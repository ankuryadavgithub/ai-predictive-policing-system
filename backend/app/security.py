from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt

SECRET_KEY = "supersecretkey123"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ----------------------
# Password Hashing
# ----------------------

def hash_password(password):
    return pwd_context.hash(password)


def verify_password(password, hashed):
    return pwd_context.verify(password, hashed)


# ----------------------
# JWT Token Creation
# ----------------------

def create_access_token(data: dict):

    to_encode = data.copy()

    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return encoded_jwt


# ----------------------
# Token Verification
# ----------------------

def verify_token(token: str):

    try:

        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        username: str = payload.get("sub")

        role: str = payload.get("role")

        if username is None:
            return None

        return {"username": username, "role": role}

    except JWTError:
        return None