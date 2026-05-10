#!/usr/bin/env python3
"""
Comprehensive test suite for reservation time validation with 30-min lead time.
Tests the new same-day future-only slot filtering logic.
"""

import requests
import json
from datetime import datetime, timedelta
import sys

BASE_URL = "http://localhost:3000/api"
ADMIN_TOKEN = "admin123"

def log_test(test_num, description, passed, details=""):
    """Log test results with clear formatting"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\nTest {test_num}: {description}")
    print(f"Status: {status}")
    if details:
        print(f"Details: {details}")
    return passed

def parse_date_time(date_str, time_str):
    """Parse date and time strings into datetime object"""
    return datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")

def add_days(date_str, days):
    """Add days to a date string (YYYY-MM-DD)"""
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    new_dt = dt + timedelta(days=days)
    return new_dt.strftime("%Y-%m-%d")

def time_to_minutes(time_str):
    """Convert HH:MM to minutes since midnight"""
    h, m = map(int, time_str.split(':'))
    return h * 60 + m

def minutes_to_time(minutes):
    """Convert minutes since midnight to HH:MM"""
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"

def round_to_next_slot(minutes):
    """Round up to next 30-minute slot"""
    if minutes % 30 == 0:
        return minutes
    return ((minutes // 30) + 1) * 30

def main():
    print("=" * 80)
    print("RESERVATION TIME VALIDATION TEST SUITE")
    print("Testing same-day future-only slot filtering with 30-min lead time")
    print("=" * 80)
    
    results = []
    
    # ========================================================================
    # TEST 1: server_now block verification
    # ========================================================================
    try:
        # Use a future date to get server_now
        future_date = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
        response = requests.get(f"{BASE_URL}/reservations/availability?date={future_date}")
        
        if response.status_code == 200:
            data = response.json()
            server_now = data.get('server_now', {})
            
            has_date = 'date' in server_now and server_now['date']
            has_time = 'time' in server_now and server_now['time']
            has_timezone = server_now.get('timezone') == 'Europe/Vilnius'
            has_lead_time = server_now.get('lead_time_minutes') == 30
            
            passed = has_date and has_time and has_timezone and has_lead_time
            details = f"server_now: {json.dumps(server_now, indent=2)}"
            results.append(log_test(1, "server_now block verification", passed, details))
            
            # Store server_now for subsequent tests
            SERVER_DATE = server_now['date']
            SERVER_TIME = server_now['time']
            SERVER_MINUTES = time_to_minutes(SERVER_TIME)
            
            print(f"\n📍 Restaurant now: {SERVER_DATE} {SERVER_TIME} (Europe/Vilnius)")
            print(f"   Minutes since midnight: {SERVER_MINUTES}")
        else:
            results.append(log_test(1, "server_now block verification", False, 
                                   f"HTTP {response.status_code}: {response.text}"))
            print("\n❌ Cannot continue without server_now. Exiting.")
            sys.exit(1)
    except Exception as e:
        results.append(log_test(1, "server_now block verification", False, str(e)))
        print(f"\n❌ Exception: {e}")
        sys.exit(1)
    
    # ========================================================================
    # TEST 2: Future date returns full slot grid (21 slots)
    # ========================================================================
    try:
        future_date = add_days(SERVER_DATE, 3)
        response = requests.get(f"{BASE_URL}/reservations/availability?date={future_date}")
        
        if response.status_code == 200:
            data = response.json()
            slots = data.get('slots', [])
            
            # Should have exactly 21 slots (12:00 to 22:00 in 30-min steps)
            has_21_slots = len(slots) == 21
            has_12_00 = any(s['time'] == '12:00' for s in slots)
            no_22_30 = not any(s['time'] == '22:30' for s in slots)
            has_22_00 = any(s['time'] == '22:00' for s in slots)
            
            passed = has_21_slots and has_12_00 and no_22_30 and has_22_00
            details = f"Slots count: {len(slots)}, First: {slots[0]['time'] if slots else 'N/A'}, Last: {slots[-1]['time'] if slots else 'N/A'}"
            results.append(log_test(2, "Future date returns full slot grid (21 slots)", passed, details))
        else:
            results.append(log_test(2, "Future date returns full slot grid", False, 
                                   f"HTTP {response.status_code}"))
    except Exception as e:
        results.append(log_test(2, "Future date returns full slot grid", False, str(e)))
    
    # ========================================================================
    # TEST 3: Past date returns empty slots
    # ========================================================================
    try:
        past_date = add_days(SERVER_DATE, -3)
        response = requests.get(f"{BASE_URL}/reservations/availability?date={past_date}")
        
        if response.status_code == 200:
            data = response.json()
            slots = data.get('slots', [])
            
            passed = len(slots) == 0
            details = f"Slots count: {len(slots)}"
            results.append(log_test(3, "Past date returns empty slots", passed, details))
        else:
            results.append(log_test(3, "Past date returns empty slots", False, 
                                   f"HTTP {response.status_code}"))
    except Exception as e:
        results.append(log_test(3, "Past date returns empty slots", False, str(e)))
    
    # ========================================================================
    # TEST 4: Today (lead-time filtering)
    # ========================================================================
    try:
        response = requests.get(f"{BASE_URL}/reservations/availability?date={SERVER_DATE}")
        
        if response.status_code == 200:
            data = response.json()
            slots = data.get('slots', [])
            
            # Calculate expected earliest slot
            min_slot_minutes = SERVER_MINUTES + 30
            
            # Find first slot >= min_slot_minutes and within 12:00-22:00
            expected_earliest = None
            for h in range(12, 23):
                for m in [0, 30]:
                    if h == 22 and m == 30:
                        continue
                    slot_minutes = h * 60 + m
                    if slot_minutes >= min_slot_minutes:
                        expected_earliest = f"{h:02d}:{m:02d}"
                        break
                if expected_earliest:
                    break
            
            if expected_earliest is None:
                # All slots are in the past
                passed = len(slots) == 0
                details = f"All slots in past. min_slot_minutes={min_slot_minutes} (after 22:00). Slots: {len(slots)}"
            else:
                # Check first slot matches expected
                if len(slots) > 0:
                    first_slot = slots[0]['time']
                    matches_expected = first_slot == expected_earliest
                    
                    # Verify no slot has minutes < min_slot_minutes
                    no_past_slots = all(time_to_minutes(s['time']) >= min_slot_minutes for s in slots)
                    
                    passed = matches_expected and no_past_slots
                    details = f"Expected earliest: {expected_earliest}, Got: {first_slot}, No past slots: {no_past_slots}, Total slots: {len(slots)}"
                else:
                    # Empty is valid if min_slot_minutes > 22:00
                    passed = min_slot_minutes > 22 * 60
                    details = f"Empty slots. min_slot_minutes={min_slot_minutes}, expected_earliest={expected_earliest}"
            
            results.append(log_test(4, "Today (lead-time filtering)", passed, details))
        else:
            results.append(log_test(4, "Today (lead-time filtering)", False, 
                                   f"HTTP {response.status_code}"))
    except Exception as e:
        results.append(log_test(4, "Today (lead-time filtering)", False, str(e)))
    
    # ========================================================================
    # TEST 5: POST validation - past date
    # ========================================================================
    try:
        past_date = add_days(SERVER_DATE, -1)
        payload = {
            "name": "Test User",
            "phone": "+370600",
            "date": past_date,
            "time": "19:00",
            "guests": 2
        }
        response = requests.post(f"{BASE_URL}/reservations", json=payload)
        
        is_400 = response.status_code == 400
        if is_400:
            error_data = response.json()
            correct_error = error_data.get('error') == "Please select a valid future reservation time."
            passed = correct_error
            details = f"HTTP {response.status_code}, Error: {error_data.get('error')}"
        else:
            passed = False
            details = f"Expected 400, got {response.status_code}"
        
        results.append(log_test(5, "POST validation - past date", passed, details))
    except Exception as e:
        results.append(log_test(5, "POST validation - past date", False, str(e)))
    
    # ========================================================================
    # TEST 6: POST validation - today inside lead buffer
    # ========================================================================
    try:
        # Try to book a time that's within the next 30 minutes
        # Use a time that's 5 minutes from now (should be rejected)
        target_minutes = SERVER_MINUTES + 5
        
        # Round down to 30-min grid
        if target_minutes % 30 != 0:
            target_minutes = (target_minutes // 30) * 30
        
        # If this rounds to current or past slot, use current time
        if target_minutes <= SERVER_MINUTES:
            target_minutes = SERVER_MINUTES
        
        target_time = minutes_to_time(target_minutes)
        
        payload = {
            "name": "Test User",
            "phone": "+370600",
            "date": SERVER_DATE,
            "time": target_time,
            "guests": 2
        }
        response = requests.post(f"{BASE_URL}/reservations", json=payload)
        
        is_400 = response.status_code == 400
        if is_400:
            error_data = response.json()
            correct_error = error_data.get('error') == "Please select a valid future reservation time."
            passed = correct_error
            details = f"HTTP {response.status_code}, Time: {target_time}, Error: {error_data.get('error')}"
        else:
            passed = False
            details = f"Expected 400, got {response.status_code}. Time: {target_time}"
        
        results.append(log_test(6, "POST validation - today inside lead buffer", passed, details))
    except Exception as e:
        results.append(log_test(6, "POST validation - today inside lead buffer", False, str(e)))
    
    # ========================================================================
    # TEST 7: POST validation - today, well in the past
    # ========================================================================
    try:
        payload = {
            "name": "Test User",
            "phone": "+370600",
            "date": SERVER_DATE,
            "time": "06:00",
            "guests": 2
        }
        response = requests.post(f"{BASE_URL}/reservations", json=payload)
        
        is_400 = response.status_code == 400
        if is_400:
            error_data = response.json()
            correct_error = error_data.get('error') == "Please select a valid future reservation time."
            passed = correct_error
            details = f"HTTP {response.status_code}, Error: {error_data.get('error')}"
        else:
            passed = False
            details = f"Expected 400, got {response.status_code}"
        
        results.append(log_test(7, "POST validation - today, well in the past", passed, details))
    except Exception as e:
        results.append(log_test(7, "POST validation - today, well in the past", False, str(e)))
    
    # ========================================================================
    # TEST 8: POST validation - valid future date
    # ========================================================================
    created_ids = []
    try:
        future_date = add_days(SERVER_DATE, 3)
        payload = {
            "name": "VTest",
            "phone": "+370600",
            "date": future_date,
            "time": "19:00",
            "guests": 2
        }
        response = requests.post(f"{BASE_URL}/reservations", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            has_id = 'id' in data
            has_code = 'reservation_code' in data and data['reservation_code'].startswith('RSV-')
            passed = has_id and has_code
            details = f"HTTP {response.status_code}, ID: {data.get('id')}, Code: {data.get('reservation_code')}"
            if has_id:
                created_ids.append(data['id'])
        else:
            passed = False
            details = f"Expected 200, got {response.status_code}: {response.text}"
        
        results.append(log_test(8, "POST validation - valid future date", passed, details))
    except Exception as e:
        results.append(log_test(8, "POST validation - valid future date", False, str(e)))
    
    # ========================================================================
    # TEST 9: POST validation - valid today (if any slot remains)
    # ========================================================================
    try:
        # Get today's availability first
        response = requests.get(f"{BASE_URL}/reservations/availability?date={SERVER_DATE}")
        
        if response.status_code == 200:
            data = response.json()
            slots = data.get('slots', [])
            
            if len(slots) > 0:
                # Use first available slot
                first_slot = slots[0]['time']
                payload = {
                    "name": "VTest Today",
                    "phone": "+370601",
                    "date": SERVER_DATE,
                    "time": first_slot,
                    "guests": 2
                }
                response = requests.post(f"{BASE_URL}/reservations", json=payload)
                
                if response.status_code == 200:
                    data = response.json()
                    has_id = 'id' in data
                    has_code = 'reservation_code' in data and data['reservation_code'].startswith('RSV-')
                    passed = has_id and has_code
                    details = f"HTTP {response.status_code}, Time: {first_slot}, ID: {data.get('id')}"
                    if has_id:
                        created_ids.append(data['id'])
                else:
                    passed = False
                    details = f"Expected 200, got {response.status_code}: {response.text}"
            else:
                passed = True
                details = "No slots available today (expected - all in past)"
            
            results.append(log_test(9, "POST validation - valid today (if any slot remains)", passed, details))
        else:
            results.append(log_test(9, "POST validation - valid today", False, 
                                   f"Failed to get availability: HTTP {response.status_code}"))
    except Exception as e:
        results.append(log_test(9, "POST validation - valid today", False, str(e)))
    
    # ========================================================================
    # TEST 10: Required-fields regression
    # ========================================================================
    try:
        future_date = add_days(SERVER_DATE, 3)
        # Missing name
        payload = {
            "phone": "+370600",
            "date": future_date,
            "time": "19:00",
            "guests": 2
        }
        response = requests.post(f"{BASE_URL}/reservations", json=payload)
        
        is_400 = response.status_code == 400
        if is_400:
            error_data = response.json()
            correct_error = "required" in error_data.get('error', '').lower()
            passed = correct_error
            details = f"HTTP {response.status_code}, Error: {error_data.get('error')}"
        else:
            passed = False
            details = f"Expected 400, got {response.status_code}"
        
        results.append(log_test(10, "Required-fields regression", passed, details))
    except Exception as e:
        results.append(log_test(10, "Required-fields regression", False, str(e)))
    
    # ========================================================================
    # TEST 11: Capacity regression (optional - simplified)
    # ========================================================================
    try:
        # Get total tables count
        future_date = add_days(SERVER_DATE, 4)
        response = requests.get(f"{BASE_URL}/reservations/availability?date={future_date}")
        
        if response.status_code == 200:
            data = response.json()
            total_tables = data.get('total_tables', 0)
            
            # Try to create one reservation and verify capacity decreases
            payload = {
                "name": "Capacity Test",
                "phone": "+370602",
                "date": future_date,
                "time": "18:00",
                "guests": 2
            }
            response = requests.post(f"{BASE_URL}/reservations", json=payload)
            
            if response.status_code == 200:
                res_data = response.json()
                created_ids.append(res_data['id'])
                
                # Check availability again
                response = requests.get(f"{BASE_URL}/reservations/availability?date={future_date}")
                if response.status_code == 200:
                    data = response.json()
                    slots = data.get('slots', [])
                    slot_18 = next((s for s in slots if s['time'] == '18:00'), None)
                    
                    if slot_18:
                        available = slot_18['available']
                        passed = available == total_tables - 1
                        details = f"Total tables: {total_tables}, Available at 18:00: {available}"
                    else:
                        passed = False
                        details = "18:00 slot not found"
                else:
                    passed = False
                    details = f"Failed to get availability: HTTP {response.status_code}"
            else:
                passed = False
                details = f"Failed to create reservation: HTTP {response.status_code}"
        else:
            passed = False
            details = f"Failed to get availability: HTTP {response.status_code}"
        
        results.append(log_test(11, "Capacity regression", passed, details))
    except Exception as e:
        results.append(log_test(11, "Capacity regression", False, str(e)))
    
    # ========================================================================
    # CLEANUP: Cancel created reservations
    # ========================================================================
    print("\n" + "=" * 80)
    print("CLEANUP: Cancelling test reservations")
    print("=" * 80)
    
    for res_id in created_ids:
        try:
            response = requests.put(
                f"{BASE_URL}/reservations/{res_id}",
                json={"status": "cancelled"},
                headers={"x-admin-token": ADMIN_TOKEN}
            )
            if response.status_code == 200:
                print(f"✅ Cancelled reservation {res_id}")
            else:
                print(f"⚠️  Failed to cancel {res_id}: HTTP {response.status_code}")
        except Exception as e:
            print(f"⚠️  Exception cancelling {res_id}: {e}")
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed_count = sum(1 for r in results if r)
    total_count = len(results)
    success_rate = (passed_count / total_count * 100) if total_count > 0 else 0
    
    print(f"\nTotal Tests: {total_count}")
    print(f"Passed: {passed_count}")
    print(f"Failed: {total_count - passed_count}")
    print(f"Success Rate: {success_rate:.1f}%")
    
    if passed_count == total_count:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {total_count - passed_count} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
