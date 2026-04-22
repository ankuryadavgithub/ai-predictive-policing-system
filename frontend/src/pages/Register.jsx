import { useEffect, useRef, useState } from "react";
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

import { registerUser, registerVerifiedCitizen } from "../utils/auth";
import CinematicBackground from "../components/CinematicBackground";
import CrimeGlobe from "../components/CrimeGlobe";
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
  citizen: "Citizen registration now collects Aadhaar and live selfie evidence, then goes to admin review before account activation.",
  police: "Police registration collects operational details and usually requires admin approval before login access.",
  admin: "Admin registration requires a valid authorization code and should be used only for approved oversight accounts.",
};

const extractErrorMessage = (error) => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object") {
          const path = Array.isArray(item.loc) ? item.loc.slice(1).join(" -> ") : "";
          const message = item.msg || item.message || "Validation error";
          return path ? `${path}: ${message}` : message;
        }
        return "Validation error";
      })
      .join("; ");
  }
  if (typeof error?.response?.data?.message === "string" && error.response.data.message.trim()) {
    return error.response.data.message;
  }
  return "Registration failed.";
};

const Register = () => {
  const [role, setRole] = useState(null);
  const [form, setForm] = useState({});
  const [status, setStatus] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [aadhaarFile, setAadhaarFile] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState("");
  const [selfieBlob, setSelfieBlob] = useState(null);
  const [livenessBlobs, setLivenessBlobs] = useState([]);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

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

    if (role === "citizen") {
      if (!aadhaarFile) {
        setStatus({ type: "error", message: "Please upload your Aadhaar card image." });
        return;
      }
      if (!selfieBlob) {
        setStatus({ type: "error", message: "Please capture a live selfie verification sequence." });
        return;
      }
    }

    setSubmitting(true);
    setStatus({ type: "", message: "" });

    try {
      let res;
      if (role === "citizen") {
        const citizenFormData = new FormData();
        Object.entries(form).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            citizenFormData.append(key, value);
          }
        });
        citizenFormData.append("aadhaar_card", aadhaarFile);
        citizenFormData.append("live_selfie", selfieBlob, "live-selfie.jpg");
        livenessBlobs.forEach((blob, index) => {
          citizenFormData.append("liveness_frames", blob, `liveness-${index + 1}.jpg`);
        });
        res = await registerVerifiedCitizen(citizenFormData);
      } else {
        res = await registerUser(form);
      }
      setStatus({
        type: res.status === "rejected" ? "error" : "success",
        message:
          res.status === "pending"
            ? "Registration submitted. Your police account is pending admin approval."
          : res.status === "pending_manual_review"
            ? res.message || "Your account is under Aadhaar verification. Kindly wait for admin review and approval."
            : res.status === "rejected"
            ? res.message || "Citizen verification was rejected."
            : "Registration successful. You can now sign in.",
      });
    } catch (err) {
      setStatus({
        type: "error",
        message: extractErrorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectRole = (nextRole) => {
    stopCamera();
    setRole(nextRole);
    setForm({ role: nextRole });
    setStatus({ type: "", message: "" });
    setAadhaarFile(null);
    setSelfieBlob(null);
    setSelfiePreview("");
    setLivenessBlobs([]);
  };

  const resetRole = () => {
    stopCamera();
    setRole(null);
    setForm({});
    setStatus({ type: "", message: "" });
    setAadhaarFile(null);
    setSelfieBlob(null);
    setSelfiePreview("");
    setLivenessBlobs([]);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraReady(true);
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: "Camera permission is required for live selfie verification." });
    }
  };

  const captureFrameBlob = () =>
    new Promise((resolve) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) {
        resolve(null);
        return;
      }
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
    });

  const captureVerificationSequence = async () => {
    if (!cameraReady) {
      await startCamera();
      return;
    }

    const frames = [];
    for (let index = 0; index < 3; index += 1) {
      const blob = await captureFrameBlob();
      if (blob) {
        frames.push(blob);
      }
      if (index < 2) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }

    if (frames.length === 0) {
      setStatus({ type: "error", message: "Unable to capture live selfie frames from the camera." });
      return;
    }

    setSelfieBlob(frames[0]);
    setLivenessBlobs(frames);
    setSelfiePreview(URL.createObjectURL(frames[0]));
    setStatus({
      type: "success",
      message: "Live selfie verification frames captured. You can now submit your citizen registration.",
    });
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
          <div className="auth-globe-layer" aria-hidden="true">
            <CrimeGlobe />
          </div>

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
                        <div className="auth-field">
                          <div className="auth-field-head">
                            <label htmlFor="aadhaar_card">Aadhaar Card Image</label>
                          </div>
                          <div className="auth-input-wrap">
                            <IdCard size={16} />
                            <input
                              id="aadhaar_card"
                              name="aadhaar_card"
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              required
                              onChange={(event) => setAadhaarFile(event.target.files?.[0] || null)}
                            />
                          </div>
                        </div>
                      </AuthSection>

                      <AuthSection title="Live Verification">
                        <div className="auth-field">
                          <div className="auth-field-head">
                            <label>Live Selfie Capture</label>
                          </div>
                          <div className="auth-section-body">
                            <video
                              ref={videoRef}
                              autoPlay
                              muted
                              playsInline
                              className="w-full rounded-xl border border-white/10 bg-black/50"
                              style={{ minHeight: "220px" }}
                            />
                            <canvas ref={canvasRef} className="hidden" />
                            <div className="mt-3 flex flex-wrap gap-3">
                              <button type="button" className="auth-button" onClick={startCamera}>
                                {cameraReady ? "Restart Camera" : "Start Camera"}
                              </button>
                              <button type="button" className="auth-button" onClick={captureVerificationSequence}>
                                Capture Live Selfie
                              </button>
                            </div>
                            <p className="mt-3 text-sm text-gray-400">
                              Keep your face centered and move slightly while capture runs so liveness can be checked.
                            </p>
                            {selfiePreview && (
                              <img
                                src={selfiePreview}
                                alt="Live selfie preview"
                                className="mt-4 max-h-48 rounded-xl border border-white/10 object-cover"
                              />
                            )}
                          </div>
                        </div>
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
                    {submitting ? "Creating Account..." : role === "citizen" ? "Submit For Review" : "Create Account"}
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
