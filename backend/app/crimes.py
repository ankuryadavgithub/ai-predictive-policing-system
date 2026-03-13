from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import SessionLocal
from app import models, schemas

router = APIRouter(prefix="/crimes", tags=["Crimes"])


# -----------------------------
# Database Dependency
# -----------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -----------------------------
# Create Crime Record
# -----------------------------
@router.post("/", response_model=schemas.CrimeResponse)
def create_crime(crime: schemas.CrimeCreate, db: Session = Depends(get_db)):
    new_crime = models.Crime(**crime.model_dump())
    db.add(new_crime)
    db.commit()
    db.refresh(new_crime)
    return new_crime


# -----------------------------
# Get All Crimes
# -----------------------------
@router.get("/", response_model=list[schemas.CrimeResponse])
def get_all_crimes(db: Session = Depends(get_db)):
    return db.query(models.Crime).all()


# -----------------------------
# Get Crimes by Year
# -----------------------------
@router.get("/year/{year}", response_model=list[schemas.CrimeResponse])
def get_crimes_by_year(year: int, db: Session = Depends(get_db)):
    return db.query(models.Crime).filter(models.Crime.year == year).all()


# -----------------------------
# Yearly Crime Totals (FILTERED)
# -----------------------------
@router.get("/yearly")
def get_yearly_totals(
    state: str = "All",
    city: str = "All",
    crime_type: str = "All",
    db: Session = Depends(get_db)
):

    query = db.query(models.Crime)

    if state != "All":
        query = query.filter(models.Crime.state == state)

    if city != "All":
        query = query.filter(models.Crime.city.ilike(f"%{city}%"))

    if crime_type != "All":
        query = query.filter(models.Crime.crime_type == crime_type)

    results = (
        query.with_entities(
            models.Crime.year,
            func.sum(models.Crime.crime_count).label("total")
        )
        .group_by(models.Crime.year)
        .order_by(models.Crime.year)
        .all()
    )

    return [
        {"year": r.year, "total": r.total}
        for r in results
    ]

# -----------------------------
# City Crime Trend (FAST)
# -----------------------------
@router.get("/city/{city}")
def get_city_trend(city: str, db: Session = Depends(get_db)):

    results = (
        db.query(
            models.Crime.year,
            func.sum(models.Crime.crime_count).label("total")
        )
        .filter(models.Crime.city.ilike(f"%{city}%"))
        .group_by(models.Crime.year)
        .order_by(models.Crime.year)
        .all()
    )

    return [
        {"year": r.year, "total": r.total}
        for r in results
    ]


# -----------------------------
# Get Cities by State
# -----------------------------
@router.get("/cities")
def get_cities(
    state: str = "All",
    db: Session = Depends(get_db)
):

    query = db.query(models.Crime.city)

    if state != "All":
        query = query.filter(models.Crime.state == state)

    results = query.distinct().order_by(models.Crime.city).all()

    return [r.city for r in results if r.city]

# -----------------------------
# Heatmap Data
# -----------------------------
@router.get("/heatmap")
def get_heatmap_data(
    year: int,
    state: str = "All",
    city: str = "All",
    crime_type: str = "All",
    db: Session = Depends(get_db)
):

    query = db.query(
        models.Crime.latitude,
        models.Crime.longitude,
        func.sum(models.Crime.crime_count).label("intensity")
    ).filter(models.Crime.year == year)

    if state != "All":
        query = query.filter(models.Crime.state == state)

    if city != "All":
        query = query.filter(models.Crime.city.ilike(f"%{city}%"))

    if crime_type != "All":
        query = query.filter(models.Crime.crime_type == crime_type)

    crimes = query.group_by(
        models.Crime.latitude,
        models.Crime.longitude
    ).all()

    return [
        {
            "latitude": c.latitude,
            "longitude": c.longitude,
            "intensity": c.intensity
        }
        for c in crimes
    ]