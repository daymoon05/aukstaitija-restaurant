#!/usr/bin/env python3
"""
Backend test suite for notification system and extended reservation lifecycle.
Tests the new table_assigned status and notification features.
"""

import requests
import time
from datetime import datetime, timedelta
from pymongo import MongoClient
import os

# Configuration
BASE_URL = "http://localhost:3000/api"
ADMIN_TOKEN = "admin123"
MONGO_URL = os.getenv("MONGO_URL", "mongodb://127.0.0.1:27017")
DB_NAME = os.getenv("DB_NAME", "aukstaitija_restaurant")

# Test results tracking
tests_passed = 0
tests_failed = 0
test_results = []

def log_test(name, passed, details=""):
    """Log test result"""
    global tests_passed, tests_failed
    if passed:
        tests_passed += 1
        print(f"✅ PASS: {name}")
        if details:
            print(f"   {details}")
    else:
        tests_failed += 1
        print(f"❌ FAIL: {name}")
        if details:
            print(f"   {details}")
    test_results.append({"name": name, "passed": passed, "details": details})

def get_future_date(days_ahead=3):
    """Get a date N days in the future in YYYY-MM-DD format"""
    future = datetime.now() + timedelta(days=days_ahead)
    return future.strftime("%Y-%m-%d")

def get_mongo_db():
    """Connect to MongoDB and return database"""
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]

print("=" * 80)
print("BACKEND TEST SUITE: Notification System & Extended Reservation Lifecycle")
print("=" * 80)
print()

# ============================================================================
# SETUP: Create test user and authenticate
# ============================================================================
print("SETUP: Creating test user and authenticating...")
session = requests.Session()
timestamp = int(time.time())
test_email = f"test_notif_{timestamp}@example.com"
test_password = "TestPass123!"
test_name = "Notification Tester"
test_phone = "+15551112222"

try:
    signup_response = session.post(
        f"{BASE_URL}/auth/signup",
        json={
            "email": test_email,
            "password": test_password,
            "name": test_name,
            "phone": test_phone
        }
    )
    
    if signup_response.status_code == 200:
        signup_data = signup_response.json()
        user_id = signup_data.get("user", {}).get("id")
        print(f"✅ User created: {test_email}")
        print(f"   User ID: {user_id}")
        log_test("User signup", True, f"Created user {test_email}")
    else:
        print(f"❌ Failed to create user: {signup_response.status_code}")
        print(f"   Response: {signup_response.text}")
        log_test("User signup", False, f"Status {signup_response.status_code}")
        exit(1)
except Exception as e:
    print(f"❌ Exception during signup: {e}")
    log_test("User signup", False, str(e))
    exit(1)

print()

# ============================================================================
# TEST 1: Create reservation as logged-in user
# ============================================================================
print("TEST 1: Create reservation with new fields...")
reservation_date = get_future_date(3)
reservation_time = "19:00"

try:
    res_response = session.post(
        f"{BASE_URL}/reservations",
        json={
            "name": test_name,
            "phone": test_phone,
            "email": test_email,
            "date": reservation_date,
            "time": reservation_time,
            "guests": 2,
            "seating_preference": "No preference",
            "occasion": "Casual",
            "notes": "Test reservation for notifications"
        }
    )
    
    if res_response.status_code == 200:
        res_data = res_response.json()
        reservation_id = res_data.get("id")
        confirmation = res_data.get("confirmation")
        status = res_data.get("status")
        table_id = res_data.get("table_id")
        
        # Verify initial state
        checks = []
        checks.append(("status is 'pending'", status == "pending"))
        checks.append(("table_id is null", table_id is None or table_id == ""))
        checks.append(("confirmation code exists", confirmation and confirmation.startswith("RES")))
        
        all_passed = all(check[1] for check in checks)
        details = ", ".join([f"{check[0]}: {'✓' if check[1] else '✗'}" for check in checks])
        
        log_test("Create reservation", all_passed, details)
        
        if all_passed:
            print(f"   Reservation ID: {reservation_id}")
            print(f"   Confirmation: {confirmation}")
    else:
        log_test("Create reservation", False, f"Status {res_response.status_code}: {res_response.text}")
        exit(1)
