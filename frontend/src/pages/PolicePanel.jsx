import { useState, useEffect } from "react";
import MainLayout from "../layout/MainLayout";
import { motion, AnimatePresence } from "framer-motion";
import DeckGL from "@deck.gl/react";
import { Map } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import api from "../services/api";
import ProtectedMedia from "../components/ProtectedMedia";


const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const row = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

const PolicePanel = () => {

  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {

    const fetchReports = async () => {

      try {

        const res = await api.get("/reports/");
        setReports(res.data);

      } catch (err) {

        console.error("Failed to load reports", err);

      }

    };

    fetchReports();

  }, []);


  const verifyReport = async (id) => {

    try {

      await api.patch(`/reports/${id}/verify`);

      setReports(prev =>
        prev.map(r =>
          r.id === id ? { ...r, status: "Verified" } : r
        )
      );

    } catch (err) {

      console.error(err);

    }

  };


  const rejectReport = async (id) => {

    try {

      await api.patch(`/reports/${id}/reject`);

      setReports(prev =>
        prev.map(r =>
          r.id === id ? { ...r, status: "Rejected" } : r
        )
      );

    } catch (err) {

      console.error(err);

    }

  };


  const getStatusColor = (status) => {

    if (status === "Verified") return "bg-green-100 text-green-700";
    if (status === "Rejected") return "bg-red-100 text-red-700";

    return "bg-yellow-100 text-yellow-700";

  };


  return (

    <MainLayout>

      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-semibold mb-6 text-gray dark:text-white"
      >
        Police Verification Panel
      </motion.h2>


      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden"
      >

        <table className="w-full text-left">

          <thead className="bg-gray-100 dark:bg-gray-700">

            <tr className="text-gray dark:text-white">

              <th className="p-3">Report ID</th>
              <th className="p-3">Crime Type</th>
              <th className="p-3">Severity</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
              <th className="p-3">Action</th>

            </tr>

          </thead>

          <tbody>

            {reports.map((report) => (

              <motion.tr
                variants={row}
                key={report.id}
                whileHover={{ scale: 1.01 }}
                className="border-t hover:bg-gray-50 dark:hover:bg-gray-700 text-gray dark:text-white"
              >

                <td className="p-3">{report.report_id}</td>
                <td className="p-3">{report.crime_type}</td>
                <td className="p-3">{report.severity}</td>

                <td className="p-3">

                  <motion.span
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className={`px-2 py-1 rounded text-sm ${getStatusColor(report.status)}`}
                  >
                    {report.status}
                  </motion.span>

                </td>

                <td className="p-3">
                  {new Date(report.created_at).toLocaleDateString()}
                </td>

                <td className="p-3 flex gap-3">

                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedReport(report)}
                    className="text-blue-600 font-medium"
                  >
                    View
                  </motion.button>

                  {(report.status === "Submitted" || report.status === "Pending") && (

                    <>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => verifyReport(report.id)}
                        className="text-green-600 font-medium"
                      >
                        Verify
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => rejectReport(report.id)}
                        className="text-red-600 font-medium"
                      >
                        Reject
                      </motion.button>
                    </>

                  )}

                </td>

              </motion.tr>

            ))}

          </tbody>

        </table>

      </motion.div>



      {/* DRAWER */}

      <AnimatePresence>

        {selectedReport && (

          <>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setSelectedReport(null)}
            />

            <motion.div
              initial={{ x: 500 }}
              animate={{ x: 0 }}
              exit={{ x: 500 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="fixed right-0 top-0 w-full max-w-md bg-white h-full shadow-xl p-6 overflow-y-auto z-50"
            >

              <h3 className="text-xl font-semibold mb-4">
                Report Details
              </h3>

              <p><strong>ID:</strong> {selectedReport.report_id}</p>
              <p><strong>Crime:</strong> {selectedReport.crime_type}</p>
              <p><strong>Severity:</strong> {selectedReport.severity}</p>

              <p>
                <strong>Date:</strong>{" "}
                {new Date(selectedReport.created_at).toLocaleDateString()}
              </p>


              {/* DESCRIPTION */}

              <div className="mt-4">

                <h4 className="font-semibold">Description</h4>

                <p className="text-sm text-gray-600">
                  {selectedReport.description}
                </p>

              </div>



              {/* EVIDENCE */}

              {selectedReport.evidence?.length > 0 && (

                <div className="mt-6">

                  <h4 className="font-semibold mb-3">Evidence</h4>

                  <div className="grid grid-cols-2 gap-3">

                    {selectedReport.evidence.map((file) => (

                      <motion.div
                        key={file.id}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        whileHover={{ scale: 1.05 }}
                        className="border rounded overflow-hidden"
                      >

                        <ProtectedMedia
                          file={file}
                          className="w-full h-32 object-cover"
                          alt="evidence"
                        />

                      </motion.div>

                    ))}

                  </div>

                </div>

              )}



              {/* MAP */}

              <div className="mt-6">

                <h4 className="font-semibold mb-2">Location</h4>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative h-48 rounded overflow-hidden"
                >

                  <DeckGL
                    initialViewState={{
                      longitude: selectedReport.longitude,
                      latitude: selectedReport.latitude,
                      zoom: 14
                    }}
                    controller={false}
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

                </motion.div>

              </div>

            </motion.div>

          </>

        )}

      </AnimatePresence>

    </MainLayout>

  );

};

export default PolicePanel;
