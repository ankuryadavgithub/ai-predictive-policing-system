import { useEffect, useMemo, useState } from "react";
import MainLayout from "../layout/MainLayout";
import { motion, AnimatePresence } from "framer-motion";
import DeckGL from "@deck.gl/react";
import { Map } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import api from "../services/api";
import ProtectedMedia from "../components/ProtectedMedia";

const containerVariant = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const itemVariant = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0 }
};

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"];

const ReportCrime = () => {
  const [form, setForm] = useState({
    crimeType: "",
    description: "",
    severity: "Medium",
  });
  const [files, setFiles] = useState([]);
  const [location, setLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: "", text: "" });
  const [locationError, setLocationError] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [manualLocation, setManualLocation] = useState({
    latitude: "",
    longitude: "",
  });

  const loadHistory = async () => {
    try {
      const res = await api.get("/reports/");
      setHistory(res.data.slice(0, 10));
    } catch (err) {
      console.error("Failed to load report history", err);
    }
  };

  const detectLocation = () => {
    setLoadingLocation(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        };
        setLocation(nextLocation);
        setManualLocation({
          latitude: String(nextLocation.latitude),
          longitude: String(nextLocation.longitude),
        });
        setLoadingLocation(false);
      },
      () => {
        setLocationError("Location access denied. Enter coordinates manually if needed.");
        setLoadingLocation(false);
      }
    );
  };

  useEffect(() => {
    detectLocation();
    loadHistory();
  }, []);

  const filteredHistory = useMemo(() => {
    return history.filter((report) => historyFilter === "all" || report.status === historyFilter);
  }, [history, historyFilter]);

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setValidationErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const syncManualLocation = (field, value) => {
    setManualLocation((prev) => ({ ...prev, [field]: value }));
    const latitude = field === "latitude" ? value : manualLocation.latitude;
    const longitude = field === "longitude" ? value : manualLocation.longitude;

    const latNum = Number(latitude);
    const lngNum = Number(longitude);

    if (!Number.isNaN(latNum) && !Number.isNaN(lngNum)) {
      setLocation({ latitude: latNum, longitude: lngNum });
      setLocationError("");
    }
  };

  const handleFileAdd = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    const nextErrors = [];

    if (files.length + selectedFiles.length > MAX_FILES) {
      setStatusMessage({ type: "error", text: `You can upload up to ${MAX_FILES} evidence files.` });
      return;
    }

    const validFiles = selectedFiles
      .filter((file) => {
        if (!ALLOWED_TYPES.includes(file.type)) {
          nextErrors.push(`${file.name}: unsupported file type`);
          return false;
        }
        if (file.size > MAX_FILE_SIZE) {
          nextErrors.push(`${file.name}: exceeds 10 MB`);
          return false;
        }
        return true;
      })
      .map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));

    if (nextErrors.length > 0) {
      setStatusMessage({ type: "error", text: nextErrors.join(" | ") });
    } else {
      setStatusMessage({ type: "", text: "" });
    }

    setFiles((prev) => [...prev, ...validFiles]);
    event.target.value = "";
  };

  const removeFile = (index) => {
    URL.revokeObjectURL(files[index].preview);
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const errors = {};

    if (!form.crimeType) {
      errors.crimeType = "Select a crime type";
    }

    if (!form.description || form.description.trim().length < 20) {
      errors.description = "Provide at least 20 characters describing the incident";
    }

    if (!location) {
      errors.location = "Location is required";
    } else if (
      location.latitude < -90 ||
      location.latitude > 90 ||
      location.longitude < -180 ||
      location.longitude > 180
    ) {
      errors.location = "Location coordinates are invalid";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submitReport = async () => {
    setStatusMessage({ type: "", text: "" });

    if (!validateForm()) {
      setStatusMessage({ type: "error", text: "Please fix the highlighted fields before submitting." });
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append("crime_type", form.crimeType);
      formData.append("severity", form.severity);
      formData.append("description", form.description.trim());
      formData.append("latitude", location.latitude);
      formData.append("longitude", location.longitude);

      files.forEach((item) => {
        formData.append("evidence", item.file);
      });

      const res = await api.post("/reports/", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      await loadHistory();

      setStatusMessage({
        type: "success",
        text: `Report submitted successfully. Tracking ID: ${res.data.report_id}`,
      });

      setForm({
        crimeType: "",
        description: "",
        severity: "Medium"
      });

      files.forEach((item) => URL.revokeObjectURL(item.preview));
      setFiles([]);
      setValidationErrors({});
    } catch (err) {
      console.error(err);
      setStatusMessage({
        type: "error",
        text: err?.response?.data?.detail || "Failed to submit report",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <motion.div variants={containerVariant} initial="hidden" animate="show">
        <motion.h2
          variants={itemVariant}
          className="text-2xl font-semibold mb-6 text-slate-800 dark:text-white"
        >
          Report a Crime
        </motion.h2>

        <motion.div
          variants={itemVariant}
          className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow mb-6"
        >
          <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300">
            <div>
              <p className="font-semibold text-gray-800 dark:text-white">Before you submit</p>
              <p>Provide accurate location and a clear description. High quality evidence improves verification speed.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-800 dark:text-white">What happens next</p>
              <p>Your report enters review as <strong>Submitted</strong>, then may move to <strong>Verified</strong>, <strong>Rejected</strong>, or <strong>Resolved</strong>.</p>
            </div>
          </div>
        </motion.div>

        {statusMessage.text && (
          <motion.div
            variants={itemVariant}
            className={`mb-6 rounded-xl px-4 py-3 text-sm ${
              statusMessage.type === "success"
                ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            {statusMessage.text}
          </motion.div>
        )}

        <motion.div
          variants={containerVariant}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <motion.div
            variants={itemVariant}
            whileHover={{ scale: 1.01 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow"
          >
            <div className="mb-4">
              <label className="text-sm text-gray-500 dark:text-white">Crime Type</label>
              <select
                value={form.crimeType}
                className="bg-white dark:bg-gray-800 dark:text-white w-full mt-1 p-2 border rounded"
                onChange={(e) => setField("crimeType", e.target.value)}
              >
                <option value="">Select</option>
                <option value="Murder">Murder</option>
                <option value="Attempt_to_Murder">Attempt to Murder</option>
                <option value="Kidnapping_Abduction">Kidnapping & Abduction</option>
                <option value="Rape">Rape</option>
                <option value="Assault">Assault</option>
                <option value="Riots">Riots</option>
                <option value="Theft">Theft</option>
              </select>
              {validationErrors.crimeType && (
                <p className="mt-1 text-xs text-red-500">{validationErrors.crimeType}</p>
              )}
            </div>

            <div className="mb-4">
              <label className="text-sm text-gray-500 dark:text-white">Severity</label>
              <select
                value={form.severity}
                className="bg-white dark:bg-gray-800 dark:text-white w-full mt-1 p-2 border rounded"
                onChange={(e) => setField("severity", e.target.value)}
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="text-sm text-gray-500 dark:text-white">
                Description
              </label>
              <textarea
                value={form.description}
                className="bg-white dark:bg-gray-800 text-black dark:text-white w-full mt-1 p-2 border rounded"
                rows="5"
                maxLength={1000}
                placeholder="Describe what happened, what you observed, and any urgent risk..."
                onChange={(e) => setField("description", e.target.value)}
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-400">{form.description.length}/1000</span>
                {validationErrors.description && (
                  <span className="text-xs text-red-500">{validationErrors.description}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500 dark:text-white">Latitude</label>
                <input
                  value={manualLocation.latitude}
                  onChange={(e) => syncManualLocation("latitude", e.target.value)}
                  className="bg-white dark:bg-gray-800 dark:text-white w-full mt-1 p-2 border rounded"
                  placeholder="19.0760"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500 dark:text-white">Longitude</label>
                <input
                  value={manualLocation.longitude}
                  onChange={(e) => syncManualLocation("longitude", e.target.value)}
                  className="bg-white dark:bg-gray-800 dark:text-white w-full mt-1 p-2 border rounded"
                  placeholder="72.8777"
                />
              </div>
            </div>
            {(validationErrors.location || locationError) && (
              <p className="mt-2 text-xs text-red-500">{validationErrors.location || locationError}</p>
            )}

            <div className="mt-4 flex flex-wrap gap-3 items-center">
              <button
                onClick={detectLocation}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 transition"
              >
                Use Current Location
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                If GPS is denied or inaccurate, enter coordinates manually.
              </p>
            </div>
          </motion.div>

          <motion.div variants={itemVariant} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow">
            <h3 className="font-semibold mb-4 text-slate-800 dark:text-white">Location Preview</h3>

            <div className="relative h-[300px] rounded overflow-hidden">
              {loadingLocation && (
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="flex items-center justify-center h-full bg-gray-200"
                >
                  Detecting Location...
                </motion.div>
              )}

              {!loadingLocation && !location && (
                <div className="flex items-center justify-center h-full bg-gray-100 text-sm text-gray-500">
                  Add coordinates manually to preview the incident location.
                </div>
              )}

              {location && (
                <DeckGL
                  initialViewState={{
                    longitude: location.longitude,
                    latitude: location.latitude,
                    zoom: 14
                  }}
                  controller
                  layers={[]}
                  style={{ position: "absolute", inset: 0 }}
                >
                  <Map
                    reuseMaps
                    mapLib={maplibregl}
                    mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
                    style={{ width: "100%", height: "100%" }}
                  />
                </DeckGL>
              )}
            </div>
          </motion.div>
        </motion.div>

        <motion.div variants={itemVariant} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow mt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="font-semibold mb-1 text-slate-800 dark:text-white">
                Upload Evidence
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-300">
                Max {MAX_FILES} files. JPEG, PNG, WEBP, MP4, WEBM only. Up to 10 MB each.
              </p>
            </div>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              onChange={handleFileAdd}
              className="mb-0"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
            <AnimatePresence>
              {files.map((item, index) => (
                <motion.div
                  key={`${item.file.name}-${index}`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  whileHover={{ scale: 1.03 }}
                  className="relative border border-gray-200 dark:border-gray-700 rounded-lg p-2"
                >
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded-full text-xs"
                  >
                    x
                  </button>

                  {item.file.type.startsWith("image") ? (
                    <img src={item.preview} alt="preview" className="h-24 w-full object-cover rounded" />
                  ) : (
                    <video src={item.preview} className="h-24 w-full object-cover rounded" />
                  )}

                  <p className="mt-2 text-xs text-gray-700 dark:text-gray-200 truncate">{item.file.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {Math.round(item.file.size / 1024)} KB
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        <motion.div variants={itemVariant} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow mt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-white">Recent Report History</h3>
              <p className="text-sm text-gray-500 dark:text-gray-300">
                Track your submissions and current review status.
              </p>
            </div>
            <select
              value={historyFilter}
              onChange={(e) => setHistoryFilter(e.target.value)}
              className="bg-white dark:bg-gray-800 dark:text-white px-3 py-2 border rounded"
            >
              <option value="all">All statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="Verified">Verified</option>
              <option value="Rejected">Rejected</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          <div className="space-y-3">
            {filteredHistory.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-300">
                No reports match the selected status.
              </p>
            )}

            {filteredHistory.map((report) => (
              <button
                key={report.id}
                onClick={() => setSelectedHistory(report)}
                className="w-full text-left border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white">
                      {report.report_id} • {report.crime_type}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-300">
                      {new Date(report.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-300">
                    {report.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div variants={itemVariant} className="mt-6 flex flex-wrap items-center gap-4">
          <motion.button
            whileHover={submitting ? {} : { scale: 1.03 }}
            whileTap={submitting ? {} : { scale: 0.97 }}
            onClick={submitReport}
            disabled={submitting}
            className="bg-blue-600 text-white px-6 py-3 rounded shadow hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {submitting ? "Submitting..." : "Submit Report"}
          </motion.button>
          <p className="text-sm text-gray-500 dark:text-gray-300">
            Verified evidence and accurate details help police review your report faster.
          </p>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {selectedHistory && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.35 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setSelectedHistory(null)}
            />
            <motion.div
              initial={{ x: 500 }}
              animate={{ x: 0 }}
              exit={{ x: 500 }}
              className="fixed right-0 top-0 w-full max-w-lg h-full bg-white dark:bg-gray-900 shadow-xl p-6 overflow-y-auto z-50"
            >
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
                Report Summary
              </h3>
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                <p><strong>ID:</strong> {selectedHistory.report_id}</p>
                <p><strong>Crime Type:</strong> {selectedHistory.crime_type}</p>
                <p><strong>Severity:</strong> {selectedHistory.severity}</p>
                <p><strong>Status:</strong> {selectedHistory.status}</p>
                <p><strong>Submitted:</strong> {new Date(selectedHistory.created_at).toLocaleString()}</p>
                <p><strong>Notes:</strong> {selectedHistory.verification_notes || "No review notes yet"}</p>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white mb-1">Description</p>
                  <p>{selectedHistory.description}</p>
                </div>
                {selectedHistory.evidence?.length > 0 && (
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-white mb-2">Evidence</p>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedHistory.evidence.map((file) => (
                        <div key={file.id} className="border rounded-lg p-2">
                          <ProtectedMedia
                            file={file}
                            className="w-full h-28 object-cover rounded"
                            alt={file.original_file_name}
                          />
                          <p className="mt-2 text-xs text-gray-500 truncate">{file.original_file_name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </MainLayout>
  );
};

export default ReportCrime;
