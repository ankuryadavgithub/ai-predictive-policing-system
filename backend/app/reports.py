from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List
import uuid
import os
import shutil

from app.dependencies import get_current_user
from app.database import SessionLocal
from app import models

router = APIRouter(prefix="/reports", tags=["Crime Reports"])


# DATABASE DEPENDENCY
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# CREATE REPORT
@router.post("/")
def create_report(
    crime_type: str = Form(...),
    severity: str = Form(...),
    description: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    evidence: List[UploadFile] = File(None),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    report_id = "CR" + str(uuid.uuid4())[:6]

    new_report = models.CrimeReport(
        report_id=report_id,
        crime_type=crime_type,
        severity=severity,
        description=description,
        latitude=latitude,
        longitude=longitude,
        status="Pending"
    )

    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    folder_path = f"uploads/reports/{report_id}"
    os.makedirs(folder_path, exist_ok=True)

    if evidence:
        for file in evidence:

            file_location = f"{folder_path}/{file.filename}"

            with open(file_location, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            file_type = "video" if file.content_type.startswith("video") else "image"

            evidence_row = models.EvidenceFile(
                report_id=new_report.id,
                file_path=f"/{file_location}",   # IMPORTANT
                file_type=file_type
            )

            db.add(evidence_row)

        db.commit()

    return {
        "message": "Report submitted successfully",
        "report_id": report_id
    }


# GET ALL REPORTS
@router.get("/")
def get_reports(db: Session = Depends(get_db)):

    reports = db.query(models.CrimeReport).all()

    result = []

    for r in reports:

        evidence_files = [
            {
                "id": e.id,
                "file_path": e.file_path,
                "file_type": e.file_type
            }
            for e in r.evidence
        ]

        result.append({
            "id": r.id,
            "report_id": r.report_id,
            "crime_type": r.crime_type,
            "severity": r.severity,
            "description": r.description,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "status": r.status,
            "created_at": r.created_at,
            "evidence": evidence_files
        })

    return result


# VERIFY REPORT
@router.patch("/{id}/verify")
def verify_report(id: int, db: Session = Depends(get_db)):

    report = db.query(models.CrimeReport).filter(
        models.CrimeReport.id == id
    ).first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.status != "Pending":
        raise HTTPException(status_code=400, detail="Report already processed")

    report.status = "Verified"
    db.commit()

    return {"message": "Report verified successfully"}


# REJECT REPORT
@router.patch("/{id}/reject")
def reject_report(id: int, db: Session = Depends(get_db)):

    report = db.query(models.CrimeReport).filter(
        models.CrimeReport.id == id
    ).first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.status != "Pending":
        raise HTTPException(status_code=400, detail="Report already processed")

    report.status = "Rejected"
    db.commit()

    return {"message": "Report rejected successfully"}