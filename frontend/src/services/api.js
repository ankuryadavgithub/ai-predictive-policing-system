import axios from "axios";

function resolveApiBaseUrl() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol || "http:";
    const hostname = window.location.hostname || "127.0.0.1";
    return `${protocol}//${hostname}:8000`;
  }

  return "http://127.0.0.1:8000";
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

export default api;
