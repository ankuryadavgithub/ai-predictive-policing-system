import { useEffect, useState } from "react";
import api from "../services/api";

const ProtectedMedia = ({ file, className = "", alt = "evidence" }) => {
  const [objectUrl, setObjectUrl] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let currentUrl = "";
    let isActive = true;
    const controller = new AbortController();

    const loadMedia = async () => {
      try {
        setObjectUrl("");
        setError(false);
        const cacheKey = encodeURIComponent(
          `${file.id ?? "unknown"}-${file.access_count ?? 0}-${file.uploaded_at ?? "na"}`
        );
        const separator = file.access_url.includes("?") ? "&" : "?";
        const res = await api.get(`${file.access_url}${separator}v=${cacheKey}`, {
          responseType: "blob",
          signal: controller.signal,
        });
        if (!isActive) {
          return;
        }
        currentUrl = URL.createObjectURL(res.data);
        setObjectUrl(currentUrl);
      } catch (err) {
        if (controller.signal.aborted || !isActive) {
          return;
        }
        console.error("Failed to load protected media", err);
        setError(true);
      }
    };

    if (file?.access_url) {
      loadMedia();
    }

    return () => {
      isActive = false;
      controller.abort();
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [file?.id, file?.access_url, file?.access_count, file?.uploaded_at]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-sm text-gray-500 dark:bg-slate-800 dark:text-gray-300 ${className}`}>
        Unable to load evidence
      </div>
    );
  }

  if (!objectUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-sm text-gray-500 dark:bg-slate-800 dark:text-gray-300 ${className}`}>
        Loading...
      </div>
    );
  }

  if (file.file_type === "video") {
    return (
      <video
        src={objectUrl}
        controls
        className={className}
      />
    );
  }

  return (
    <img
      src={objectUrl}
      alt={alt}
      className={className}
    />
  );
};

export default ProtectedMedia;
