import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Sidebar = () => {
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
    <div className="w-64 h-full border-r border-slate-200 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-white shadow-xl dark:border-slate-800">
      <div className="p-6 text-xl font-bold border-b border-slate-800">
        Crime AI System
      </div>

      <nav className="p-4 space-y-2">
        {menu
          .filter((item) => item.roles.includes(role))
          .map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `relative block rounded-xl px-4 py-3 transition-all duration-200 ${
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
