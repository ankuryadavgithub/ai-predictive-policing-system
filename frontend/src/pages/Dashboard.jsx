import { useState } from "react";
import MainLayout from "../layout/MainLayout";
import KPISection from "../components/KPISection";
import MapSection from "../components/MapSection";
import ChartSection from "../components/ChartSection";
import ForecastSection from "../components/ForecastSection";
import FilterPanel from "../components/FilterPanel";
import { motion } from "framer-motion";

const Dashboard = () => {

  const [viewState, setViewState] = useState({
    longitude: 78.9629,
    latitude: 22.5937,
    zoom: 4.5,
    pitch: 45,
    bearing: 0,
  });

  const [filters, setFilters] = useState({
    state: "All",
    city: "All",
    crimeType: "All",
    year: 2024,
    dataset: "Historical",
  });

  return (
    <MainLayout>

      <FilterPanel filters={filters} setFilters={setFilters} />

      <KPISection filters={filters} />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6"
      >

        <div className="bg-white dark:bg-gray-800 dark:text-white p-6 rounded-xl shadow">
          <MapSection
            filters ={filters}
            viewState={viewState}
            setViewState={setViewState}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 dark:text-white p-6 rounded-xl shadow">
          <ChartSection filters={filters} />
        </div>

      </motion.div>

      <div className="mt-6 bg-white dark:bg-gray-800 dark:text-white p-6 rounded-xl shadow">
        <ForecastSection filters={filters} />
      </div>

    </MainLayout>
  );
};

export default Dashboard;