except Exception as e:
    log_test("Create reservation", False, str(e))
    exit(1)

print()

# ============================================================================
# TEST 2: Get available table
# ============================================================================
print("TEST 2: Get available table...")
try:
    tables_response = requests.get(
        f"{BASE_URL}/tables",
        headers={"x-admin-token": ADMIN_TOKEN}
    )
    
    if tables_response.status_code == 200:
        tables = tables_response.json()
        available_table = None
        for table in tables:
            if table.get("status") == "available" and table.get("capacity", 0) >= 2:
                available_table = table
                break
        
        if available_table:
            table_id = available_table["id"]
            table_number = available_table["number"]
            table_section = available_table.get("section", "Main Hall")
            log_test("Get available table", True, f"Found table {table_id} (T{table_number})")
        else:
            log_test("Get available table", False, "No available tables found")
            exit(1)
    else:
        log_test("Get available table", False, f"Status {tables_response.status_code}")
        exit(1)
except Exception as e:
    log_test("Get available table", False, str(e))
    exit(1)

print()

# ============================================================================
# TEST 3: Assign table to reservation (triggers notification)
# ============================================================================
print("TEST 3: Assign table to reservation...")
try:
    assign_response = requests.put(
        f"{BASE_URL}/reservations/{reservation_id}",
        headers={"x-admin-token": ADMIN_TOKEN},
        json={"table_id": table_id}
    )
    
    if assign_response.status_code == 200:
        updated_res = assign_response.json()
        
        checks = []
        checks.append(("status is 'table_assigned'", updated_res.get("status") == "table_assigned"))
        checks.append(("table_assigned_at exists", updated_res.get("table_assigned_at") is not None))
        checks.append(("confirmed_at exists", updated_res.get("confirmed_at") is not None))
        checks.append(("table_id matches", updated_res.get("table_id") == table_id))
        
        all_passed = all(check[1] for check in checks)
        details = ", ".join([f"{check[0]}: {'✓' if check[1] else '✗'}" for check in checks])
        
        log_test("Assign table to reservation", all_passed, details)
    else:
        log_test("Assign table to reservation", False, f"Status {assign_response.status_code}: {assign_response.text}")
        exit(1)
except Exception as e:
    log_test("Assign table to reservation", False, str(e))
    exit(1)

print()

# ============================================================================
# TEST 4: Get notifications as logged-in user
# ============================================================================
print("TEST 4: Get notifications as logged-in user...")
time.sleep(1)  # Give notification time to be created

try:
    notif_response = session.get(f"{BASE_URL}/notifications")
    
    if notif_response.status_code == 200:
        notif_data = notif_response.json()
        notifications = notif_data.get("notifications", [])
        unread_count = notif_data.get("unread_count", 0)
        
        # Find the table_assigned notification
        table_notif = None
        for notif in notifications:
            if notif.get("type") == "reservation_table_assigned":
                table_notif = notif
                break
        
        if table_notif:
            checks = []
            checks.append(("unread_count >= 1", unread_count >= 1))
            checks.append(("type is 'reservation_table_assigned'", table_notif.get("type") == "reservation_table_assigned"))
            checks.append(("title is 'Your table is ready'", table_notif.get("title") == "Your table is ready"))
            checks.append(("meta.table_number exists", table_notif.get("meta", {}).get("table_number") is not None))
            checks.append(("meta.section exists", table_notif.get("meta", {}).get("section") is not None))
            checks.append(("meta.time matches", table_notif.get("meta", {}).get("time") == reservation_time))
            checks.append(("read is false", table_notif.get("read") == False))
            
            all_passed = all(check[1] for check in checks)
            details = ", ".join([f"{check[0]}: {'✓' if check[1] else '✗'}" for check in checks])
            
            log_test("Get notifications", all_passed, details)
            notification_id = table_notif.get("id")
        else:
            log_test("Get notifications", False, "No table_assigned notification found")
    else:
        log_test("Get notifications", False, f"Status {notif_response.status_code}: {notif_response.text}")
