import pandas as pd
from app.database import SessionLocal, engine
from app.models import Base, Crime

# Ensure tables exist
Base.metadata.create_all(bind=engine)

csv_path = "india_cities_crime_2020_2025.csv"
df = pd.read_csv(csv_path)

print("CSV Loaded Successfully ✅")
print(f"Total Rows Found: {len(df)}")

# Crime columns start after 'Year'
crime_columns = [
    'Murder', 'Attempt_to_Murder', 'Kidnapping_Abduction', 'Rape',
    'Assault', 'Riots', 'Theft', 'Burglary', 'Robbery', 'Dacoity',
    'Auto_Theft', 'Cheating_Fraud', 'Cyber_Crime', 'Dowry_Deaths',
    'Domestic_Violence', 'Drug_Offences', 'Arms_Act_Offences',
    'Total_Estimated_Crimes'
]

db = SessionLocal()

try:
    for _, row in df.iterrows():

        for crime_type in crime_columns:
            crime = Crime(
                state=row["State"],
                district=row["District"],
                city=row["City"],
                latitude=float(row["Latitude"]),
                longitude=float(row["Longitude"]),
                year=int(row["Year"]),
                crime_type=crime_type,
                crime_count=int(row[crime_type])
            )

            db.add(crime)

    db.commit()
    print("Historical Data Inserted Successfully 🚀")

except Exception as e:
    db.rollback()
    print("Error occurred:", e)

finally:
    db.close()
