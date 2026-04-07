import csv
import os
import random
import re
import shutil
import subprocess
import uuid
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent
ENV_PATH = PROJECT_ROOT / ".env"


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        cleaned = line.strip()
        if not cleaned or cleaned.startswith("#") or "=" not in cleaned:
            continue
        key, value = cleaned.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_env_file(ENV_PATH)

from app.config import UPLOADS_DIR  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import CrimeReport, EvidenceFile, User  # noqa: E402
from app.security import hash_password  # noqa: E402


RANDOM_SEED = 20260407
TOTAL_USERS = 100
PASSWORD = "Citizen123"
STATE = "Maharashtra"
SEED_TAG = "[bulk-seed-citizen-report]"
KAGGLE_DATASET = "odins0n/ucf-crime-dataset"
KAGGLE_EXE = Path(r"C:\Users\Shweta Yadav\AppData\Local\Programs\Python\Python312\Scripts\kaggle.exe")
CRIME_TYPES = [
    "Theft",
    "Robbery",
    "Assault",
    "Burglary",
    "Cyber Crime",
    "Drug Offences",
    "Domestic Violence",
    "Cheating Fraud",
]
KAGGLE_TOKEN_PATTERN = re.compile(r"^Next Page Token = (.+)$")
SEVERITIES = ["Low", "Medium", "High"]
STREET_NAMES = [
    "MG Road",
    "Shivaji Chowk",
    "Tilak Road",
    "Station Road",
    "Market Yard",
    "Civil Lines",
    "Ganesh Nagar",
    "Laxmi Colony",
]


def _load_maharashtra_locations() -> list[dict]:
    csv_path = PROJECT_ROOT / "india_cities_crime_2020_2025.csv"
    locations: list[dict] = []
    seen: set[tuple[str, str, str]] = set()

    with csv_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            if row["State"] != STATE:
                continue

            key = (row["District"], row["City"], row["Year"])
            if key in seen:
                continue
            seen.add(key)

            locations.append(
                {
                    "district": row["District"],
                    "city": row["City"],
                    "latitude": float(row["Latitude"]),
                    "longitude": float(row["Longitude"]),
                }
            )

    if not locations:
        raise RuntimeError("No Maharashtra locations found in historical dataset")

    return locations


def _load_evidence_images() -> list[Path]:
    evidence_dir = PROJECT_ROOT / "seed_assets" / "ucf_crime_diverse_100"
    images = sorted(path for path in evidence_dir.glob("*.png") if path.is_file())
    if not images:
        raise RuntimeError("No Kaggle evidence images found in backend/seed_assets/ucf_crime_diverse_100")
    return images


def _clip_key(file_name: str) -> str:
    stem = Path(file_name).stem
    if "_" not in stem:
        return stem
    return stem.rsplit("_", 1)[0]


def _download_diverse_kaggle_images() -> list[Path]:
    if not KAGGLE_EXE.exists():
        raise RuntimeError(f"Kaggle executable not found at {KAGGLE_EXE}")

    destination = PROJECT_ROOT / "seed_assets" / "ucf_crime_diverse_100"
    destination.mkdir(parents=True, exist_ok=True)

    # Reuse an already prepared diverse set when available.
    existing = sorted(path for path in destination.glob("*.png") if path.is_file())
    if len(existing) >= TOTAL_USERS:
        return existing[:TOTAL_USERS]

    selected_files: list[str] = []
    seen_clips: set[str] = set()
    page_token: str | None = None

    for _ in range(200):
        command = [
            str(KAGGLE_EXE),
            "datasets",
            "files",
            KAGGLE_DATASET,
            "--page-size",
            "200",
            "-v",
        ]
        if page_token:
            command.extend(["--page-token", page_token])

        result = subprocess.run(
            command,
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )

        output_lines = [line.rstrip("\r") for line in result.stdout.splitlines() if line.strip()]
        next_page_token = None
        csv_lines: list[str] = []
        for line in output_lines:
            token_match = KAGGLE_TOKEN_PATTERN.match(line)
            if token_match:
                next_page_token = token_match.group(1)
                continue
            csv_lines.append(line)

        if len(csv_lines) <= 1:
            break

        for row in csv.DictReader(csv_lines):
            file_name = row.get("name")
            if not file_name:
                continue
            clip_name = _clip_key(file_name)
            if clip_name in seen_clips:
                continue
            seen_clips.add(clip_name)
            selected_files.append(file_name)
            if len(selected_files) >= TOTAL_USERS:
                break

        if len(selected_files) >= TOTAL_USERS or not next_page_token:
            break
        page_token = next_page_token

    if len(selected_files) < TOTAL_USERS:
        raise RuntimeError(f"Only found {len(selected_files)} distinct Kaggle clips, expected {TOTAL_USERS}")

    for file_name in selected_files:
        target_name = Path(file_name).name
        target_path = destination / target_name
        if target_path.exists():
            continue
        subprocess.run(
            [
                str(KAGGLE_EXE),
                "datasets",
                "download",
                KAGGLE_DATASET,
                "-f",
                file_name,
                "-p",
                str(destination),
                "-o",
                "-q",
            ],
            cwd=PROJECT_ROOT,
            check=True,
        )

    return sorted(path for path in destination.glob("*.png") if path.is_file())[:TOTAL_USERS]


