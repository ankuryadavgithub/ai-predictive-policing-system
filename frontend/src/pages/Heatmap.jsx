import { useEffect, useMemo, useState } from "react";
import MainLayout from "../layout/MainLayout";
import MapSection from "../components/MapSection";
import api from "../services/api";

const recordTypeMap = {
  Historical: "historical",
  Predicted: "predicted",
  Combined: "all",
};

const yearRangeMap = {
  Historical: { min: 2020, max: 2025 },
  Predicted: { min: 2026, max: 2030 },
  Combined: { min: 2020, max: 2030 },
};

const stateOptions = [
  "All",
  "Andaman And Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Dadra And Nagar Haveli And Daman And Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu & Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

const crimeOptions = [
  ["All", "All Crimes"],
  ["Murder", "Murder"],
  ["Attempt_to_Murder", "Attempt to Murder"],
  ["Kidnapping_Abduction", "Kidnapping & Abduction"],
  ["Rape", "Rape"],
  ["Assault", "Assault"],
  ["Riots", "Riots"],
  ["Theft", "Theft"],
  ["Burglary", "Burglary"],
  ["Robbery", "Robbery"],
  ["Dacoity", "Dacoity"],
  ["Auto_Theft", "Auto Theft"],
  ["Cheating_Fraud", "Cheating / Fraud"],
  ["Cyber_Crime", "Cyber Crime"],
  ["Dowry_Deaths", "Dowry Deaths"],
  ["Domestic_Violence", "Domestic Violence"],
  ["Drug_Offences", "Drug Offences"],
  ["Arms_Act_Offences", "Arms Act Offences"],
  ["Total_Estimated_Crimes", "Total Crimes"],
];

const mapModeOptions = [
  ["heatmap", "Classic Heatmap"],
  ["hexbin", "Hexbin Hotspots"],
  ["incidents", "Incident Map"],
  ["area", "Area Crime Map"],
  ["forecast", "Forecast Risk Map"],
  ["timeline", "Timeline Map"],
];

const baseView = {
  longitude: 78.9629,
  latitude: 22.5937,
  zoom: 4.5,
  pitch: 45,
  bearing: 0,
};

const HeatmapFilterRail = ({ filters, setFilters }) => {
  const [cities, setCities] = useState([]);
  const currentRange = yearRangeMap[filters.dataset] || yearRangeMap.Historical;

  const handleChange = (field, value) => {
    setFilters((prev) => {
      if (field === "dataset") {
        const nextRange = yearRangeMap[value] || yearRangeMap.Historical;
        const nextYear = Math.min(Math.max(prev.year, nextRange.min), nextRange.max);
        return { ...prev, dataset: value, year: nextYear, city: "All" };
      }

      if (field === "mapMode") {
        if (value === "forecast") {
          return { ...prev, mapMode: value, dataset: "Predicted", year: Math.max(prev.year, 2026) };
        }
        return { ...prev, mapMode: value };
      }

      if (field === "state") {
        return { ...prev, state: value, city: "All" };
      }

      return { ...prev, [field]: value };
    });
  };

  useEffect(() => {
    const fetchCities = async () => {
      try {
        const res = await api.get("/crimes/cities", {
          params: {
            state: filters.state,
            record_type: recordTypeMap[filters.dataset] || "all",
          },
        });
        setCities(res.data || []);
      } catch (err) {
        console.error("City fetch error", err);
        setCities([]);
      }
    };

    fetchCities();
  }, [filters.dataset, filters.state]);

  useEffect(() => {
    if (filters.city !== "All" && !cities.includes(filters.city)) {
      setFilters((prev) => ({ ...prev, city: "All" }));
    }
  }, [cities, filters.city, setFilters]);

  const resetFilters = () => {
    setFilters({
      state: "All",
      city: "All",
      crimeType: "All",
      year: 2024,
      dataset: "Historical",
      mapMode: "heatmap",
      areaLevel: "city",
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Dataset</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {["Historical", "Predicted", "Combined"].map((dataset) => (
            <button
              key={dataset}
              type="button"
              onClick={() => handleChange("dataset", dataset)}
              className={`rounded-xl px-2 py-2 text-xs font-bold transition ${
                filters.dataset === dataset
                  ? "bg-cyan-600 text-white shadow"
                  : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {dataset}
            </button>
          ))}
        </div>
      </div>

      <RailSelect label="State" value={filters.state} onChange={(value) => handleChange("state", value)}>
        {stateOptions.map((state) => (
          <option key={state} value={state}>{state}</option>
        ))}
      </RailSelect>

      <RailSelect label="City" value={filters.city} onChange={(value) => handleChange("city", value)}>
        <option value="All">All Cities</option>
        {cities.map((city) => (
          <option key={city} value={city}>{city}</option>
        ))}
      </RailSelect>

      <RailSelect label="Crime Type" value={filters.crimeType} onChange={(value) => handleChange("crimeType", value)}>
        {crimeOptions.map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </RailSelect>

      <RailSelect label="Map Type" value={filters.mapMode || "heatmap"} onChange={(value) => handleChange("mapMode", value)}>
        {mapModeOptions.map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </RailSelect>

      {filters.mapMode === "area" && (
        <RailSelect label="Area Level" value={filters.areaLevel || "city"} onChange={(value) => handleChange("areaLevel", value)}>
          <option value="city">City</option>
          <option value="district">District</option>
        </RailSelect>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Year</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {currentRange.min}-{currentRange.max}
            </p>
          </div>
          <span className="rounded-full bg-cyan-100 px-3 py-1 text-sm font-black text-cyan-800 dark:bg-cyan-400/10 dark:text-cyan-200">
            {filters.year}
          </span>
        </div>
        <input
          type="range"
          min={currentRange.min}
          max={currentRange.max}
          value={filters.year}
          onChange={(event) => handleChange("year", Number(event.target.value))}
          className="mt-4 w-full accent-cyan-600"
        />
      </div>

      <button
        type="button"
        onClick={resetFilters}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Reset Filters
      </button>
    </div>
  );
};

const RailSelect = ({ label, value, onChange, children }) => (
  <label className="block">
    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
    >
      {children}
    </select>
  </label>
);

const Heatmap = () => {
  const [splitView, setSplitView] = useState(false);
  const [filters, setFilters] = useState({
    state: "All",
    city: "All",
    crimeType: "All",
    year: 2024,
    dataset: "Historical",
    mapMode: "heatmap",
    areaLevel: "city",
  });

  const [viewState, setViewState] = useState({ ...baseView });
  const [historicalViewState, setHistoricalViewState] = useState({ ...baseView });
  const [predictedViewState, setPredictedViewState] = useState({ ...baseView });
  const canCompare = filters.mapMode !== "forecast" && filters.mapMode !== "timeline";

  useEffect(() => {
    if (!canCompare) {
      setSplitView(false);
    }
  }, [canCompare]);

  useEffect(() => {
    if (splitView) {
      setHistoricalViewState({ ...viewState });
      setPredictedViewState({ ...viewState });
    }
  }, [splitView, viewState]);

  const compareSummary = useMemo(() => {
    return {
      geography: filters.city !== "All" ? filters.city : filters.state !== "All" ? filters.state : "India",
      crimeType: filters.crimeType === "All" ? "All crime types" : filters.crimeType.replaceAll("_", " "),
      year: filters.year,
      mode: filters.mapMode,
    };
  }, [filters]);

  const syncCompareViewState = (nextViewState) => {
    setHistoricalViewState(nextViewState);
    setPredictedViewState(nextViewState);
  };

  return (
    <MainLayout>
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,_#06111f,_#0f2a3d_46%,_#07111f)] p-5 text-white shadow-2xl sm:p-7">
        <div className="pointer-events-none absolute left-8 top-6 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.28em] text-cyan-100">
              Geospatial Command Surface
            </span>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Crime Heatmap and Forecast Atlas</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              Map historical incidents, predicted hotspot pressure, city-level summaries, and timeline movement in one focused workspace.
            </p>
          </div>

          {canCompare && (
            <button
              onClick={() => setSplitView(!splitView)}
              className="self-start rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15 xl:self-end"
            >
              {splitView ? "Return to Single Map" : "Compare Historical vs Predicted"}
            </button>
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[380px_1fr]">
        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-4 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-600 dark:text-cyan-300">Filter Rail</p>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Map Scope</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Tune geography, dataset, crime category, map mode, and year.
              </p>
            </div>
            <HeatmapFilterRail filters={filters} setFilters={setFilters} />
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-bold">Interpretation guardrail</p>
            <p className="mt-2 leading-6">
              Hotspots show aggregate intensity. Pair map signals with verified reports, patrol knowledge, and supervisor review.
            </p>
          </div>
        </aside>

        <main>
          {splitView && (
            <div className="mb-4 grid grid-cols-1 gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 md:grid-cols-3">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Compare Scope</p>
                <p>{compareSummary.geography}</p>
                <p>{compareSummary.crimeType}</p>
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Historical Map</p>
                <p>Recorded intensity through {Math.min(compareSummary.year, 2025)}.</p>
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Predicted Map</p>
                <p>Forecast intensity from {Math.max(compareSummary.year, 2026)}.</p>
              </div>
            </div>
          )}

          {!splitView ? (
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <MapSection
                filters={filters}
                viewState={viewState}
                setViewState={setViewState}
                heightClass="h-[520px] sm:h-[650px] xl:h-[760px]"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <h3 className="mb-3 font-bold text-slate-800 dark:text-white">Historical Intelligence</h3>
                <MapSection
                  filters={{ ...filters, dataset: "Historical", year: Math.min(filters.year, 2025) }}
                  viewState={historicalViewState}
                  setViewState={syncCompareViewState}
                  heightClass="h-[480px] sm:h-[620px]"
                />
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <h3 className="mb-3 font-bold text-slate-800 dark:text-white">Predicted Intelligence</h3>
                <MapSection
                  filters={{ ...filters, dataset: "Predicted", year: Math.max(filters.year, 2026) }}
                  viewState={predictedViewState}
                  setViewState={syncCompareViewState}
                  heightClass="h-[480px] sm:h-[620px]"
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </MainLayout>
  );
};

export default Heatmap;
