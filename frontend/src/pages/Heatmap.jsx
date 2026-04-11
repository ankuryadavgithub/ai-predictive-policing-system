import { useEffect, useMemo, useState } from "react";
import MainLayout from "../layout/MainLayout";
import FilterPanel from "../components/FilterPanel";
import MapSection from "../components/MapSection";

const baseView = {
  longitude: 78.9629,
  latitude: 22.5937,
  zoom: 4.5,
  pitch: 45,
  bearing: 0,
};

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
    if (canCompare) {
      return;
    }
    setSplitView(false);
  }, [canCompare]);

  useEffect(() => {
    if (!splitView) {
      return;
    }

    setHistoricalViewState({ ...viewState });
    setPredictedViewState({ ...viewState });
  }, [splitView, viewState]);

  const compareSummary = useMemo(() => {
    return {
      geography: filters.city !== "All" ? filters.city : filters.state !== "All" ? filters.state : "India",
      crimeType: filters.crimeType === "All" ? "All crime types" : filters.crimeType,
      year: filters.year,
    };
  }, [filters]);

  const syncCompareViewState = (nextViewState) => {
    setHistoricalViewState(nextViewState);
    setPredictedViewState(nextViewState);
  };

  return (
    <MainLayout>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex-1">
          <FilterPanel filters={filters} setFilters={setFilters} />
        </div>

        {canCompare && (
          <button
            onClick={() => setSplitView(!splitView)}
            className="px-4 py-3 bg-blue-600 text-white rounded shadow hover:bg-blue-700 dark:bg-gray-800 transition self-start"
          >
            {splitView ? "Single View" : "Compare View"}
          </button>
        )}
      </div>

      {splitView && (
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl shadow p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-300">
          <div>
            <p className="font-semibold text-gray-800 dark:text-white">Compare Scope</p>
            <p>{compareSummary.geography}</p>
            <p>{compareSummary.crimeType}</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800 dark:text-white">Historical Map</p>
            <p>Use the left map to inspect recorded hotspot concentrations.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800 dark:text-white">Predicted Map</p>
            <p>Use the right map to compare forecast-driven hotspot concentration for the same filters.</p>
          </div>
        </div>
      )}

      <div className="mt-6">
        {!splitView ? (
          <div className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white p-4 rounded-xl shadow">
            <MapSection
              filters={filters}
              viewState={viewState}
              setViewState={setViewState}
              heightClass="h-[420px] sm:h-[520px] lg:h-[650px]"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
              <h3 className="font-semibold mb-3 text-slate-800 dark:text-white">Historical</h3>
              <MapSection
                filters={{ ...filters, dataset: "Historical", year: Math.min(filters.year, 2025) }}
                viewState={historicalViewState}
                setViewState={syncCompareViewState}
                heightClass="h-[420px] sm:h-[520px] lg:h-[650px]"
              />
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
              <h3 className="font-semibold mb-3 text-slate-800 dark:text-white">Predicted</h3>
              <MapSection
                filters={{ ...filters, dataset: "Predicted", year: Math.max(filters.year, 2026) }}
                viewState={predictedViewState}
                setViewState={syncCompareViewState}
                heightClass="h-[420px] sm:h-[520px] lg:h-[650px]"
              />
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Heatmap;
