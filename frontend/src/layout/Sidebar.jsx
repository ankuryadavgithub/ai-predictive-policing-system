import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Sidebar = ({ onNavigate }) => {
  const { user } = useAuth();
  const role = user?.role;

  const menu = [
    {
      name: "Dashboard",
      path: "/dashboard",
      roles: ["citizen", "police", "admin"]
    },
    {
      name: "Heatmap",
      path: "/heatmap",
      roles: ["citizen", "police", "admin"]
    },
    {
      name: "Report Crime",
      path: "/report",
      roles: ["citizen", "police", "admin"]
    },
    {
      name: "Police Panel",
      path: "/police",
      roles: ["police", "admin"]
    },
    {
      name: "Patrol Recommendation",
      path: "/patrol-recommendation",
      roles: ["police", "admin"]
    },
    {
      name: "Mission Control",
      path: "/mission-control",
      roles: ["police", "admin"]
    },
    {
      name: "Admin Panel",
      path: "/admin",
      roles: ["admin"]
    },
    {
      name: "Reports Moderation",
      path: "/admin-reports",
      roles: ["admin"]
    },
    {
      name: "Crime Analytics",
      path: "/admin-analytics",
      roles: ["admin"]
    },
    {
      name: "Evidence Monitor",
      path: "/admin-evidence",
      roles: ["admin"]
    }
  ];

  return (
    <div className="flex h-full w-72 max-w-[86vw] flex-col border-r border-slate-200 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-white shadow-xl dark:border-slate-800 lg:w-64">
      <div className="shrink-0 border-b border-slate-800 p-5 text-xl font-bold">
        Crime AI System
      </div>

      <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {menu
          .filter((item) => item.roles.includes(role))
          .map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                `relative block rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-2 h-[calc(100%-1rem)] w-1 rounded-r bg-cyan-300"></span>
                  )}
                  <span className="ml-2">{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
      </nav>
    </div>
  );
};

export default Sidebar;
