import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import MainLayout from "../layout/MainLayout";
import KPISection from "../components/KPISection";
import MapSection from "../components/MapSection";
import ChartSection from "../components/ChartSection";
import ForecastSection from "../components/ForecastSection";
import FilterPanel from "../components/FilterPanel";

const baseViewState = {
  longitude: 78.9629,
  latitude: 22.5937,
  zoom: 4.5,
  pitch: 45,
  bearing: 0,
};

const Dashboard = () => {
  const [viewState, setViewState] = useState(baseViewState);
  const [filters, setFilters] = useState({
    state: "All",
    city: "All",
    crimeType: "All",
    year: 2024,
    dataset: "Historical",
    mapMode: "hexbin",
    areaLevel: "city",
  });

  const scope = useMemo(() => {
    const place = filters.city !== "All" ? filters.city : filters.state !== "All" ? filters.state : "India";
    const datasetLabel = filters.dataset === "Predicted" ? "forecast intelligence" : filters.dataset.toLowerCase();
    const crimeLabel = filters.crimeType === "All" ? "all crime categories" : filters.crimeType.replaceAll("_", " ");
    return { place, datasetLabel, crimeLabel };
  }, [filters]);

  return (
    <MainLayout>
      <section className="relative overflow-hidden rounded-[2rem] border border-sky-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.20),_transparent_32%),linear-gradient(135deg,_#f8fbff,_#e8f3ff_55%,_#dbeafe)] p-5 shadow-xl dark:border-cyan-400/20 dark:bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_30%),linear-gradient(135deg,_#020617,_#0f172a_55%,_#111827)] sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-300/30 blur-3xl dark:bg-cyan-400/20" />
        <div className="relative z-10 grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <span className="rounded-full border border-cyan-300/70 bg-cyan-100 px-4 py-1 text-xs font-bold uppercase tracking-[0.25em] text-cyan-900 dark:border-cyan-300/30 dark:bg-cyan-400/10 dark:text-cyan-100">
              Intelligence Overview
            </span>
            <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
              One operating picture for crime trends, hotspots, and forecast signals.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
              Viewing {scope.datasetLabel} for <strong>{scope.place}</strong>, focused on {scope.crimeLabel}.
              Historical data, predicted batches, map intensity, and trend charts stay synchronized through the filters below.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid gap-3 sm:grid-cols-3"
          >
            {[
              ["Scope", scope.place],
              ["Dataset", filters.dataset],
              ["Year", filters.year],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{value}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white/85 p-4 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <FilterPanel filters={filters} setFilters={setFilters} />
      </div>

      <KPISection filters={filters} />

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-600 dark:text-cyan-300">Hotspot Surface</p>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Map Intelligence</h2>
            </div>
            <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
              Switch between heatmap, hexbin, incident, area, and timeline modes in the filter panel.
            </p>
          </div>
          <MapSection
            filters={filters}
            viewState={viewState}
            setViewState={setViewState}
            heightClass="h-[420px] sm:h-[520px] xl:h-[620px]"
          />
        </motion.div>

        <div className="grid gap-6">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <ChartSection filters={filters} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-lg dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-100"
          >
            <h3 className="font-bold">Responsible AI reminder</h3>
            <p className="mt-2 leading-6">
              Prediction views are aggregate decision-support signals. Use them for planning and review, not as proof of crime or individual-level targeting.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <ForecastSection filters={filters} />
      </section>
    </MainLayout>
  );
};

export default Dashboard;
