import { useState, useEffect } from "react";
import MainLayout from "../layout/MainLayout";
import { motion, AnimatePresence } from "framer-motion";
import DeckGL from "@deck.gl/react";
import { Map } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import api from "../services/api";

const containerVariant = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const itemVariant = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0 }
};

const ReportCrime = () => {

  const [form, setForm] = useState({
    crimeType: "",
    description: "",
    severity: "Medium",
  });

  const [files, setFiles] = useState([]);
  const [location, setLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(true);

  useEffect(() => {

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLoadingLocation(false);
      },
      () => {
        console.error("Location access denied");
        setLoadingLocation(false);
      }
    );

  }, []);

  const handleFileAdd = (e) => {

    const selectedFiles = Array.from(e.target.files);

    if (files.length + selectedFiles.length > 10) {
      alert("Maximum 10 files allowed");
      return;
    }

    const newFiles = selectedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setFiles((prev) => [...prev, ...newFiles]);

  };

  const removeFile = (index) => {

    URL.revokeObjectURL(files[index].preview);

    setFiles((prev) => prev.filter((_, i) => i !== index));

  };

  const submitReport = async () => {

    if (!form.crimeType) {
      alert("Please select crime type");
      return;
    }

    if (!form.description) {
      alert("Please enter description");
      return;
    }

    if (!location) {
      alert("Location not detected yet");
      return;
    }

    try {

      const formData = new FormData();

      formData.append("crime_type", form.crimeType);
      formData.append("severity", form.severity);
      formData.append("description", form.description);
      formData.append("latitude", location.latitude);
      formData.append("longitude", location.longitude);

      files.forEach((item) => {
        formData.append("evidence", item.file);
      });

      await api.post("/reports/", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      alert("Crime report submitted successfully");

      setForm({
        crimeType: "",
        description: "",
        severity: "Medium"
      });

      setFiles([]);

    } catch (err) {

      console.error(err);
      alert("Failed to submit report");

    }

  };

  return (

    <MainLayout>

      <motion.div
        variants={containerVariant}
        initial="hidden"
        animate="show"
      >

        <motion.h2
          variants={itemVariant}
          className="text-2xl font-semibold mb-6 text-gray dark:text-white"
        >
          Report a Crime
        </motion.h2>


        {/* FORM + MAP */}

        <motion.div
          variants={containerVariant}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >

          {/* FORM */}

          <motion.div
            variants={itemVariant}
            whileHover={{ scale: 1.01 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow"
          >

            <div className="mb-4">

              <label className="text-sm text-gray-500 dark:text-white">
                Crime Type
              </label>

              <select
                value={form.crimeType}
                className="bg-white dark:bg-gray-800 dark:text-white w-full mt-1 p-2 border rounded"
                onChange={(e) =>
                  setForm({ ...form, crimeType: e.target.value })
                }
              >
                <option value="">Select</option>
                <option value="Murder">Murder</option>
                <option value="Attempt_to_Murder">Attempt to Murder</option>
                <option value="Kidnapping_Abduction">Kidnapping & Abduction</option>
                <option value="Rape">Rape</option>
                <option value="Assault">Assault</option>
                <option value="Riots">Riots</option>
                <option value="Theft">Theft</option>
              </select>

            </div>


            <div className="mb-4">

              <label className="text-sm text-gray-500 dark:text-white">
                Severity
              </label>

              <select
                value={form.severity}
                className="bg-white dark:bg-gray-800 dark:text-white w-full mt-1 p-2 border rounded"
                onChange={(e) =>
                  setForm({ ...form, severity: e.target.value })
                }
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>

            </div>


            <div className="mb-4">

              <label className="text-sm text-gray-500 dark:text-white">
                Description
              </label>

              <textarea
                value={form.description}
                className="bg-white dark:bg-gray-800 text-black dark:text-white w-full mt-1 p-2 border rounded"
                rows="4"
                placeholder="Describe what happened..."
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />

            </div>

          </motion.div>



          {/* MAP */}

          <motion.div
            variants={itemVariant}
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow"
          >

            <h3 className="font-semibold mb-4 text-gray dark:text-white">
              Location Preview
            </h3>

            <div className="relative h-[300px] rounded overflow-hidden">

              {loadingLocation && (

                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="flex items-center justify-center h-full bg-gray-200"
                >
                  Detecting Location...
                </motion.div>

              )}

              {location && (

                <DeckGL
                  initialViewState={{
                    longitude: location.longitude,
                    latitude: location.latitude,
                    zoom: 14
                  }}
                  controller
                  layers={[]}
                  style={{ position: "absolute", inset: 0 }}
                >

                  <Map
                    reuseMaps
                    mapLib={maplibregl}
                    mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
                    style={{ width: "100%", height: "100%" }}
                  />

                </DeckGL>

              )}

            </div>

          </motion.div>

        </motion.div>



        {/* EVIDENCE */}

        <motion.div
          variants={itemVariant}
          className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow mt-6"
        >

          <h3 className="font-semibold mb-4 text-gray dark:text-white">
            Upload Evidence (Max 10 Files)
          </h3>

          <input
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleFileAdd}
            className="mb-4"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">

            <AnimatePresence>

              {files.map((item, index) => (

                <motion.div
                  key={index}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  whileHover={{ scale: 1.05 }}
                  className="relative"
                >

                  <button
                    onClick={() => removeFile(index)}
                    className="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded-full text-xs"
                  >
                    ✕
                  </button>

                  {item.file.type.startsWith("image") ? (

                    <img
                      src={item.preview}
                      alt="preview"
                      className="h-24 w-full object-cover rounded"
                    />

                  ) : (

                    <video
                      src={item.preview}
                      className="h-24 w-full object-cover rounded"
                    />

                  )}

                </motion.div>

              ))}

            </AnimatePresence>

          </div>

        </motion.div>



        {/* SUBMIT */}

        <motion.div
          variants={itemVariant}
          className="mt-6"
        >

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={{ boxShadow: ["0px 0px 0px", "0px 0px 10px #3b82f6"] }}
            transition={{ repeat: Infinity, duration: 2 }}
            onClick={submitReport}
            disabled={!location}
            className="bg-blue-600 text-white px-6 py-3 rounded shadow hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            Submit Report
          </motion.button>

        </motion.div>

      </motion.div>

    </MainLayout>

  );

};

export default ReportCrime;