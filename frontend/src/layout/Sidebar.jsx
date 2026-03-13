import { NavLink } from "react-router-dom";

const Sidebar = () => {

  const role = localStorage.getItem("role");

  const menu = [
    {
      name: "Dashboard",
      path: "/dashboard",
      roles: ["citizen","police","admin"]
    },
    {
      name: "Heatmap",
      path: "/heatmap",
      roles: ["citizen","police","admin"]
    },
    {
      name: "Report Crime",
      path: "/report",
      roles: ["citizen","police","admin"]
    },
    {
      name: "Police Panel",
      path: "/police",
      roles: ["police","admin"]
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
    <div className="w-64 h-full bg-gradient-to-b from-gray-900 to-gray-800 text-white shadow-lg">

      <div className="p-6 text-xl font-bold border-b border-gray-700">
        Crime AI System
      </div>

      <nav className="p-4 space-y-2">

        {menu
          .filter(item => item.roles.includes(role))
          .map((item) => (

            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `relative block p-3 rounded transition-all duration-200 ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`
              }
            >

              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-0 h-full w-1 bg-white dark:bg-gray-800 rounded-r"></span>
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