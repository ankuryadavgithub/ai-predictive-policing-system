from fastapi import Cookie, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import User
from app.security import verify_token


security = HTTPBearer(auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_token_from_request(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    access_cookie: str | None = Cookie(default=None, alias=settings.access_cookie_name),
) -> str:
    if credentials and credentials.credentials:
        return credentials.credentials
    if access_cookie:
        return access_cookie
    raise HTTPException(status_code=401, detail="Authentication required")


def get_current_user(
    token: str = Depends(get_token_from_request),
    db: Session = Depends(get_db),
) -> User:
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    try:
        resolved_user_id = int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token payload") from None

    user = db.query(User).filter(User.id == resolved_user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if user.status in {"pending", "suspended"}:
        raise HTTPException(status_code=403, detail="Account not allowed to access the system")
    return user
