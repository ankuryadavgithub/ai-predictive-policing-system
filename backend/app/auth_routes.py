from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.audit import logger
from app.config import settings
from app.dependencies import get_current_user, get_db, get_token_from_request
from app.models import User
from app.rate_limit import enforce_rate_limit
from app.schemas import AuthUserResponse, LoginRequest, RegisterRequest
from app.security import (
    create_access_token,
    hash_password,
    revoke_token,
    validate_password_strength,
    verify_password,
    verify_token,
)


router = APIRouter(prefix="/auth", tags=["Auth"])


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.access_cookie_name,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.access_token_expire_minutes * 60,
        expires=settings.access_token_expire_minutes * 60,
        path="/",
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(
    payload: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    enforce_rate_limit(
        f"register:{client_ip}",
        settings.registration_rate_limit,
        settings.rate_limit_window_seconds,
    )

    if payload.confirm_password and payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    if not validate_password_strength(payload.password):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters with uppercase, lowercase, and a number",
        )

    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already exists")

    if payload.role == "admin":
        if not settings.allow_admin_registration:
            raise HTTPException(status_code=403, detail="Admin registration is disabled")
        if payload.auth_code != settings.admin_registration_code:
            raise HTTPException(status_code=403, detail="Invalid admin authorization code")

    if payload.role == "police":
        status_value = "pending"
    else:
        status_value = "approved"

    user = User(
        full_name=payload.full_name,
        username=payload.username,
        email=payload.email,
        phone=payload.phone,
        address=payload.address,
        government_id=payload.aadhaar,
        gps_consent=payload.gps_permission,
        password_hash=hash_password(payload.password),
        role=payload.role,
        status=status_value,
        badge_id=payload.badge_id,
        rank=payload.rank,
        station=payload.station,
        district=payload.district,
        city=payload.city,
        department=payload.department,
    )

    db.add(user)
    db.commit()

    logger.info("User registered username=%s role=%s status=%s", user.username, user.role, user.status)
    return {
        "message": "User registered successfully",
        "status": user.status,
    }


@router.post("/login")
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    enforce_rate_limit(
        f"login:{client_ip}:{payload.username}",
        settings.login_rate_limit,
        settings.rate_limit_window_seconds,
    )

    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if user.status != "approved":
        raise HTTPException(status_code=403, detail="Account pending admin approval or suspended")

    token, token_id, expires_at = create_access_token(
        {"sub": str(user.id), "role": user.role, "username": user.username}
    )
    _set_auth_cookie(response, token)

    logger.info("User logged in username=%s role=%s token_id=%s", user.username, user.role, token_id)
    return {
        "message": "Login successful",
        "access_token": token,
        "token_type": "bearer",
        "expires_at": expires_at.isoformat(),
        "user": AuthUserResponse.model_validate(user).model_dump(mode="json"),
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    token: str = Depends(get_token_from_request),
):
    payload = verify_token(token)
    if payload:
        revoke_token(payload.get("jti"), payload["exp"])

    response.delete_cookie(key=settings.access_cookie_name, path="/")
    logger.info("User logged out token_subject=%s", payload.get("sub") if payload else "unknown")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=AuthUserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
