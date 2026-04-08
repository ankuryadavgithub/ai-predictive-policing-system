import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import MainLayout from "../layout/MainLayout";
import api from "../services/api";
import ProtectedMedia from "../components/ProtectedMedia";

const EvidenceMonitor = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [fileType, setFileType] = useState("all");

  const loadEvidence = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/admin/evidence", { params: { page_size: 100 } });
      setFiles(res.data);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || "Failed to load evidence");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvidence();
  }, []);

  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      const matchesType = fileType === "all" || file.file_type === fileType;
      const matchesQuery = [file.original_file_name, String(file.report_id)]
        .some((value) => value.toLowerCase().includes(query.toLowerCase()));
      return matchesType && matchesQuery;
    });
  }, [files, fileType, query]);

  const archiveFile = async (id) => {
    try {
      await api.delete(`/admin/evidence/${id}`);
      setFiles((prev) => prev.filter((file) => file.id !== id));
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || "Failed to archive evidence");
    }
  };

  return (
    <MainLayout>
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-semibold mb-6 text-gray-800 dark:text-white"
      >
        Evidence Monitoring
      </motion.h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 sm:p-5 mb-6 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search report ID or filename..."
          className="bg-white dark:bg-gray-800 dark:text-white px-3 py-2 border rounded"
        />
        <select
          value={fileType}
          onChange={(e) => setFileType(e.target.value)}
          className="bg-white dark:bg-gray-800 dark:text-white px-3 py-2 border rounded"
        >
          <option value="all">All media</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
        </select>
        <button
          onClick={loadEvidence}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          Refresh Evidence
        </button>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-300 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 dark:text-gray-300">Loading evidence library...</div>
      ) : filteredFiles.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-300">No evidence matches the current filters.</div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredFiles.map((file) => (
            <motion.div
              key={file.id}
              whileHover={{ scale: 1.02 }}
              className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow"
            >
              <ProtectedMedia
                file={file}
                className="rounded mb-3 w-full h-44 sm:h-56 object-cover"
                alt={file.original_file_name}
              />
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <p className="font-medium text-gray-800 dark:text-white truncate">{file.original_file_name}</p>
                <p>Report ID: {file.report_id}</p>
                <p>Type: {file.file_type}</p>
                <p>Size: {Math.max(0, Math.round((file.file_size || 0) / 1024))} KB</p>
                <p>Accessed: {file.access_count} times</p>
                <p>Uploaded: {new Date(file.uploaded_at).toLocaleString()}</p>
              </div>
              <button
                onClick={() => archiveFile(file.id)}
                className="mt-4 text-red-600 hover:text-red-700"
              >
                Archive Evidence
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </MainLayout>
  );
};

export default EvidenceMonitor;
