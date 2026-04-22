from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.audit import logger
from app.config import settings
from app.dependencies import get_current_user, get_db, get_token_from_request
from app.identity_verification import create_pending_or_approved_citizen
from app.models import IdentityVerification, User
from app.rate_limit import enforce_rate_limit
from app.schemas import (
    AuthUserResponse,
    CitizenVerificationResponse,
    LoginRequest,
    PoliceLocationUpdateRequest,
    RegisterRequest,
)
from app.security import (
    create_access_token,
    hash_password,
    revoke_token,
    validate_password_strength,
    verify_password,
    verify_token,
)


router = APIRouter(prefix="/auth", tags=["Auth"])


def _format_error_detail(detail) -> str:
    if isinstance(detail, str):
        return detail
    if isinstance(detail, list):
        messages: list[str] = []
        for item in detail:
            if isinstance(item, dict):
                loc = item.get("loc")
                prefix = " -> ".join(str(part) for part in loc[1:]) if isinstance(loc, (list, tuple)) else ""
                message = item.get("msg") or item.get("message") or "Validation error"
                messages.append(f"{prefix}: {message}" if prefix else message)
            else:
                messages.append(str(item))
        return "; ".join(messages)
    if isinstance(detail, dict):
        return detail.get("message") or detail.get("detail") or "Request failed"
    return "Request failed"


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


def _raise_citizen_verification_login_status(db: Session, username: str, password: str) -> None:
    verification = (
        db.query(IdentityVerification)
        .filter(IdentityVerification.username == username)
        .order_by(IdentityVerification.created_at.desc(), IdentityVerification.id.desc())
        .first()
    )
    if not verification or not verify_password(password, verification.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if verification.verification_status == "rejected":
        raise HTTPException(
            status_code=403,
            detail=verification.rejection_reason or "Your citizen account was rejected during Aadhaar verification.",
        )

    raise HTTPException(
        status_code=403,
        detail="Your account is under Aadhaar verification. Kindly wait for admin approval before logging in.",
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

    if payload.role == "citizen":
        raise HTTPException(
            status_code=400,
            detail="Citizen registration requires Aadhaar and live selfie verification. Use the verified registration flow.",
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


@router.post(
    "/register/citizen-verified",
    status_code=status.HTTP_201_CREATED,
    response_model=CitizenVerificationResponse,
)
def register_verified_citizen(
    request: Request,
    full_name: str = Form(..., alias="fullName"),
    username: str = Form(...),
    email: str = Form(...),
    phone: str | None = Form(default=None),
    password: str = Form(...),
    confirm_password: str | None = Form(default=None, alias="confirmPassword"),
    city: str | None = Form(default=None),
    address: str | None = Form(default=None),
    gps_permission: bool = Form(default=False, alias="gpsPermission"),
    aadhaar_card: UploadFile = File(...),
    live_selfie: UploadFile = File(...),
    liveness_frames: list[UploadFile] | None = File(default=None),
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    enforce_rate_limit(
        f"register:{client_ip}:citizen_verified",
        settings.registration_rate_limit,
        settings.rate_limit_window_seconds,
    )

    if confirm_password and password != confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    if not validate_password_strength(password):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters with uppercase, lowercase, and a number",
        )

    try:
        verification, created_user = create_pending_or_approved_citizen(
            db=db,
            full_name=full_name.strip(),
            username=username.strip(),
            email=email.strip(),
            phone=phone.strip() if phone else None,
            address=address.strip() if address else None,
            city=city.strip() if city else None,
            password=password,
            gps_permission=gps_permission,
            aadhaar_card=aadhaar_card,
            live_selfie=live_selfie,
            liveness_frames=liveness_frames,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Citizen verification registration failed unexpectedly for username=%s", username)
        raise HTTPException(
            status_code=500,
            detail="Citizen verification could not be completed. Please retry or contact admin for manual review.",
        ) from exc
    db.commit()

    if verification.verification_status == "approved":
        return {
            "status": "approved",
            "message": "Citizen registration verified successfully. You can now sign in.",
            "verification_id": verification.id,
            "user_id": created_user.id if created_user else None,
        }

    if verification.verification_status == "rejected":
        return {
            "status": "rejected",
            "message": verification.rejection_reason or "Citizen verification was rejected.",
            "verification_id": verification.id,
            "user_id": None,
        }

    return {
        "status": "pending_manual_review",
        "message": "Your account is under Aadhaar verification. Kindly wait for admin review and approval.",
        "verification_id": verification.id,
        "user_id": None,
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
    if not user:
        _raise_citizen_verification_login_status(db, payload.username, payload.password)

    if not verify_password(payload.password, user.password_hash):
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


@router.post("/location")
def update_police_location(
    payload: PoliceLocationUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "police":
        raise HTTPException(status_code=403, detail="Only police accounts can update live location")
    if not current_user.gps_consent:
        raise HTTPException(status_code=403, detail="GPS sharing is not enabled for this police account")
    if not (-90 <= payload.latitude <= 90 and -180 <= payload.longitude <= 180):
        raise HTTPException(status_code=400, detail="Invalid latitude or longitude")

    current_user.current_latitude = payload.latitude
    current_user.current_longitude = payload.longitude
    current_user.location_updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "message": "Police live location updated",
        "location_updated_at": current_user.location_updated_at.isoformat(),
    }
