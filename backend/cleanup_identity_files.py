from __future__ import annotations

from app.database import SessionLocal
from app.identity_verification import delete_expired_identity_files


def main() -> int:
    db = SessionLocal()
    try:
        deleted_paths = delete_expired_identity_files(db)
    finally:
        db.close()

    print(f"Deleted {deleted_paths} expired identity verification files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