except Exception as e:
    log_test("Get notifications", False, str(e))

print()

# ============================================================================
# TEST 5: Get notifications without cookie (should fail)
# ============================================================================
print("TEST 5: Get notifications without authentication...")
try:
    unauth_response = requests.get(f"{BASE_URL}/notifications")
    
    if unauth_response.status_code == 401:
        log_test("Unauthenticated notification access", True, "Correctly returned 401")
    else:
        log_test("Unauthenticated notification access", False, f"Expected 401, got {unauth_response.status_code}")
except Exception as e:
    log_test("Unauthenticated notification access", False, str(e))

print()

# ============================================================================
# TEST 6: Verify queues (email_queue and sms_queue)
# ============================================================================
print("TEST 6: Verify email_queue and sms_queue...")
try:
    db = get_mongo_db()
    
    # Check email_queue
    email_count = db.email_queue.count_documents({
        "type": "reservation_table_assigned",
        "to": test_email
    })
    
    # Check sms_queue
    sms_count = db.sms_queue.count_documents({
        "type": "reservation_table_assigned",
        "to": test_phone
    })
    
    checks = []
    checks.append(("email_queue has entry", email_count >= 1))
    checks.append(("sms_queue has entry", sms_count >= 1))
    
    all_passed = all(check[1] for check in checks)
    details = f"email_queue: {email_count}, sms_queue: {sms_count}"
    
    log_test("Verify notification queues", all_passed, details)
except Exception as e:
    log_test("Verify notification queues", False, str(e))

print()

# ============================================================================
# TEST 7: Re-assign same table (should not create duplicate notification)
# ============================================================================
print("TEST 7: Re-assign same table (no duplicate notification)...")
try:
    # Get current notification count
    notif_before = session.get(f"{BASE_URL}/notifications").json()
    count_before = len([n for n in notif_before.get("notifications", []) 
                       if n.get("reservation_id") == reservation_id])
    
    # Re-assign same table
    reassign_response = requests.put(
        f"{BASE_URL}/reservations/{reservation_id}",
        headers={"x-admin-token": ADMIN_TOKEN},
        json={"table_id": table_id}
    )
    
    time.sleep(1)
    
    # Check notification count again
    notif_after = session.get(f"{BASE_URL}/notifications").json()
    count_after = len([n for n in notif_after.get("notifications", []) 
                      if n.get("reservation_id") == reservation_id])
    
    # Check queue counts
    db = get_mongo_db()
    email_count_after = db.email_queue.count_documents({
        "type": "reservation_table_assigned",
        "to": test_email
    })
    sms_count_after = db.sms_queue.count_documents({
        "type": "reservation_table_assigned",
        "to": test_phone
    })
    
    checks = []
    checks.append(("notification count unchanged", count_before == count_after))
    checks.append(("email_queue count still 1", email_count_after == 1))
    checks.append(("sms_queue count still 1", sms_count_after == 1))
    
    all_passed = all(check[1] for check in checks)
    details = f"notifications: {count_before}→{count_after}, email: {email_count_after}, sms: {sms_count_after}"
    
    log_test("No duplicate notifications", all_passed, details)
except Exception as e:
    log_test("No duplicate notifications", False, str(e))

print()

