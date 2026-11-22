"""
DukaanMitra Unified Authentication System
Supports: Local, Google OAuth, WhatsApp OTP-based authentication
"""

import sqlite3
import json
import uuid
import hmac
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Tuple
import secrets

DB_PATH = "dukaanmitra_shared.db"

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def hash_password(password: str) -> str:
    """Hash password using SHA-256 with salt"""
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}:{hashed}"

def verify_password(password: str, stored_hash: str) -> bool:
    """Verify password against stored hash"""
    try:
        salt, hashed = stored_hash.split(":")
        computed = hashlib.sha256((password + salt).encode()).hexdigest()
        return hmac.compare_digest(computed, hashed)
    except:
        return False

def generate_jwt_token(user_id: str, business_id: str, role: str, expires_hours: int = 24) -> str:
    """Generate a simple JWT-like token (in production, use proper JWT library)"""
    payload = {
        "user_id": user_id,
        "business_id": business_id,
        "role": role,
        "exp": (datetime.now(timezone.utc) + timedelta(hours=expires_hours)).isoformat(),
        "iat": datetime.now(timezone.utc).isoformat()
    }
    # Simple base64 encoding (in production, use proper JWT signing)
    token_data = json.dumps(payload)
    token_hash = hashlib.sha256(token_data.encode()).hexdigest()
    return f"{token_hash}.{token_data}"

def verify_jwt_token(token: str) -> Optional[Dict]:
    """Verify JWT-like token"""
    try:
        token_hash, token_data = token.split(".", 1)
        computed_hash = hashlib.sha256(token_data.encode()).hexdigest()

        if not hmac.compare_digest(computed_hash, token_hash):
            return None

        payload = json.loads(token_data)
        exp = datetime.fromisoformat(payload["exp"])

        if datetime.now(timezone.utc) > exp:
            return None

        return payload
    except:
        return None

def generate_otp(length: int = 6) -> str:
    """Generate numeric OTP"""
    return "".join([str(secrets.randbelow(10)) for _ in range(length)])

def store_otp(phone: str, otp: str, expires_minutes: int = 5) -> str:
    """Store OTP with expiration"""
    otp_id = str(uuid.uuid4())
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)).isoformat()

    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS otp_verifications(
              id TEXT PRIMARY KEY,
              phone TEXT NOT NULL,
              otp TEXT NOT NULL,
              expires_at TEXT NOT NULL,
              verified BOOLEAN DEFAULT 0,
              created_at TEXT NOT NULL
            )
        """)
        conn.execute(
            "INSERT INTO otp_verifications VALUES(?,?,?,?,?,?)",
            (otp_id, phone, otp, expires_at, False, datetime.now(timezone.utc).isoformat())
        )
        conn.commit()

    return otp_id

def verify_otp(phone: str, otp: str) -> bool:
    """Verify OTP"""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM otp_verifications WHERE phone=? AND otp=? AND verified=0 AND expires_at > ?",
            (phone, otp, datetime.now(timezone.utc).isoformat())
        ).fetchone()

        if not row:
            return False

        conn.execute(
            "UPDATE otp_verifications SET verified=1 WHERE id=?",
            (row["id"],)
        )
        conn.commit()

        return True

def register_local_user(business_id: str, display_name: str, email: str, password: str, role: str = "owner") -> str:
    """Register user with local authentication"""
    user_id = str(uuid.uuid4())
    password_hash = hash_password(password)
    now = datetime.now(timezone.utc).isoformat()

    with get_db() as conn:
        # Create passwords table if not exists
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_passwords(
              user_id TEXT PRIMARY KEY,
              password_hash TEXT NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        try:
            conn.execute(
                "INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?,?)",
                (user_id, business_id, display_name, email, None, role, "local", None, now, None)
            )
            conn.execute(
                "INSERT INTO user_passwords VALUES(?,?)",
                (user_id, password_hash)
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise ValueError("Email already registered")

    return user_id

def register_whatsapp_user(business_id: str, display_name: str, phone: str, whatsapp_id: str, role: str = "owner") -> str:
    """Register user with WhatsApp authentication"""
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    with get_db() as conn:
        try:
            conn.execute(
                "INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?,?)",
                (user_id, business_id, display_name, None, phone, role, "whatsapp", whatsapp_id, now, None)
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise ValueError("Phone number already registered")

    return user_id

def authenticate_local(email: str, password: str) -> Optional[Dict]:
    """Authenticate user with local credentials"""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email=? AND auth_provider='local'",
            (email,)
        ).fetchone()

        if not row:
            return None

        # Get password hash
        pw_row = conn.execute(
            "SELECT password_hash FROM user_passwords WHERE user_id=?",
            (row["id"],)
        ).fetchone()

        if not pw_row or not verify_password(password, pw_row["password_hash"]):
            return None

        # Update last login
        conn.execute(
            "UPDATE users SET last_login_at=? WHERE id=?",
            (datetime.now(timezone.utc).isoformat(), row["id"])
        )
        conn.commit()

        user = dict(row)
        user.pop("auth_provider_id", None)

        return user

def authenticate_whatsapp(phone: str, otp: str) -> Optional[Dict]:
    """Authenticate user with WhatsApp OTP"""
    if not verify_otp(phone, otp):
        return None

    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE phone=? AND auth_provider='whatsapp'",
            (phone,)
        ).fetchone()

        if not row:
            return None

        # Update last login
        conn.execute(
            "UPDATE users SET last_login_at=? WHERE id=?",
            (datetime.now(timezone.utc).isoformat(), row["id"])
        )
        conn.commit()

        user = dict(row)
        user.pop("auth_provider_id", None)

        return user

def get_user(user_id: str) -> Optional[Dict]:
    """Get user by ID"""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        return dict(row) if row else None

def update_last_login(user_id: str):
    """Update user's last login timestamp"""
    with get_db() as conn:
        conn.execute(
            "UPDATE users SET last_login_at=? WHERE id=?",
            (datetime.now(timezone.utc).isoformat(), user_id)
        )
        conn.commit()

if __name__ == "__main__":
    # Test authentication system
    print("Testing Unified Authentication System...")

    # Test 1: Generate OTP
    phone = "9876543210"
    otp = generate_otp()
    print(f"Generated OTP for {phone}: {otp}")

    otp_id = store_otp(phone, otp)
    print(f"Stored OTP ID: {otp_id}")

    # Test 2: Verify OTP
    is_valid = verify_otp(phone, otp)
    print(f"OTP verification: {is_valid}")

    # Test 3: Register local user (first create a business)
    business_id = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute("INSERT INTO businesses VALUES(?,?,?,?,?,?,?,?)",
                    (business_id, "Test Business", "retail", "basic", "INR",
                     datetime.now(timezone.utc).isoformat(),
                     datetime.now(timezone.utc).isoformat(), "{}"))
        conn.commit()

    user_id = register_local_user(business_id, "Test User", "test@example.com", "password123")
    print(f"Registered local user: {user_id}")

    # Test 4: Authenticate local user
    try:
        user = authenticate_local("test@example.com", "password123")
        print(f"Authenticated user: {user['display_name'] if user else 'Failed'}")
    except Exception as e:
        print(f"Authentication test failed: {e}")

    # Test 5: Generate JWT token
    if user:
        token = generate_jwt_token(user["id"], user["business_id"], user["role"])
        print(f"Generated token: {token[:50]}...")

        # Test 6: Verify token
        payload = verify_jwt_token(token)
        print(f"Token payload: {payload}")

    print("Authentication system tests complete!")
