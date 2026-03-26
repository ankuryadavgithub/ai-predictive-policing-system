import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
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
    password: ""
  });

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => {

    setForm({
      ...form,
      [e.target.name]: e.target.value
    });

  };

const handleLogin = async (e) => {

  e.preventDefault();

  try {
    await login(form);
    navigate("/dashboard");

  } catch (err) {
    alert(err?.response?.data?.detail || "Login failed or account approval is pending");

  }

};

  return (

    <div className="auth-page">

      <CinematicBackground />

      <PoliceAlertLights />

      <div className="auth-overlay" />

      {/* LEFT SIDE — CINEMATIC VISUALS */}

      <div className="auth-left">

        <SatelliteScan />

        <div className="radar"></div>

        <div className="globe-container">
          <CrimeGlobe />
        </div>

        <LiveCrimeStats />

      </div>


      {/* RIGHT SIDE — LOGIN PANEL */}

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
            POLICE COMMAND LOGIN
          </motion.h1>

          <p className="auth-subtitle">
            Secure access to Predictive Policing System
          </p>

          <form onSubmit={handleLogin}>

            <input
              type="text"
              name="username"
              placeholder="Officer Username"
              onChange={handleChange}
              required
            />

            <input
              type="password"
              name="password"
              placeholder="Secure Password"
              onChange={handleChange}
              required
            />

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="auth-button"
            >
              ACCESS SYSTEM
            </motion.button>

          </form>

          <p className="auth-switch">
            New Officer? <a href="/register">Create Account</a>
          </p>

        </motion.div>

      </div>

    </div>

  );

};

export default Login;
