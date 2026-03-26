import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import MainLayout from "../layout/MainLayout";
import api from "../services/api";
import ProtectedMedia from "../components/ProtectedMedia";

const AdminReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/admin/reports", { params: { page_size: 100 } });
      setReports(res.data);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const matchesStatus = statusFilter === "all" || report.status === statusFilter;
      const matchesSeverity = severityFilter === "all" || report.severity === severityFilter;
      const matchesQuery = [report.report_id, report.crime_type, report.city, report.reporter_username]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query.toLowerCase()));
      return matchesStatus && matchesSeverity && matchesQuery;
    });
  }, [reports, query, severityFilter, statusFilter]);

  const mutateReport = async (id, request, nextStatus) => {
    try {
      setError("");
      await request();
      setReports((prev) => {
        if (nextStatus === "__deleted__") {
          return prev.filter((report) => report.id !== id);
        }
        return prev.map((report) =>
          report.id === id ? { ...report, status: nextStatus } : report
        );
      });
      if (selectedReport?.id === id && nextStatus === "__deleted__") {
        setSelectedReport(null);
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || "Moderation action failed");
    }
  };

  return (
    <MainLayout>
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-semibold mb-6 text-gray-800 dark:text-white"
      >
        Crime Report Moderation
      </motion.h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search report ID, type, city..."
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
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
          <button
            onClick={fetchReports}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            Refresh Queue
          </button>
        </div>

        {error && (
          <div className="px-5 py-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-sm text-gray-500 dark:text-gray-300">Loading moderation queue...</div>
        ) : filteredReports.length === 0 ? (
          <div className="p-8 text-sm text-gray-500 dark:text-gray-300">No reports match the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="p-4">Report</th>
                  <th className="p-4">Crime</th>
                  <th className="p-4">Severity</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Evidence</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report) => (
                  <motion.tr
                    key={report.id}
                    whileHover={{ scale: 1.005 }}
                    className="border-t hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="p-4">
                      <p className="font-medium text-gray-800 dark:text-white">{report.report_id}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-300">{report.city || "Unknown city"}</p>
                      <p className="text-xs text-gray-400">{new Date(report.created_at).toLocaleString()}</p>
                    </td>
                    <td className="p-4 text-gray-700 dark:text-gray-200">{report.crime_type}</td>
                    <td className="p-4 text-gray-700 dark:text-gray-200">{report.severity}</td>
                    <td className="p-4">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        {report.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-700 dark:text-gray-200">{report.evidence_count}</td>
                    <td className="p-4 flex flex-wrap gap-3">
                      <button onClick={() => setSelectedReport(report)} className="text-blue-600">View</button>
                      <button onClick={() => mutateReport(report.id, () => api.patch(`/admin/reports/${report.id}/resolve`), "Resolved")} className="text-green-600">Resolve</button>
                      <button onClick={() => mutateReport(report.id, () => api.patch(`/admin/reports/${report.id}/fake`), "Rejected")} className="text-yellow-600">Mark Fake</button>
                      <button onClick={() => mutateReport(report.id, () => api.delete(`/admin/reports/${report.id}`), "__deleted__")} className="text-red-600">Delete</button>
                    </td>
                  </motion.tr>
                )).filter(Boolean)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedReport && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.35 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setSelectedReport(null)}
            />
            <motion.div
              initial={{ x: 500 }}
              animate={{ x: 0 }}
              exit={{ x: 500 }}
              className="fixed right-0 top-0 w-full max-w-lg h-full bg-white dark:bg-gray-900 shadow-xl p-6 overflow-y-auto z-50"
            >
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
                Moderation Detail
              </h2>
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                <p><strong>Report:</strong> {selectedReport.report_id}</p>
                <p><strong>Reporter:</strong> {selectedReport.reporter_username || "Unknown"}</p>
                <p><strong>Crime Type:</strong> {selectedReport.crime_type}</p>
                <p><strong>Severity:</strong> {selectedReport.severity}</p>
                <p><strong>Status:</strong> {selectedReport.status}</p>
                <p><strong>City:</strong> {selectedReport.city || "Unknown"}</p>
                <p><strong>Assigned District:</strong> {selectedReport.assigned_district || "Not assigned"}</p>
                <p><strong>Notes:</strong> {selectedReport.verification_notes || "No moderation notes yet"}</p>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white mb-2">Description</p>
                  <p>{selectedReport.description}</p>
                </div>
                {selectedReport.evidence?.length > 0 && (
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-white mb-2">Evidence</p>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedReport.evidence.map((file) => (
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

export default AdminReports;
