import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  IdCard,
  MapPin,
  Shield,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { registerUser } from "../utils/auth";
import CinematicBackground from "../components/CinematicBackground";
import SatelliteScan from "../components/SatelliteScan";

import "./Auth.css";

const roles = [
  {
    id: "citizen",
    title: "Citizen",
    desc: "Report incidents, upload evidence, and track the review status of your submissions.",
    icon: UserRound,
  },
  {
    id: "police",
    title: "Police Officer",
    desc: "Verify reports, monitor field queues, and access patrol recommendation and command tools.",
    icon: ShieldCheck,
  },
  {
    id: "admin",
    title: "Administrator",
    desc: "Approve officers, moderate reports, manage evidence, and oversee operational intelligence.",
    icon: Building2,
  },
];

const roleGuidance = {
  citizen: "Citizen registration is straightforward and becomes active immediately after successful submission.",
  police: "Police registration collects operational details and usually requires admin approval before login access.",
  admin: "Admin registration requires a valid authorization code and should be used only for approved oversight accounts.",
};

const Register = () => {
  const [role, setRole] = useState(null);
  const [form, setForm] = useState({});
  const [status, setStatus] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (status.message) {
      setStatus({ type: "", message: "" });
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();

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
            ? "Registration submitted. Your police account is pending admin approval."
            : "Registration successful. You can now sign in.",
      });
    } catch (err) {
      setStatus({
        type: "error",
        message: err?.response?.data?.detail || "Registration failed.",
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

  const selectedRole = roles.find((item) => item.id === role);
  const SelectedRoleIcon = selectedRole?.icon || Shield;

  return (
    <div className="auth-page">
      <CinematicBackground />
      <SatelliteScan />
      <div className="auth-overlay" />

      <div className="auth-shell">
        <section className="auth-panel auth-panel-info">
          <div className="auth-panel-inner">
            <span className="auth-kicker">Registration</span>
            <h1 className="auth-hero-title">Create the right access profile for your role.</h1>
            <p className="auth-hero-copy">
              Registration stays role-based so the platform can collect the right information for citizen,
              police, and administrative workflows without overloading every user with the same form.
            </p>

            <div className="auth-info-grid auth-info-grid-single">
              <div className="auth-info-card">
                <BadgeCheck size={18} />
                <div>
                  <strong>Role-specific onboarding</strong>
                  <p>Each path collects only the data needed for that role’s access level and workflow.</p>
                </div>
              </div>
            </div>

            <div className="auth-guidance">
              <strong>Registration notes</strong>
              <ul>
                <li>Citizen access is the simplest onboarding flow.</li>
                <li>Police registration collects badge, station, and district data.</li>
                <li>Admin registration requires an authorization code.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="auth-panel auth-panel-form">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="auth-card auth-card-register"
          >
            {!role && (
              <div className="auth-card-top">
                <span className="auth-badge">Create Account</span>
                <h2 className="auth-title">Choose your access role</h2>
                <p className="auth-subtitle">
                  Select the identity that best matches how you will use the platform.
                </p>

                <div className="role-grid">
                  {roles.map((item) => {
                    const Icon = item.icon;
                    return (
                      <motion.button
                        type="button"
                        key={item.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className="role-card"
                        onClick={() => selectRole(item.id)}
                      >
                        <span className="role-card-icon">
                          <Icon size={20} />
                        </span>
                        <div>
                          <h3>{item.title}</h3>
                          <p>{item.desc}</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                <p className="auth-switch">
                  Already registered? <Link to="/login">Login</Link>
                </p>
              </div>
            )}

            <AnimatePresence mode="wait">
              {role && (
                <motion.form
                  key={role}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.32 }}
                  onSubmit={handleRegister}
                  className="auth-form"
                >
                  <div className="auth-form-toolbar">
                    <button type="button" className="auth-back-button" onClick={resetRole}>
                      <ArrowLeft size={16} />
                      <span>Back</span>
                    </button>

                    <div className="auth-role-summary">
                      <span className="auth-role-icon">
                        <SelectedRoleIcon size={16} />
                      </span>
                      <div>
                        <strong>{selectedRole?.title} registration</strong>
                        <p>{roleGuidance[role]}</p>
                      </div>
                    </div>
                  </div>

                  {status.message && (
                    <div className={`auth-message auth-message-${status.type}`}>{status.message}</div>
                  )}

                  {role === "citizen" && (
                    <>
                      <AuthSection title="Identity">
                        <Field label="Full Name" name="fullName" placeholder="Enter your full name" onChange={handleChange} required icon={<UserRound size={16} />} />
                        <Field label="Username" name="username" placeholder="Choose a username" onChange={handleChange} required icon={<IdCard size={16} />} />
                      </AuthSection>

                      <AuthSection title="Contact">
                        <Field label="Email" name="email" type="email" placeholder="Enter your email" onChange={handleChange} required icon={<Building2 size={16} />} />
                        <Field label="Phone Number" name="phone" placeholder="Enter your phone number" onChange={handleChange} required icon={<Shield size={16} />} />
                        <Field label="City" name="city" placeholder="Enter your city" onChange={handleChange} required icon={<MapPin size={16} />} />
                        <Field label="Address" name="address" placeholder="Optional address" onChange={handleChange} optional icon={<MapPin size={16} />} />
                        <Field label="Aadhaar / Govt ID" name="aadhaar" placeholder="Optional identity reference" onChange={handleChange} optional icon={<IdCard size={16} />} />
                      </AuthSection>

                      <AuthSection title="Preferences">
                        <label className="auth-checkbox auth-checkbox-block">
                          <input type="checkbox" name="gpsPermission" onChange={handleChange} />
                          <div>
                            <strong>Allow GPS location access</strong>
                            <span>Helpful for location-assisted incident reporting.</span>
                          </div>
                        </label>
                      </AuthSection>

                      <AuthSection title="Security">
                        <Field label="Password" name="password" type="password" placeholder="Create a password" onChange={handleChange} required icon={<Shield size={16} />} />
                        <Field label="Confirm Password" name="confirmPassword" type="password" placeholder="Re-enter your password" onChange={handleChange} required icon={<Shield size={16} />} />
                      </AuthSection>
                    </>
                  )}

                  {role === "police" && (
                    <>
                      <AuthSection title="Identity">
                        <Field label="Full Name" name="fullName" placeholder="Officer full name" onChange={handleChange} required icon={<UserRound size={16} />} />
                        <Field label="Username" name="username" placeholder="Choose a username" onChange={handleChange} required icon={<IdCard size={16} />} />
                        <Field label="Official Email" name="email" type="email" placeholder="Official email address" onChange={handleChange} required icon={<Building2 size={16} />} />
                        <Field label="Phone Number" name="phone" placeholder="Official or contact phone number" onChange={handleChange} required icon={<Shield size={16} />} />
                      </AuthSection>

                      <AuthSection title="Operational Information">
                        <Field label="Police Badge ID" name="badgeId" placeholder="Badge identification" onChange={handleChange} required icon={<BadgeCheck size={16} />} />
                        <Field label="Rank" name="rank" placeholder="Inspector / SI / ASI" onChange={handleChange} required icon={<ShieldCheck size={16} />} />
                        <Field label="Police Station" name="station" placeholder="Assigned police station" onChange={handleChange} required icon={<Building2 size={16} />} />
                        <Field label="District" name="district" placeholder="Assigned district" onChange={handleChange} required icon={<MapPin size={16} />} />
                      </AuthSection>

                      <AuthSection title="Security">
                        <Field label="Password" name="password" type="password" placeholder="Create a password" onChange={handleChange} required icon={<Shield size={16} />} />
                        <Field label="Confirm Password" name="confirmPassword" type="password" placeholder="Re-enter your password" onChange={handleChange} required icon={<Shield size={16} />} />
                      </AuthSection>
                    </>
                  )}

                  {role === "admin" && (
                    <>
                      <AuthSection title="Identity">
                        <Field label="Full Name" name="fullName" placeholder="Administrator full name" onChange={handleChange} required icon={<UserRound size={16} />} />
                        <Field label="Username" name="username" placeholder="Choose a username" onChange={handleChange} required icon={<IdCard size={16} />} />
                        <Field label="Email" name="email" type="email" placeholder="Official email address" onChange={handleChange} required icon={<Building2 size={16} />} />
                      </AuthSection>

                      <AuthSection title="Administrative Access">
                        <Field label="Department" name="department" placeholder="IT / Cyber Security / Administration" onChange={handleChange} required icon={<Building2 size={16} />} />
                        <Field label="Admin Authorization Code" name="authCode" placeholder="Enter admin authorization code" onChange={handleChange} required icon={<ShieldCheck size={16} />} />
                      </AuthSection>

                      <AuthSection title="Security">
                        <Field label="Password" name="password" type="password" placeholder="Create a password" onChange={handleChange} required icon={<Shield size={16} />} />
                        <Field label="Confirm Password" name="confirmPassword" type="password" placeholder="Re-enter your password" onChange={handleChange} required icon={<Shield size={16} />} />
                      </AuthSection>
                    </>
                  )}

                  <motion.button
                    type="submit"
                    whileHover={{ scale: submitting ? 1 : 1.01 }}
                    whileTap={{ scale: submitting ? 1 : 0.99 }}
                    className="auth-button"
                    disabled={submitting}
                  >
                    {submitting ? "Creating Account..." : "Create Account"}
                  </motion.button>

                  <p className="auth-switch">
                    Already registered? <Link to="/login">Login</Link>
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </section>
      </div>
    </div>
  );
};

const AuthSection = ({ title, children }) => (
  <section className="auth-section">
    <div className="auth-section-head">
      <strong>{title}</strong>
    </div>
    <div className="auth-section-body">{children}</div>
  </section>
);

const Field = ({ label, name, type = "text", placeholder, onChange, required = false, optional = false, icon }) => (
  <div className="auth-field">
    <div className="auth-field-head">
      <label htmlFor={name}>{label}</label>
      {optional && <span>Optional</span>}
    </div>
    <div className="auth-input-wrap">
      {icon}
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        onChange={onChange}
        required={required}
      />
    </div>
  </div>
);

export default Register;
