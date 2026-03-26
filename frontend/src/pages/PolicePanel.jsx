import { useEffect, useMemo, useState } from "react";
import MainLayout from "../layout/MainLayout";
import { motion, AnimatePresence } from "framer-motion";
import DeckGL from "@deck.gl/react";
import { Map } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import api from "../services/api";
import ProtectedMedia from "../components/ProtectedMedia";

const PolicePanel = () => {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [notes, setNotes] = useState("");
  const [busyId, setBusyId] = useState(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError("");
      const params = {
        page_size: 100,
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      };
      const res = await api.get("/reports/", { params });
      setReports(res.data);
    } catch (err) {
      console.error("Failed to load reports", err);
      setError(err?.response?.data?.detail || "Failed to load police queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  useEffect(() => {
    setNotes(selectedReport?.verification_notes || "");
  }, [selectedReport]);

  const filteredReports = useMemo(() => {
    const filtered = reports.filter((report) => {
      const matchesQuery = [
        report.report_id,
        report.crime_type,
        report.city,
        report.reporter_username,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query.toLowerCase()));
      const matchesSeverity = severityFilter === "all" || report.severity === severityFilter;
      return matchesQuery && matchesSeverity;
    });

    const severityRank = { High: 3, Medium: 2, Low: 1 };

    return filtered.sort((a, b) => {
      if (sortBy === "oldest") {
        return new Date(a.created_at) - new Date(b.created_at);
      }
      if (sortBy === "severity") {
        return (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [query, reports, severityFilter, sortBy]);

  const submitDecision = async (report, action) => {
    try {
      setBusyId(report.id);
      setError("");
      const formData = new FormData();
      if (notes.trim()) {
        formData.append("notes", notes.trim());
      }
      await api.patch(`/reports/${report.id}/${action}`, formData);

      const nextStatus = action === "verify" ? "Verified" : "Rejected";
      setReports((prev) =>
        prev.map((item) =>
          item.id === report.id
            ? { ...item, status: nextStatus, verification_notes: notes.trim() }
            : item
        )
      );
      setSelectedReport((prev) =>
        prev && prev.id === report.id
          ? { ...prev, status: nextStatus, verification_notes: notes.trim() }
          : prev
      );
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || "Unable to update report");
    } finally {
      setBusyId(null);
    }
  };

  const getStatusColor = (status) => {
    if (status === "Verified") return "bg-green-100 text-green-700";
    if (status === "Rejected") return "bg-red-100 text-red-700";
    if (status === "Resolved") return "bg-blue-100 text-blue-700";
    return "bg-yellow-100 text-yellow-700";
  };

  const getSeverityColor = (severity) => {
    if (severity === "High") return "text-red-600";
    if (severity === "Medium") return "text-orange-500";
    return "text-green-600";
  };

  return (
    <MainLayout>
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-semibold mb-6 text-gray dark:text-white"
      >
        Police Verification Panel
      </motion.h2>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search report ID, crime, city..."
          className="bg-white dark:bg-gray-800 dark:text-white px-3 py-2 border rounded"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white dark:bg-gray-800 dark:text-white px-3 py-2 border rounded"
        >
          <option value="all">All statuses</option>
          <option value="Submitted">Submitted</option>
          <option value="Verified">Verified</option>
          <option value="Rejected">Rejected</option>
          <option value="Resolved">Resolved</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="bg-white dark:bg-gray-800 dark:text-white px-3 py-2 border rounded"
        >
          <option value="all">All severities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <div className="flex gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="flex-1 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 border rounded"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="severity">Severity</option>
          </select>
          <button
            onClick={fetchReports}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-300 rounded-lg">
          {error}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden"
      >
        {loading ? (
          <div className="p-8 text-sm text-gray-500 dark:text-gray-300">Loading police queue...</div>
        ) : filteredReports.length === 0 ? (
          <div className="p-8 text-sm text-gray-500 dark:text-gray-300">
            No reports match the current queue filters.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr className="text-gray dark:text-white">
                <th className="p-3">Report</th>
                <th className="p-3">Crime</th>
                <th className="p-3">Severity</th>
                <th className="p-3">Status</th>
                <th className="p-3">Evidence</th>
                <th className="p-3">Submitted</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report) => (
                <motion.tr
                  key={report.id}
                  whileHover={{ scale: 1.005 }}
                  className="border-t hover:bg-gray-50 dark:hover:bg-gray-700 text-gray dark:text-white"
                >
                  <td className="p-3">
                    <p className="font-medium">{report.report_id}</p>
                    <p className="text-xs text-gray-500">{report.city || "Unknown city"}</p>
                  </td>
                  <td className="p-3">{report.crime_type}</td>
                  <td className={`p-3 font-semibold ${getSeverityColor(report.severity)}`}>{report.severity}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-sm ${getStatusColor(report.status)}`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="p-3">{report.evidence_count || 0}</td>
                  <td className="p-3">{new Date(report.created_at).toLocaleString()}</td>
                  <td className="p-3 flex gap-3 flex-wrap">
                    <button
                      onClick={() => setSelectedReport(report)}
                      className="text-blue-600 font-medium"
                    >
                      View
                    </button>

                    {(report.status === "Submitted" || report.status === "Pending") && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedReport(report);
                            setNotes(report.verification_notes || "");
                          }}
                          className="text-green-600 font-medium"
                        >
                          Review
                        </button>
                      </>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      <AnimatePresence>
        {selectedReport && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setSelectedReport(null)}
            />

            <motion.div
              initial={{ x: 500 }}
              animate={{ x: 0 }}
              exit={{ x: 500 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="fixed right-0 top-0 w-full max-w-lg bg-white dark:bg-gray-900 h-full shadow-xl p-6 overflow-y-auto z-50"
            >
              <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
                Report Details
              </h3>

              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <p><strong>ID:</strong> {selectedReport.report_id}</p>
                <p><strong>Reporter:</strong> {selectedReport.reporter_username || "Unknown"}</p>
                <p><strong>Crime:</strong> {selectedReport.crime_type}</p>
                <p><strong>Severity:</strong> {selectedReport.severity}</p>
                <p><strong>Status:</strong> {selectedReport.status}</p>
                <p><strong>City:</strong> {selectedReport.city || "Unknown"}</p>
                <p><strong>Assigned District:</strong> {selectedReport.assigned_district || "Not assigned"}</p>
                <p><strong>Assigned Station:</strong> {selectedReport.assigned_station || "Not assigned"}</p>
                <p><strong>Date:</strong> {new Date(selectedReport.created_at).toLocaleString()}</p>
              </div>

              <div className="mt-4">
                <h4 className="font-semibold text-gray-800 dark:text-white">Description</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {selectedReport.description}
                </p>
              </div>

              {selectedReport.evidence?.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-3 text-gray-800 dark:text-white">Evidence</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedReport.evidence.map((file) => (
                      <motion.div
                        key={file.id}
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="border rounded overflow-hidden p-2 bg-white dark:bg-gray-800"
                      >
                        <ProtectedMedia
                          file={file}
                          className="w-full h-32 object-cover rounded"
                          alt={file.original_file_name}
                        />
                        <p className="mt-2 text-xs text-gray-500 truncate">{file.original_file_name}</p>
                        <p className="text-xs text-gray-400">{Math.max(0, Math.round((file.file_size || 0) / 1024))} KB</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6">
                <h4 className="font-semibold mb-2 text-gray-800 dark:text-white">Location</h4>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative h-48 rounded overflow-hidden"
                >
                  <DeckGL
                    initialViewState={{
                      longitude: selectedReport.longitude,
                      latitude: selectedReport.latitude,
                      zoom: 14,
                    }}
                    controller={false}
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
                </motion.div>
              </div>

              <div className="mt-6">
                <label className="block font-semibold mb-2 text-gray-800 dark:text-white">
                  Verification Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows="4"
                  className="w-full p-3 border rounded bg-white dark:bg-gray-800 dark:text-white"
                  placeholder="Add verification or rejection notes..."
                />
              </div>

              {(selectedReport.status === "Submitted" || selectedReport.status === "Pending") && (
                <div className="mt-6 flex gap-3">
                  <button
                    disabled={busyId === selectedReport.id}
                    onClick={() => submitDecision(selectedReport, "verify")}
                    className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {busyId === selectedReport.id ? "Working..." : "Verify Report"}
                  </button>
                  <button
                    disabled={busyId === selectedReport.id}
                    onClick={() => submitDecision(selectedReport, "reject")}
                    className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {busyId === selectedReport.id ? "Working..." : "Reject Report"}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </MainLayout>
  );
};

export default PolicePanel;
