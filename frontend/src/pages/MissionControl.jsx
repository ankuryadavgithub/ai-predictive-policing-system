import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import MainLayout from "../layout/MainLayout";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const STATE_OPTIONS = [
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

const CRIME_LABELS = {
  Murder: "Murder",
  Rape: "Rape",
  Robbery: "Robbery",
  Assault: "Assault",
  Kidnapping_Abduction: "Kidnapping & Abduction",
  Riots: "Riots",
  Theft: "Theft",
  Burglary: "Burglary",
  Auto_Theft: "Auto Theft",
  Cheating_Fraud: "Cheating / Fraud",
  Cyber_Crime: "Cyber Crime",
  Total_Estimated_Crimes: "Total Estimated Crimes",
};

const formatCrimeName = (value) => CRIME_LABELS[value] || value?.replaceAll("_", " ") || "Unknown";

const getRiskTone = (score) => {
  if (score >= 80) {
    return {
      label: "Critical",
      accent: "from-red-500 via-orange-400 to-amber-300",
      ring: "ring-red-400/50",
      glow: "shadow-[0_0_45px_rgba(239,68,68,0.35)]",
      chip: "bg-red-500/15 text-red-200 border-red-400/30",
    };
  }

  if (score >= 55) {
    return {
      label: "Elevated",
      accent: "from-amber-400 via-orange-300 to-yellow-200",
      ring: "ring-amber-400/40",
      glow: "shadow-[0_0_35px_rgba(245,158,11,0.28)]",
      chip: "bg-amber-400/15 text-amber-100 border-amber-300/25",
    };
  }

  return {
    label: "Guarded",
    accent: "from-cyan-400 via-sky-300 to-emerald-200",
    ring: "ring-cyan-400/35",
    glow: "shadow-[0_0_30px_rgba(56,189,248,0.24)]",
    chip: "bg-cyan-400/15 text-cyan-100 border-cyan-300/25",
  };
};

const buildHotspot = (city, forecast, trend = []) => {
  const predictions = Object.entries(forecast?.predicted_crimes || {})
    .filter(([crime]) => crime !== "Total_Estimated_Crimes")
    .sort((a, b) => Number(b[1]) - Number(a[1]));

  const topCrime = predictions[0];
  const totalProjected = Number(forecast?.predicted_crimes?.Total_Estimated_Crimes || 0);
  const riskIndex = Number(forecast?.crime_risk_index || 0);
  const normalizedRisk = Math.min(100, Math.round(riskIndex / 10));
  const relevantTrend = trend.filter((item) => item.year >= 2026 && item.year <= 2030).sort((a, b) => a.year - b.year);
  const first = Number(relevantTrend[0]?.total || 0);
  const last = Number(relevantTrend[relevantTrend.length - 1]?.total || 0);
  const growthRate = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
  const score = Math.max(0, Math.min(100, normalizedRisk + Math.max(0, growthRate)));
  const tone = getRiskTone(score);

  return {
    city,
    score,
    tone,
    totalProjected,
    riskIndex: Math.round(riskIndex),
    growthRate,
    headlineCrime: topCrime?.[0] || "Total_Estimated_Crimes",
    headlineCrimeLabel: formatCrimeName(topCrime?.[0] || "Total_Estimated_Crimes"),
    headlineCrimeCount: Number(topCrime?.[1] || totalProjected),
    patrolWindow:
      score >= 80 ? "19:00-23:00" : score >= 55 ? "16:00-21:00" : "13:00-18:00",
    recommendedUnits:
      score >= 80 ? "5 rapid units" : score >= 55 ? "3 mobile units" : "2 visible patrols",
    actionLine: `${formatCrimeName(topCrime?.[0] || "Total_Estimated_Crimes")} pressure is leading ${city}, with ${Math.max(
      growthRate,
      0
    )}% projected escalation in the active forecast window.`,
  };
};

const AnimatedBackdrop = () => (
  <>
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),_transparent_25%),linear-gradient(180deg,_rgba(15,23,42,0.18),_rgba(2,6,23,0.88))]" />
    <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.22)_1px,transparent_1px)] [background-size:72px_72px]" />
    <motion.div
      animate={{ opacity: [0.18, 0.36, 0.18], scale: [1, 1.08, 1] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      className="pointer-events-none absolute -left-16 top-24 h-64 w-64 rounded-full bg-cyan-400/20 blur-[90px]"
    />
    <motion.div
      animate={{ opacity: [0.1, 0.26, 0.1], x: [0, 18, 0], y: [0, -16, 0] }}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      className="pointer-events-none absolute right-0 top-1/3 h-72 w-72 rounded-full bg-blue-500/15 blur-[100px]"
    />
  </>
);

const MissionControl = () => {
  const { user, refreshUser } = useAuth();
  const { darkMode } = useTheme();
  const isPoliceView = user?.role === "police";
  const [stateFilter, setStateFilter] = useState("All");
  const [scopedCities, setScopedCities] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [reports, setReports] = useState([]);
  const [districtTrend, setDistrictTrend] = useState([]);
  const [assignedAreaResolved, setAssignedAreaResolved] = useState(false);
  const [useExplorerFallback, setUseExplorerFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hotspotIndex, setHotspotIndex] = useState(0);
  const [rotationPaused, setRotationPaused] = useState(false);
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [pageVisible, setPageVisible] = useState(typeof document === "undefined" ? true : document.visibilityState === "visible");

  const activeHotspot = hotspots[hotspotIndex] || null;

  const missionScopeLabel = useMemo(() => {
    if (!isPoliceView) {
      return stateFilter === "All" ? "National command view" : `${stateFilter} command view`;
    }

    if (user?.patrol_city) return `${user.patrol_city} patrol zone`;
    if (user?.patrol_district) return `${user.patrol_district} district command`;
    if (user?.patrol_state) return `${user.patrol_state} state command`;
    if (user?.city) return `${user.city} field command`;
    if (user?.district) return `${user.district} field command`;
    return "Explorer fallback command";
  }, [isPoliceView, stateFilter, user?.city, user?.district, user?.patrol_city, user?.patrol_district, user?.patrol_state]);

  const liveStats = useMemo(() => {
    const verifiedCount = reports.filter((report) => report.status === "Verified").length;
    const assignedCount = reports.filter((report) => report.status === "Assigned").length;
    const highSeverity = reports.filter((report) => report.severity === "High").length;

    return [
      { label: "Mission Zones", value: hotspots.length, sublabel: "active rotating hotspot boards" },
      { label: "Verified Reports", value: verifiedCount, sublabel: "confirmed field incidents in scope" },
      { label: "Assigned Queue", value: assignedCount, sublabel: "reports currently under response" },
      { label: "High Severity", value: highSeverity, sublabel: "urgent incidents on the live feed" },
    ];
  }, [hotspots.length, reports]);

  const incidentFeed = useMemo(
    () => [...reports].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8),
    [reports]
  );

  useEffect(() => {
    if (!isPoliceView) {
      return;
    }

    refreshUser();
  }, [isPoliceView, user?.patrol_city, user?.patrol_district, user?.patrol_state]);

  useEffect(() => {
    if (!hotspots.length || rotationPaused || !pageVisible) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setHotspotIndex((prev) => (prev + 1) % hotspots.length);
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, [hotspots.length, pageVisible, rotationPaused]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setPageVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!pageVisible) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setRefreshTick((prev) => prev + 1);
    }, 45000);

    return () => window.clearInterval(intervalId);
  }, [pageVisible]);

  useEffect(() => {
    setHotspotIndex(0);
  }, [hotspots]);

  useEffect(() => {
    if (!isPoliceView) {
      setAssignedAreaResolved(true);
      setUseExplorerFallback(false);
      return;
    }

    const resolvePoliceScope = async () => {
      try {
        setAssignedAreaResolved(false);
        setUseExplorerFallback(false);

        if (user?.patrol_city) {
          setScopedCities([user.patrol_city]);
          return;
        }

        if (user?.patrol_district) {
          const res = await api.get("/crimes", { params: { record_type: "predicted" } });
          const districtCities = Array.from(
            new Set(
              (res.data || [])
                .filter(
                  (item) =>
                    item?.city &&
                    item?.district &&
                    item.district.toLowerCase() === user.patrol_district.toLowerCase()
                )
                .map((item) => item.city)
            )
          ).sort((a, b) => a.localeCompare(b));

          if (districtCities.length > 0) {
            setScopedCities(districtCities.slice(0, 10));
            return;
          }
        }

        if (user?.patrol_state) {
          const res = await api.get("/crimes/cities", {
            params: { state: user.patrol_state, record_type: "predicted" },
          });
          const stateCities = (res.data || []).slice(0, 10);
          if (stateCities.length > 0) {
            setScopedCities(stateCities);
            return;
          }
        }

        if (user?.city) {
          setScopedCities([user.city]);
          return;
        }

        if (user?.district) {
          const res = await api.get("/crimes", { params: { record_type: "predicted" } });
          const districtCities = Array.from(
            new Set(
              (res.data || [])
                .filter(
                  (item) =>
                    item?.city &&
                    item?.district &&
                    item.district.toLowerCase() === user.district.toLowerCase()
                )
                .map((item) => item.city)
            )
          ).sort((a, b) => a.localeCompare(b));

          if (districtCities.length > 0) {
            setScopedCities(districtCities.slice(0, 10));
            return;
          }
        }

        setScopedCities([]);
        setUseExplorerFallback(true);
      } catch (err) {
        console.error("Failed to resolve mission scope", err);
        setScopedCities([]);
        setUseExplorerFallback(true);
      } finally {
        setAssignedAreaResolved(true);
      }
    };

    resolvePoliceScope();
  }, [isPoliceView, user?.city, user?.district, user?.patrol_city, user?.patrol_district, user?.patrol_state]);

  useEffect(() => {
    if (isPoliceView && !assignedAreaResolved) {
      return;
    }

    const loadMissionControl = async () => {
      try {
        setLoading(true);
        setError("");

        const reportRequest = isPoliceView
          ? api.get("/reports/", { params: { page_size: 100 } })
          : api.get("/admin/reports", { params: { page_size: 100 } });

        const reportResponsePromise = reportRequest.catch((err) => {
          if (isPoliceView) {
            return { data: [] };
          }
          throw err;
        });

        const districtResponsePromise = isPoliceView
          ? Promise.resolve({ data: [] })
          : api
              .get("/admin/analytics/top-districts", {
                params: { record_type: "predicted" },
              })
              .catch(() => ({ data: [] }));

        let missionCities = [];
        if (isPoliceView && !useExplorerFallback) {
          missionCities = scopedCities.slice(0, 5);
        } else {
          const cityRes = await api.get("/crimes/cities", {
            params: { state: stateFilter, record_type: "predicted" },
          });
          missionCities = (cityRes.data || []).slice(0, 5);
        }

        const [reportsRes, districtRes, hotspotResponses] = await Promise.all([
          reportResponsePromise,
          districtResponsePromise,
          Promise.allSettled(
            missionCities.map(async (city) => {
              const [forecastRes, trendRes] = await Promise.all([
                api.get(`/forecast/${encodeURIComponent(city)}`),
                api.get(`/crimes/city/${encodeURIComponent(city)}`, {
                  params: { record_type: "predicted" },
                }),
              ]);

              return buildHotspot(city, forecastRes.data, trendRes.data);
            })
          ),
        ]);

        const rankedHotspots = hotspotResponses
          .filter((result) => result.status === "fulfilled")
          .map((result) => result.value)
          .filter((item) => item.totalProjected > 0 || item.headlineCrimeCount > 0)
          .sort((a, b) => b.score - a.score);

        setHotspots(rankedHotspots);
        setReports(reportsRes.data || []);
        setDistrictTrend((districtRes.data || []).slice(0, 5));

        if (!rankedHotspots.length) {
          setError("Mission Control could not find usable hotspot intelligence for the current scope.");
        }
      } catch (err) {
        console.error("Mission Control load failed", err);
        setHotspots([]);
        setReports([]);
        setDistrictTrend([]);
        setError(err?.response?.data?.detail || "Failed to load Mission Control");
      } finally {
        setLoading(false);
      }
    };

    loadMissionControl();
  }, [assignedAreaResolved, isPoliceView, refreshTick, scopedCities, stateFilter, useExplorerFallback]);

  return (
    <MainLayout>
      <div
        className={`-m-4 p-4 sm:-m-6 sm:p-6 ${
          darkMode
            ? "bg-[linear-gradient(180deg,#0f172a_0%,#020617_18%,#020617_100%)]"
            : "bg-[linear-gradient(180deg,#dbeafe_0%,#eef6ff_12%,#f8fbff_32%,#e2ecf7_100%)]"
        }`}
      >
        <div
          className={`relative overflow-hidden rounded-[2rem] border shadow-[0_30px_120px_rgba(2,6,23,0.22)] ${
            darkMode
              ? "border-cyan-400/20 bg-[#020617] text-white"
              : "border-sky-200/80 bg-[linear-gradient(180deg,#f8fcff_0%,#edf6ff_55%,#e2effd_100%)] text-slate-900"
          }`}
        >
          <AnimatedBackdrop />

          <div className="relative z-10 p-6 sm:p-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between"
          >
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-full border px-4 py-1 text-[11px] uppercase tracking-[0.35em] ${darkMode ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-200" : "border-cyan-300/70 bg-cyan-100 text-cyan-900"}`}>
                  Mission Control
                </span>
                <motion.span
                  animate={{ opacity: [0.45, 1, 0.45] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  className={`rounded-full border px-3 py-1 text-xs ${darkMode ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "border-emerald-300/70 bg-emerald-100 text-emerald-900"}`}
                >
                  Live Cinematic Mode
                </motion.span>
              </div>

              <h1 className={`mt-4 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl ${darkMode ? "bg-gradient-to-r from-white via-cyan-100 to-sky-200" : "bg-gradient-to-r from-slate-900 via-sky-800 to-cyan-700"}`}>
                Command Theater For Real-Time Crime Intelligence
              </h1>

              <p className={`mt-4 max-w-3xl text-sm leading-7 sm:text-base ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                A high-motion operational screen for hotspot rotation, incident flow, patrol deployment cues,
                and district pressure summaries. Every panel is driven by live system data, not demo filler.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Badge label={isPoliceView ? "Police access" : "Admin access"} />
                <Badge label={missionScopeLabel} />
                {isPoliceView && useExplorerFallback && <Badge label="Explorer fallback active" tone="amber" />}
              </div>
            </div>

            <div className="grid w-full max-w-xl gap-3 sm:grid-cols-2">
              {liveStats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.94, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className={`rounded-3xl border p-4 backdrop-blur-xl ${darkMode ? "border-white/10 bg-white/5" : "border-sky-200/80 bg-white/65"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className={`text-[11px] uppercase tracking-[0.28em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{stat.label}</p>
                      <CounterValue value={stat.value} />
                    </div>
                    <motion.div
                      animate={{ scale: [1, 1.18, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2.2, repeat: Infinity, delay: index * 0.2 }}
                      className="mt-1 h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.7)]"
                    />
                  </div>
                  <p className={`mt-2 text-xs ${darkMode ? "text-slate-400" : "text-slate-600"}`}>{stat.sublabel}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative overflow-hidden rounded-[2rem] border p-5 backdrop-blur-xl ${darkMode ? "border-white/10 bg-white/5" : "border-sky-200/80 bg-white/60"}`}
              >
                <div className={`absolute inset-y-0 right-0 w-40 bg-gradient-to-l ${darkMode ? "from-cyan-400/10" : "from-cyan-200/40"} to-transparent`} />
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className={`text-[11px] uppercase tracking-[0.32em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Threat Banner</p>
                    <h2 className={`mt-2 text-2xl font-bold sm:text-3xl ${darkMode ? "text-white" : "text-slate-900"}`}>
                      {activeHotspot ? `${activeHotspot.city} is the active command focus` : "Waiting for hotspot intelligence"}
                    </h2>
                    <p className={`mt-3 max-w-2xl text-sm leading-6 ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                      {activeHotspot
                        ? activeHotspot.actionLine
                        : loading
                        ? "Streaming forecast intelligence into the live board..."
                        : "No hotspot data is currently available for this mission scope."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {!isPoliceView && (
                      <select
                        value={stateFilter}
                        onChange={(e) => setStateFilter(e.target.value)}
                        className={`rounded-2xl border px-4 py-3 text-sm outline-none ${darkMode ? "border-white/10 bg-slate-950/60 text-slate-100" : "border-sky-200 bg-white text-slate-900"}`}
                      >
                        {STATE_OPTIONS.map((state) => (
                          <option key={state} value={state}>
                            {state === "All" ? "All States" : state}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => setRefreshTick((prev) => prev + 1)}
                      className={`rounded-2xl border px-4 py-3 text-sm transition ${darkMode ? "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10" : "border-sky-200 bg-white/80 text-slate-800 hover:bg-white"}`}
                    >
                      Refresh Feed
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotationPaused((prev) => !prev)}
                      className={`rounded-2xl border px-4 py-3 text-sm transition ${darkMode ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20" : "border-cyan-300 bg-cyan-100 text-cyan-900 hover:bg-cyan-200"}`}
                    >
                      {rotationPaused ? "Resume Rotation" : "Pause Rotation"}
                    </button>
                  </div>
                </div>
              </motion.div>

              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <section className={`rounded-[2rem] border p-5 backdrop-blur-xl ${darkMode ? "border-white/10 bg-white/5" : "border-sky-200/80 bg-white/60"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-[11px] uppercase tracking-[0.3em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Rotating Hotspot Board</p>
                      <h3 className={`mt-2 text-xl font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>Auto-cycling operational focus</h3>
                    </div>
                    <div className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                      {hotspots.length ? `${hotspotIndex + 1} / ${hotspots.length}` : "No hotspots"}
                    </div>
                  </div>

                  <div className="mt-5 min-h-[22rem]">
                    <AnimatePresence mode="wait">
                      {activeHotspot ? (
                        <motion.div
                          key={activeHotspot.city}
                          initial={{ opacity: 0, x: 42, rotateX: 8 }}
                          animate={{ opacity: 1, x: 0, rotateX: 0 }}
                          exit={{ opacity: 0, x: -42, rotateX: -8 }}
                          transition={{ duration: 0.55 }}
                          className={`relative overflow-hidden rounded-[1.75rem] border p-6 ring-1 ${activeHotspot.tone.ring} ${activeHotspot.tone.glow} ${
                            darkMode ? "border-white/10 bg-slate-950/80" : "border-sky-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#edf7ff_100%)]"
                          }`}
                        >
                          <motion.div
                            animate={{ x: ["-120%", "120%"] }}
                            transition={{ duration: 3.8, repeat: Infinity, ease: "linear" }}
                            className="pointer-events-none absolute inset-y-0 w-28 bg-gradient-to-r from-transparent via-white/10 to-transparent blur-xl"
                          />

                          <div className="relative z-10">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className={`rounded-full border px-3 py-1 text-xs ${activeHotspot.tone.chip}`}>
                                {activeHotspot.tone.label} Alert
                              </span>
                              <span className={`rounded-full border px-3 py-1 text-xs ${darkMode ? "border-white/10 bg-white/5 text-slate-300" : "border-sky-200 bg-sky-50 text-slate-700"}`}>
                                {activeHotspot.headlineCrimeLabel}
                              </span>
                            </div>

                            <h4 className={`mt-4 text-4xl font-black tracking-tight ${darkMode ? "text-white" : "text-slate-900"}`}>
                              {activeHotspot.city}
                            </h4>

                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                              <MetricTile label="Priority Score" value={`${activeHotspot.score}/100`} />
                              <MetricTile label="Projected Cases" value={activeHotspot.totalProjected.toLocaleString()} />
                              <MetricTile label="Patrol Window" value={activeHotspot.patrolWindow} />
                              <MetricTile label="Rapid Deployment" value={activeHotspot.recommendedUnits} />
                            </div>

                            <div className="mt-6">
                              <div className={`flex items-center justify-between text-xs uppercase tracking-[0.24em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                                <span>Threat Intensity</span>
                                <span>{activeHotspot.tone.label}</span>
                              </div>
                              <div className={`mt-3 h-3 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-slate-200"}`}>
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${activeHotspot.score}%` }}
                                  transition={{ duration: 0.9, ease: "easeOut" }}
                                  className={`h-full rounded-full bg-gradient-to-r ${activeHotspot.tone.accent}`}
                                />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <EmptyPanel
                          title={loading ? "Rendering command view..." : "No hotspot intelligence"}
                          body="Mission Control is waiting for predicted hotspot data for the current scope."
                        />
                      )}
                    </AnimatePresence>
                  </div>
                </section>
                <section className={`rounded-[2rem] border p-5 backdrop-blur-xl ${darkMode ? "border-white/10 bg-white/5" : "border-sky-200/80 bg-white/60"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={`text-[11px] uppercase tracking-[0.3em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>District Pulse</p>
                      <h3 className={`mt-2 text-xl font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>Rotating pressure ladder</h3>
                    </div>
                    <span className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Predicted volume</span>
                  </div>

                  <div className="mt-5 space-y-3">
                    {districtTrend.length === 0 ? (
                      <EmptyPanel
                        title="No district pulse"
                        body="The district pressure board will appear once predicted analytics are available."
                        compact
                      />
                    ) : (
                      districtTrend.map((district, index) => {
                        const width = Math.max(18, Math.min(100, Math.round((district.total / districtTrend[0].total) * 100)));
                        return (
                          <motion.div
                            key={district.district}
                            initial={{ opacity: 0, x: 18 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.08 }}
                            className={`rounded-2xl border p-4 ${darkMode ? "border-white/10 bg-slate-950/50" : "border-sky-200 bg-slate-50/90"}`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className={`text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>{district.district}</p>
                                <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Predicted district pressure concentration</p>
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-semibold ${darkMode ? "text-cyan-100" : "text-cyan-800"}`}>{Number(district.total || 0).toLocaleString()}</p>
                                <p className={`text-[11px] uppercase tracking-[0.22em] ${darkMode ? "text-slate-500" : "text-slate-400"}`}>signal</p>
                              </div>
                            </div>
                            <div className={`mt-3 h-2 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-slate-200"}`}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${width}%` }}
                                transition={{ duration: 0.9, delay: index * 0.05 }}
                                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500"
                              />
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </section>
              </div>
            </section>

            <section className="space-y-6">
              <section className={`rounded-[2rem] border p-5 backdrop-blur-xl ${darkMode ? "border-white/10 bg-white/5" : "border-sky-200/80 bg-white/60"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-[11px] uppercase tracking-[0.3em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Deployment Strip</p>
                    <h3 className={`mt-2 text-xl font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>Patrol directives</h3>
                  </div>
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 2.2, repeat: Infinity }}
                    className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.8)]"
                  />
                </div>

                <div className="mt-5 space-y-3">
                  {hotspots.length === 0 ? (
                    <EmptyPanel
                      title="Deployment queue unavailable"
                      body="No patrol directives can be generated until hotspot intelligence is loaded."
                      compact
                    />
                  ) : (
                    hotspots.slice(0, 4).map((hotspot, index) => (
                      <motion.div
                        key={hotspot.city}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.08 }}
                        className={`rounded-2xl border p-4 ${darkMode ? "border-white/10 bg-slate-950/55" : "border-sky-200 bg-slate-50/90"}`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className={`text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>{hotspot.city}</p>
                            <p className={`mt-1 text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{hotspot.headlineCrimeLabel} remains the top predicted driver</p>
                          </div>
                          <span className={`rounded-full border px-3 py-1 text-xs ${hotspot.tone.chip}`}>
                            {hotspot.tone.label}
                          </span>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                          <MiniStat label="Units" value={hotspot.recommendedUnits} />
                          <MiniStat label="Window" value={hotspot.patrolWindow} />
                          <MiniStat label="Risk" value={String(hotspot.riskIndex)} />
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </section>

              <section className={`rounded-[2rem] border p-5 backdrop-blur-xl ${darkMode ? "border-white/10 bg-white/5" : "border-sky-200/80 bg-white/60"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-[11px] uppercase tracking-[0.3em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Incident Feed</p>
                    <h3 className={`mt-2 text-xl font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>Rolling operational ticker</h3>
                  </div>
                  <span className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{incidentFeed.length} visible incidents</span>
                </div>

                <div className="mt-5 space-y-3">
                  {incidentFeed.length === 0 ? (
                    <EmptyPanel
                      title="No incident traffic"
                      body="The live feed will show submitted, assigned, and verified reports as they appear."
                      compact
                    />
                  ) : (
                    incidentFeed.map((report, index) => (
                      <motion.div
                        key={report.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.06 }}
                        className={`group relative overflow-hidden rounded-2xl border p-4 ${darkMode ? "border-white/10 bg-slate-950/55" : "border-sky-200 bg-slate-50/90"}`}
                      >
                        <motion.div
                          animate={{ x: ["-110%", "110%"] }}
                          transition={{ duration: 4.6, repeat: Infinity, ease: "linear", delay: index * 0.25 }}
                          className="pointer-events-none absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/6 to-transparent"
                        />
                        <div className="relative z-10 flex items-start justify-between gap-4">
                          <div>
                            <p className={`text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>
                              {report.report_id} - {report.crime_type}
                            </p>
                            <p className={`mt-1 text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                              {report.city || "Unknown city"} - {report.assigned_police_name || report.assigned_police_username || "Area queue"}
                            </p>
                          </div>
                          <StatusPill status={report.status} severity={report.severity} />
                        </div>
                        <p className={`relative z-10 mt-3 line-clamp-2 text-sm ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                          {report.description}
                        </p>
                      </motion.div>
                    ))
                  )}
                </div>
              </section>
            </section>
          </div>

            {error && (
              <div className="relative z-10 mt-6 rounded-2xl border border-red-400/15 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

const CounterValue = ({ value }) => (
  <motion.p
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white"
  >
    {value}
  </motion.p>
);

const MetricTile = ({ label, value }) => (
  <div className="rounded-2xl border border-sky-200 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
    <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">{label}</p>
    <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{value}</p>
  </div>
);

const MiniStat = ({ label, value }) => (
  <div className="rounded-2xl border border-sky-200 bg-white/75 px-3 py-3 dark:border-white/10 dark:bg-white/5">
    <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
  </div>
);

const Badge = ({ label, tone = "cyan" }) => {
  const tones = {
    cyan: "border-cyan-300/20 bg-cyan-400/10 text-cyan-100",
    amber: "border-amber-300/25 bg-amber-400/10 text-amber-100",
  };

  return <span className={`rounded-full border px-3 py-1 text-xs ${tones[tone]}`}>{label}</span>;
};

const StatusPill = ({ status, severity }) => {
  const tone =
    severity === "High"
      ? "border-red-400/25 bg-red-500/10 text-red-100"
      : severity === "Medium"
      ? "border-amber-300/25 bg-amber-400/10 text-amber-100"
      : "border-cyan-300/25 bg-cyan-400/10 text-cyan-100";

  return <span className={`rounded-full border px-3 py-1 text-xs ${tone}`}>{status}</span>;
};

const EmptyPanel = ({ title, body, compact = false }) => (
  <div className={`rounded-2xl border border-dashed border-sky-200 bg-white/55 text-slate-600 dark:border-white/10 dark:bg-slate-950/35 dark:text-slate-400 ${compact ? "p-4" : "flex min-h-[16rem] items-center justify-center p-6 text-center"}`}>
    <div>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</p>
      <p className="mt-2 text-sm">{body}</p>
    </div>
  </div>
);

export default MissionControl;
