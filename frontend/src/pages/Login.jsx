import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import CinematicBackground from "../components/CinematicBackground";
import CrimeGlobe from "../components/CrimeGlobe";
import PoliceAlertLights from "../components/PoliceAlertLights";
import SatelliteScan from "../components/SatelliteScan";
import LiveCrimeStats from "../components/LiveCrimeStats";
import TypingText from "../components/TypingText";

import "./Auth.css";

const Login = () => {
  const [form, setForm] = useState({
    username: "",
    password: "",
  });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));

    if (status.message) {
      setStatus({ type: "", message: "" });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus({ type: "", message: "" });

    try {
      await login(form);
      navigate("/dashboard");
    } catch (err) {
      setStatus({
        type: "error",
        message: err?.response?.data?.detail || "Login failed or account approval is pending",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <CinematicBackground />
      <PoliceAlertLights />
      <div className="auth-overlay" />

      <div className="auth-left">
        <SatelliteScan />
        <div className="radar"></div>
        <div className="globe-container">
          <CrimeGlobe />
        </div>
        <LiveCrimeStats />
      </div>

      <div className="auth-right">
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="auth-card"
        >
          <TypingText />

          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="auth-title"
          >
            SECURE SYSTEM LOGIN
          </motion.h1>

          <p className="auth-subtitle">
            Access the Predictive Policing platform for citizens, police, and administrators.
          </p>

          {status.message && (
            <div className={`auth-message auth-message-${status.type}`}>
              {status.message}
            </div>
          )}

          <form onSubmit={handleLogin} className="auth-form">
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={form.username}
              onChange={handleChange}
              autoComplete="username"
              required
            />

            <input
              type="password"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />

            <motion.button
              type="submit"
              whileHover={{ scale: submitting ? 1 : 1.03 }}
              whileTap={{ scale: submitting ? 1 : 0.98 }}
              className="auth-button"
              disabled={submitting}
            >
              {submitting ? "AUTHENTICATING..." : "ACCESS SYSTEM"}
            </motion.button>
          </form>

          <p className="auth-switch">
            Need an account? <Link to="/register">Create Account</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
