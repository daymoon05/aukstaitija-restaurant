#!/usr/bin/env python3
"""
Backend test suite for waiter-assisted dine-in ordering features.

Tests:
A. Auth on GET /api/waiter/active-tables
B. Picker shape and filtering
C. Default order_source
D. Waiter source + flags + waiter persisted
E. Different notes → new line item, still merged
F. Merge gating — kitchen has accepted
G. merge_active=false bypasses merging
H. Walkin table that doesn't yet have a session
I. Regression — required fields and capacity
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:3000/api"
ADMIN_TOKEN = "admin123"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def test_a_auth_on_picker():
    """A. Auth on the new picker endpoint"""
    log("=" * 80)
    log("TEST A: Auth on GET /api/waiter/active-tables")
    log("=" * 80)
    
    try:
        # Without admin token → 401
        log("A1. GET /api/waiter/active-tables WITHOUT x-admin-token")
        r = requests.get(f"{BASE_URL}/waiter/active-tables")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        log("✅ Returns 401 without admin token")
        
        # With admin token → 200
        log("A2. GET /api/waiter/active-tables WITH admin token")
        r = requests.get(f"{BASE_URL}/waiter/active-tables", headers={"x-admin-token": ADMIN_TOKEN})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert "tables" in data, "Response should have 'tables' key"
        log(f"✅ Returns 200 with admin token, tables count: {len(data['tables'])}")
        
        return True
    except AssertionError as e:
        log(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        log(f"❌ ERROR: {e}")
        return False

def cleanup_table(table_id):
    """Helper to end any active session on a table"""
    try:
        r = requests.post(f"{BASE_URL}/tables/{table_id}/pay", headers={"x-admin-token": ADMIN_TOKEN})
        if r.status_code == 200:
            log(f"  Cleaned up table {table_id}")
    except:
        pass

def test_b_picker_shape():
    """B. Picker shape and filtering"""
    log("=" * 80)
    log("TEST B: Picker shape and filtering")
    log("=" * 80)
    
    try:
        # Clean up tables t1, t2, t3 first
        log("B0. Cleaning up tables t1, t2, t3")
        for tid in ["t1", "t2", "t3"]:
            cleanup_table(tid)
        time.sleep(0.5)
        
        # Create a walk-in on table t1
        log("B1. Create walk-in on table t1")
        r = requests.post(
            f"{BASE_URL}/tables/t1/walkin",
            headers={"x-admin-token": ADMIN_TOKEN},
            json={"guests": 2, "customer_name": "PickerSmoke"}
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        log("✅ Walk-in created on t1")
        
        # GET /api/waiter/active-tables → t1 should appear
        log("B2. GET /api/waiter/active-tables (without include=available)")
        r = requests.get(f"{BASE_URL}/waiter/active-tables", headers={"x-admin-token": ADMIN_TOKEN})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        tables = data.get("tables", [])
        t1 = next((t for t in tables if t["id"] == "t1"), None)
        assert t1 is not None, "Table t1 should appear in active-tables"
        assert t1["state"] == "seated", f"Expected state='seated', got {t1['state']}"
        assert t1["session"]["customer_name"] == "PickerSmoke", "Customer name mismatch"
        assert t1["active_order"] is None, "active_order should be null (no order yet)"
        log(f"✅ t1 appears with state='seated', customer_name='PickerSmoke', active_order=null")
        
        # GET /api/waiter/active-tables?include=available → should include available tables
        log("B3. GET /api/waiter/active-tables?include=available")
        r = requests.get(f"{BASE_URL}/waiter/active-tables?include=available", headers={"x-admin-token": ADMIN_TOKEN})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        tables = data.get("tables", [])
        t1 = next((t for t in tables if t["id"] == "t1"), None)
        assert t1 is not None, "Table t1 should still appear"
        available_tables = [t for t in tables if t["state"] == "available"]
        assert len(available_tables) > 0, "Should have at least one available table"
        log(f"✅ t1 still appears, and {len(available_tables)} available tables found")
        
        # Check that out_of_service tables never appear (if any exist)
        log("B4. Verify out_of_service tables are excluded")
        out_of_service = [t for t in tables if t["status"] == "out_of_service"]
        assert len(out_of_service) == 0, "out_of_service tables should never appear"
        log("✅ No out_of_service tables in response")
        
        return True
    except AssertionError as e:
        log(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        log(f"❌ ERROR: {e}")
        return False

def test_c_default_order_source():
    """C. Default order_source"""
    log("=" * 80)
    log("TEST C: Default order_source")
    log("=" * 80)
    
    try:
        # POST /api/orders with table_id=t1, NO order_source field
        log("C1. POST /api/orders with table_id=t1, NO order_source field")
        r = requests.post(
            f"{BASE_URL}/orders",
            json={
                "table_id": "t1",
                "items": [{"id": "cepelinai", "name": "Cepelinai", "price": 12.50, "quantity": 1}]
            }
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        order = r.json()
        assert order.get("order_source") == "qr", f"Expected order_source='qr', got {order.get('order_source')}"
        log(f"✅ order_source defaults to 'qr' (order_id: {order['id']})")
        
        return order["id"]
    except AssertionError as e:
        log(f"❌ FAIL: {e}")
        return None
    except Exception as e:
        log(f"❌ ERROR: {e}")
        return None

def test_d_waiter_source_flags_persisted(first_order_id):
    """D. Waiter source + flags + waiter persisted"""
    log("=" * 80)
    log("TEST D: Waiter source + flags + waiter persisted")
    log("=" * 80)
    
    try:
        # POST /api/orders with order_source='waiter', waiter={name:'Petras'}, flags={urgent:true}
        log("D1. POST /api/orders with order_source='waiter', waiter, flags")
        r = requests.post(
            f"{BASE_URL}/orders",
            json={
                "table_id": "t1",
                "items": [{"id": "cepelinai", "name": "Cepelinai", "price": 12.50, "quantity": 1, "notes": "no onions"}],
                "order_source": "waiter",
                "waiter": {"name": "Petras"},
                "flags": {"urgent": True}
            }
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        response = r.json()
        
        # This should MERGE into the first order
        assert response.get("merged") == True, "Expected merged=true"
        assert response.get("merged_into_order_id") == first_order_id, f"Expected merged_into_order_id={first_order_id}"
        log(f"✅ Merged into first order (merged_into_order_id: {response['merged_into_order_id']})")
        
        # Verify the merged order has the waiter flag
        log("D2. GET the merged order to verify flags and history")
        r = requests.get(f"{BASE_URL}/orders/{first_order_id}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        order = r.json()
        
        # Check flags
        assert order.get("flags", {}).get("urgent") == True, "Expected flags.urgent=true"
        log(f"✅ flags.urgent=true")
        
        # Check history
        history = order.get("history", [])
        assert len(history) >= 2, f"Expected at least 2 history entries, got {len(history)}"
        append_entry = next((h for h in history if h.get("action") == "append_items"), None)
        assert append_entry is not None, "Expected append_items history entry"
        assert append_entry.get("source") == "waiter", "Expected source='waiter' in history"
        assert append_entry.get("waiter", {}).get("name") == "Petras", "Expected waiter.name='Petras' in history"
        log(f"✅ history has append_items entry with source='waiter', waiter.name='Petras'")
        
        # Check items - should have 2 items now (1 from test C + 1 from this test, but same dish so qty should be 2)
        items = order.get("items", [])
        cepelinai_item = next((i for i in items if i["id"] == "cepelinai" and i.get("notes") == "no onions"), None)
        assert cepelinai_item is not None, "Expected cepelinai item with notes='no onions'"
        log(f"✅ Items merged correctly, cepelinai with 'no onions' found")
        
        # Re-fetch via GET /api/waiter/active-tables
        log("D3. GET /api/waiter/active-tables to verify active_order")
        r = requests.get(f"{BASE_URL}/waiter/active-tables", headers={"x-admin-token": ADMIN_TOKEN})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        t1 = next((t for t in data["tables"] if t["id"] == "t1"), None)
        assert t1 is not None, "Table t1 should appear"
        assert t1["active_order"] is not None, "active_order should not be null"
        assert t1["active_order"]["mergeable"] == True, "active_order should be mergeable (status='received')"
        log(f"✅ t1.active_order is mergeable=true")
        
        return True
    except AssertionError as e:
        log(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        log(f"❌ ERROR: {e}")
        return False

def test_e_different_notes_new_line(first_order_id):
    """E. Different notes → new line item, still merged"""
    log("=" * 80)
    log("TEST E: Different notes → new line item, still merged")
    log("=" * 80)
    
    try:
        # Get current items count
        r = requests.get(f"{BASE_URL}/orders/{first_order_id}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        order_before = r.json()
        items_before = len(order_before.get("items", []))
        
        # POST /api/orders with same dish but different notes
        log("E1. POST /api/orders with same dish + different notes ('extra spicy')")
        r = requests.post(
            f"{BASE_URL}/orders",
            json={
                "table_id": "t1",
                "items": [{"id": "cepelinai", "name": "Cepelinai", "price": 12.50, "quantity": 1, "notes": "extra spicy"}],
                "order_source": "waiter",
                "waiter": {"name": "Petras"}
            }
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        response = r.json()
        
        assert response.get("merged") == True, "Expected merged=true"
        assert response.get("merged_into_order_id") == first_order_id, f"Expected merged_into_order_id={first_order_id}"
        log(f"✅ Merged into first order")
        
        # Verify items array increased by 1
        items_after = len(response.get("items", []))
        assert items_after == items_before + 1, f"Expected items count to increase by 1 (was {items_before}, now {items_after})"
        log(f"✅ Items array increased by 1 (new line for 'extra spicy')")
        
        # Verify the new line exists
        extra_spicy_item = next((i for i in response["items"] if i.get("notes") == "extra spicy"), None)
        assert extra_spicy_item is not None, "Expected item with notes='extra spicy'"
        log(f"✅ New line item with notes='extra spicy' found")
        
        return True
    except AssertionError as e:
        log(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        log(f"❌ ERROR: {e}")
        return False

def test_f_merge_gating_kitchen_accepted(first_order_id):
    """F. Merge gating — kitchen has accepted"""
    log("=" * 80)
    log("TEST F: Merge gating — kitchen has accepted")
    log("=" * 80)
    
    try:
        # PUT /api/orders/:id with status='preparing'
        log("F1. PUT /api/orders/:id with status='preparing'")
        r = requests.put(
            f"{BASE_URL}/orders/{first_order_id}",
            headers={"x-admin-token": ADMIN_TOKEN},
            json={"status": "preparing"}
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        log(f"✅ Order status updated to 'preparing'")
        
        # POST /api/orders again with same table
        log("F2. POST /api/orders again (should NOT merge)")
        r = requests.post(
            f"{BASE_URL}/orders",
            json={
                "table_id": "t1",
                "items": [{"id": "cepelinai", "name": "Cepelinai", "price": 12.50, "quantity": 1}],
                "order_source": "waiter"
            }
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        response = r.json()
        
        # Should NOT merge (merged should be falsy/undefined)
        assert response.get("merged") != True, "Expected merged to be falsy (not merged)"
        assert response["id"] != first_order_id, "New order should have different ID"
        assert response.get("session_id") is not None, "session_id should be present"
        log(f"✅ New order created (not merged), new order_id: {response['id']}")
        
        return response["id"]
    except AssertionError as e:
        log(f"❌ FAIL: {e}")
        return None
    except Exception as e:
        log(f"❌ ERROR: {e}")
        return None

def test_g_merge_active_false():
    """G. merge_active=false bypasses merging"""
    log("=" * 80)
    log("TEST G: merge_active=false bypasses merging")
    log("=" * 80)
    
    try:
        # Clean up table t2
        log("G0. Cleaning up table t2")
        cleanup_table("t2")
        time.sleep(0.5)
        
        # Create walk-in on t2
        log("G1. POST /api/tables/t2/walkin")
        r = requests.post(
            f"{BASE_URL}/tables/t2/walkin",
            headers={"x-admin-token": ADMIN_TOKEN},
            json={"guests": 2, "customer_name": "NoMerge"}
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        log("✅ Walk-in created on t2")
        
        # POST first order with merge_active=false
        log("G2. POST first order with merge_active=false")
        r = requests.post(
            f"{BASE_URL}/orders",
            json={
                "table_id": "t2",
                "items": [{"id": "cepelinai", "name": "Cepelinai", "price": 12.50, "quantity": 1}],
                "order_source": "waiter",
                "merge_active": False
            }
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        order1 = r.json()
        assert order1.get("merged") != True, "First order should not have merged flag"
        log(f"✅ First order created (order_id: {order1['id']})")
        
        # POST second order with merge_active=false
        log("G3. POST second order with merge_active=false")
        r = requests.post(
            f"{BASE_URL}/orders",
            json={
                "table_id": "t2",
                "items": [{"id": "cepelinai", "name": "Cepelinai", "price": 12.50, "quantity": 1}],
                "order_source": "waiter",
                "merge_active": False
            }
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        order2 = r.json()
        assert order2.get("merged") != True, "Second order should not have merged flag"
        assert order2["id"] != order1["id"], "Orders should have different IDs"
        log(f"✅ Second order created (order_id: {order2['id']}), NOT merged")
        
        # Verify both orders exist
        log("G4. Verify both orders exist in /api/waiter/active-tables")
        r = requests.get(f"{BASE_URL}/waiter/active-tables", headers={"x-admin-token": ADMIN_TOKEN})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        t2 = next((t for t in data["tables"] if t["id"] == "t2"), None)
        assert t2 is not None, "Table t2 should appear"
        # active_order should show the latest 'received' order
        assert t2["active_order"] is not None, "active_order should not be null"
        log(f"✅ t2.active_order shows latest order")
        
        return True
    except AssertionError as e:
        log(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        log(f"❌ ERROR: {e}")
        return False

def test_h_walkin_table_no_session():
    """H. Walkin table that doesn't yet have a session"""
    log("=" * 80)
    log("TEST H: Walkin table that doesn't yet have a session")
    log("=" * 80)
    
    try:
        # Clean up table t3
        log("H0. Cleaning up table t3")
        cleanup_table("t3")
        time.sleep(0.5)
        
        # Verify t3 is available
        log("H1. Verify t3 is available (no session)")
        r = requests.get(f"{BASE_URL}/tables/t3")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        table = r.json()
        assert table["status"] == "available", f"Expected status='available', got {table['status']}"
        log(f"✅ t3 is available")
        
        # POST /api/orders with table_id=t3 (should auto-create session)
        log("H2. POST /api/orders with table_id=t3 (auto-create session)")
        r = requests.post(
            f"{BASE_URL}/orders",
            json={
                "table_id": "t3",
                "items": [{"id": "cepelinai", "name": "Cepelinai", "price": 12.50, "quantity": 1}],
                "order_source": "waiter",
                "waiter": {"name": "Petras"}
            }
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        order = r.json()
        assert order.get("session_id") is not None, "session_id should be present"
        log(f"✅ Order created with auto-created session (session_id: {order['session_id']})")
        
        # GET /api/waiter/active-tables → t3 should appear with state='seated'
        log("H3. GET /api/waiter/active-tables → t3 should appear")
        r = requests.get(f"{BASE_URL}/waiter/active-tables", headers={"x-admin-token": ADMIN_TOKEN})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        t3 = next((t for t in data["tables"] if t["id"] == "t3"), None)
        assert t3 is not None, "Table t3 should appear"
        assert t3["state"] == "seated", f"Expected state='seated', got {t3['state']}"
        assert t3["session"]["origin"] == "waiter_order", f"Expected origin='waiter_order', got {t3['session']['origin']}"
        log(f"✅ t3 appears with state='seated', session.origin='waiter_order'")
        
        return True
    except AssertionError as e:
        log(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        log(f"❌ ERROR: {e}")
        return False

def test_i_regression():
    """I. Regression — required fields and capacity"""
    log("=" * 80)
    log("TEST I: Regression — required fields and capacity")
    log("=" * 80)
    
    try:
        # POST /api/orders with empty items array → 400
        log("I1. POST /api/orders with empty items array")
        r = requests.post(
            f"{BASE_URL}/orders",
            json={"table_id": "t1", "items": []}
        )
        assert r.status_code == 400, f"Expected 400, got {r.status_code}"
        assert "Items required" in r.text or "items" in r.text.lower(), "Error message should mention items"
        log(f"✅ Returns 400 'Items required'")
        
        # POST /api/orders with invalid table_id → 400
        log("I2. POST /api/orders with invalid table_id")
        r = requests.post(
            f"{BASE_URL}/orders",
            json={
                "table_id": "invalid_table",
                "items": [{"id": "cepelinai", "name": "Cepelinai", "price": 12.50, "quantity": 1}]
            }
        )
        assert r.status_code == 400, f"Expected 400, got {r.status_code}"
        assert "Invalid table" in r.text or "table" in r.text.lower(), "Error message should mention table"
        log(f"✅ Returns 400 'Invalid table'")
        
        return True
    except AssertionError as e:
        log(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        log(f"❌ ERROR: {e}")
        return False

def cleanup_all_test_tables():
    """Cleanup all test tables at the end"""
    log("=" * 80)
    log("CLEANUP: Closing sessions on test tables")
    log("=" * 80)
    
    for tid in ["t1", "t2", "t3"]:
        try:
            r = requests.post(f"{BASE_URL}/tables/{tid}/pay", headers={"x-admin-token": ADMIN_TOKEN})
            if r.status_code == 200:
                log(f"✅ Closed session on {tid}")
        except Exception as e:
            log(f"⚠️  Could not close session on {tid}: {e}")

def main():
    log("=" * 80)
    log("WAITER-ASSISTED DINE-IN ORDERING BACKEND TEST SUITE")
    log("=" * 80)
    log(f"Base URL: {BASE_URL}")
    log(f"Admin Token: {ADMIN_TOKEN}")
    log("")
    
    results = {}
    
    # Test A: Auth
    results["A_auth"] = test_a_auth_on_picker()
    time.sleep(0.5)
    
    # Test B: Picker shape
    results["B_picker_shape"] = test_b_picker_shape()
    time.sleep(0.5)
    
    # Test C: Default order_source
    first_order_id = test_c_default_order_source()
    results["C_default_source"] = first_order_id is not None
    time.sleep(0.5)
    
    # Test D: Waiter source + flags
    if first_order_id:
        results["D_waiter_flags"] = test_d_waiter_source_flags_persisted(first_order_id)
        time.sleep(0.5)
    else:
        results["D_waiter_flags"] = False
        log("⚠️  Skipping test D (test C failed)")
    
    # Test E: Different notes
    if first_order_id:
        results["E_different_notes"] = test_e_different_notes_new_line(first_order_id)
        time.sleep(0.5)
    else:
        results["E_different_notes"] = False
        log("⚠️  Skipping test E (test C failed)")
    
    # Test F: Merge gating
    if first_order_id:
        second_order_id = test_f_merge_gating_kitchen_accepted(first_order_id)
        results["F_merge_gating"] = second_order_id is not None
        time.sleep(0.5)
    else:
        results["F_merge_gating"] = False
        log("⚠️  Skipping test F (test C failed)")
    
    # Test G: merge_active=false
    results["G_merge_active_false"] = test_g_merge_active_false()
    time.sleep(0.5)
    
    # Test H: Walkin table no session
    results["H_walkin_no_session"] = test_h_walkin_table_no_session()
    time.sleep(0.5)
    
    # Test I: Regression
    results["I_regression"] = test_i_regression()
    time.sleep(0.5)
    
    # Cleanup
    cleanup_all_test_tables()
    
    # Summary
    log("")
    log("=" * 80)
    log("TEST SUMMARY")
    log("=" * 80)
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    log(f"Passed: {passed}/{total} ({100*passed//total}%)")
    log("")
    for test, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        log(f"{status} - {test}")
    log("=" * 80)
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
