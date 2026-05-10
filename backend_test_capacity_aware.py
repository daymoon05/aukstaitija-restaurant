#!/usr/bin/env python3
"""
Comprehensive test suite for capacity-aware reservation slot availability with 90-min overlap detection.

Tests the new capacity-aware logic that:
- Matches guest count to table capacity (smaller parties may take larger tables)
- Treats each reservation as a 90-minute window
- Hides slots only when no suitable table remains
- Prevents overbooking and false availability
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:3000/api"
ADMIN_TOKEN = "admin123"

# Use a date 7 days in the future to avoid lead-time flakiness
FUTURE_DATE = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")

# Track created reservations for cleanup
created_reservations = []

def cleanup_reservations():
    """Cancel all test reservations at the end"""
    print("\n" + "="*80)
    print("CLEANUP: Cancelling all test reservations...")
    print("="*80)
    for res_id in created_reservations:
        try:
            response = requests.put(
                f"{BASE_URL}/reservations/{res_id}",
                headers={"x-admin-token": ADMIN_TOKEN},
                json={"status": "cancelled"}
            )
            if response.status_code == 200:
                print(f"✅ Cancelled reservation {res_id}")
            else:
                print(f"⚠️  Failed to cancel {res_id}: {response.status_code}")
        except Exception as e:
            print(f"❌ Error cancelling {res_id}: {e}")

def test_a_default_guests():
    """A. Default guests when missing → guests=2 echoed in response"""
    print("\n" + "="*80)
    print("TEST A: Default guests when missing")
    print("="*80)
    
    try:
        # GET /availability without guests parameter
        response = requests.get(f"{BASE_URL}/reservations/availability?date={FUTURE_DATE}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "guests" in data, "Response missing 'guests' field"
        assert data["guests"] == 2, f"Expected guests=2, got {data['guests']}"
        assert "slots" in data, "Response missing 'slots' field"
        assert len(data["slots"]) == 21, f"Expected 21 slots (12:00-22:00), got {len(data['slots'])}"
        
        print(f"✅ PASS: Default guests=2 echoed in response")
        print(f"   Slots returned: {len(data['slots'])}")
        return True
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def test_b_clean_baseline():
    """B. Clean baseline by capacity: guests=2/4/8/10"""
    print("\n" + "="*80)
    print("TEST B: Clean baseline by capacity")
    print("="*80)
    
    results = []
    
    # Test guests=2 → 21 slots, available=10, total=10
    try:
        response = requests.get(f"{BASE_URL}/reservations/availability?date={FUTURE_DATE}&guests=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["slots"]) == 21, f"guests=2: Expected 21 slots, got {len(data['slots'])}"
        
        # Check first slot
        first_slot = data["slots"][0]
        assert first_slot["available"] == 10, f"guests=2: Expected available=10, got {first_slot['available']}"
        assert first_slot["total"] == 10, f"guests=2: Expected total=10, got {first_slot['total']}"
        
        print(f"✅ PASS: guests=2 → 21 slots, available=10, total=10")
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL guests=2: {e}")
        results.append(False)
    except Exception as e:
        print(f"❌ ERROR guests=2: {e}")
        results.append(False)
    
    # Test guests=4 → 21 slots, available=8 (4×cap4 + 2×cap8), total=8
    try:
        response = requests.get(f"{BASE_URL}/reservations/availability?date={FUTURE_DATE}&guests=4")
        assert response.status_code == 200
        data = response.json()
        assert len(data["slots"]) == 21, f"guests=4: Expected 21 slots, got {len(data['slots'])}"
        
        first_slot = data["slots"][0]
        # 4 tables with capacity 4 + 2 tables with capacity 8 = 6 tables total
        assert first_slot["available"] == 6, f"guests=4: Expected available=6, got {first_slot['available']}"
        assert first_slot["total"] == 6, f"guests=4: Expected total=6, got {first_slot['total']}"
        
        print(f"✅ PASS: guests=4 → 21 slots, available=6, total=6")
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL guests=4: {e}")
        results.append(False)
    except Exception as e:
        print(f"❌ ERROR guests=4: {e}")
        results.append(False)
    
    # Test guests=8 → 21 slots, available=2, total=2
    try:
        response = requests.get(f"{BASE_URL}/reservations/availability?date={FUTURE_DATE}&guests=8")
        assert response.status_code == 200
        data = response.json()
        assert len(data["slots"]) == 21, f"guests=8: Expected 21 slots, got {len(data['slots'])}"
        
        first_slot = data["slots"][0]
        assert first_slot["available"] == 2, f"guests=8: Expected available=2, got {first_slot['available']}"
        assert first_slot["total"] == 2, f"guests=8: Expected total=2, got {first_slot['total']}"
        
        print(f"✅ PASS: guests=8 → 21 slots, available=2, total=2")
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL guests=8: {e}")
        results.append(False)
    except Exception as e:
        print(f"❌ ERROR guests=8: {e}")
        results.append(False)
    
    # Test guests=10 → either empty slots or all slots filtered out
    try:
        response = requests.get(f"{BASE_URL}/reservations/availability?date={FUTURE_DATE}&guests=10")
        assert response.status_code == 200
        data = response.json()
        # No table fits 10 guests (max capacity is 8)
        assert len(data["slots"]) == 0, f"guests=10: Expected 0 slots (no table fits), got {len(data['slots'])}"
        
        print(f"✅ PASS: guests=10 → 0 slots (no table fits)")
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL guests=10: {e}")
        results.append(False)
    except Exception as e:
        print(f"❌ ERROR guests=10: {e}")
        results.append(False)
    
    return all(results)

def test_c_overlap_window():
    """C. Overlap window verification (cap-8)"""
    print("\n" + "="*80)
    print("TEST C: Overlap window verification with cap-8 tables")
    print("="*80)
    
    results = []
    
    # 1) Create reservation R1 at 19:30 with guests=8
    try:
        response = requests.post(
            f"{BASE_URL}/reservations",
            json={
                "name": "Big1",
                "phone": "+370600",
                "date": FUTURE_DATE,
                "time": "19:30",
                "guests": 8
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        r1 = response.json()
        id1 = r1["id"]
        created_reservations.append(id1)
        print(f"✅ Created R1: {id1} at 19:30 guests=8")
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL creating R1: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR creating R1: {e}")
        return False
    
    # 2) Assign table t10 to R1
    try:
        response = requests.put(
            f"{BASE_URL}/reservations/{id1}",
            headers={"x-admin-token": ADMIN_TOKEN},
            json={"table_id": "t10"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✅ Assigned table t10 to R1")
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL assigning t10: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR assigning t10: {e}")
        return False
    
    # 3) Check availability for guests=8
    # R1 is at 19:30, duration 90 min → ends at 21:00
    # Overlap: rEnd > slotMin && rStart < slotEnd
    # 18:00 slot: slotMin=18:00 (1080), slotEnd=19:30 (1170)
    #   rEnd=21:00 (1260) > 1080 ✓, rStart=19:30 (1170) < 1170 ✗ → NO overlap
    # 18:30 slot: slotMin=18:30 (1110), slotEnd=20:00 (1200)
    #   rEnd=21:00 (1260) > 1110 ✓, rStart=19:30 (1170) < 1200 ✓ → OVERLAP
    # 19:00, 19:30, 20:00, 20:30 → all overlap
    # 21:00 slot: slotMin=21:00 (1260), slotEnd=22:30 (1350)
    #   rEnd=21:00 (1260) > 1260 ✗ → NO overlap (back-to-back OK)
    try:
        response = requests.get(f"{BASE_URL}/reservations/availability?date={FUTURE_DATE}&guests=8")
        assert response.status_code == 200
        data = response.json()
        slots = {s["time"]: s for s in data["slots"]}
        
        # 18:00 should have available=2 (both t9 and t10 free)
        assert "18:00" in slots, "18:00 slot missing"
        assert slots["18:00"]["available"] == 2, f"18:00: Expected available=2, got {slots['18:00']['available']}"
        print(f"✅ 18:00 slot: available=2 (no overlap)")
        
        # 18:30 should have available=1 (t10 blocked, t9 free)
        assert "18:30" in slots, "18:30 slot missing"
        assert slots["18:30"]["available"] == 1, f"18:30: Expected available=1, got {slots['18:30']['available']}"
        print(f"✅ 18:30 slot: available=1 (t10 blocked)")
        
        # 19:00, 19:30, 20:00, 20:30 should all have available=1
        for time in ["19:00", "19:30", "20:00", "20:30"]:
            assert time in slots, f"{time} slot missing"
            assert slots[time]["available"] == 1, f"{time}: Expected available=1, got {slots[time]['available']}"
        print(f"✅ 19:00-20:30 slots: available=1 (t10 blocked)")
        
        # 21:00 should have available=2 (back-to-back OK)
        assert "21:00" in slots, "21:00 slot missing"
        assert slots["21:00"]["available"] == 2, f"21:00: Expected available=2, got {slots['21:00']['available']}"
        print(f"✅ 21:00 slot: available=2 (back-to-back OK)")
        
        # 21:30+ should have available=2
        assert "21:30" in slots, "21:30 slot missing"
        assert slots["21:30"]["available"] == 2, f"21:30: Expected available=2, got {slots['21:30']['available']}"
        print(f"✅ 21:30 slot: available=2")
        
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL checking availability after R1: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR checking availability after R1: {e}")
        return False
    
    # 4) Create R2 at 20:00 guests=8 assigned to t9
    try:
        response = requests.post(
            f"{BASE_URL}/reservations",
            json={
                "name": "Big2",
                "phone": "+370601",
                "date": FUTURE_DATE,
                "time": "20:00",
                "guests": 8
            }
        )
        assert response.status_code == 200
        r2 = response.json()
        id2 = r2["id"]
        created_reservations.append(id2)
        print(f"✅ Created R2: {id2} at 20:00 guests=8")
        
        # Assign t9
        response = requests.put(
            f"{BASE_URL}/reservations/{id2}",
            headers={"x-admin-token": ADMIN_TOKEN},
            json={"table_id": "t9"}
        )
        assert response.status_code == 200
        print(f"✅ Assigned table t9 to R2")
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL creating/assigning R2: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR creating/assigning R2: {e}")
        return False
    
    # 5) Check availability for guests=8 with both R1 and R2
    # R2 is at 20:00, ends at 21:30
    # 18:30: R1 blocks t10, R2 doesn't overlap (rStart=20:00 >= slotEnd=20:00) → available=1
    # 19:00, 19:30, 20:00, 20:30: both blocked → available=0 (slots hidden)
    # 21:00: R1 ends at 21:00 (no overlap), R2 still occupies t9 → available=1
    # 21:30: both free → available=2
    try:
        response = requests.get(f"{BASE_URL}/reservations/availability?date={FUTURE_DATE}&guests=8")
        assert response.status_code == 200
        data = response.json()
        slots = {s["time"]: s for s in data["slots"]}
        
        # 18:30 should have available=1 (only t10 blocked by R1)
        assert "18:30" in slots, "18:30 slot missing"
        assert slots["18:30"]["available"] == 1, f"18:30: Expected available=1, got {slots['18:30']['available']}"
        print(f"✅ 18:30 slot: available=1 (only R1 blocks t10)")
        
        # 19:00, 19:30, 20:00, 20:30 should be hidden (available=0)
        for time in ["19:00", "19:30", "20:00", "20:30"]:
            assert time not in slots, f"{time} slot should be hidden but is present"
        print(f"✅ 19:00-20:30 slots: hidden (both tables blocked)")
        
        # 21:00 should have available=1 (R2 still occupies t9)
        assert "21:00" in slots, "21:00 slot missing"
        assert slots["21:00"]["available"] == 1, f"21:00: Expected available=1, got {slots['21:00']['available']}"
        print(f"✅ 21:00 slot: available=1 (R2 still blocks t9)")
        
        # 21:30 should have available=2
        assert "21:30" in slots, "21:30 slot missing"
        assert slots["21:30"]["available"] == 2, f"21:30: Expected available=2, got {slots['21:30']['available']}"
        print(f"✅ 21:30 slot: available=2 (both free)")
        
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL checking availability with R1+R2: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR checking availability with R1+R2: {e}")
        return False
    
    # 6) Check guests=2 with same blockers → all 21 slots, 20:00 shows available=8
    try:
        response = requests.get(f"{BASE_URL}/reservations/availability?date={FUTURE_DATE}&guests=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["slots"]) == 21, f"guests=2: Expected 21 slots, got {len(data['slots'])}"
        
        slots = {s["time"]: s for s in data["slots"]}
        # At 20:00, 2 cap-8 tables are occupied, so 10 - 2 = 8 available
        assert "20:00" in slots, "20:00 slot missing for guests=2"
        assert slots["20:00"]["available"] == 8, f"20:00 guests=2: Expected available=8, got {slots['20:00']['available']}"
        print(f"✅ guests=2: all 21 slots present, 20:00 shows available=8")
        
        # 18:00 should show available=10 (no blockers)
        assert "18:00" in slots, "18:00 slot missing for guests=2"
        assert slots["18:00"]["available"] == 10, f"18:00 guests=2: Expected available=10, got {slots['18:00']['available']}"
        print(f"✅ guests=2: 18:00 shows available=10")
        
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL checking guests=2 with blockers: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR checking guests=2 with blockers: {e}")
        return False
    
    return all(results)

def test_d_cancelled_release():
    """D. Cancelled / no_show release capacity"""
    print("\n" + "="*80)
    print("TEST D: Cancelled/no_show release capacity")
    print("="*80)
    
    # Find R1 from previous test (should be first in created_reservations)
    if len(created_reservations) < 1:
        print("⚠️  SKIP: No reservations from previous test")
        return True
    
    id1 = created_reservations[0]
    
    try:
        # Cancel R1
        response = requests.put(
            f"{BASE_URL}/reservations/{id1}",
            headers={"x-admin-token": ADMIN_TOKEN},
            json={"status": "cancelled"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✅ Cancelled R1: {id1}")
        
        # Check availability for guests=8 → only R2 still blocks t9
        response = requests.get(f"{BASE_URL}/reservations/availability?date={FUTURE_DATE}&guests=8")
        assert response.status_code == 200
        data = response.json()
        slots = {s["time"]: s for s in data["slots"]}
        
        # 18:30 should now have available=2 (R1 cancelled, t10 free)
        assert "18:30" in slots, "18:30 slot missing"
        assert slots["18:30"]["available"] == 2, f"18:30: Expected available=2, got {slots['18:30']['available']}"
        print(f"✅ 18:30 slot: available=2 (R1 cancelled, t10 released)")
        
        # 19:00, 19:30 should now have available=1 (only R2 blocks t9)
        for time in ["19:00", "19:30"]:
            assert time in slots, f"{time} slot missing"
            assert slots[time]["available"] == 1, f"{time}: Expected available=1, got {slots[time]['available']}"
        print(f"✅ 19:00-19:30 slots: available=1 (only R2 blocks)")
        
        return True
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def test_e_unassigned_greedy():
    """E. Unassigned greedy capacity"""
    print("\n" + "="*80)
    print("TEST E: Unassigned greedy capacity")
    print("="*80)
    
    results = []
    
    # Create R3 at 14:00 guests=2, DO NOT assign table
    try:
        response = requests.post(
            f"{BASE_URL}/reservations",
            json={
                "name": "Pend1",
                "phone": "+370602",
                "date": FUTURE_DATE,
                "time": "14:00",
                "guests": 2
            }
        )
        assert response.status_code == 200
        r3 = response.json()
        id3 = r3["id"]
        created_reservations.append(id3)
        assert r3["status"] == "pending", f"Expected status=pending, got {r3['status']}"
        assert r3["table_id"] is None, f"Expected table_id=null, got {r3['table_id']}"
        print(f"✅ Created R3: {id3} at 14:00 guests=2 (unassigned)")
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL creating R3: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR creating R3: {e}")
        return False
    
    # Check availability for guests=2 at 14:00 → should be 9 (one cap-2 consumed greedily)
    try:
        response = requests.get(f"{BASE_URL}/reservations/availability?date={FUTURE_DATE}&guests=2")
        assert response.status_code == 200
        data = response.json()
        slots = {s["time"]: s for s in data["slots"]}
        
        assert "14:00" in slots, "14:00 slot missing"
        assert slots["14:00"]["available"] == 9, f"14:00 guests=2: Expected available=9, got {slots['14:00']['available']}"
        print(f"✅ 14:00 guests=2: available=9 (one cap-2 consumed greedily)")
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL checking guests=2 at 14:00: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR checking guests=2 at 14:00: {e}")
        return False
    
    # Check availability for guests=4 at 14:00 → should still be 6 (greedy picked cap-2)
    try:
        response = requests.get(f"{BASE_URL}/reservations/availability?date={FUTURE_DATE}&guests=4")
        assert response.status_code == 200
        data = response.json()
        slots = {s["time"]: s for s in data["slots"]}
        
        assert "14:00" in slots, "14:00 slot missing for guests=4"
        assert slots["14:00"]["available"] == 6, f"14:00 guests=4: Expected available=6, got {slots['14:00']['available']}"
        print(f"✅ 14:00 guests=4: available=6 (cap-4+ untouched)")
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL checking guests=4 at 14:00: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR checking guests=4 at 14:00: {e}")
        return False
    
    # Check availability for guests=8 at 14:00 → should still be 2
    try:
        response = requests.get(f"{BASE_URL}/reservations/availability?date={FUTURE_DATE}&guests=8")
        assert response.status_code == 200
        data = response.json()
        slots = {s["time"]: s for s in data["slots"]}
        
        assert "14:00" in slots, "14:00 slot missing for guests=8"
        assert slots["14:00"]["available"] == 2, f"14:00 guests=8: Expected available=2, got {slots['14:00']['available']}"
        print(f"✅ 14:00 guests=8: available=2 (cap-8 untouched)")
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL checking guests=8 at 14:00: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR checking guests=8 at 14:00: {e}")
        return False
    
    # Create R4 at 14:00 guests=8 (unassigned)
    try:
        response = requests.post(
            f"{BASE_URL}/reservations",
            json={
                "name": "Pend2",
                "phone": "+370603",
                "date": FUTURE_DATE,
                "time": "14:00",
                "guests": 8
            }
        )
        assert response.status_code == 200
        r4 = response.json()
        id4 = r4["id"]
        created_reservations.append(id4)
        print(f"✅ Created R4: {id4} at 14:00 guests=8 (unassigned)")
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL creating R4: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR creating R4: {e}")
        return False
    
    # Check availability for guests=8 at 14:00 → should drop from 2 to 1
    try:
        response = requests.get(f"{BASE_URL}/reservations/availability?date={FUTURE_DATE}&guests=8")
        assert response.status_code == 200
        data = response.json()
        slots = {s["time"]: s for s in data["slots"]}
        
        assert "14:00" in slots, "14:00 slot missing for guests=8 after R4"
        assert slots["14:00"]["available"] == 1, f"14:00 guests=8: Expected available=1, got {slots['14:00']['available']}"
        print(f"✅ 14:00 guests=8: available=1 (greedy claimed one cap-8)")
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL checking guests=8 at 14:00 after R4: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR checking guests=8 at 14:00 after R4: {e}")
        return False
    
    # Check availability for guests=4 at 14:00 → should still be 6
    try:
        response = requests.get(f"{BASE_URL}/reservations/availability?date={FUTURE_DATE}&guests=4")
        assert response.status_code == 200
        data = response.json()
        slots = {s["time"]: s for s in data["slots"]}
        
        assert "14:00" in slots, "14:00 slot missing for guests=4 after R4"
        assert slots["14:00"]["available"] == 6, f"14:00 guests=4: Expected available=6, got {slots['14:00']['available']}"
        print(f"✅ 14:00 guests=4: available=6 (cap-4 pool untouched)")
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL checking guests=4 at 14:00 after R4: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR checking guests=4 at 14:00 after R4: {e}")
        return False
    
    return all(results)

def test_f_post_capacity_gate():
    """F. POST capacity gate"""
    print("\n" + "="*80)
    print("TEST F: POST capacity gate")
    print("="*80)
    
    results = []
    
    # With R4 already pending at 14:00 (consumes one cap-8), one more 8-top should succeed
    try:
        response = requests.post(
            f"{BASE_URL}/reservations",
            json={
                "name": "Big3",
                "phone": "+370604",
                "date": FUTURE_DATE,
                "time": "14:00",
                "guests": 8
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        r5 = response.json()
        id5 = r5["id"]
        created_reservations.append(id5)
        print(f"✅ Second 8-top at 14:00 succeeded: {id5}")
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL second 8-top: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR second 8-top: {e}")
        return False
    
    # Third 8-top should fail with 409
    try:
        response = requests.post(
            f"{BASE_URL}/reservations",
            json={
                "name": "Big4",
                "phone": "+370605",
                "date": FUTURE_DATE,
                "time": "14:00",
                "guests": 8
            }
        )
        assert response.status_code == 409, f"Expected 409, got {response.status_code}"
        data = response.json()
        assert "error" in data, "Response missing 'error' field"
        assert "fully booked" in data["error"].lower(), f"Expected 'fully booked' error, got {data['error']}"
        print(f"✅ Third 8-top at 14:00 rejected with 409: {data['error']}")
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL third 8-top: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR third 8-top: {e}")
        return False
    
    # POST a 4-top at 14:00 → should succeed (cap-4 pool untouched)
    try:
        response = requests.post(
            f"{BASE_URL}/reservations",
            json={
                "name": "Mid1",
                "phone": "+370606",
                "date": FUTURE_DATE,
                "time": "14:00",
                "guests": 4
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        r6 = response.json()
        id6 = r6["id"]
        created_reservations.append(id6)
        print(f"✅ 4-top at 14:00 succeeded: {id6}")
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL 4-top: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR 4-top: {e}")
        return False
    
    return all(results)

def test_g_past_leadtime_rejection():
    """G. Past/lead-time rejection still works"""
    print("\n" + "="*80)
    print("TEST G: Past/lead-time rejection")
    print("="*80)
    
    results = []
    
    # POST date=yesterday → 400
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    try:
        response = requests.post(
            f"{BASE_URL}/reservations",
            json={
                "name": "Past1",
                "phone": "+370607",
                "date": yesterday,
                "time": "19:00",
                "guests": 2
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "error" in data, "Response missing 'error' field"
        assert "valid future reservation time" in data["error"].lower(), f"Expected 'valid future reservation time' error, got {data['error']}"
        print(f"✅ Past date rejected with 400: {data['error']}")
        results.append(True)
    except AssertionError as e:
        print(f"❌ FAIL past date: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR past date: {e}")
        return False
    
    return all(results)

def test_h_server_now_block():
    """H. Server_now block intact"""
    print("\n" + "="*80)
    print("TEST H: Server_now block")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/reservations/availability?date={FUTURE_DATE}&guests=2")
        assert response.status_code == 200
        data = response.json()
        
        assert "server_now" in data, "Response missing 'server_now' field"
        server_now = data["server_now"]
        
        assert "date" in server_now, "server_now missing 'date' field"
        assert "time" in server_now, "server_now missing 'time' field"
        assert "timezone" in server_now, "server_now missing 'timezone' field"
        assert server_now["timezone"] == "Europe/Vilnius", f"Expected timezone='Europe/Vilnius', got {server_now['timezone']}"
        assert "lead_time_minutes" in server_now, "server_now missing 'lead_time_minutes' field"
        assert server_now["lead_time_minutes"] == 30, f"Expected lead_time_minutes=30, got {server_now['lead_time_minutes']}"
        assert "duration_minutes" in server_now, "server_now missing 'duration_minutes' field"
        assert server_now["duration_minutes"] == 90, f"Expected duration_minutes=90, got {server_now['duration_minutes']}"
        
        print(f"✅ server_now block present with all required fields:")
        print(f"   date: {server_now['date']}")
        print(f"   time: {server_now['time']}")
        print(f"   timezone: {server_now['timezone']}")
        print(f"   lead_time_minutes: {server_now['lead_time_minutes']}")
        print(f"   duration_minutes: {server_now['duration_minutes']}")
        
        return True
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def main():
    print("\n" + "="*80)
    print("CAPACITY-AWARE RESERVATION SLOT AVAILABILITY TEST SUITE")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Date: {FUTURE_DATE} (7 days in future)")
    print(f"Admin Token: {ADMIN_TOKEN}")
    print("="*80)
    
    results = {}
    
    # Run all tests
    results["A. Default guests"] = test_a_default_guests()
    results["B. Clean baseline"] = test_b_clean_baseline()
    results["C. Overlap window"] = test_c_overlap_window()
    results["D. Cancelled release"] = test_d_cancelled_release()
    results["E. Unassigned greedy"] = test_e_unassigned_greedy()
    results["F. POST capacity gate"] = test_f_post_capacity_gate()
    results["G. Past/lead-time rejection"] = test_g_past_leadtime_rejection()
    results["H. Server_now block"] = test_h_server_now_block()
    
    # Cleanup
    cleanup_reservations()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test}")
    
    print("="*80)
    print(f"TOTAL: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    print("="*80)
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! Capacity-aware reservation system is working correctly.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Please review the output above.")
        return 1

if __name__ == "__main__":
    exit(main())