# ============================================================================
# TEST 8: Assign table with status=arrived
# ============================================================================
print("TEST 8: Assign table with status=arrived...")
try:
    # Create another reservation
    res2_response = session.post(
        f"{BASE_URL}/reservations",
        json={
            "name": test_name,
            "phone": test_phone,
            "email": test_email,
            "date": reservation_date,
            "time": "20:00",
            "guests": 2,
            "seating_preference": "Window",
            "occasion": "Birthday"
        }
    )
    
    if res2_response.status_code == 200:
        res2_id = res2_response.json().get("id")
        
        # Find another available table
        tables_response = requests.get(
            f"{BASE_URL}/tables",
            headers={"x-admin-token": ADMIN_TOKEN}
        )
        tables = tables_response.json()
        table2 = None
        for t in tables:
            if t.get("status") == "available" and t.get("id") != table_id:
                table2 = t
                break
        
        if table2:
            table2_id = table2["id"]
            
            # Assign with status=arrived
            assign2_response = requests.put(
                f"{BASE_URL}/reservations/{res2_id}",
                headers={"x-admin-token": ADMIN_TOKEN},
                json={"table_id": table2_id, "status": "arrived"}
            )
            
            if assign2_response.status_code == 200:
                res2_data = assign2_response.json()
                
                checks = []
                checks.append(("status is 'arrived'", res2_data.get("status") == "arrived"))
                checks.append(("confirmed_at set", res2_data.get("confirmed_at") is not None))
                checks.append(("table_assigned_at set", res2_data.get("table_assigned_at") is not None))
                checks.append(("table_id is t2", res2_data.get("table_id") == table2_id))
                
                # Check table status
                time.sleep(1)
                table_check = requests.get(
                    f"{BASE_URL}/tables",
                    headers={"x-admin-token": ADMIN_TOKEN}
                ).json()
                
                table2_status = None
                for t in table_check:
                    if t.get("id") == table2_id:
                        table2_status = t.get("status")
                        break
                
                checks.append(("table status is 'occupied'", table2_status == "occupied"))
                
                # Notification should still fire
                time.sleep(1)
                notif_check = session.get(f"{BASE_URL}/notifications").json()
                has_notif = any(n.get("reservation_id") == res2_id for n in notif_check.get("notifications", []))
                checks.append(("notification created", has_notif))
                
                all_passed = all(check[1] for check in checks)
                details = ", ".join([f"{check[0]}: {'✓' if check[1] else '✗'}" for check in checks])
                
                log_test("Assign with status=arrived", all_passed, details)
            else:
                log_test("Assign with status=arrived", False, f"Status {assign2_response.status_code}")
        else:
            log_test("Assign with status=arrived", False, "No second table available")
    else:
        log_test("Assign with status=arrived", False, f"Failed to create second reservation")
except Exception as e:
    log_test("Assign with status=arrived", False, str(e))

print()

# ============================================================================
# TEST 9: Double-booking prevention with table_assigned status
# ============================================================================
print("TEST 9: Double-booking prevention...")
try:
    # Create another reservation for same time
    res3_response = session.post(
        f"{BASE_URL}/reservations",
        json={
            "name": "Another Guest",
            "phone": "+15559998888",
            "email": f"another_{timestamp}@example.com",
            "date": reservation_date,
            "time": reservation_time,
            "guests": 2
        }
    )
    
    if res3_response.status_code == 200:
        res3_id = res3_response.json().get("id")
        
        # Try to assign the same table (should fail with 409)
        conflict_response = requests.put(
            f"{BASE_URL}/reservations/{res3_id}",
            headers={"x-admin-token": ADMIN_TOKEN},
            json={"table_id": table_id}
        )
        
        if conflict_response.status_code == 409:
            log_test("Double-booking prevention", True, "Correctly returned 409 conflict")
        else:
            log_test("Double-booking prevention", False, f"Expected 409, got {conflict_response.status_code}")
    else:
        log_test("Double-booking prevention", False, "Failed to create third reservation")
except Exception as e:
    log_test("Double-booking prevention", False, str(e))

print()

