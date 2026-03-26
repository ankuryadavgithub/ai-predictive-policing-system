import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  { id: "admin", title: "Administrator", desc: "Control system and manage officers" }
];

const Register = () => {

  const [role, setRole] = useState(null);

  const [form, setForm] = useState({});

  const handleChange = (e) => {

    const { name, value, type, checked } = e.target;

    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value
    });

  };

 

const handleRegister = async (e) => {

  e.preventDefault();

  if (form.password !== form.confirmPassword) {
    alert("Passwords do not match");
    return;
  }

  try {

    const res = await registerUser(form);

    if (res.status === "pending") {
      alert("Registration successful. Your police account is pending admin approval.");
    } else {
      alert("Registration successful");
    }

  } catch (err) {

    alert(err?.response?.data?.detail || "Registration failed");

  }

};

  const selectRole = (r) => {

    setRole(r);

    setForm({
      role: r
    });

  };

  return (

    <div className="auth-page">

      <CinematicBackground />
      <PoliceAlertLights />
      <div className="auth-overlay" />

      {/* LEFT SIDE VISUAL */}

      <div className="auth-left">

        <SatelliteScan />

        <div className="radar"></div>

        <div className="globe-container">
          <CrimeGlobe />
        </div>

        <LiveCrimeStats />

      </div>

      {/* RIGHT SIDE PANEL */}

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
                Select your identity to access the policing network
              </p>

              <div className="role-grid">

                {roles.map((r) => (

                  <motion.div
                    key={r.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="role-card"
                    onClick={() => selectRole(r.id)}
                  >

                    <h3>{r.title}</h3>
                    <p>{r.desc}</p>

                  </motion.div>

                ))}

              </div>

            </>

          )}

          <AnimatePresence>

            {role && (

              <motion.form
                initial={{ opacity: 0, x: 80 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                onSubmit={handleRegister}
              >

                <h1 className="auth-title">
                  {role.toUpperCase()} REGISTRATION
                </h1>

                <p className="auth-subtitle">
                  Secure account creation
                </p>

                {/* CITIZEN FORM */}

                {role === "citizen" && (

                  <>

                    <input name="fullName" placeholder="Full Name" onChange={handleChange} required />

                    <input name="username" placeholder="Username" onChange={handleChange} required />

                    <input type="email" name="email" placeholder="Email" onChange={handleChange} required />

                    <input name="phone" placeholder="Phone Number" onChange={handleChange} required />

                    <input name="city" placeholder="City" onChange={handleChange} required />

                    <input name="address" placeholder="Address (Optional)" onChange={handleChange} />

                    <input name="aadhaar" placeholder="Aadhaar / Govt ID (Optional)" onChange={handleChange} />

                    <label style={{ fontSize: "13px", marginBottom: "10px" }}>
                      <input type="checkbox" name="gpsPermission" onChange={handleChange} /> Allow GPS Location Access
                    </label>

                    <input type="password" name="password" placeholder="Password" onChange={handleChange} required />

                    <input type="password" name="confirmPassword" placeholder="Confirm Password" onChange={handleChange} required />

                  </>

                )}

                {/* POLICE FORM */}

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

                {/* ADMIN FORM */}

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
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="auth-button"
                >
                  CREATE ACCOUNT
                </motion.button>

                <p className="auth-switch">
                  Already Registered? <a href="/login">Login</a>
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
