import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import Dashboard from "./pages/Dashboard";
import Heatmap from "./pages/Heatmap";
import ReportCrime from "./pages/ReportCrime";
import PolicePanel from "./pages/PolicePanel";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminPanel from "./pages/AdminPanel";
import AdminReports from "./pages/AdminReports"
import AdminAnalytics from "./pages/AdminAnalytics"
import EvidenceMonitor from "./pages/EvidenceMonitor"
import PatrolRecommendation from "./pages/PatrolRecommendation"
import MissionControl from "./pages/MissionControl"

import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";

function App() {

  const location = useLocation();

  return (

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

  );

}

const PageWrapper = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
);

export default App;
