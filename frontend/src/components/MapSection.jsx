import { useMemo, useState, useEffect } from "react";
import DeckGL from "@deck.gl/react";
import { HexagonLayer } from "@deck.gl/aggregation-layers";
import { Map } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import api from "../services/api";

const colorRanges = {
  historical: [
    [198, 219, 239],
    [158, 202, 225],
    [107, 174, 214],
    [66, 146, 198],
    [33, 113, 181],
    [8, 69, 148],
  ],
  predicted: [
    [254, 224, 210],
    [252, 187, 161],
    [252, 146, 114],
    [251, 106, 74],
    [222, 45, 38],
    [165, 15, 21],
  ],
};

const stateCenters = {
  "Andaman And Nicobar Islands": [92.7265, 11.7401],
  "Andhra Pradesh": [80.9129, 16.9124],
  "Arunachal Pradesh": [94.7278, 28.218],
  "Assam": [92.9376, 26.2006],
  "Bihar": [85.3131, 25.0961],
  "Chhattisgarh": [81.8661, 21.2787],
  "Dadra And Nagar Haveli And Daman And Diu": [73.0169, 20.3974],
  "Delhi": [77.1025, 28.7041],
  "Goa": [74.124, 15.2993],
  "Gujarat": [71.1924, 22.2587],
  "Haryana": [76.0856, 29.0588],
  "Himachal Pradesh": [77.1734, 31.1048],
  "Jammu & Kashmir": [74.7973, 33.7782],
  "Jharkhand": [85.2799, 23.6102],
  "Karnataka": [75.7139, 15.3173],
  "Kerala": [76.2711, 10.8505],
  "Ladakh": [77.5619, 34.1526],
  "Lakshadweep": [72.6417, 10.5667],
  "Madhya Pradesh": [78.6569, 23.4733],
  "Maharashtra": [75.7139, 19.7515],
  "Manipur": [93.9063, 24.6637],
  "Meghalaya": [91.3662, 25.467],
  "Mizoram": [92.9376, 23.1645],
  "Nagaland": [94.5624, 26.1584],
  "Odisha": [85.0985, 20.9517],
  "Puducherry": [79.8083, 11.9416],
  "Punjab": [75.3412, 31.1471],
  "Rajasthan": [74.2179, 27.0238],
  "Sikkim": [88.5122, 27.533],
  "Tamil Nadu": [78.6569, 11.1271],
  "Telangana": [79.0193, 18.1124],
  "Tripura": [91.9882, 23.9408],
  "Uttar Pradesh": [80.9462, 26.8467],
  "Uttarakhand": [79.0193, 30.0668],
  "West Bengal": [87.855, 22.9868],
};

const MapSection = ({ filters = {}, viewState, setViewState }) => {

  const [sampleData, setSampleData] = useState([]);

  const year = filters.year ?? 2024;
  const state = filters.state ?? "All";
  const city = filters.city ?? "All";
  const crimeType = filters.crimeType ?? "All";
  const dataset = (filters.dataset ?? "Historical").toLowerCase();
  const recordType =
    dataset === "historical"
      ? "historical"
      : dataset === "predicted"
      ? "predicted"
      : "all";

  useEffect(() => {

    const fetchHeatmap = async () => {

      try {

        const res = await api.get("/crimes/heatmap", {
          params: {
            year,
            state,
            city,
            crime_type: crimeType,
            record_type: recordType,
          }
        });

        const points = res.data.map(d => ({
          lat: d.latitude,
          lng: d.longitude,
          weight: d.intensity
        }));

        setSampleData(points);

      } catch (err) {

        console.error("Heatmap fetch error:", err);

      }

    };

    fetchHeatmap();

  }, [year, state, city, crimeType, recordType]);

  // 🔹 Auto Zoom to State
  useEffect(() => {

    if (state !== "All" && stateCenters[state]) {

      const [lng, lat] = stateCenters[state];

      setViewState(prev => ({
        ...prev,
        longitude: lng,
        latitude: lat,
        zoom: 6
      }));

    }

  }, [state]);

  const layer = useMemo(() => {

    return new HexagonLayer({
      id: "heatmap",
      data: sampleData,

      getPosition: d => [d.lng, d.lat],

      getElevationWeight: d => d.weight,
      getColorWeight: d => d.weight,

      radius: 30000,
      elevationScale: 200,
      extruded: true,
      coverage: 0.9,

      colorRange: colorRanges[dataset] || colorRanges.historical,
    });

  }, [sampleData, dataset]);

  return (
    <div className="relative h-[400px] w-full rounded-xl overflow-hidden">

      {sampleData.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-gray-900/70 text-sm text-gray-600 dark:text-gray-300">
          No map data available for the selected filters.
        </div>
      )}

      <DeckGL
        viewState={viewState}
        controller
        onViewStateChange={({ viewState }) => setViewState(viewState)}
        layers={[layer]}
        style={{ position: "absolute", inset: 0 }}
      >

        <Map
          reuseMaps
          mapLib={maplibregl}
          mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
          style={{ width: "100%", height: "100%" }}
        />

      </DeckGL>

    </div>
  );
};

export default MapSection;
