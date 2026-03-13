import { useState } from "react";
import MainLayout from "../layout/MainLayout";
import FilterPanel from "../components/FilterPanel";
import MapSection from "../components/MapSection";

const Heatmap = () => {
  const [splitView, setSplitView] = useState(false);

const [filters, setFilters] = useState({
  state: "All",
  city: "All",
  crimeType: "All",
  year: 2024,
  dataset: "Historical"
});

const [viewState, setViewState] = useState({
  longitude: 78.9629,
  latitude: 22.5937,
  zoom: 4.5,
  pitch: 45,
  bearing: 0,
});

  return (
    <MainLayout>

      {/* Top Controls */}
      <div className="flex justify-between items-center">
        <FilterPanel filters={filters} setFilters={setFilters} />

        <button
          onClick={() => setSplitView(!splitView)}
          className="ml-4 px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 dark:bg-gray-800 transition"
        >
          {splitView ? "Single View" : "Compare View"}
        </button>
      </div>

      {/* Heatmap Display */}
      <div className="mt-6">

        {!splitView ? (
          // SINGLE MODE
          <div className="bg-white dark:bg-gray-800 text-black dark:text-white p-4 rounded-xl shadow">
            <div className="h-[600px]">
              <MapSection
              filters={filters}
              viewState={viewState}
              setViewState={setViewState} />
            </div>
          </div>
        ) : (
          // SPLIT MODE
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
              <h3 className="font-semibold mb-2 text-gray dark:text-white">Historical</h3>
              <div className="h-[600px]">
                <MapSection
                filters={{ ...filters, dataset: "Historical" }}
                viewState={viewState}
                setViewState={setViewState} />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
              <h3 className="font-semibold mb-2 text-gray dark:text-white">Predicted</h3>
              <div className="h-[600px]">
                <MapSection
                filters={{ ...filters, dataset: "Predicted" }}
                viewState={viewState}
                setViewState={setViewState} />
              </div>
            </div>

          </div>
        )}

      </div>

    </MainLayout>
  );
};

export default Heatmap;
