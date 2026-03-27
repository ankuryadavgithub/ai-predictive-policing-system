import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import MainLayout from "../layout/MainLayout";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

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

const TIME_WINDOWS = {
  critical: "19:00-23:00",
  elevated: "16:00-21:00",
  moderate: "14:00-18:00",
};

const formatCrimeName = (value) => CRIME_LABELS[value] || value.replaceAll("_", " ");

const getRiskBand = (score) => {
  if (score >= 75) return "Critical";
  if (score >= 50) return "Elevated";
  return "Moderate";
};

const getPriorityTone = (band) => {
  if (band === "Critical") {
    return {
      badge: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
      accent: "from-red-500 to-orange-400",
      border: "border-red-200 dark:border-red-900/70",
    };
  }

  if (band === "Elevated") {
    return {
      badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
      accent: "from-amber-500 to-yellow-400",
      border: "border-amber-200 dark:border-amber-900/70",
    };
  }

  return {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    accent: "from-emerald-500 to-cyan-400",
    border: "border-emerald-200 dark:border-emerald-900/70",
  };
};

const buildRecommendation = (city, forecast, trend = []) => {
  const predictions = Object.entries(forecast?.predicted_crimes || {})
    .filter(([crime]) => crime !== "Total_Estimated_Crimes")
    .sort((a, b) => b[1] - a[1]);

  const topCrimes = predictions.slice(0, 3);
  const totalProjected = Number(forecast?.predicted_crimes?.Total_Estimated_Crimes || 0);
  const riskIndex = Number(forecast?.crime_risk_index || 0);
  const normalizedRisk = Math.min(100, Math.round(riskIndex / 10));

  const recentTrend = trend
    .filter((item) => item.year >= 2026 && item.year <= 2030)
    .sort((a, b) => a.year - b.year);

  const first = recentTrend[0]?.total || 0;
  const last = recentTrend[recentTrend.length - 1]?.total || 0;
  const growthRate = first > 0 ? Math.round(((last - first) / first) * 100) : 0;

  const score = Math.max(0, Math.min(100, normalizedRisk + Math.max(0, growthRate)));
  const band = getRiskBand(score);
  const patrolUnits = band === "Critical" ? "4-6 units" : band === "Elevated" ? "2-4 units" : "1-2 units";
  const responseWindow =
    band === "Critical"
      ? TIME_WINDOWS.critical
      : band === "Elevated"
      ? TIME_WINDOWS.elevated
      : TIME_WINDOWS.moderate;

  const headlineCrime = topCrimes[0]?.[0] || "Total_Estimated_Crimes";
  const headlineLabel = formatCrimeName(headlineCrime);

  return {
    city,
    score,
    band,
    patrolUnits,
    responseWindow,
    growthRate,
    totalProjected,
    riskIndex: Math.round(riskIndex),
    topCrimes: topCrimes.map(([crime, total]) => ({
      crime,
      label: formatCrimeName(crime),
      total,
    })),
    rationale: `${headlineLabel} is projected to be the main driver in ${city}, with a ${Math.max(
      growthRate,
      0
    )}% forecasted change across the 2026-2030 prediction window.`,
  };
};

