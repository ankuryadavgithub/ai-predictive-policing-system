import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

const MainLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-cyan-600 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to main content
      </a>
      <div
        className={`fixed z-30 inset-y-0 left-0 transform gpu-smooth
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} 
        transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] 
        lg:relative lg:translate-x-0`}
      >
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-950/40 backdrop-blur-[1px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="Close sidebar"
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Escape") {
              setSidebarOpen(false);
            }
          }}
        />
      )}

      <div className="flex flex-col flex-1 w-full min-w-0">
        <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <main id="main-content" className="flex-1 overflow-x-hidden p-3 sm:p-5 lg:p-6" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
