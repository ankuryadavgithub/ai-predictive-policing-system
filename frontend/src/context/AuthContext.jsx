import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
      return res.data;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (credentials) => {
    const res = await api.post("/auth/login", credentials);
    if (res.data?.access_token) {
      sessionStorage.setItem("pps_access_token", res.data.access_token);
    }
    return refreshUser();
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      sessionStorage.removeItem("pps_access_token");
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        refreshUser,
        login,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
