import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (!user || user.role !== "police" || !user.gps_consent || !navigator.geolocation) {
      return undefined;
    }

    let cancelled = false;

    const pushLocation = () => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          if (cancelled) {
            return;
          }

          try {
            await api.post("/auth/location", {
              latitude: Number(position.coords.latitude.toFixed(6)),
              longitude: Number(position.coords.longitude.toFixed(6)),
            });
          } catch (err) {
            console.error("Failed to sync police live location", err);
          }
        },
        () => {},
        {
          enableHighAccuracy: true,
          maximumAge: 60 * 1000,
          timeout: 10 * 1000,
        }
      );
    };

    pushLocation();
    const intervalId = window.setInterval(pushLocation, 2 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [user]);

  const login = useCallback(async (credentials) => {
    const res = await api.post("/auth/login", credentials);
    if (res.data?.user) {
      setUser(res.data.user);
      setLoading(false);
      return res.data.user;
    }
    return refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
    }
  }, []);

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

