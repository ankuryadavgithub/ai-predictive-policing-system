import { useMemo, useState, useEffect } from "react";
import DeckGL from "@deck.gl/react";
import { HexagonLayer } from "@deck.gl/aggregation-layers";
import { Map as MapLibreMap } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import api from "../services/api";

const colorRanges = {
  historical: [
    [209, 229, 240],
    [146, 197, 222],
    [67, 147, 195],
    [33, 102, 172],
    [5, 48, 97],
    [3, 31, 63],
  ],
  predicted: [
    [254, 240, 217],
    [253, 204, 138],
    [252, 141, 89],
    [227, 74, 51],
    [179, 0, 0],
    [127, 0, 0],
  ],
  combined: [
    [237, 248, 177],
    [199, 233, 180],
    [127, 205, 187],
    [65, 182, 196],
    [29, 145, 192],
    [34, 94, 168],
  ],
};

const legendGradients = {
  historical: "from-sky-200 via-blue-500 to-slate-950",
  predicted: "from-amber-200 via-orange-500 to-red-900",
  combined: "from-lime-200 via-cyan-500 to-blue-800",
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

const cityCenters = {
  Mumbai: [72.8777, 19.076],
  Delhi: [77.1025, 28.7041],
  Bengaluru: [77.5946, 12.9716],
  Bangalore: [77.5946, 12.9716],
  Chennai: [80.2707, 13.0827],
  Hyderabad: [78.4867, 17.385],
  Kolkata: [88.3639, 22.5726],
  Pune: [73.8567, 18.5204],
  Ahmedabad: [72.5714, 23.0225],
  Jaipur: [75.7873, 26.9124],
};

const prettyDataset = {
  historical: "Historical",
  predicted: "Predicted",
  combined: "Combined",
};

const defaultViewState = {
  longitude: 78.9629,
  latitude: 22.5937,
  zoom: 4.5,
  pitch: 45,
  bearing: 0,
};

const heatmapResponseCache = new Map();

const MapSection = ({ filters = {}, viewState, setViewState, heightClass = "h-[400px]" }) => {
  const [sampleData, setSampleData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoverInfo, setHoverInfo] = useState(null);
  const [internalViewState, setInternalViewState] = useState(defaultViewState);
  const [reloadKey, setReloadKey] = useState(0);

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

  const maxPoints = 50000;
  const fetchKey = `${year}|${state}|${city}|${crimeType}|${recordType}|${maxPoints}`;

  const activeViewState = viewState || internalViewState;
  const updateViewState = setViewState || setInternalViewState;

  useEffect(() => {
    const controller = new AbortController();

    const fetchHeatmap = async () => {
      const cached = heatmapResponseCache.get(fetchKey);
      if (cached) {
        setSampleData(cached);
        setLoading(false);
        setError("");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const res = await api.get("/crimes/heatmap", {
          params: {
            year,
            state,
            city,
            crime_type: crimeType,
            record_type: recordType,
            max_points: maxPoints,
          },
          signal: controller.signal,
        });

        const points = res.data.map((item) => ({
          lat: item.latitude,
          lng: item.longitude,
          weight: item.intensity,
          recordType: item.record_type,
        }));

        heatmapResponseCache.set(fetchKey, points);
        setSampleData(points);
      } catch (err) {
        if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") {
          return;
        }

        console.error("Heatmap fetch error:", err);
        setError(err?.response?.data?.detail || "Unable to load heatmap data");
        setSampleData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHeatmap();
    return () => controller.abort();
  }, [year, state, city, crimeType, recordType, maxPoints, fetchKey, reloadKey]);

  useEffect(() => {
    if (city !== "All" && cityCenters[city]) {
      const [lng, lat] = cityCenters[city];
      updateViewState((prev) => ({
        ...prev,
        longitude: lng,
        latitude: lat,
        zoom: 9,
      }));
      return;
    }

    if (state !== "All" && stateCenters[state]) {
      const [lng, lat] = stateCenters[state];
      updateViewState((prev) => ({
        ...prev,
        longitude: lng,
        latitude: lat,
        zoom: 6,
      }));
    }
  }, [state, city, updateViewState]);

  const summary = useMemo(() => {
    if (sampleData.length === 0) {
      return {
        points: 0,
        maxIntensity: 0,
        totalWeight: 0,
      };
    }

    return {
      points: sampleData.length,
      maxIntensity: Math.max(...sampleData.map((item) => item.weight)),
      totalWeight: Math.round(sampleData.reduce((sum, item) => sum + item.weight, 0)),
    };
  }, [sampleData]);

  const layer = useMemo(() => {
    return new HexagonLayer({
      id: `heatmap-${dataset}`,
      data: sampleData,
      pickable: true,
      getPosition: (d) => [d.lng, d.lat],
      getElevationWeight: (d) => d.weight,
      getColorWeight: (d) => d.weight,
      radius: 30000,
      elevationScale: 200,
      extruded: true,
      coverage: 0.9,
      colorRange: colorRanges[dataset] || colorRanges.historical,
      onHover: (info) => {
        if (!info?.object) {
          setHoverInfo(null);
          return;
        }

        setHoverInfo({
          x: info.x,
          y: info.y,
          count: info.object.points.length,
          intensity: Math.round(info.object.points.reduce((sum, point) => sum + point.source.weight, 0)),
        });
      },
    });
  }, [dataset, sampleData]);

  const resetView = () => {
    updateViewState(defaultViewState);
  };

  return (
    <div className={`relative ${heightClass} w-full rounded-xl overflow-hidden`}>
      <div className="absolute top-3 left-3 z-20 bg-white/90 dark:bg-gray-900/90 rounded-lg shadow px-3 py-2 text-xs text-gray-700 dark:text-gray-200">
        <p className="font-semibold">{prettyDataset[dataset] || "Historical"} Heatmap</p>
        <p>{year} | {state === "All" ? "India" : state}{city !== "All" ? ` | ${city}` : ""}</p>
        <p>{summary.points} hotspots | max intensity {summary.maxIntensity}</p>
      </div>

      <div className="absolute top-3 right-3 z-20 flex gap-2">
        <button
          onClick={resetView}
          className="px-3 py-2 rounded bg-white/90 dark:bg-gray-900/90 text-xs text-gray-700 dark:text-gray-200 shadow"
        >
          Reset View
        </button>
        {!loading && (
          <button
            onClick={() => {
              heatmapResponseCache.delete(fetchKey);
              setReloadKey((prev) => prev + 1);
            }}
            className="px-3 py-2 rounded bg-white/90 dark:bg-gray-900/90 text-xs text-gray-700 dark:text-gray-200 shadow"
          >
            Refresh Data
          </button>
        )}
      </div>

      <div className="absolute bottom-3 left-3 z-20 bg-white/90 dark:bg-gray-900/90 rounded-lg shadow px-3 py-2 text-xs text-gray-700 dark:text-gray-200">
        <p className="font-semibold mb-1">Intensity</p>
        <div className="flex items-center gap-2">
          <div
            className={`w-24 h-2 rounded bg-gradient-to-r ${legendGradients[dataset] || legendGradients.historical}`}
          ></div>
          <span>Low to High</span>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-gray-900/70 text-sm text-gray-600 dark:text-gray-300">
          Loading heatmap data...
        </div>
      )}

      {!loading && error && (
        <div className="absolute inset-0 z-10 flex flex-col gap-3 items-center justify-center bg-white/70 dark:bg-gray-900/70 text-sm text-red-600 dark:text-red-300 px-4 text-center">
          <p>{error}</p>
          <button
            onClick={() => setReloadKey((prev) => prev + 1)}
            className="px-3 py-2 rounded bg-red-600 text-white text-xs shadow hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && sampleData.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-gray-900/70 text-sm text-gray-600 dark:text-gray-300">
          No map data available for the selected filters.
        </div>
      )}

      {hoverInfo && (
        <div
          className="absolute z-30 bg-white dark:bg-gray-900 text-xs text-gray-700 dark:text-gray-200 px-3 py-2 rounded shadow pointer-events-none"
          style={{ left: hoverInfo.x + 12, top: hoverInfo.y + 12 }}
        >
          <p className="font-semibold">Hotspot Summary</p>
          <p>Points: {hoverInfo.count}</p>
          <p>Intensity: {hoverInfo.intensity}</p>
        </div>
      )}

      <DeckGL
        initialViewState={activeViewState}
        viewState={activeViewState}
        controller
        onViewStateChange={({ viewState: nextViewState }) => updateViewState(nextViewState)}
        layers={[layer]}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <MapLibreMap
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