# ============================================================================
# TEST 10: Mark notification as read
# ============================================================================
print("TEST 10: Mark notification as read...")
try:
    if 'notification_id' in locals():
        read_response = session.post(f"{BASE_URL}/notifications/{notification_id}/read")
        
        if read_response.status_code == 200:
            # Check notification is now read
            notif_check = session.get(f"{BASE_URL}/notifications").json()
            notifications = notif_check.get("notifications", [])
            unread_count = notif_check.get("unread_count", 0)
            
            read_notif = None
            for n in notifications:
                if n.get("id") == notification_id:
                    read_notif = n
                    break
            
            checks = []
            checks.append(("notification marked read", read_notif and read_notif.get("read") == True))
            checks.append(("unread_count decreased", unread_count < notif_data.get("unread_count", 999)))
            
            all_passed = all(check[1] for check in checks)
            details = f"read={read_notif.get('read') if read_notif else 'N/A'}, unread_count={unread_count}"
            
            log_test("Mark notification as read", all_passed, details)
        else:
            log_test("Mark notification as read", False, f"Status {read_response.status_code}")
    else:
        log_test("Mark notification as read", False, "No notification_id available")
except Exception as e:
    log_test("Mark notification as read", False, str(e))

print()

# ============================================================================
# TEST 11: Mark all notifications as read
# ============================================================================
print("TEST 11: Mark all notifications as read...")
try:
    read_all_response = session.post(f"{BASE_URL}/notifications/read-all")
    
    if read_all_response.status_code == 200:
        # Check all notifications are read
        notif_check = session.get(f"{BASE_URL}/notifications").json()
        unread_count = notif_check.get("unread_count", -1)
        
        if unread_count == 0:
            log_test("Mark all notifications as read", True, "unread_count=0")
        else:
            log_test("Mark all notifications as read", False, f"unread_count={unread_count}, expected 0")
    else:
        log_test("Mark all notifications as read", False, f"Status {read_all_response.status_code}")
except Exception as e:
    log_test("Mark all notifications as read", False, str(e))

print()

# ============================================================================
# TEST 12: Regression - GET /api/reservations still works
# ============================================================================
print("TEST 12: Regression - GET /api/reservations...")
try:
    res_list_response = requests.get(
        f"{BASE_URL}/reservations",
        headers={"x-admin-token": ADMIN_TOKEN}
    )
    
    if res_list_response.status_code == 200:
        reservations = res_list_response.json()
        if isinstance(reservations, list):
            log_test("GET /api/reservations regression", True, f"Returned {len(reservations)} reservations")
        else:
            log_test("GET /api/reservations regression", False, "Response is not a list")
    else:
        log_test("GET /api/reservations regression", False, f"Status {res_list_response.status_code}")
except Exception as e:
    log_test("GET /api/reservations regression", False, str(e))

print()

# ============================================================================
# TEST 13: Lifecycle past table_assigned
# ============================================================================
print("TEST 13: Lifecycle transitions...")
try:
    # Create a fresh reservation
    res4_response = session.post(
        f"{BASE_URL}/reservations",
        json={
            "name": test_name,
            "phone": test_phone,
            "email": test_email,
            "date": reservation_date,
            "time": "21:00",
            "guests": 4
        }
    )
    
    if res4_response.status_code == 200:
        res4_id = res4_response.json().get("id")
        
        # Find available table
        tables = requests.get(f"{BASE_URL}/tables", headers={"x-admin-token": ADMIN_TOKEN}).json()
        table4 = None
        for t in tables:
            if t.get("status") == "available" and t.get("capacity", 0) >= 4:
                table4 = t
                break
        
        if table4:
            table4_id = table4["id"]
            
            # Assign table (pending → table_assigned)
            r1 = requests.put(
                f"{BASE_URL}/reservations/{res4_id}",
                headers={"x-admin-token": ADMIN_TOKEN},
                json={"table_id": table4_id}
            )
            
            # Update to arrived
            r2 = requests.put(
                f"{BASE_URL}/reservations/{res4_id}",
                headers={"x-admin-token": ADMIN_TOKEN},
                json={"status": "arrived"}
            )
            
            # Update to checked_in
            r3 = requests.put(
                f"{BASE_URL}/reservations/{res4_id}",
                headers={"x-admin-token": ADMIN_TOKEN},
                json={"status": "checked_in"}
            )
            
            # Update to completed
            r4 = requests.put(
                f"{BASE_URL}/reservations/{res4_id}",
                headers={"x-admin-token": ADMIN_TOKEN},
                json={"status": "completed"}
            )
            
            checks = []
            checks.append(("table_assigned", r1.status_code == 200))
            checks.append(("arrived", r2.status_code == 200))
            checks.append(("checked_in", r3.status_code == 200))
            checks.append(("completed", r4.status_code == 200))
            
            if r4.status_code == 200:
                final = r4.json()
                checks.append(("completed_at set", final.get("completed_at") is not None))
            
            all_passed = all(check[1] for check in checks)
            details = ", ".join([f"{check[0]}: {'✓' if check[1] else '✗'}" for check in checks])
            
            log_test("Lifecycle transitions", all_passed, details)
        else:
            log_test("Lifecycle transitions", False, "No table with capacity 4 available")
    else:
        log_test("Lifecycle transitions", False, "Failed to create reservation")
