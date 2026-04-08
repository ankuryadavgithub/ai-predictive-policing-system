from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.audit import logger
from app.config import UPLOADS_DIR, settings
from app.models import IdentityVerification, User
from app.security import hash_password


IDENTITY_ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}
AADHAAR_REGEX = re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b")
VERIFICATION_UPLOAD_DIR = UPLOADS_DIR / "identity_verifications"

_easyocr_reader = None


@dataclass
class VerificationArtifacts:
    aadhaar_card_path: str
    live_selfie_path: str
    liveness_frames_path: str | None


@dataclass
class VerificationDecision:
    status: str
    aadhaar_masked: str | None
    ocr_status: str
    liveness_status: str
    face_match_status: str
    face_match_score: float | None
    rejection_reason: str | None


@dataclass
class ImageQualityResult:
    status: str
    reason: str
    brightness: float
    sharpness: float
    width: int
    height: int


def _downgrade_to_manual_review(decision: VerificationDecision) -> VerificationDecision:
    if decision.status == "pending_manual_review":
        return decision

    reason = decision.rejection_reason or "Awaiting admin review"
    return VerificationDecision(
        status="pending_manual_review",
        aadhaar_masked=decision.aadhaar_masked,
        ocr_status=decision.ocr_status,
        liveness_status=decision.liveness_status,
        face_match_status=decision.face_match_status,
        face_match_score=decision.face_match_score,
        rejection_reason=reason,
    )


def _import_vision_dependencies():
    try:
        import cv2
        import easyocr
        from PIL import Image
    except ImportError as exc:  # pragma: no cover - environment specific
        raise RuntimeError(
            "Identity verification dependencies are missing. Install opencv-python, Pillow, and easyocr."
        ) from exc
    return cv2, easyocr, Image


def _import_tesseract():
    try:
        import pytesseract
    except ImportError:
        return None
    return pytesseract


def _get_easyocr_reader():
    global _easyocr_reader
    if _easyocr_reader is None:
        _, easyocr, _ = _import_vision_dependencies()
        try:
            _easyocr_reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        except Exception as exc:  # pragma: no cover - depends on local OCR/runtime setup
            logger.warning("EasyOCR initialization failed; citizen verification will fall back to manual review: %s", exc)
            _easyocr_reader = False
    return _easyocr_reader


def _ensure_unique_registration_targets(db: Session, username: str, email: str) -> None:
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="Email already exists")
    existing_verification = (
        db.query(IdentityVerification)
        .filter(
            (IdentityVerification.username == username)
            | (IdentityVerification.email == email)
        )
        .filter(IdentityVerification.verification_status != "rejected")
        .first()
    )
    if existing_verification:
        raise HTTPException(status_code=409, detail="A verification request already exists for this citizen")


def _validate_upload(file: UploadFile, *, label: str) -> None:
    content_type = (file.content_type or "").lower()
    if content_type not in IDENTITY_ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"{label} must be a JPG, PNG, or WEBP image")


def _save_upload(file: UploadFile, destination_dir: Path, *, prefix: str) -> str:
    _validate_upload(file, label=prefix.replace("_", " ").title())
    suffix = Path(file.filename or "").suffix.lower() or ".jpg"
    destination_dir.mkdir(parents=True, exist_ok=True)
    destination = destination_dir / f"{prefix}_{uuid.uuid4().hex}{suffix}"

    total_size = 0
    with destination.open("wb") as buffer:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > settings.identity_max_upload_size_bytes:
                buffer.close()
                destination.unlink(missing_ok=True)
                raise HTTPException(status_code=400, detail=f"{prefix.replace('_', ' ').title()} exceeds upload limit")
            buffer.write(chunk)
    file.file.close()
    return str(destination)


