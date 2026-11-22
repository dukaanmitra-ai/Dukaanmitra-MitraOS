"""
Complete Ecosystem Integration Test
Tests all modules working together in a unified workflow
"""

import pytest
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
import shared_database
import auth_system
import uuid

from fastapi.testclient import TestClient

client = TestClient(app)

def test_complete_ecosystem_workflow():
    """Test complete workflow: Auth → Business → Products → AI Modules → Sync"""

    # Initialize shared database
    shared_database.init_shared_database()

    # Step 1: Create a business
    business_id = shared_database.create_business("Integration Test Dukaan", "retail", "basic")
    assert business_id is not None
    print(f"✓ Business created: {business_id}")

    # Step 2: Register a user
    unique_email = f"test_{uuid.uuid4().hex[:8]}@integration.com"
    user_id = auth_system.register_local_user(business_id, "Test Owner", unique_email, "password123", "owner")
    assert user_id is not None
    print(f"✓ User registered: {user_id}")

    # Step 3: Authenticate user
    user = auth_system.authenticate_local(unique_email, "password123")
    assert user is not None
    assert user["display_name"] == "Test Owner"
    print(f"✓ User authenticated: {user['display_name']}")

    # Step 4: Test AI Studio - Marketing Copy
    marketing_response = client.post("/api/v1/modules/marketing/generate", json={
        "product_name": "Aashirvaad Atta",
        "category": "kirana",
        "target_audience": "household",
        "language": "hinglish"
    })
    assert marketing_response.status_code == 200
    marketing_data = marketing_response.json()
    assert "marketing_copy" in marketing_data
    print(f"✓ Marketing copy generated: {marketing_data['marketing_copy'][:50]}...")

    # Step 5: Test CRM - Customer Retention
    crm_response = client.post("/api/v1/modules/crm/retention-draft", json={
        "inactive_days": 45,
        "customer_name": "Rahul Kumar",
        "last_purchase": "2024-09-15"
    })
    assert crm_response.status_code == 200
    crm_data = crm_response.json()
    assert crm_data["discount_offer"] == "10%"
    print(f"✓ CRM retention draft generated: {crm_data['discount_offer']} discount")

    # Step 6: Test QR System
    qr_response = client.post("/api/v1/modules/feedback/qr-generate", json={
        "upi_id": "merchant@upi",
        "amount": 500.0,
        "merchant_name": "Test Store"
    })
    assert qr_response.status_code == 200
    qr_data = qr_response.json()
    assert "upi_intent_url" in qr_data
    print(f"✓ UPI QR generated: {qr_data['upi_intent_url'][:50]}...")

    # Step 7: Test Vertical - Salon Estimate
    salon_response = client.post("/api/v1/modules/verticals/salon-estimate", json={
        "services": [
            {"name": "Haircut", "duration": 30, "price": 300}
        ],
        "stylist_commission": 0.3
    })
    assert salon_response.status_code == 200
    salon_data = salon_response.json()
    assert salon_data["total_amount"] == 300
    print(f"✓ Salon estimate calculated: {salon_data['total_amount']}")

    # Step 8: Test Vertical - Construction Estimate
    construction_response = client.post("/api/v1/modules/verticals/construction-estimate", json={
        "area_sqft": 1000,
        "location": "Delhi"
    })
    assert construction_response.status_code == 200
    construction_data = construction_response.json()
    assert construction_data["total_estimate"] == 2360000
    print(f"✓ Construction estimate calculated: {construction_data['total_estimate']}")

    # Step 9: Test Fraud Shield
    safety_response = client.post("/api/v1/modules/safety/call-check", json={
        "phone_number": "9876543210",
        "call_context": "delivery inquiry"
    })
    assert safety_response.status_code == 200
    safety_data = safety_response.json()
    assert safety_data["is_suspicious"] == False
    print(f"✓ Safety check passed: {safety_data['risk_level']} risk")

    # Step 10: Test Data Sync
    sync_event_id = shared_database.record_sync_event(
        "core_engine", "product", "prod_123",
        "dukaanin", "create", {"name": "Test Product", "price": 100}
    )
    assert sync_event_id is not None
    print(f"✓ Sync event recorded: {sync_event_id}")

    # Step 11: Test OTP System
    phone = "9876543210"
    otp = auth_system.generate_otp()
    auth_system.store_otp(phone, otp)
    is_valid = auth_system.verify_otp(phone, otp)
    assert is_valid == True
    print(f"✓ OTP system working: {otp}")

    print("\n✅ Complete ecosystem integration test PASSED!")

def test_cross_module_data_flow():
    """Test data flowing between modules"""
    shared_database.init_shared_database()

    # Create business
    business_id = shared_database.create_business("Cross Module Test", "retail", "basic")

    # Generate marketing copy
    marketing_response = client.post("/api/v1/modules/marketing/generate", json={
        "product_name": "Test Product",
        "category": "kirana",
        "target_audience": "general",
        "language": "english"
    })
    assert marketing_response.status_code == 200

    # Generate QR for same business
    qr_response = client.post("/api/v1/modules/feedback/qr-generate", json={
        "upi_id": f"{business_id}@upi",
        "merchant_name": "Cross Module Test"
    })
    assert qr_response.status_code == 200

    # Record sync event linking marketing and QR
    sync_event_id = shared_database.record_sync_event(
        "ai_services", "marketing_campaign", "camp_123",
        "dukaanin", "create", {"qr_data": qr_response.json()["qr_code_data"]}
    )
    assert sync_event_id is not None

    print("✅ Cross-module data flow test PASSED!")

def test_error_handling():
    """Test error handling across modules"""
    shared_database.init_shared_database()

    # Test invalid input
    response = client.post("/api/v1/modules/safety/call-check", json={
        "phone_number": "",
        "call_context": ""
    })
    # Should not crash, return safe default
    assert response.status_code == 200
    data = response.json()
    assert data["risk_level"] == "low"

    print("✅ Error handling test PASSED!")

if __name__ == "__main__":
    print("Running Complete Ecosystem Integration Tests...\n")
    test_complete_ecosystem_workflow()
    test_cross_module_data_flow()
    test_error_handling()
    print("\n🎉 All ecosystem integration tests PASSED!")
