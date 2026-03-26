from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.admin_routes import router as admin_router
from app.auth_routes import router as auth_router
from app.config import settings
from app.crimes import router as crime_router
from app.forecast import router as forecast_router
from app.reports import router as reports_router


app = FastAPI(title=settings.app_name, version=settings.app_version)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router)
app.include_router(crime_router)
app.include_router(forecast_router)
app.include_router(reports_router)
app.include_router(admin_router)


@app.get("/")
def root():
    return {
        "message": "Predictive Policing Backend Running",
        "environment": settings.environment,
    }
