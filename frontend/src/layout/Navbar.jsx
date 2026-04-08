import { Menu, LogOut, Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const Navbar = ({ toggleSidebar }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { darkMode, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="sticky top-0 z-10 flex flex-wrap justify-between items-center gap-3 px-3 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-white/90 text-slate-900 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:text-white">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {toggleSidebar && (
          <button onClick={toggleSidebar} className="lg:hidden text-slate-700 dark:text-slate-200" aria-label="Open sidebar">
            <Menu size={24} />
          </button>
        )}

        <h1 className="truncate text-lg sm:text-xl font-semibold">
          AI Predictive Policing Dashboard
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
        <button
          onClick={toggleTheme}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-2.5 sm:px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          <span className="hidden sm:inline">{darkMode ? "Light" : "Dark"}</span>
        </button>

        {user?.username && (
          <span className="hidden sm:block font-medium text-slate-700 dark:text-slate-200">
            {user.username}
          </span>
        )}

        {user && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg bg-red-500 px-2.5 sm:px-3 py-2 text-white transition hover:bg-red-600"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default Navbar;