except Exception as e:
    log_test("Lifecycle transitions", False, str(e))

print()

# ============================================================================
# TEST 14: autoUpdateTableStatuses regression
# ============================================================================
print("TEST 14: autoUpdateTableStatuses regression...")
try:
    # Create reservation for tomorrow
    tomorrow = get_future_date(1)
    res5_response = session.post(
        f"{BASE_URL}/reservations",
        json={
            "name": test_name,
            "phone": test_phone,
            "email": test_email,
            "date": tomorrow,
            "time": "18:00",
            "guests": 2
        }
    )
    
    if res5_response.status_code == 200:
        res5_id = res5_response.json().get("id")
        
        # Find available table
        tables = requests.get(f"{BASE_URL}/tables", headers={"x-admin-token": ADMIN_TOKEN}).json()
        table5 = None
        for t in tables:
            if t.get("status") == "available":
                table5 = t
                break
        
        if table5:
            table5_id = table5["id"]
            
            # Assign table
            requests.put(
                f"{BASE_URL}/reservations/{res5_id}",
                headers={"x-admin-token": ADMIN_TOKEN},
                json={"table_id": table5_id}
            )
            
            # Trigger autoUpdateTableStatuses by calling GET /api/tables
            time.sleep(1)
            tables_after = requests.get(
                f"{BASE_URL}/tables",
                headers={"x-admin-token": ADMIN_TOKEN}
            ).json()
            
            table5_status = None
            for t in tables_after:
                if t.get("id") == table5_id:
                    table5_status = t.get("status")
                    break
            
            if table5_status == "reserved":
                log_test("autoUpdateTableStatuses regression", True, f"Table {table5_id} status is 'reserved'")
            else:
                log_test("autoUpdateTableStatuses regression", False, f"Table {table5_id} status is '{table5_status}', expected 'reserved'")
        else:
            log_test("autoUpdateTableStatuses regression", False, "No available table")
    else:
        log_test("autoUpdateTableStatuses regression", False, "Failed to create reservation")
except Exception as e:
    log_test("autoUpdateTableStatuses regression", False, str(e))

print()

# ============================================================================
# SUMMARY
# ============================================================================
print("=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print(f"Total tests: {tests_passed + tests_failed}")
print(f"Passed: {tests_passed}")
print(f"Failed: {tests_failed}")
print(f"Success rate: {(tests_passed / (tests_passed + tests_failed) * 100):.1f}%")
print()

if tests_failed > 0:
    print("FAILED TESTS:")
    for result in test_results:
        if not result["passed"]:
            print(f"  ❌ {result['name']}")
            if result["details"]:
                print(f"     {result['details']}")
    print()

print("=" * 80)
print(f"Test credentials saved for re-runs:")
print(f"  Email: {test_email}")
print(f"  Password: {test_password}")
print(f"  Admin token: {ADMIN_TOKEN}")
print("=" * 80)

# Exit with appropriate code
exit(0 if tests_failed == 0 else 1)
