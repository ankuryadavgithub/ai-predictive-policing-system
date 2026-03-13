from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import User
from app.security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth")

def get_db():

    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


@router.post("/register")
def register_user(data: dict, db: Session = Depends(get_db)):

    role = data.get("role")

    # Default status
    status = "approved"

    # Police require admin approval
    if role == "police":
        status = "pending"

    user = User(
        full_name=data.get("fullName"),
        username=data.get("username"),
        email=data.get("email"),
        phone=data.get("phone"),
        password_hash=hash_password(data.get("password")),
        role=role,
        status=status,   # NEW FIELD
        badge_id=data.get("badgeId"),
        rank=data.get("rank"),
        station=data.get("station"),
        district=data.get("district"),
        city=data.get("city"),
        department=data.get("department"),
    )

    db.add(user)
    db.commit()

    return {"message": "User registered successfully"}

@router.post("/login")
def login(data: dict, db: Session = Depends(get_db)):

    user = db.query(User).filter(
        User.username == data.get("username")
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid username")

    if not verify_password(data.get("password"), user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid password")

    # NEW CHECK
    if user.status != "approved":
        raise HTTPException(
            status_code=403,
            detail="Account pending admin approval"
        )

    token = create_access_token({
        "sub": user.username,
        "role": user.role
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username
    }