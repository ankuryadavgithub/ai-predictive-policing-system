import { lazy, Suspense } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import ProtectedRoute from "./components/ProtectedRoute";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Heatmap = lazy(() => import("./pages/Heatmap"));
const ReportCrime = lazy(() => import("./pages/ReportCrime"));
const PolicePanel = lazy(() => import("./pages/PolicePanel"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const EvidenceMonitor = lazy(() => import("./pages/EvidenceMonitor"));
const PatrolRecommendation = lazy(() => import("./pages/PatrolRecommendation"));
const MissionControl = lazy(() => import("./pages/MissionControl"));

function App() {
  const location = useLocation();

  return (
    <Suspense fallback={<RouteLoader />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>

        {/* Default */}
        <Route path="/" element={<Landing />} />

        {/* Auth */}
        <Route path="/login" element={<PageWrapper><Login /></PageWrapper>} />
        <Route path="/register" element={<PageWrapper><Register /></PageWrapper>} />

        {/* Dashboard (ALL ROLES) */}

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["citizen","police","admin"]}>
              <PageWrapper><Dashboard /></PageWrapper>
            </ProtectedRoute>
          }
        />

        {/* Heatmap (ALL ROLES) */}

        <Route
          path="/heatmap"
          element={
            <ProtectedRoute allowedRoles={["citizen","police","admin"]}>
              <PageWrapper><Heatmap /></PageWrapper>
            </ProtectedRoute>
          }
        />

        {/* Report Crime (ALL ROLES) */}

        <Route
          path="/report"
          element={
            <ProtectedRoute allowedRoles={["citizen","police","admin"]}>
              <PageWrapper><ReportCrime /></PageWrapper>
            </ProtectedRoute>
          }
        />

        {/* Police Panel (ONLY POLICE + ADMIN) */}

        <Route
          path="/police"
          element={
            <ProtectedRoute allowedRoles={["police","admin"]}>
              <PageWrapper><PolicePanel /></PageWrapper>
            </ProtectedRoute>
          }
        />

        <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <PageWrapper><AdminPanel /></PageWrapper>
          </ProtectedRoute>
        }
        />
        <Route
        path="/admin-reports"
        element={
        <ProtectedRoute allowedRoles={["admin"]}>
        <PageWrapper><AdminReports/></PageWrapper>
        </ProtectedRoute>
        }
        />

        <Route
        path="/admin-analytics"
        element={
        <ProtectedRoute allowedRoles={["admin"]}>
        <PageWrapper><AdminAnalytics/></PageWrapper>
        </ProtectedRoute>
        }
        />

        <Route
        path="/admin-evidence"
        element={
        <ProtectedRoute allowedRoles={["admin"]}>
        <PageWrapper><EvidenceMonitor/></PageWrapper>
        </ProtectedRoute>
        }
        />

        <Route
        path="/patrol-recommendation"
        element={
        <ProtectedRoute allowedRoles={["police","admin"]}>
        <PageWrapper><PatrolRecommendation/></PageWrapper>
        </ProtectedRoute>
        }
        />

        <Route
        path="/mission-control"
        element={
        <ProtectedRoute allowedRoles={["police","admin"]}>
        <PageWrapper><MissionControl/></PageWrapper>
        </ProtectedRoute>
        }
        />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}

const PageWrapper = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.22, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);

const RouteLoader = () => (
  <div className="grid min-h-screen place-items-center bg-slate-100 px-6 text-slate-700 dark:bg-slate-950 dark:text-slate-200">
    <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white/85 p-6 text-center shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500 dark:border-slate-700 dark:border-t-cyan-300" />
      <p className="mt-4 text-sm font-semibold">Loading workspace...</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Preparing only the page you need.</p>
    </div>
  </div>
);

export default App;
