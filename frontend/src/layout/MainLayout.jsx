import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

const MainLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

const [darkMode, setDarkMode] = useState(
  localStorage.getItem("theme") === "dark"
);

useEffect(() => {
  if (darkMode) {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
  } else {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }
}, [darkMode]);


  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">

      {/* Sidebar */}
      <div
        className={`fixed z-30 inset-y-0 left-0 transform 
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} 
        transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] 
        lg:relative lg:translate-x-0`}
      >
        <Sidebar />
      </div>

      {/* Overlay (Mobile Only) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black opacity-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Right Side */}
      <div className="flex flex-col flex-1 w-full">

        <Navbar
        toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        />

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden">
          {children}
        </main>

      </div>
    </div>
  );
};

export default MainLayout;
