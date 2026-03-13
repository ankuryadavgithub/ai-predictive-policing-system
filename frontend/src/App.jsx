import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import Dashboard from "./pages/Dashboard";
import Heatmap from "./pages/Heatmap";
import ReportCrime from "./pages/ReportCrime";
import PolicePanel from "./pages/PolicePanel";
import Login from "./pages/Login";
import Register from "./pages/Register";

import ProtectedRoute from "./components/ProtectedRoute";

function App() {

  const location = useLocation();

  return (

    <AnimatePresence mode="wait">

      <Routes location={location} key={location.pathname}>

        {/* Default */}
        <Route path="/" element={<Navigate to="/login" />} />

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