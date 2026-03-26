import { useEffect, useState } from "react";
import api from "../services/api";

const ProtectedMedia = ({ file, className = "", alt = "evidence" }) => {
  const [objectUrl, setObjectUrl] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let currentUrl = "";

    const loadMedia = async () => {
      try {
        setError(false);
        const res = await api.get(file.access_url, {
          responseType: "blob",
        });
        currentUrl = URL.createObjectURL(res.data);
        setObjectUrl(currentUrl);
      } catch (err) {
        console.error("Failed to load protected media", err);
        setError(true);
      }
    };

    if (file?.access_url) {
      loadMedia();
    }

    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [file]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-sm text-gray-500 ${className}`}>
        Unable to load evidence
      </div>
    );
  }

  if (!objectUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-sm text-gray-500 ${className}`}>
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
