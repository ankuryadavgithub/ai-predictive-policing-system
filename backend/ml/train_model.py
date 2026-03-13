import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import pickle
import os

from sklearn.preprocessing import MinMaxScaler
from sklearn.neighbors import NearestNeighbors

from app.ml_model import CNN_LSTM_GCN

# =====================================
# 1️⃣ LOAD DATASET
# =====================================

print("Loading dataset...")

df = pd.read_csv("india_cities_crime_2020_2025.csv")

meta_cols = ["State", "District", "City", "Latitude", "Longitude", "Year", "Population"]
crime_cols = df.columns.difference(meta_cols)

print("Crime columns detected:", list(crime_cols))

# =====================================
# 2️⃣ PIVOT DATA (City-Year matrix)
# =====================================

df_pivot = df.pivot_table(
    index=["City", "Year"],
    values=crime_cols
).reset_index()

# =====================================
# 3️⃣ NORMALIZE CRIME VALUES
# =====================================

scaler = MinMaxScaler()

df_pivot[crime_cols] = scaler.fit_transform(df_pivot[crime_cols])

os.makedirs("ml", exist_ok=True)

with open("ml/scaler.pkl", "wb") as f:
    pickle.dump(scaler, f)

with open("ml/crime_columns.pkl", "wb") as f:
    pickle.dump(list(crime_cols), f)

print("Scaler and crime columns saved")

# =====================================
# 4️⃣ CREATE TIME SEQUENCES (LSTM)
# =====================================

sequence_length = 4
X = []
y = []
sequence_cities = []

cities = df_pivot["City"].unique()

for city in cities:
    city_data = df_pivot[df_pivot["City"] == city].sort_values("Year")
    values = city_data[crime_cols].values

    if len(values) >= sequence_length + 1:
        X.append(values[:sequence_length])
        y.append(values[sequence_length])
        sequence_cities.append(city)

X = torch.tensor(np.array(X), dtype=torch.float32)
y = torch.tensor(np.array(y), dtype=torch.float32)

print("Dataset shape:", X.shape)

# =====================================
# 5️⃣ CREATE SPATIAL GRAPH (GCN)
# =====================================

coords = df.groupby("City")[["Latitude", "Longitude"]].first()
coords = coords.loc[sequence_cities]

coords_rad = np.radians(coords.values)

k = 5

nbrs = NearestNeighbors(n_neighbors=k + 1, metric="haversine")
nbrs.fit(coords_rad)

distances, indices = nbrs.kneighbors(coords_rad)

edge_index = []

for i in range(len(sequence_cities)):
    for j in indices[i][1:]:
        edge_index.append([i, j])

edge_index = torch.tensor(edge_index, dtype=torch.long).t().contiguous()

print("Graph nodes:", len(sequence_cities))
print("Graph edges:", edge_index.shape)

# =====================================
# 6️⃣ INITIALIZE MODEL
# =====================================

model = CNN_LSTM_GCN(num_features=len(crime_cols))

optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
criterion = nn.MSELoss()

# =====================================
# 7️⃣ TRAIN MODEL
# =====================================

epochs = 100

print("Starting training...")

for epoch in range(epochs):

    model.train()

    optimizer.zero_grad()

    output = model(X, edge_index)

    loss = criterion(output, y)

    loss.backward()

    optimizer.step()

    if epoch % 10 == 0:
        print(f"Epoch {epoch} | Training Loss: {loss.item():.6f}")

# =====================================
# 8️⃣ MODEL EVALUATION
# =====================================

model.eval()

with torch.no_grad():

    predictions = model(X, edge_index)

    mse = torch.mean((predictions - y) ** 2).item()

    rmse = np.sqrt(mse)

print("RMSE:", rmse)

# =====================================
# 9️⃣ SAVE MODEL
# =====================================

torch.save(model.state_dict(), "ml/saved_model.pth")

print("Model saved to ml/saved_model.pth")

print("Training complete 🚀")