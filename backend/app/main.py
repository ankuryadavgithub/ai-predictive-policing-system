from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine
from app.models import Base

from app.crimes import router as crime_router
from app.forecast import router as forecast_router
from app.reports import router as reports_router
from app.auth_routes import router
from fastapi.staticfiles import StaticFiles



app = FastAPI(
    title="AI Based Predictive Policing System",
    version="1.0.0"
)

# ------------------------------
# CORS Configuration
# ------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------
# Create Database Tables
# ------------------------------

Base.metadata.create_all(bind=engine)

# ------------------------------
# Register Routers
# ------------------------------

app.include_router(router)
app.include_router(crime_router)
app.include_router(forecast_router)
app.include_router(reports_router)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
# ------------------------------
# Root Endpoint
# ------------------------------

@app.get("/")
def root():
    return {"message": "Predictive Policing Backend Running 🚀"}