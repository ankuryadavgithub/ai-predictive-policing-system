from pathlib import Path

import pandas as pd

from app.database import SessionLocal
from app.models import Crime


CSV_FILE = Path(__file__).resolve().parent / "crime_predictions_2026_2030.csv"
PREDICTION_BATCH = "csv_2026_2030"

df = pd.read_csv(CSV_FILE)

crime_columns = [
    col
    for col in df.columns
    if col
    not in [
        "state",
        "district",
        "city",
        "latitude",
        "longitude",
        "population",
        "year",
    ]
]

db = SessionLocal()
rows_inserted = 0

for _, row in df.iterrows():
    for crime in crime_columns:
        count = int(row[crime])

        crime_record = Crime(
            state=row["state"],
            district=row["district"],
            city=row["city"],
            latitude=row["latitude"],
            longitude=row["longitude"],
            year=row["year"],
            crime_type=crime,
            crime_count=count,
            record_type="predicted",
            prediction_batch=PREDICTION_BATCH,
        )

        db.add(crime_record)
        rows_inserted += 1

db.commit()
db.close()

print("Prediction data inserted successfully")
print("Total rows inserted:", rows_inserted)