def _build_user_payload(index: int, location: dict) -> dict:
    street_name = STREET_NAMES[(index - 1) % len(STREET_NAMES)]
    return {
        "full_name": f"Citizen User {index}",
        "username": f"user{index}",
        "email": f"user{index}@example.com",
        "phone": f"900000{index:04d}",
        "address": f"House {index}, {street_name}, {location['city']}, {location['district']}, {STATE}",
        "government_id": f"1234123412{index:04d}",
        "gps_consent": False,
        "password_hash": hash_password(PASSWORD),
        "role": "citizen",
        "status": "approved",
        "district": location["district"],
        "city": location["city"],
    }


def _report_description(index: int, location: dict, crime_type: str) -> str:
    return (
        f"{SEED_TAG} Citizen user{index} reported suspected {crime_type.lower()} activity near "
        f"{location['city']} in {location['district']} district. Local residents noticed the incident and "
        "submitted photo evidence for police review."
    )


def _ensure_user(db, index: int, location: dict) -> User:
    username = f"user{index}"
    existing_user = db.query(User).filter(User.username == username).first()
    payload = _build_user_payload(index, location)

    if existing_user:
        existing_user.full_name = payload["full_name"]
        existing_user.email = payload["email"]
        existing_user.phone = payload["phone"]
        existing_user.address = payload["address"]
        existing_user.government_id = payload["government_id"]
        existing_user.gps_consent = payload["gps_consent"]
        existing_user.password_hash = payload["password_hash"]
        existing_user.role = payload["role"]
        existing_user.status = payload["status"]
        existing_user.district = payload["district"]
        existing_user.city = payload["city"]
        return existing_user

    user = User(**payload)
    db.add(user)
    db.flush()
    return user


def _ensure_report(
    db,
    *,
    user: User,
    index: int,
    location: dict,
    evidence_image: Path,
) -> tuple[CrimeReport, bool]:
    existing_report = (
        db.query(CrimeReport)
        .filter(
            CrimeReport.reporter_user_id == user.id,
            CrimeReport.description.contains(SEED_TAG),
        )
        .first()
    )

    if existing_report:
        active_evidence = next((item for item in existing_report.evidence if not item.is_archived), None)
        if active_evidence is not None:
            destination = Path(active_evidence.file_path)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(evidence_image, destination)
            active_evidence.original_file_name = evidence_image.name
            active_evidence.file_size = destination.stat().st_size
            active_evidence.content_type = "image/png"
            active_evidence.file_type = "image"
        return existing_report, False

    crime_type = CRIME_TYPES[(index - 1) % len(CRIME_TYPES)]
    report = CrimeReport(
        report_id=f"CR{uuid.uuid4().hex[:8].upper()}",
        reporter_user_id=user.id,
        crime_type=crime_type,
        severity=SEVERITIES[(index - 1) % len(SEVERITIES)],
        description=_report_description(index, location, crime_type),
        latitude=round(location["latitude"] + random.uniform(-0.01, 0.01), 6),
        longitude=round(location["longitude"] + random.uniform(-0.01, 0.01), 6),
        city=location["city"],
        state=STATE,
        status="Submitted",
        assigned_station=None,
        assigned_district=location["district"],
    )
    db.add(report)
    db.flush()

    report_dir = UPLOADS_DIR / "reports" / report.report_id
    report_dir.mkdir(parents=True, exist_ok=True)
    stored_file_name = f"{uuid.uuid4().hex}{evidence_image.suffix.lower()}"
    stored_path = report_dir / stored_file_name
    shutil.copy2(evidence_image, stored_path)

    evidence = EvidenceFile(
        report_id=report.id,
        original_file_name=evidence_image.name,
        stored_file_name=stored_file_name,
        file_path=str(stored_path),
        file_type="image",
        content_type="image/png",
        file_size=stored_path.stat().st_size,
        is_archived=False,
    )
    db.add(evidence)
    return report, True


def main() -> None:
    random.seed(RANDOM_SEED)
    locations = _load_maharashtra_locations()
    evidence_images = _download_diverse_kaggle_images()
    db = SessionLocal()

    users_created = 0
    users_updated = 0
    reports_created = 0
    reports_skipped = 0

    try:
        for index in range(1, TOTAL_USERS + 1):
            location = random.choice(locations)
            evidence_image = evidence_images[(index - 1) % len(evidence_images)]

            existing_user = db.query(User).filter(User.username == f"user{index}").first()
            user = _ensure_user(db, index, location)
            if existing_user is None:
                users_created += 1
            else:
                users_updated += 1

            _, created = _ensure_report(
                db,
                user=user,
                index=index,
                location=location,
                evidence_image=evidence_image,
            )
            if created:
                reports_created += 1
            else:
                reports_skipped += 1

        db.commit()
        print(
            {
                "users_created": users_created,
                "users_updated": users_updated,
                "reports_created": reports_created,
                "reports_skipped": reports_skipped,
                "evidence_images_available": len(evidence_images),
                "seeded_users_target": TOTAL_USERS,
                "default_password": PASSWORD,
            }
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
