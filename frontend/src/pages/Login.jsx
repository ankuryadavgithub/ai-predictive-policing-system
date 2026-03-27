import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { LockKeyhole, ShieldCheck, UserRound } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import CinematicBackground from "../components/CinematicBackground";
import CrimeGlobe from "../components/CrimeGlobe";
import SatelliteScan from "../components/SatelliteScan";

import "./Auth.css";

const loginHighlights = [
  "Citizen accounts can report incidents and track their submissions.",
  "Police accounts gain access after admin approval.",
  "Admin access requires an approved account and valid credentials.",
];

const Login = () => {
  const [form, setForm] = useState({
    username: "",
    password: "",
  });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (event) => {
    setForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));

    if (status.message) {
      setStatus({ type: "", message: "" });
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus({ type: "", message: "" });

    try {
      await login(form);
      navigate("/dashboard");
    } catch (err) {
      setStatus({
        type: "error",
        message:
          err?.response?.data?.detail ||
          "Unable to sign in. Check your credentials or account approval status.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <CinematicBackground />
      <SatelliteScan />
      <div className="auth-overlay" />

      <div className="auth-shell">
        <section className="auth-panel auth-panel-info">
          <div className="auth-globe-layer" aria-hidden="true">
            <CrimeGlobe />
          </div>

          <div className="auth-panel-inner">
            <span className="auth-kicker">Secure access</span>
            <h1 className="auth-hero-title">Sign in to the predictive policing network.</h1>
            <p className="auth-hero-copy">
              Access dashboards, reporting workflows, patrol intelligence, and verification tools through a
              cleaner and more trusted system entry point.
            </p>

            <div className="auth-info-grid">
              <div className="auth-info-card">
                <ShieldCheck size={18} />
                <div>
                  <strong>Approved access only</strong>
                  <p>Pending or suspended accounts are blocked until they are cleared by the system.</p>
                </div>
              </div>

              <div className="auth-info-card">
                <LockKeyhole size={18} />
                <div>
                  <strong>Session protected</strong>
                  <p>Authenticated access is managed through secure backend session handling.</p>
                </div>
              </div>
            </div>

            <div className="auth-guidance">
              <strong>Before you continue</strong>
              <ul>
                {loginHighlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="auth-panel auth-panel-form">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="auth-card"
          >
            <div className="auth-card-top">
              <span className="auth-badge">Login</span>
              <h2 className="auth-title">Welcome back</h2>
              <p className="auth-subtitle">
                Sign in with your approved username and password to continue into the platform.
              </p>
            </div>

            {status.message && (
              <div className={`auth-message auth-message-${status.type}`}>{status.message}</div>
            )}

            <form onSubmit={handleLogin} className="auth-form">
              <div className="auth-field">
                <label htmlFor="username">Username</label>
                <div className="auth-input-wrap">
                  <UserRound size={17} />
                  <input
                    id="username"
                    type="text"
                    name="username"
                    placeholder="Enter your username"
                    value={form.username}
                    onChange={handleChange}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="auth-field">
                <div className="auth-field-head">
                  <label htmlFor="password">Password</label>
                </div>
                <div className="auth-input-wrap">
                  <LockKeyhole size={17} />
                  <input
                    id="password"
                    type="password"
                    name="password"
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={handleChange}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <div className="auth-inline-note">
                Police accounts may remain unavailable until an administrator approves them.
              </div>

              <motion.button
                type="submit"
                whileHover={{ scale: submitting ? 1 : 1.01 }}
                whileTap={{ scale: submitting ? 1 : 0.99 }}
                className="auth-button"
                disabled={submitting}
              >
                {submitting ? "Signing In..." : "Access Dashboard"}
              </motion.button>
            </form>

            <p className="auth-switch">
              Need an account? <Link to="/register">Create Account</Link>
            </p>
          </motion.div>
        </section>
      </div>
    </div>
  );
};

export default Login;