const PatrolRecommendation = () => {
  const { user, refreshUser } = useAuth();
  const isPoliceView = user?.role === "police";
  const [stateFilter, setStateFilter] = useState("All");
  const [cityFilter, setCityFilter] = useState("All");
  const [cities, setCities] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  const [error, setError] = useState("");
  const [policeAssignedCities, setPoliceAssignedCities] = useState([]);
  const [useAdminFallback, setUseAdminFallback] = useState(false);
  const [assignedAreaResolved, setAssignedAreaResolved] = useState(false);

  const assignedAreaLabel = useMemo(() => {
    if (!isPoliceView) {
      return "";
    }

    if (user?.patrol_city) {
      return user.patrol_city;
    }

    if (user?.patrol_district) {
      return `${user.patrol_district} district`;
    }

    if (user?.patrol_state) {
      return `${user.patrol_state} state`;
    }

    if (user?.city) {
      return user.city;
    }

    if (user?.district) {
      return `${user.district} district`;
    }

    return "registered area";
  }, [isPoliceView, user?.city, user?.district, user?.patrol_city, user?.patrol_district, user?.patrol_state]);

  useEffect(() => {
    if (!isPoliceView) {
      return;
    }

    refreshUser();
  }, [isPoliceView, user?.patrol_city, user?.patrol_district, user?.patrol_state]);

  useEffect(() => {
    if (isPoliceView) {
      return;
    }

    const loadCities = async () => {
      try {
        setLoadingCities(true);
        const res = await api.get("/crimes/cities", {
          params: { state: stateFilter, record_type: "predicted" },
        });

        setCities(res.data || []);
      } catch (err) {
        console.error("Failed to load city list", err);
        setCities([]);
      } finally {
        setLoadingCities(false);
      }
    };

    loadCities();
  }, [isPoliceView, stateFilter]);

  useEffect(() => {
    if (!isPoliceView) {
      setAssignedAreaResolved(true);
      return;
    }

    if (useAdminFallback) {
      setAssignedAreaResolved(true);
      return;
    }

    const loadAssignedCities = async () => {
      try {
        setLoadingCities(true);
        setAssignedAreaResolved(false);
        setError("");

        if (user?.patrol_city) {
          setUseAdminFallback(false);
          setPoliceAssignedCities([user.patrol_city]);
          return;
        }

        if (user?.patrol_district) {
          const res = await api.get("/crimes", {
            params: { record_type: "predicted" },
          });

          const matchedCities = Array.from(
            new Set(
              (res.data || [])
                .filter(
                  (item) =>
                    item?.district &&
                    item.district.toLowerCase() === user.patrol_district.toLowerCase() &&
                    item?.city
                )
                .map((item) => item.city)
            )
          ).sort((a, b) => a.localeCompare(b));

          if (matchedCities.length > 0) {
            setUseAdminFallback(false);
          }
          setPoliceAssignedCities(matchedCities);
          return;
        }

        if (user?.patrol_state) {
          const res = await api.get("/crimes/cities", {
            params: {
              state: user.patrol_state,
              record_type: "predicted",
            },
          });
          const stateCities = (res.data || []).slice(0, 12);
          if (stateCities.length > 0) {
            setUseAdminFallback(false);
            setPoliceAssignedCities(stateCities);
            return;
          }
        }

        if (user?.city) {
          setUseAdminFallback(false);
          setPoliceAssignedCities([user.city]);
          return;
        }

        if (user?.district) {
          const res = await api.get("/crimes", {
            params: { record_type: "predicted" },
          });

          const matchedCities = Array.from(
            new Set(
              (res.data || [])
                .filter(
                  (item) =>
                    item?.district &&
                    item.district.toLowerCase() === user.district.toLowerCase() &&
                    item?.city
                )
                .map((item) => item.city)
            )
          ).sort((a, b) => a.localeCompare(b));

          if (matchedCities.length > 0) {
            setUseAdminFallback(false);
            setPoliceAssignedCities(matchedCities);
            return;
          }

          setPoliceAssignedCities(matchedCities);
        }

        setPoliceAssignedCities([]);
        setUseAdminFallback(true);
        setError(
          "Assigned-area data was unavailable, so full patrol explorer mode is enabled for this police account."
        );
      } catch (err) {
        console.error("Failed to resolve assigned police area", err);
        setPoliceAssignedCities([]);
        setUseAdminFallback(true);
        setError(
          "Assigned-area patrol data could not be loaded. Switched to full patrol explorer."
        );
      } finally {
        setAssignedAreaResolved(true);
        setLoadingCities(false);
      }
    };

    loadAssignedCities();
  }, [isPoliceView, useAdminFallback, user?.city, user?.district, user?.patrol_city, user?.patrol_district, user?.patrol_state]);

  useEffect(() => {
    if (!isPoliceView || !useAdminFallback) {
      return;
    }

    const loadCities = async () => {
      try {
        setLoadingCities(true);
        const res = await api.get("/crimes/cities", {
          params: { state: stateFilter, record_type: "predicted" },
        });

        setCities(res.data || []);
      } catch (err) {
        console.error("Failed to load fallback city list", err);
        setCities([]);
      } finally {
        setLoadingCities(false);
      }
    };

    loadCities();
  }, [isPoliceView, useAdminFallback, stateFilter]);

  useEffect(() => {
    if (cityFilter === "All") {
      return;
    }

    const cityOptions = isPoliceView && !useAdminFallback ? policeAssignedCities : cities;

    if (!cityOptions.includes(cityFilter)) {
      setCityFilter("All");
    }
  }, [cities, cityFilter, isPoliceView, policeAssignedCities, useAdminFallback]);

  useEffect(() => {
    if (isPoliceView && !useAdminFallback && !assignedAreaResolved) {
      return;
    }

    const loadRecommendations = async () => {
      try {
        setLoadingRecommendations(true);
        setError("");

        const availableCities =
          isPoliceView && !useAdminFallback ? policeAssignedCities : cities;
        const targetCities =
          cityFilter !== "All"
            ? [cityFilter]
            : isPoliceView && !useAdminFallback
            ? availableCities
            : availableCities.slice(0, 8);

        if (targetCities.length === 0) {
          setRecommendations([]);
          setSelectedCity("");
          setError("No recommendation data is available for the selected filters.");
          return;
        }

        const responses = await Promise.all(
          targetCities.map(async (city) => {
            const [forecastRes, trendRes] = await Promise.all([
              api.get(`/forecast/${encodeURIComponent(city)}`),
              api.get(`/crimes/city/${encodeURIComponent(city)}`, {
                params: { record_type: "predicted" },
              }),
            ]);

            return buildRecommendation(city, forecastRes.data, trendRes.data);
          })
        );

        const nextRecommendations = responses
          .filter((item) => item.totalProjected > 0 || item.topCrimes.length > 0)
          .sort((a, b) => b.score - a.score);

        if (nextRecommendations.length === 0 && isPoliceView && !useAdminFallback) {
          setUseAdminFallback(true);
          setError(
            "No prediction data was found for the assigned police area. Switched to full patrol explorer."
          );
          return;
        }

        setRecommendations(nextRecommendations);
        setSelectedCity((prev) => {
          if (nextRecommendations.length === 0) {
            return "";
          }

          if (prev && nextRecommendations.some((item) => item.city === prev)) {
            return prev;
          }

          return nextRecommendations[0].city;
        });
      } catch (err) {
        console.error("Failed to load patrol recommendations", err);
        setRecommendations([]);
        if (isPoliceView && !useAdminFallback) {
          setUseAdminFallback(true);
          setError(
            "Assigned-area patrol data could not be loaded. Switched to full patrol explorer."
          );
        } else {
          setError(err?.response?.data?.detail || "Failed to generate patrol recommendations");
        }
      } finally {
        setLoadingRecommendations(false);
      }
    };

    loadRecommendations();
  }, [assignedAreaResolved, cities, cityFilter, isPoliceView, policeAssignedCities, useAdminFallback]);

  const selectedRecommendation = useMemo(
    () => recommendations.find((item) => item.city === selectedCity) || recommendations[0],
    [recommendations, selectedCity]
  );

  return (
    <MainLayout>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.16),_transparent_32%),linear-gradient(135deg,_#0f172a,_#1e293b_48%,_#111827)] p-6 text-white shadow-xl"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200">Operations Intelligence</p>
            <h1 className="mt-3 text-3xl font-bold">Patrol Recommendation Engine</h1>
            <p className="mt-3 text-sm text-slate-200">
              {isPoliceView && !useAdminFallback
                ? `Convert predicted crime intensity into patrol priorities for ${assignedAreaLabel}.`
                : "Convert predicted crime intensity into patrol priorities, recommended deployment windows, and city-specific action notes for police and admin teams."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-300">Coverage</p>
              <p className="mt-2 text-2xl font-semibold">{recommendations.length}</p>
              <p className="text-sm text-slate-300">priority zones analyzed</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-300">Default Window</p>
              <p className="mt-2 text-2xl font-semibold">
                {selectedRecommendation?.responseWindow || "--"}
              </p>
              <p className="text-sm text-slate-300">recommended active patrol slot</p>
            </div>
          </div>
        </div>
      </motion.div>

      {isPoliceView && !useAdminFallback ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 grid gap-4 rounded-2xl bg-white p-5 shadow dark:bg-gray-800 md:grid-cols-3"
        >
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-slate-900/40">
            <p className="text-sm font-medium text-slate-700 dark:text-white">Assigned Area</p>
            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{assignedAreaLabel}</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
              Recommendations for police users are locked to their assigned patrol area first, then fall back to their registered area only when no assignment exists.
            </p>
          </div>

          <div>
            <label className="text-sm text-gray-500 dark:text-gray-300">City Focus</label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="mt-1 w-full rounded border bg-white p-2 text-slate-900 dark:bg-gray-800 dark:text-white"
            >
              <option value="All">Assigned Coverage</option>
              {policeAssignedCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {loadingCities
                ? "Resolving assigned coverage..."
                : `${policeAssignedCities.length} city zones linked to this account`}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-slate-900/40">
            <p className="text-sm font-medium text-slate-700 dark:text-white">Recommendation Logic</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
              Scores combine forecast risk index, projected growth, and top crime concentration inside the officer's assigned city, district, or state coverage.
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 grid gap-4 rounded-2xl bg-white p-5 shadow dark:bg-gray-800 md:grid-cols-3"
        >
          <div>
            <label className="text-sm text-gray-500 dark:text-gray-300">State</label>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="mt-1 w-full rounded border bg-white p-2 text-slate-900 dark:bg-gray-800 dark:text-white"
            >
              {STATE_OPTIONS.map((state) => (
                <option key={state} value={state}>
                  {state === "All" ? "All States" : state}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-500 dark:text-gray-300">City Focus</label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="mt-1 w-full rounded border bg-white p-2 text-slate-900 dark:bg-gray-800 dark:text-white"
            >
              <option value="All">Top Predicted Cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {loadingCities ? "Refreshing city list..." : `${cities.length} predicted cities available`}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-slate-900/40">
            <p className="text-sm font-medium text-slate-700 dark:text-white">Recommendation Logic</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
              Scores combine forecast risk index, projected growth, and top crime concentration to rank
              where patrol presence should be strengthened first.
            </p>
            {isPoliceView && useAdminFallback && (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">
                Assigned-area data was unavailable, so full patrol explorer mode is enabled for this police account.
              </p>
            )}
          </div>
        </motion.div>
      )}

      {error && (
        <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {loadingRecommendations ? (
        <div className="mt-6 rounded-2xl bg-white p-8 text-sm text-gray-500 shadow dark:bg-gray-800 dark:text-gray-300">
          {isPoliceView && !useAdminFallback && !assignedAreaResolved
            ? "Resolving assigned patrol area..."
            : "Building patrol recommendations from forecast data..."}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-white p-8 text-sm text-gray-500 shadow dark:bg-gray-800 dark:text-gray-300">
          No recommendation data is available for the selected filters.
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            {recommendations.map((item, index) => {
              const tone = getPriorityTone(item.band);

              return (
                <motion.button
                  key={item.city}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedCity(item.city)}
                  className={`w-full rounded-3xl border bg-white p-5 text-left shadow transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-gray-800 ${
                    selectedRecommendation?.city === item.city
                      ? `${tone.border} ring-2 ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-950`
                      : "border-slate-200 dark:border-gray-700"
                  }`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-semibold text-slate-800 dark:text-white">{item.city}</h2>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.badge}`}>
                          {item.band} Priority
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{item.rationale}</p>
                    </div>

                    <div className="min-w-44">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${tone.accent}`}
                          style={{ width: `${item.score}%` }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>Priority Score</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{item.score}/100</span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <div className="rounded-3xl bg-white p-6 shadow dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
              {selectedRecommendation?.city || "Selected City"} Deployment Brief
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
              Focus patrol deployment around predicted pressure points and align visible presence with the
              recommended time window below.
            </p>

            {selectedRecommendation && (
              <>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <StatCard label="Recommended Units" value={selectedRecommendation.patrolUnits} />
                  <StatCard label="Active Window" value={selectedRecommendation.responseWindow} />
                  <StatCard
                    label="Projected Growth"
                    value={`${selectedRecommendation.growthRate >= 0 ? "+" : ""}${selectedRecommendation.growthRate}%`}
                  />
                  <StatCard
                    label="Forecast Risk Index"
                    value={String(selectedRecommendation.riskIndex)}
                  />
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-slate-900/40">
                  <p className="text-sm font-semibold text-slate-700 dark:text-white">Suggested Action</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Increase high-visibility patrols in {selectedRecommendation.city} during{" "}
                    {selectedRecommendation.responseWindow}, prioritizing quick-response coverage for{" "}
                    {selectedRecommendation.topCrimes[0]?.label || "predicted hotspots"} and keeping one
                    reserve unit ready for spillover into adjacent zones.
                  </p>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-semibold text-slate-700 dark:text-white">Top Predicted Drivers</p>
                  <div className="mt-3 space-y-3">
                    {selectedRecommendation.topCrimes.map((crime) => (
                      <div
                        key={crime.crime}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 dark:border-gray-700"
                      >
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {crime.label}
                        </span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {crime.total.toLocaleString()} projected cases
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 rounded-2xl bg-slate-950 p-4 text-slate-100">
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Command Note</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {selectedRecommendation.city} is currently marked as a {selectedRecommendation.band.toLowerCase()}{" "}
                    patrol priority with {selectedRecommendation.totalProjected.toLocaleString()} projected total
                    incidents in the available forecast set. Use this panel as a deployment suggestion layer on
                    top of field intelligence and live incident updates.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </MainLayout>
  );
};

const StatCard = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-slate-900/40">
    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-2 text-xl font-semibold text-slate-800 dark:text-white">{value}</p>
  </div>
);

export default PatrolRecommendation;