def save_verification_uploads(
    verification_token: str,
    aadhaar_card: UploadFile,
    live_selfie: UploadFile,
    liveness_frames: list[UploadFile] | None,
) -> VerificationArtifacts:
    verification_dir = VERIFICATION_UPLOAD_DIR / verification_token
    aadhaar_card_path = _save_upload(aadhaar_card, verification_dir, prefix="aadhaar_card")
    live_selfie_path = _save_upload(live_selfie, verification_dir, prefix="live_selfie")

    liveness_dir = verification_dir / "liveness_frames"
    frame_paths: list[str] = []
    for index, frame in enumerate(liveness_frames or []):
        frame_paths.append(_save_upload(frame, liveness_dir, prefix=f"frame_{index+1}"))

    return VerificationArtifacts(
        aadhaar_card_path=aadhaar_card_path,
        live_selfie_path=live_selfie_path,
        liveness_frames_path=str(liveness_dir) if frame_paths else None,
    )


def extract_aadhaar_number(image_path: str) -> tuple[str | None, str]:
    cv2, _, _ = _import_vision_dependencies()
    reader = _get_easyocr_reader()
    source = cv2.imread(image_path)
    if source is None:
        return None, "failed"

    grayscale = cv2.cvtColor(source, cv2.COLOR_BGR2GRAY)
    enlarged = cv2.resize(grayscale, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    denoised = cv2.bilateralFilter(enlarged, 9, 75, 75)
    thresholded = cv2.adaptiveThreshold(
        denoised,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        2,
    )
    ocr_images = [source, enlarged, thresholded]
    text_candidates: list[str] = []

    if reader is not False:
        for candidate in ocr_images:
            results = reader.readtext(candidate, detail=0, paragraph=True)
            if results:
                text_candidates.append(" ".join(results))

    pytesseract = _import_tesseract()
    if pytesseract is not None:
        try:
            config = "--psm 6 -c tessedit_char_whitelist=0123456789 "
            for candidate in [enlarged, thresholded]:
                text_candidates.append(pytesseract.image_to_string(candidate, config=config))
        except Exception as exc:  # pragma: no cover - environment specific
            logger.warning("pytesseract Aadhaar extraction fallback failed: %s", exc)

    for text_blob in text_candidates:
        match = AADHAAR_REGEX.search(text_blob)
        if match:
            raw_number = re.sub(r"\s+", "", match.group(0))
            return raw_number, "success"

    if reader is False and pytesseract is None:
        return None, "unavailable"
    return None, "failed"


def mask_aadhaar(aadhaar_number: str | None) -> str | None:
    if not aadhaar_number or len(aadhaar_number) != 12:
        return None
    return f"XXXXXXXX{aadhaar_number[-4:]}"


def _load_image_bgr(path: str):
    cv2, _, _ = _import_vision_dependencies()
    image = cv2.imread(path)
    if image is None:
        raise HTTPException(status_code=400, detail="Failed to read uploaded verification image")
    return image


def assess_image_quality(image_path: str, *, kind: str) -> ImageQualityResult:
    cv2, _, _ = _import_vision_dependencies()
    image = _load_image_bgr(image_path)
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    brightness = float(np.mean(gray))
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    min_width = settings.identity_min_image_width
    min_height = settings.identity_min_image_height
    blur_threshold = (
        settings.identity_aadhaar_blur_threshold
        if kind == "aadhaar"
        else settings.identity_selfie_blur_threshold
    )

    if width < min_width or height < min_height:
        return ImageQualityResult(
            status="low_quality",
            reason=f"{kind}_resolution_low",
            brightness=brightness,
            sharpness=sharpness,
            width=width,
            height=height,
        )
    if brightness < settings.identity_min_brightness:
        return ImageQualityResult(
            status="low_quality",
            reason=f"{kind}_too_dark",
            brightness=brightness,
            sharpness=sharpness,
            width=width,
            height=height,
        )
    if brightness > settings.identity_max_brightness:
        return ImageQualityResult(
            status="low_quality",
            reason=f"{kind}_too_bright",
            brightness=brightness,
            sharpness=sharpness,
            width=width,
            height=height,
        )
    if sharpness < blur_threshold:
        return ImageQualityResult(
            status="low_quality",
            reason=f"{kind}_blurred",
            brightness=brightness,
            sharpness=sharpness,
            width=width,
            height=height,
        )

    return ImageQualityResult(
        status="clear",
        reason="passed",
        brightness=brightness,
        sharpness=sharpness,
        width=width,
        height=height,
    )


def detect_face_crop(image_path: str):
    cv2, _, _ = _import_vision_dependencies()
    image = _load_image_bgr(image_path)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(str(Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"))
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))
    if len(faces) == 0:
        return None
    x, y, w, h = max(faces, key=lambda face: face[2] * face[3])
    return gray[y : y + h, x : x + w]


def compute_face_match_score(aadhaar_image_path: str, selfie_image_path: str) -> tuple[float | None, str]:
    cv2, _, _ = _import_vision_dependencies()
    aadhaar_face = detect_face_crop(aadhaar_image_path)
    selfie_face = detect_face_crop(selfie_image_path)
    if aadhaar_face is None or selfie_face is None:
        return None, "face_missing"

    aadhaar_face = cv2.resize(aadhaar_face, (160, 160))
    selfie_face = cv2.resize(selfie_face, (160, 160))

    orb = cv2.ORB_create()
    keypoints_a, descriptors_a = orb.detectAndCompute(aadhaar_face, None)
    keypoints_b, descriptors_b = orb.detectAndCompute(selfie_face, None)

    if descriptors_a is None or descriptors_b is None or not keypoints_a or not keypoints_b:
        return None, "face_features_missing"

    matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = matcher.match(descriptors_a, descriptors_b)
    if not matches:
        return 0.0, "mismatch"

    good_matches = [match for match in matches if match.distance < 60]
    normalization = max(len(keypoints_a), len(keypoints_b), 1)
    score = len(good_matches) / normalization

    if score >= settings.identity_face_match_threshold:
        return float(score), "matched"
    if score >= settings.identity_face_review_threshold:
        return float(score), "review"
    return float(score), "mismatch"


def evaluate_liveness(frame_dir: str | None, selfie_path: str) -> tuple[str, str]:
    cv2, _, _ = _import_vision_dependencies()
    if not frame_dir:
        return "pending_manual_review", "insufficient_frames"

    frame_paths = sorted(Path(frame_dir).glob("*"))
    if len(frame_paths) < 2:
        return "pending_manual_review", "insufficient_frames"

    grayscale_frames = []
    for frame_path in frame_paths:
        image = cv2.imread(str(frame_path), cv2.IMREAD_GRAYSCALE)
        if image is None:
            continue
        grayscale_frames.append(cv2.resize(image, (160, 160)))

    if len(grayscale_frames) < 2:
        return "pending_manual_review", "insufficient_frames"

    diffs = []
    for previous, current in zip(grayscale_frames, grayscale_frames[1:]):
        diffs.append(float(np.mean(cv2.absdiff(previous, current)) / 255.0))

    if not diffs:
        return "pending_manual_review", "insufficient_frames"

    if detect_face_crop(selfie_path) is None:
        return "rejected", "face_missing"

    mean_diff = float(np.mean(diffs))
    if mean_diff >= settings.identity_liveness_threshold:
        return "approved", "passed"
    return "pending_manual_review", "low_motion"


def build_verification_decision(
    aadhaar_card_path: str,
    live_selfie_path: str,
    liveness_frames_path: str | None,
) -> VerificationDecision:
    aadhaar_quality = assess_image_quality(aadhaar_card_path, kind="aadhaar")
    selfie_quality = assess_image_quality(live_selfie_path, kind="selfie")

    if aadhaar_quality.status != "clear":
        return VerificationDecision(
            status="pending_manual_review",
            aadhaar_masked=None,
            ocr_status=aadhaar_quality.reason,
            liveness_status="pending",
            face_match_status="pending",
            face_match_score=None,
            rejection_reason="Aadhaar image is not clear enough for automatic verification",
        )

    if selfie_quality.status != "clear":
        return VerificationDecision(
            status="pending_manual_review",
            aadhaar_masked=None,
            ocr_status="pending",
            liveness_status=selfie_quality.reason,
            face_match_status="pending",
            face_match_score=None,
            rejection_reason="Live selfie is not clear enough for automatic verification",
        )

    try:
        aadhaar_number, ocr_status = extract_aadhaar_number(aadhaar_card_path)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - depends on local OCR/runtime setup
        logger.warning("Aadhaar OCR failed during citizen verification; falling back to manual review: %s", exc)
        aadhaar_number, ocr_status = None, "unavailable"
    aadhaar_masked = mask_aadhaar(aadhaar_number)
    if aadhaar_masked is None:
        return VerificationDecision(
            status="pending_manual_review",
            aadhaar_masked=None,
            ocr_status=ocr_status,
            liveness_status="pending",
            face_match_status="pending",
            face_match_score=None,
            rejection_reason="Aadhaar number could not be confidently extracted",
        )

    face_match_score, face_match_status = compute_face_match_score(aadhaar_card_path, live_selfie_path)
    if face_match_status in {"face_missing", "face_features_missing"}:
        return VerificationDecision(
            status="rejected",
            aadhaar_masked=aadhaar_masked,
            ocr_status=ocr_status,
            liveness_status="pending",
            face_match_status=face_match_status,
            face_match_score=face_match_score,
            rejection_reason="A clear face was not found in the Aadhaar image or live selfie",
        )

    liveness_status, liveness_reason = evaluate_liveness(liveness_frames_path, live_selfie_path)
    if face_match_status == "matched" and liveness_status == "approved":
        return VerificationDecision(
            status="approved",
            aadhaar_masked=aadhaar_masked,
            ocr_status=ocr_status,
            liveness_status=liveness_reason,
            face_match_status=face_match_status,
            face_match_score=face_match_score,
            rejection_reason=None,
        )

    if face_match_status == "mismatch":
        return VerificationDecision(
            status="rejected",
            aadhaar_masked=aadhaar_masked,
            ocr_status=ocr_status,
            liveness_status=liveness_reason,
            face_match_status=face_match_status,
            face_match_score=face_match_score,
            rejection_reason="Live selfie does not match the Aadhaar card photo",
        )

    return VerificationDecision(
        status="pending_manual_review",
        aadhaar_masked=aadhaar_masked,
        ocr_status=ocr_status,
        liveness_status=liveness_reason,
        face_match_status=face_match_status,
        face_match_score=face_match_score,
        rejection_reason="Verification requires manual review",
    )


def create_pending_or_approved_citizen(
    *,
    db: Session,
    full_name: str,
    username: str,
    email: str,
    phone: str | None,
    address: str | None,
    city: str | None,
    password: str,
    gps_permission: bool,
    aadhaar_card: UploadFile,
    live_selfie: UploadFile,
    liveness_frames: list[UploadFile] | None,
) -> tuple[IdentityVerification, User | None]:
    _ensure_unique_registration_targets(db, username=username, email=email)

    verification_token = uuid.uuid4().hex
    artifacts = save_verification_uploads(
        verification_token=verification_token,
        aadhaar_card=aadhaar_card,
        live_selfie=live_selfie,
        liveness_frames=liveness_frames,
    )

    decision = build_verification_decision(
        aadhaar_card_path=artifacts.aadhaar_card_path,
        live_selfie_path=artifacts.live_selfie_path,
        liveness_frames_path=artifacts.liveness_frames_path,
    )
    decision = _downgrade_to_manual_review(decision)

    if decision.aadhaar_masked:
        existing_masked = db.query(User).filter(User.government_id == decision.aadhaar_masked).first()
        if existing_masked:
            raise HTTPException(status_code=409, detail="A citizen account already exists for this Aadhaar number")

    verification = IdentityVerification(
        role="citizen",
        full_name=full_name,
        username=username,
        email=email,
        phone=phone,
        address=address,
        city=city,
        gps_consent=gps_permission,
        password_hash=hash_password(password),
        aadhaar_masked=decision.aadhaar_masked,
        verification_status=decision.status,
        ocr_status=decision.ocr_status,
        liveness_status=decision.liveness_status,
        face_match_status=decision.face_match_status,
        face_match_score=decision.face_match_score,
        rejection_reason=decision.rejection_reason,
        aadhaar_card_path=artifacts.aadhaar_card_path,
        live_selfie_path=artifacts.live_selfie_path,
        liveness_frames_path=artifacts.liveness_frames_path,
        raw_file_expires_at=datetime.now(timezone.utc) + timedelta(days=settings.identity_raw_retention_days),
    )
    db.add(verification)
    db.flush()

    created_user = None

    logger.info(
        "Citizen identity verification created username=%s status=%s score=%s",
        username,
        decision.status,
        decision.face_match_score,
    )
    return verification, created_user


def serialize_identity_verification(record: IdentityVerification) -> dict:
    return {
        "id": record.id,
        "user_id": record.user_id,
        "full_name": record.full_name,
        "username": record.username,
        "email": record.email,
        "phone": record.phone,
        "city": record.city,
        "aadhaar_masked": record.aadhaar_masked,
        "verification_status": record.verification_status,
        "ocr_status": record.ocr_status,
        "liveness_status": record.liveness_status,
        "face_match_status": record.face_match_status,
        "face_match_score": record.face_match_score,
        "rejection_reason": record.rejection_reason,
        "raw_file_expires_at": record.raw_file_expires_at,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
        "aadhaar_card_url": f"/admin/identity-verifications/{record.id}/files/aadhaar",
        "live_selfie_url": f"/admin/identity-verifications/{record.id}/files/selfie",
    }


def approve_identity_verification(db: Session, record: IdentityVerification, reviewer_id: int) -> User:
    if record.user_id:
        user = db.query(User).filter(User.id == record.user_id).first()
        if user:
            record.verification_status = "approved"
            record.reviewed_by = reviewer_id
            record.reviewed_at = datetime.now(timezone.utc)
            return user

    user = User(
        full_name=record.full_name,
        username=record.username,
        email=record.email,
        phone=record.phone,
        address=record.address,
        city=record.city,
        government_id=record.aadhaar_masked,
        gps_consent=record.gps_consent,
        password_hash=record.password_hash,
        role="citizen",
        status="approved",
    )
    db.add(user)
    db.flush()

    record.user_id = user.id
    record.verification_status = "approved"
    record.reviewed_by = reviewer_id
    record.reviewed_at = datetime.now(timezone.utc)
    record.rejection_reason = None
    return user


def reject_identity_verification(db: Session, record: IdentityVerification, reviewer_id: int, reason: str) -> None:
    record.verification_status = "rejected"
    record.rejection_reason = reason
    record.reviewed_by = reviewer_id
    record.reviewed_at = datetime.now(timezone.utc)


def delete_expired_identity_files(db: Session) -> int:
    expired_records = (
        db.query(IdentityVerification)
        .filter(IdentityVerification.raw_file_expires_at < datetime.now(timezone.utc))
        .all()
    )
    deleted_paths = 0
    for record in expired_records:
        for raw_path in [record.aadhaar_card_path, record.live_selfie_path]:
            if raw_path and Path(raw_path).exists():
                Path(raw_path).unlink(missing_ok=True)
                deleted_paths += 1
        if record.liveness_frames_path and Path(record.liveness_frames_path).exists():
            for frame in Path(record.liveness_frames_path).glob("*"):
                frame.unlink(missing_ok=True)
                deleted_paths += 1
            Path(record.liveness_frames_path).rmdir()
        record.aadhaar_card_path = ""
        record.live_selfie_path = ""
        record.liveness_frames_path = None
    db.commit()
    return deleted_paths
