import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { registerUser } from "../utils/auth";

import CinematicBackground from "../components/CinematicBackground";
import CrimeGlobe from "../components/CrimeGlobe";
import PoliceAlertLights from "../components/PoliceAlertLights";
import SatelliteScan from "../components/SatelliteScan";
import LiveCrimeStats from "../components/LiveCrimeStats";
import TypingText from "../components/TypingText";

import "./Auth.css";

const roles = [
  { id: "citizen", title: "Citizen", desc: "Report crimes and submit evidence" },
  { id: "police", title: "Police Officer", desc: "Verify reports and monitor crime" },
  { id: "admin", title: "Administrator", desc: "Control system and manage officers" },
];

const Register = () => {
  const [role, setRole] = useState(null);
  const [form, setForm] = useState({});
  const [status, setStatus] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (status.message) {
      setStatus({ type: "", message: "" });
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      setStatus({ type: "error", message: "Passwords do not match." });
      return;
    }

    setSubmitting(true);
    setStatus({ type: "", message: "" });

    try {
      const res = await registerUser(form);
      setStatus({
        type: "success",
        message:
          res.status === "pending"
            ? "Registration successful. Your police account is pending admin approval."
            : "Registration successful. You can now log in.",
      });
    } catch (err) {
      setStatus({
        type: "error",
        message: err?.response?.data?.detail || "Registration failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectRole = (nextRole) => {
    setRole(nextRole);
    setForm({ role: nextRole });
    setStatus({ type: "", message: "" });
  };

  const resetRole = () => {
    setRole(null);
    setForm({});
    setStatus({ type: "", message: "" });
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

          {!role && (
            <>
              <h1 className="auth-title">SYSTEM REGISTRATION</h1>
              <p className="auth-subtitle">
                Select your identity to access the policing network.
              </p>

              <div className="role-grid">
                {roles.map((r) => (
                  <motion.button
                    type="button"
                    key={r.id}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className="role-card"
                    onClick={() => selectRole(r.id)}
                  >
                    <h3>{r.title}</h3>
                    <p>{r.desc}</p>
                  </motion.button>
                ))}
              </div>
            </>
          )}

          <AnimatePresence mode="wait">
            {role && (
              <motion.form
                key={role}
                initial={{ opacity: 0, x: 80 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.35 }}
                onSubmit={handleRegister}
                className="auth-form"
              >
                <div className="auth-form-header">
                  <button type="button" className="auth-back-button" onClick={resetRole}>
                    Back
                  </button>
                  <div>
                    <h1 className="auth-title">{role.toUpperCase()} REGISTRATION</h1>
                    <p className="auth-subtitle">Secure account creation</p>
                  </div>
                </div>

                {status.message && (
                  <div className={`auth-message auth-message-${status.type}`}>
                    {status.message}
                  </div>
                )}

                {role === "citizen" && (
                  <>
                    <input name="fullName" placeholder="Full Name" onChange={handleChange} required />
                    <input name="username" placeholder="Username" onChange={handleChange} required />
                    <input type="email" name="email" placeholder="Email" onChange={handleChange} required />
                    <input name="phone" placeholder="Phone Number" onChange={handleChange} required />
                    <input name="city" placeholder="City" onChange={handleChange} required />
                    <input name="address" placeholder="Address (Optional)" onChange={handleChange} />
                    <input name="aadhaar" placeholder="Aadhaar / Govt ID (Optional)" onChange={handleChange} />
                    <label className="auth-checkbox">
                      <input type="checkbox" name="gpsPermission" onChange={handleChange} />
                      <span>Allow GPS Location Access</span>
                    </label>
                    <input type="password" name="password" placeholder="Password" onChange={handleChange} required />
                    <input type="password" name="confirmPassword" placeholder="Confirm Password" onChange={handleChange} required />
                  </>
                )}

                {role === "police" && (
                  <>
                    <input name="fullName" placeholder="Full Name" onChange={handleChange} required />
                    <input name="username" placeholder="Username" onChange={handleChange} required />
                    <input name="badgeId" placeholder="Police Badge ID" onChange={handleChange} required />
                    <input name="rank" placeholder="Rank (Inspector / SI)" onChange={handleChange} required />
                    <input name="station" placeholder="Police Station" onChange={handleChange} required />
                    <input name="district" placeholder="District" onChange={handleChange} required />
                    <input type="email" name="email" placeholder="Official Email" onChange={handleChange} required />
                    <input name="phone" placeholder="Phone Number" onChange={handleChange} required />
                    <input type="password" name="password" placeholder="Password" onChange={handleChange} required />
                    <input type="password" name="confirmPassword" placeholder="Confirm Password" onChange={handleChange} required />
                  </>
                )}

                {role === "admin" && (
                  <>
                    <input name="fullName" placeholder="Full Name" onChange={handleChange} required />
                    <input name="username" placeholder="Username" onChange={handleChange} required />
                    <input type="email" name="email" placeholder="Email" onChange={handleChange} required />
                    <input name="department" placeholder="Department (IT / Cyber Security)" onChange={handleChange} required />
                    <input name="authCode" placeholder="Admin Authorization Code" onChange={handleChange} required />
                    <input type="password" name="password" placeholder="Password" onChange={handleChange} required />
                    <input type="password" name="confirmPassword" placeholder="Confirm Password" onChange={handleChange} required />
                  </>
                )}

                <motion.button
                  type="submit"
                  whileHover={{ scale: submitting ? 1 : 1.03 }}
                  whileTap={{ scale: submitting ? 1 : 0.98 }}
                  className="auth-button"
                  disabled={submitting}
                >
                  {submitting ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
                </motion.button>

                <p className="auth-switch">
                  Already registered? <Link to="/login">Login</Link>
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default Register;
