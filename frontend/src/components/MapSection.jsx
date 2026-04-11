import { useCallback, useEffect, useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { HeatmapLayer, HexagonLayer } from "@deck.gl/aggregation-layers";
import { ColumnLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { Map as MapLibreMap } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import api from "../services/api";

const stateCenters = {
  "Andaman And Nicobar Islands": [92.7265, 11.7401],
  "Andhra Pradesh": [80.9129, 16.9124],
  "Arunachal Pradesh": [94.7278, 28.218],
  "Assam": [92.9376, 26.2006],
  "Bihar": [85.3131, 25.0961],
  "Chhattisgarh": [81.8661, 21.2787],
  "Dadra And Nagar Haveli And Daman And Diu": [73.0169, 20.3974],
  Delhi: [77.1025, 28.7041],
  Goa: [74.124, 15.2993],
  Gujarat: [71.1924, 22.2587],
  Haryana: [76.0856, 29.0588],
  "Himachal Pradesh": [77.1734, 31.1048],
  "Jammu & Kashmir": [74.7973, 33.7782],
  Jharkhand: [85.2799, 23.6102],
  Karnataka: [75.7139, 15.3173],
  Kerala: [76.2711, 10.8505],
  Ladakh: [77.5619, 34.1526],
  Lakshadweep: [72.6417, 10.5667],
  "Madhya Pradesh": [78.6569, 23.4733],
  Maharashtra: [75.7139, 19.7515],
  Manipur: [93.9063, 24.6637],
  Meghalaya: [91.3662, 25.467],
  Mizoram: [92.9376, 23.1645],
  Nagaland: [94.5624, 26.1584],
  Odisha: [85.0985, 20.9517],
  Puducherry: [79.8083, 11.9416],
  Punjab: [75.3412, 31.1471],
  Rajasthan: [74.2179, 27.0238],
  Sikkim: [88.5122, 27.533],
  "Tamil Nadu": [78.6569, 11.1271],
  Telangana: [79.0193, 18.1124],
  Tripura: [91.9882, 23.9408],
  "Uttar Pradesh": [80.9462, 26.8467],
  Uttarakhand: [79.0193, 30.0668],
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

const defaultViewState = {
  longitude: 78.9629,
  latitude: 22.5937,
  zoom: 4.5,
  pitch: 35,
  bearing: 0,
};

const mapTitles = {
  heatmap: "Classic Heatmap",
  hexbin: "Hexbin Hotspots",
  incidents: "Incident Map",
  area: "Area Crime Map",
  forecast: "Forecast Risk Map",
  timeline: "Timeline Crime Map",
};

const datasetLabels = {
  historical: "Historical",
  predicted: "Predicted",
  combined: "Combined",
};

const legendGradients = {
  heatmap: "from-cyan-200 via-sky-400 to-blue-700",
  hexbin: "from-amber-200 via-orange-500 to-red-800",
  incidents: "from-emerald-200 via-emerald-500 to-teal-800",
  area: "from-lime-200 via-yellow-400 to-amber-700",
  forecast: "from-rose-200 via-red-500 to-fuchsia-900",
  timeline: "from-violet-200 via-indigo-500 to-slate-900",
};

const colorRanges = {
  hexbin: [
    [254, 240, 217],
    [253, 204, 138],
    [252, 141, 89],
    [227, 74, 51],
    [179, 0, 0],
    [127, 0, 0],
  ],
};

const mapCache = new Map();

const getDatasetRecordType = (dataset) => {
  if (dataset === "Historical") return "historical";
  if (dataset === "Predicted") return "predicted";
  return "all";
};

const getYearRange = (dataset) => {
  if (dataset === "Predicted") return { min: 2026, max: 2030 };
  if (dataset === "Combined") return { min: 2020, max: 2030 };
  return { min: 2020, max: 2025 };
};

const formatCrimeName = (value) => (value || "").replaceAll("_", " ");

const scaleValue = (value, min, max, floor, ceil) => {
  if (max <= min) {
    return Math.round((floor + ceil) / 2);
  }
  const ratio = (value - min) / (max - min);
  return Math.round(floor + ratio * (ceil - floor));
};

const getIncidentColor = (intensity, maxIntensity) => {
  const level = scaleValue(intensity, 0, maxIntensity || 1, 90, 220);
  return [16, level, 129, 190];
};

const getAreaColor = (total, maxTotal) => {
  const red = scaleValue(total, 0, maxTotal || 1, 200, 120);
  const green = scaleValue(total, 0, maxTotal || 1, 225, 90);
  const blue = scaleValue(total, 0, maxTotal || 1, 140, 40);
  return [red, green, blue, 220];
};

const getForecastColor = (risk, maxRisk) => {
  const red = scaleValue(risk, 0, maxRisk || 1, 236, 127);
  const green = scaleValue(risk, 0, maxRisk || 1, 72, 0);
  const blue = scaleValue(risk, 0, maxRisk || 1, 87, 60);
  return [red, green, blue, 230];
};

const getTimelineFrameLabel = (year, dataset) => {
  const prefix = dataset === "Predicted" ? "Forecast frame" : "Timeline frame";
  return `${prefix}: ${year}`;
};

const MapSection = ({ filters = {}, viewState, setViewState, heightClass = "h-[360px] sm:h-[420px]" }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoverInfo, setHoverInfo] = useState(null);
  const [internalViewState, setInternalViewState] = useState(defaultViewState);
  const [reloadKey, setReloadKey] = useState(0);
  const [timelineYear, setTimelineYear] = useState(filters.year ?? 2024);
  const [isPlaying, setIsPlaying] = useState(false);

  const mapMode = filters.mapMode ?? "hexbin";
  const areaLevel = filters.areaLevel ?? "city";
  const state = filters.state ?? "All";
  const city = filters.city ?? "All";
  const crimeType = filters.crimeType ?? "All";
  const dataset = filters.dataset ?? "Historical";
  const recordType = getDatasetRecordType(dataset);
  const range = getYearRange(dataset);
  const year = Math.min(Math.max(filters.year ?? range.min, range.min), range.max);
  const effectiveYear = mapMode === "forecast" ? Math.max(year, 2026) : year;
  const activeViewState = viewState || internalViewState;
  const updateViewState = useCallback((nextViewState) => {
    const resolvedViewState =
      typeof nextViewState === "function" ? nextViewState(activeViewState) : nextViewState;

    if (setViewState) {
      setViewState(resolvedViewState);
      return;
    }

    setInternalViewState(resolvedViewState);
  }, [activeViewState, setViewState]);

  const fetchConfig = useMemo(() => {
    if (mapMode === "incidents") {
      return {
        endpoint: "/crimes/incidents",
        params: { year: effectiveYear, state, city, crime_type: crimeType, record_type: recordType, max_points: 12000 },
      };
    }

    if (mapMode === "area") {
      return {
        endpoint: "/crimes/areas",
        params: {
          year: effectiveYear,
          state,
          city,
          crime_type: crimeType,
          area_level: areaLevel,
          record_type: recordType,
          max_areas: 600,
        },
      };
    }

    if (mapMode === "forecast") {
      return {
        endpoint: "/forecast/areas-summary",
        params: {
          year: Math.max(effectiveYear, 2026),
          state,
          city,
          crime_type: crimeType,
          max_areas: 600,
        },
      };
    }

    if (mapMode === "timeline") {
      return {
        endpoint: "/crimes/timeline",
        params: {
          year_start: range.min,
          year_end: range.max,
          state,
          city,
          crime_type: crimeType,
          record_type: recordType,
          max_points_per_year: 3000,
        },
      };
    }

    return {
      endpoint: "/crimes/heatmap",
      params: {
        year: effectiveYear,
        state,
        city,
        crime_type: crimeType,
        record_type: recordType,
        max_points: 50000,
      },
    };
  }, [areaLevel, city, crimeType, effectiveYear, mapMode, range.max, range.min, recordType, state]);

  const fetchKey = useMemo(
    () => JSON.stringify({ mode: mapMode, dataset, ...fetchConfig }),
    [dataset, fetchConfig, mapMode]
  );

  useEffect(() => {
    setTimelineYear(year);
  }, [year]);

  useEffect(() => {
    if (mapMode !== "timeline") {
      setIsPlaying(false);
      return;
    }

    if (!isPlaying) {
      return;
    }

    const timer = window.setInterval(() => {
      setTimelineYear((current) => (current >= range.max ? range.min : current + 1));
    }, 1400);

    return () => window.clearInterval(timer);
  }, [isPlaying, mapMode, range.max, range.min]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchMapData = async () => {
      const cached = mapCache.get(fetchKey);
      if (cached) {
        setData(cached);
        setLoading(false);
        setError("");
        return;
      }

      try {
        setLoading(true);
        setError("");
        const response = await api.get(fetchConfig.endpoint, {
          params: fetchConfig.params,
          signal: controller.signal,
        });
        const normalizedData = Array.isArray(response.data) ? response.data : [];
        mapCache.set(fetchKey, normalizedData);
        setData(normalizedData);
        if (!Array.isArray(response.data)) {
          setError("Unexpected map data response received from the server.");
        }
      } catch (err) {
        if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") {
          return;
        }
        console.error("Map fetch error:", err);
        setError(err?.response?.data?.detail || "Unable to load map data");
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMapData();
    return () => controller.abort();
  }, [fetchConfig.endpoint, fetchConfig.params, fetchKey, reloadKey]);

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
  }, [city, state, updateViewState]);

  const timelineFrameData = useMemo(() => {
    if (mapMode !== "timeline") {
      return [];
    }
    return data.filter((item) => item.year === timelineYear);
  }, [data, mapMode, timelineYear]);

  const renderData = mapMode === "timeline" ? timelineFrameData : data;

  const summary = useMemo(() => {
    if (renderData.length === 0) {
      return { points: 0, maxValue: 0, totalValue: 0 };
    }

    if (mapMode === "forecast") {
      const risks = renderData.map((item) => item.risk_index);
      return {
        points: renderData.length,
        maxValue: Math.round(Math.max(...risks)),
        totalValue: Math.round(renderData.reduce((sum, item) => sum + item.predicted_total, 0)),
      };
    }

    const values = renderData.map((item) => item.intensity ?? item.total ?? 0);
    return {
      points: renderData.length,
      maxValue: Math.round(Math.max(...values)),
      totalValue: Math.round(values.reduce((sum, item) => sum + item, 0)),
    };
  }, [mapMode, renderData]);

  const layers = useMemo(() => {
    if (renderData.length === 0) {
      return [];
    }

    if (mapMode === "heatmap" || mapMode === "timeline") {
      return [
        new HeatmapLayer({
          id: `${mapMode}-layer`,
          data: renderData,
          pickable: true,
          radiusPixels: city === "All" ? 60 : 45,
          intensity: 1,
          threshold: 0.05,
          aggregation: "SUM",
          getPosition: (item) => [item.longitude, item.latitude],
          getWeight: (item) => item.intensity,
          onHover: (info) => {
            if (!info?.object) {
              setHoverInfo(null);
              return;
            }
            setHoverInfo({
              x: info.x,
              y: info.y,
              title: mapMode === "timeline" ? getTimelineFrameLabel(timelineYear, dataset) : "Heatmap intensity",
              lines: [`Weighted density: ${Math.round(info.object.maxDensity || 0)}`],
            });
          },
        }),
      ];
    }

    if (mapMode === "hexbin") {
      return [
        new HexagonLayer({
          id: "hexbin-layer",
          data: renderData,
          pickable: true,
          extruded: true,
          radius: city === "All" ? 30000 : 10000,
          elevationScale: city === "All" ? 180 : 90,
          coverage: 0.88,
          colorRange: colorRanges.hexbin,
          getPosition: (item) => [item.longitude, item.latitude],
          getElevationWeight: (item) => item.intensity,
          getColorWeight: (item) => item.intensity,
          onHover: (info) => {
            if (!info?.object) {
              setHoverInfo(null);
              return;
            }
            setHoverInfo({
              x: info.x,
              y: info.y,
              title: "Hexbin hotspot",
              lines: [
                `Points: ${info.object.points.length}`,
                `Intensity: ${Math.round(info.object.points.reduce((sum, point) => sum + point.source.intensity, 0))}`,
              ],
            });
          },
        }),
      ];
    }

    if (mapMode === "incidents") {
      const maxIntensity = Math.max(...renderData.map((item) => item.intensity));
      return [
        new ScatterplotLayer({
          id: "incident-layer",
          data: renderData,
          pickable: true,
          stroked: true,
          filled: true,
          radiusUnits: "pixels",
          lineWidthMinPixels: 1,
          getPosition: (item) => [item.longitude, item.latitude],
          getRadius: (item) => scaleValue(item.intensity, 1, maxIntensity || 1, 6, 20),
          getFillColor: (item) => getIncidentColor(item.intensity, maxIntensity),
          getLineColor: [255, 255, 255, 180],
          opacity: 0.9,
          onHover: (info) => {
            if (!info?.object) {
              setHoverInfo(null);
              return;
            }
            setHoverInfo({
              x: info.x,
              y: info.y,
              title: `${formatCrimeName(info.object.crime_type)} incident`,
              lines: [
                `${info.object.city || "Unknown city"}${info.object.state ? `, ${info.object.state}` : ""}`,
                `Intensity: ${Math.round(info.object.intensity)}`,
                `Year: ${info.object.year}`,
              ],
            });
          },
        }),
      ];
    }

    if (mapMode === "area") {
      const maxTotal = Math.max(...renderData.map((item) => item.total));
      return [
        new ColumnLayer({
          id: "area-column-layer",
          data: renderData,
          pickable: true,
          diskResolution: 20,
          extruded: true,
          radius: city === "All" ? 18000 : 9000,
          elevationScale: 25,
          getPosition: (item) => [item.longitude, item.latitude],
          getElevation: (item) => item.total,
          getFillColor: (item) => getAreaColor(item.total, maxTotal),
          onHover: (info) => {
            if (!info?.object) {
              setHoverInfo(null);
              return;
            }
            setHoverInfo({
              x: info.x,
              y: info.y,
              title: info.object.area_name,
              lines: [
                `Total crimes: ${Math.round(info.object.total)}`,
                `Crime types: ${info.object.crime_types}`,
                `${info.object.area_level} view`,
              ],
            });
          },
        }),
        new TextLayer({
          id: "area-label-layer",
          data: renderData.slice(0, 25),
          pickable: false,
          getPosition: (item) => [item.longitude, item.latitude],
          getText: (item) => item.area_name,
          getSize: 14,
          sizeUnits: "pixels",
          getColor: [31, 41, 55, 220],
          getBackgroundColor: [255, 255, 255, 210],
          background: true,
          getPixelOffset: [0, -18],
        }),
      ];
    }

    const maxRisk = Math.max(...renderData.map((item) => item.risk_index));
    return [
      new ColumnLayer({
        id: "forecast-layer",
        data: renderData,
        pickable: true,
        diskResolution: 24,
        extruded: true,
        radius: city === "All" ? 22000 : 11000,
        elevationScale: 28,
        getPosition: (item) => [item.longitude, item.latitude],
        getElevation: (item) => item.risk_index,
        getFillColor: (item) => getForecastColor(item.risk_index, maxRisk),
        onHover: (info) => {
          if (!info?.object) {
            setHoverInfo(null);
            return;
          }
          setHoverInfo({
            x: info.x,
            y: info.y,
            title: `${info.object.city} forecast`,
            lines: [
              `Risk index: ${Math.round(info.object.risk_index)}`,
              `Predicted total: ${Math.round(info.object.predicted_total)}`,
              `Top crime: ${formatCrimeName(info.object.top_crime)}`,
            ],
          });
        },
      }),
      new TextLayer({
        id: "forecast-label-layer",
        data: renderData.slice(0, 20),
        pickable: false,
        getPosition: (item) => [item.longitude, item.latitude],
        getText: (item) => item.city,
        getSize: 14,
        sizeUnits: "pixels",
        getColor: [255, 255, 255, 220],
        getPixelOffset: [0, -18],
      }),
    ];
  }, [city, dataset, mapMode, renderData, timelineYear]);

  const mapTitle = mapTitles[mapMode] || "Crime Map";
  const datasetLabel = mapMode === "forecast" ? "Predicted" : datasetLabels[recordType === "all" ? "combined" : recordType];

  const resetView = () => {
    updateViewState(defaultViewState);
  };

  return (
    <div className={`relative ${heightClass} w-full rounded-xl overflow-hidden`}>
      <div className="absolute top-3 left-3 z-20 max-w-[calc(100%-1.5rem)] bg-white/90 dark:bg-gray-900/90 rounded-lg shadow px-3 py-2 text-[11px] sm:text-xs text-gray-700 dark:text-gray-200">
        <p className="font-semibold">{mapTitle}</p>
        <p>
          {datasetLabel} | {state === "All" ? "India" : state}
          {city !== "All" ? ` | ${city}` : ""}
        </p>
        <p>
          {mapMode === "timeline" ? getTimelineFrameLabel(timelineYear, dataset) : `Year: ${effectiveYear}`} | Points: {summary.points}
        </p>
      </div>

      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
        <button
          onClick={resetView}
          className="px-3 py-2 rounded bg-white/90 dark:bg-gray-900/90 text-xs text-gray-700 dark:text-gray-200 shadow"
        >
          Reset View
        </button>
        {!loading && (
          <button
            onClick={() => {
              mapCache.delete(fetchKey);
              setReloadKey((prev) => prev + 1);
            }}
            className="px-3 py-2 rounded bg-white/90 dark:bg-gray-900/90 text-xs text-gray-700 dark:text-gray-200 shadow"
          >
            Refresh Data
          </button>
        )}
      </div>

      <div className="absolute bottom-3 left-3 z-20 max-w-[calc(100%-1.5rem)] bg-white/90 dark:bg-gray-900/90 rounded-lg shadow px-3 py-2 text-[11px] sm:text-xs text-gray-700 dark:text-gray-200">
        <p className="font-semibold mb-1">Map Summary</p>
        <p>Total weighted value: {summary.totalValue}</p>
        <p>Peak value: {summary.maxValue}</p>
        <div className="mt-2 flex items-center gap-2">
          <div className={`w-24 h-2 rounded bg-gradient-to-r ${legendGradients[mapMode] || legendGradients.hexbin}`}></div>
          <span>Low to High</span>
        </div>
      </div>

      {mapMode === "timeline" && (
        <div className="absolute bottom-3 right-3 z-20 w-72 max-w-[calc(100%-1.5rem)] bg-white/90 dark:bg-gray-900/90 rounded-lg shadow px-3 py-3 text-[11px] sm:text-xs text-gray-700 dark:text-gray-200">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">Timeline Controls</p>
            <button
              onClick={() => setIsPlaying((prev) => !prev)}
              className="px-3 py-1 rounded bg-indigo-600 text-white text-xs"
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
          </div>
          <input
            type="range"
            min={range.min}
            max={range.max}
            value={timelineYear}
            onChange={(event) => {
              setIsPlaying(false);
              setTimelineYear(Number(event.target.value));
            }}
            className="w-full mt-3"
          />
          <p className="mt-1">
            Frame {timelineYear} ({range.min}-{range.max})
          </p>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-gray-900/70 text-sm text-gray-600 dark:text-gray-300">
          Loading map data...
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

      {!loading && !error && renderData.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-gray-900/70 text-sm text-gray-600 dark:text-gray-300">
          No map data available for the selected filters.
        </div>
      )}

      {hoverInfo && (
        <div
          className="absolute z-30 bg-white dark:bg-gray-900 text-xs text-gray-700 dark:text-gray-200 px-3 py-2 rounded shadow pointer-events-none"
          style={{ left: hoverInfo.x + 12, top: hoverInfo.y + 12 }}
        >
          <p className="font-semibold">{hoverInfo.title}</p>
          {hoverInfo.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}

      <DeckGL
        initialViewState={activeViewState}
        viewState={activeViewState}
        controller
        onViewStateChange={({ viewState: nextViewState }) => updateViewState(nextViewState)}
        layers={layers}
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
