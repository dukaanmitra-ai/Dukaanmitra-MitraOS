"""
Tests for DukaanMitra Platform Modules
AI Studio, CRM, QR Feedback, Verticals, Fraud Shield
"""

import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app

client = TestClient(app)

def test_marketing_copy_generation():
    """Test AI Studio marketing copy generation"""
    response = client.post("/api/v1/modules/marketing/generate", json={
        "product_name": "Aashirvaad Atta",
        "category": "kirana",
        "target_audience": "household",
        "language": "hinglish",
        "tone": "professional"
    })
    assert response.status_code == 200
    data = response.json()
    assert "marketing_copy" in data
    assert "hashtags" in data
    assert "emojis" in data
    assert "Aashirvaad Atta" in data["marketing_copy"]

def test_customer_retention_draft_inactive_30_days():
    """Test CRM retention draft for 30+ days inactive"""
    response = client.post("/api/v1/modules/crm/retention-draft", json={
        "inactive_days": 35,
        "customer_name": "Rahul Kumar",
        "last_purchase": "2024-09-15"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["discount_offer"] == "10%"
    assert data["re_engagement_score"] == 0.6

def test_customer_retention_draft_inactive_60_days():
    """Test CRM retention draft for 60+ days inactive"""
    response = client.post("/api/v1/modules/crm/retention-draft", json={
        "inactive_days": 65,
        "customer_name": "Priya Singh",
        "last_purchase": "2024-08-15"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["discount_offer"] == "20%"
    assert data["re_engagement_score"] == 0.9

def test_upi_qr_generation():
    """Test QR system UPI intent link generation"""
    response = client.post("/api/v1/modules/feedback/qr-generate", json={
        "upi_id": "merchant@upi",
        "amount": 500.0,
        "merchant_name": "DukaanMitra Store"
    })
    assert response.status_code == 200
    data = response.json()
    assert "upi_intent_url" in data
    assert "merchant@upi" in data["upi_intent_url"]
    assert "am=500" in data["upi_intent_url"]

def test_feedback_routing_positive():
    """Test feedback routing for positive reviews (4-5 stars)"""
    response = client.post("/api/v1/modules/feedback/route", json={
        "rating": 5,
        "merchant_id": "TEST_MERCHANT",
        "customer_name": "Test Customer"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["action"] == "public_review"
    assert data["destination_url"] is not None

def test_feedback_routing_negative():
    """Test feedback routing for negative reviews (1-3 stars)"""
    response = client.post("/api/v1/modules/feedback/route", json={
        "rating": 2,
        "merchant_id": "TEST_MERCHANT",
        "customer_name": "Test Customer"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["action"] == "private_grievance"
    assert data["destination_url"] is None

def test_salon_estimate_calculation():
    """Test vertical salon bill calculator"""
    response = client.post("/api/v1/modules/verticals/salon-estimate", json={
        "services": [
            {"name": "Haircut", "duration": 30, "price": 300},
            {"name": "Beard Trim", "duration": 15, "price": 150}
        ],
        "stylist_commission": 0.3
    })
    assert response.status_code == 200
    data = response.json()
    assert data["total_amount"] == 450
    assert data["stylist_earnings"] == 135
    assert data["shop_earnings"] == 315
    assert data["total_duration"] == 45

def test_construction_estimate():
    """Test vertical construction estimate engine"""
    response = client.post("/api/v1/modules/verticals/construction-estimate", json={
        "area_sqft": 1000,
        "location": "Delhi"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["material_cost"] == 1200000  # 60% of 2M
    assert data["labor_cost"] == 800000  # 40% of 2M
    assert data["gst_amount"] == 360000  # 18% of 2M
    assert data["total_estimate"] == 2360000

def test_pet_tag_generation():
    """Test vertical pet emergency tag generator"""
    response = client.post("/api/v1/modules/verticals/pet-tag", json={
        "pet_name": "Bruno",
        "owner_phone": "9876543210",
        "emergency_contact": "9876543211",
        "breed": "Labrador"
    })
    assert response.status_code == 200
    data = response.json()
    assert "qr_data" in data
    assert "9876543210" in data["qr_data"]
    assert "9876543211" in data["qr_data"]

def test_call_check_suspicious():
    """Test fraud shield suspicious call detection"""
    response = client.post("/api/v1/modules/safety/call-check", json={
        "phone_number": "0001234567",
        "call_context": "bank otp verification"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["is_suspicious"] == True
    assert data["risk_level"] == "high"

def test_call_check_otp_theft():
    """Test fraud shield OTP theft pattern detection"""
    response = client.post("/api/v1/modules/safety/call-check", json={
        "phone_number": "9876543210",
        "call_context": "bank asking for otp"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["is_suspicious"] == True
    assert data["risk_level"] == "medium"
    assert "OTP" in data["warning_message"]

def test_call_check_safe():
    """Test fraud shield safe call detection"""
    response = client.post("/api/v1/modules/safety/call-check", json={
        "phone_number": "9876543210",
        "call_context": "delivery inquiry"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["is_suspicious"] == False
    assert data["risk_level"] == "low"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
