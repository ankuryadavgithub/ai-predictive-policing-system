from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import SessionLocal
from app import models

router = APIRouter(prefix="/forecast", tags=["Forecast"])


# ==============================
# DATABASE DEPENDENCY
# ==============================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==============================
# CRIME RISK INDEX
# ==============================

def compute_risk(pred):

    return (
        0.25 * pred.get("Murder", 0) +
        0.15 * pred.get("Rape", 0) +
        0.15 * pred.get("Robbery", 0) +
        0.10 * pred.get("Assault", 0) +
        0.10 * pred.get("Kidnapping_Abduction", 0) +
        0.05 * pred.get("Riots", 0) +
        0.20 * pred.get("Total_Estimated_Crimes", 0)
    )


# ==============================
# KPI ENDPOINT (Dashboard)
# ==============================

@router.get("/kpis")
def get_kpis(
    state: str = "All",
    crime_type: str = "All",
    city: str = "All",
    year: int = 2024,
    db: Session = Depends(get_db)
):

    query = db.query(models.Crime).filter(models.Crime.year == year)

    if state != "All":
        query = query.filter(models.Crime.state == state)

    if city != "All":
        query = query.filter(models.Crime.city.ilike(f"%{city}%"))

    if crime_type != "All":
        query = query.filter(models.Crime.crime_type == crime_type)

    crimes = query.all()

    if not crimes:
        return {
            "total_crimes": 0,
            "risk_index": 0,
            "high_risk_city": "N/A",
            "crime_types": 0
        }

    total_crimes = sum(c.crime_count for c in crimes)

    crime_dict = {}
    city_dict = {}

    for c in crimes:

        crime_dict[c.crime_type] = crime_dict.get(c.crime_type, 0) + c.crime_count
        city_dict[c.city] = city_dict.get(c.city, 0) + c.crime_count

    risk = compute_risk(crime_dict)

    high_risk_city = max(city_dict, key=city_dict.get)

    return {
        "total_crimes": total_crimes,
        "risk_index": float(risk),
        "high_risk_city": high_risk_city,
        "crime_types": len(crime_dict)
    }


# ==============================
# FORECAST ENDPOINT (City)
# ==============================

@router.get("/{city}")
def forecast_city(city: str, db: Session = Depends(get_db)):

    records = (
        db.query(models.Crime)
        .filter(models.Crime.city.ilike(f"%{city}%"))
        .filter(models.Crime.year >= 2026)
        .all()
    )

    if not records:
        return {
            "city": city,
            "predicted_crimes": {},
            "crime_risk_index": 0
        }

    crime_dict = {}

    for r in records:
        crime_dict[r.crime_type] = crime_dict.get(r.crime_type, 0) + r.crime_count

    risk = compute_risk(crime_dict)

    return {
        "city": city,
        "predicted_crimes": crime_dict,
        "crime_risk_index": float(risk)
    }