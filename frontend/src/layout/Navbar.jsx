import { Menu, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = ({ toggleSidebar, darkMode, setDarkMode }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (

    <div className="flex justify-between items-center px-4 sm:px-6 py-4 bg-white dark:bg-gray-800 dark:text-white shadow">

      {/* Left Section */}

      <div className="flex items-center gap-4">

        <button
          onClick={toggleSidebar}
          className="lg:hidden"
        >
          <Menu size={24} />
        </button>

        <h1 className="text-lg sm:text-xl font-semibold">
          AI Predictive Policing Dashboard
        </h1>

      </div>


      {/* Right Section */}

      <div className="flex items-center gap-4">

        {/* Dark Mode Toggle */}

        <button
          onClick={() => setDarkMode(!darkMode)}
          className="px-3 py-1 bg-gray-200 dark:bg-gray-700 dark:text-white rounded transition hover:scale-105"
        >
          {darkMode ? "Light Mode" : "Dark Mode"}
        </button>


        {/* Officer Name */}

        <span className="hidden sm:block font-medium">
          {user?.username}
        </span>


        {/* Logout Button */}

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded transition hover:scale-105"
        >

          <LogOut size={18} />

          Logout

        </button>

      </div>

    </div>

  );

};

export default Navbar;
