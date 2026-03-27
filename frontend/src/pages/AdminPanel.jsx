import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import MainLayout from "../layout/MainLayout";
import api from "../services/api";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const emptyPatrolArea = {
  patrol_state: "",
  patrol_district: "",
  patrol_city: "",
};

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [editingOfficerId, setEditingOfficerId] = useState(null);
  const [patrolDraft, setPatrolDraft] = useState(emptyPatrolArea);
  const [stateOptions, setStateOptions] = useState([]);
  const [districtOptions, setDistrictOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);

  const loadPage = async () => {
    try {
      setLoading(true);
      setError("");

      const [usersRes, statsRes, statesRes] = await Promise.all([
        api.get("/admin/users", { params: { page_size: 100 } }),
        api.get("/admin/analytics"),
        api.get("/admin/patrol/states"),
      ]);

      setUsers(usersRes.data);
      setStats(statsRes.data);
      setStateOptions(statesRes.data);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || "Failed to load admin panel");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (!editingOfficerId) {
      setDistrictOptions([]);
      setCityOptions([]);
      return;
    }

    const loadDistricts = async () => {
      try {
        const res = await api.get("/admin/patrol/districts", {
          params: { state: patrolDraft.patrol_state || undefined },
        });
        setDistrictOptions(res.data);
      } catch (err) {
        console.error("Failed to load patrol districts", err);
        setDistrictOptions([]);
      }
    };

    loadDistricts();
  }, [editingOfficerId, patrolDraft.patrol_state]);

  useEffect(() => {
    if (!editingOfficerId) {
      return;
    }

    const loadCities = async () => {
      try {
        const res = await api.get("/admin/patrol/cities", {
          params: {
            state: patrolDraft.patrol_state || undefined,
            district: patrolDraft.patrol_district || undefined,
          },
        });
        setCityOptions(res.data);
      } catch (err) {
        console.error("Failed to load patrol cities", err);
        setCityOptions([]);
      }
    };

    loadCities();
  }, [editingOfficerId, patrolDraft.patrol_state, patrolDraft.patrol_district]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesQuery = [
        user.username,
        user.full_name,
        user.email,
        user.station,
        user.district,
        user.patrol_city,
        user.patrol_district,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query.toLowerCase()));
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [users, query, roleFilter, statusFilter]);

  const runAction = async (id, request, updater) => {
    try {
      setBusyId(id);
      setError("");
      await request();
      setUsers((prev) => updater(prev));
      await loadPage();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const startEditPatrolArea = (user) => {
    setEditingOfficerId(user.id);
    setPatrolDraft({
      patrol_state: user.patrol_state || "",
      patrol_district: user.patrol_district || "",
      patrol_city: user.patrol_city || "",
    });
  };

  const savePatrolArea = async (user) => {
    await runAction(
      user.id,
      () => api.patch(`/admin/users/${user.id}/patrol-area`, patrolDraft),
      (prev) =>
        prev.map((item) =>
          item.id === user.id
            ? {
                ...item,
                ...patrolDraft,
              }
            : item
        )
    );
    setEditingOfficerId(null);
    setPatrolDraft(emptyPatrolArea);
  };

  const cancelPatrolEdit = () => {
    setEditingOfficerId(null);
    setPatrolDraft(emptyPatrolArea);
  };

  const updatePatrolField = (field, value) => {
    setPatrolDraft((prev) => {
      if (field === "patrol_state") {
        return {
          ...prev,
          patrol_state: value,
          patrol_district: "",
          patrol_city: "",
        };
      }

      if (field === "patrol_district") {
        return {
          ...prev,
          patrol_district: value,
          patrol_city: "",
        };
      }

      return {
        ...prev,
        [field]: value,
      };
    });
  };

  return (
    <MainLayout>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          Administrator Command Center
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Review onboarding, manage account health, and assign operational patrol areas to police teams.
        </p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
      >
        <Card title="Total Users" value={stats.total_users} />
        <Card title="Pending Police" value={stats.pending_police} />
        <Card title="Total Reports" value={stats.total_reports} />
        <Card title="Verified Reports" value={stats.verified_reports} />
      </motion.div>

      <div className="bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-700 dark:text-white">
              User Management
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Search, filter, and act on citizen, police, and admin accounts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full lg:w-auto">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search username, email, station..."
              className="bg-white dark:bg-gray-800 dark:text-white px-3 py-2 border rounded"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-white dark:bg-gray-800 dark:text-white px-3 py-2 border rounded"
            >
              <option value="all">All roles</option>
              <option value="citizen">Citizen</option>
              <option value="police">Police</option>
              <option value="admin">Admin</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white dark:bg-gray-800 dark:text-white px-3 py-2 border rounded"
            >
              <option value="all">All statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="px-5 py-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-sm text-gray-500 dark:text-gray-300">
            Loading user registry...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-sm text-gray-500 dark:text-gray-300">
            No users match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Registered Area</th>
                  <th className="p-4">Patrol Area</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition align-top"
                  >
                    <td className="p-4">
                      <p className="font-medium text-gray-700 dark:text-white">{user.username}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{user.full_name}</p>
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </td>
                    <td className="p-4 capitalize text-gray-500 dark:text-gray-300">{user.role}</td>
                    <td className="p-4"><StatusBadge status={user.status} /></td>
                    <td className="p-4 text-sm text-gray-500 dark:text-gray-300">
                      <p>{user.city || "No city"}</p>
                      <p>{user.district || "No district"}</p>
                      <p>{user.station || "No station"}</p>
                    </td>
                    <td className="p-4 text-sm text-gray-500 dark:text-gray-300 min-w-80">
                      {user.role !== "police" ? (
                        <span className="text-gray-400">Not applicable</span>
                      ) : editingOfficerId === user.id ? (
                        <div className="grid grid-cols-1 gap-2">
                          <select
                            value={patrolDraft.patrol_state}
                            onChange={(e) => updatePatrolField("patrol_state", e.target.value)}
                            className="bg-white dark:bg-gray-800 dark:text-white px-3 py-2 border rounded"
                          >
                            <option value="">Select patrol state</option>
                            {stateOptions.map((state) => (
                              <option key={state} value={state}>{state}</option>
                            ))}
                          </select>

                          <select
                            value={patrolDraft.patrol_district}
                            onChange={(e) => updatePatrolField("patrol_district", e.target.value)}
                            className="bg-white dark:bg-gray-800 dark:text-white px-3 py-2 border rounded"
                          >
                            <option value="">Select patrol district</option>
                            {districtOptions.map((district) => (
                              <option key={district} value={district}>{district}</option>
                            ))}
                          </select>

                          <select
                            value={patrolDraft.patrol_city}
                            onChange={(e) => updatePatrolField("patrol_city", e.target.value)}
                            className="bg-white dark:bg-gray-800 dark:text-white px-3 py-2 border rounded"
                          >
                            <option value="">Select patrol city</option>
                            {cityOptions.map((city) => (
                              <option key={city} value={city}>{city}</option>
                            ))}
                          </select>

                          <div className="flex gap-2">
                            <ActionButton
                              color="green"
                              label={busyId === user.id ? "Saving..." : "Save Area"}
                              disabled={busyId === user.id}
                              onClick={() => savePatrolArea(user)}
                            />
                            <ActionButton
                              color="slate"
                              label="Cancel"
                              disabled={busyId === user.id}
                              onClick={cancelPatrolEdit}
                            />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p>{user.patrol_city || "-"}</p>
                          <p>{user.patrol_district || "-"}</p>
                          <p className="text-xs text-gray-400">{user.patrol_state || "-"}</p>
                        </div>
                      )}
                    </td>
                    <td className="p-4 flex flex-wrap gap-2">
                      {user.status === "pending" && (
                        <ActionButton
                          color="green"
                          label={busyId === user.id ? "Working..." : "Approve"}
                          disabled={busyId === user.id}
                          onClick={() =>
                            runAction(
                              user.id,
                              () => api.patch(`/admin/approve/${user.id}`),
                              (prev) => prev.map((item) => item.id === user.id ? { ...item, status: "approved" } : item)
                            )
                          }
                        />
                      )}
                      {user.role === "police" && editingOfficerId !== user.id && (
                        <ActionButton
                          color="blue"
                          label="Assign Area"
                          disabled={busyId === user.id}
                          onClick={() => startEditPatrolArea(user)}
                        />
                      )}
                      <ActionButton
                        color="yellow"
                        label={busyId === user.id ? "Working..." : "Suspend"}
                        disabled={busyId === user.id}
                        onClick={() =>
                          runAction(
                            user.id,
                            () => api.patch(`/admin/suspend/${user.id}`),
                            (prev) => prev.map((item) => item.id === user.id ? { ...item, status: "suspended" } : item)
                          )
                        }
                      />
                      {user.role !== "admin" && (
                        <ActionButton
                          color="red"
                          label={busyId === user.id ? "Working..." : "Delete"}
                          disabled={busyId === user.id}
                          onClick={() =>
                            runAction(
                              user.id,
                              () => api.delete(`/admin/users/${user.id}`),
                              (prev) => prev.filter((item) => item.id !== user.id)
                            )
                          }
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AdminPanel;

const Card = ({ title, value }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value || 0;

    const timer = setInterval(() => {
      start += Math.ceil(end / 20 || 1);

      if (start >= end) {
        start = end;
        clearInterval(timer);
      }

      setCount(start);
    }, 35);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      className="relative overflow-hidden bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 blur-xl"></div>
      <p className="text-gray-500 text-sm">{title}</p>
      <p className="text-3xl font-bold text-blue-600 mt-2">{count}</p>
    </motion.div>
  );
};

const StatusBadge = ({ status }) => {
  const color = {
    approved: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700 animate-pulse",
    suspended: "bg-red-100 text-red-700",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${color[status] || "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
};

const ActionButton = ({ label, color, onClick, disabled }) => {
  const styles = {
    green: "text-green-600 hover:bg-green-50",
    yellow: "text-yellow-600 hover:bg-yellow-50",
    red: "text-red-600 hover:bg-red-50",
    blue: "text-blue-600 hover:bg-blue-50",
    slate: "text-slate-600 hover:bg-slate-50",
  };

  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1 rounded transition disabled:opacity-50 ${styles[color]}`}
    >
      {label}
    </motion.button>
  );
};
