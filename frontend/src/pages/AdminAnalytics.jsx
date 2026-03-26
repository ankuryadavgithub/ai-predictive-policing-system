import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import MainLayout from "../layout/MainLayout";
import api from "../services/api";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

const AdminAnalytics = () => {
  const [typeData, setTypeData] = useState([]);
  const [districtData, setDistrictData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [recordType, setRecordType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const params = { record_type: recordType };
      const [type, district, trend] = await Promise.all([
        api.get("/admin/analytics/top-crime-types", { params }),
        api.get("/admin/analytics/top-districts", { params }),
        api.get("/admin/analytics/yearly-trend", { params }),
      ]);

      setTypeData(type.data);
      setDistrictData(district.data);
      setTrendData(trend.data);
    } catch (err) {
      console.error("Analytics load error:", err);
      setError(err?.response?.data?.detail || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [recordType]);

  return (
    <MainLayout>
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-semibold mb-8 text-gray-800 dark:text-white"
      >
        Crime Intelligence Dashboard
      </motion.h1>

      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold text-gray-700 dark:text-white">Analytics Scope</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Switch between historical, predicted, and combined intelligence.
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={recordType}
            onChange={(e) => setRecordType(e.target.value)}
            className="bg-white dark:bg-gray-800 dark:text-white px-3 py-2 border rounded"
          >
            <option value="all">Combined</option>
            <option value="historical">Historical</option>
            <option value="predicted">Predicted</option>
          </select>
          <button
            onClick={loadData}
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

      {loading ? (
        <div className="text-sm text-gray-500 dark:text-gray-300">Loading analytics...</div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-8">
            <ChartCard title="Top Districts by Volume" empty={districtData.length === 0}>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={districtData}>
                  <XAxis dataKey="district" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#dc2626" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top Crime Types" empty={typeData.length === 0}>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={typeData}>
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard title="Yearly Crime Trend" empty={trendData.length === 0} className="mt-8">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={trendData}>
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}
    </MainLayout>
  );
};

export default AdminAnalytics;

const ChartCard = ({ title, empty, className = "", children }) => (
  <div className={`bg-white dark:bg-gray-800 p-6 rounded-xl shadow ${className}`}>
    <h3 className="mb-4 font-semibold text-gray-700 dark:text-white">{title}</h3>
    {empty ? (
      <div className="h-[250px] flex items-center justify-center text-sm text-gray-500 dark:text-gray-300">
        No analytics data available for this scope.
      </div>
    ) : (
      children
    )}
  </div>
);
