import { useEffect, useState } from "react";
import api from "../services/api";
import { motion } from "framer-motion";

const KPISection = ({ filters = {} }) => {

  const [cards, setCards] = useState([]);
  const [displayValues, setDisplayValues] = useState({});

  useEffect(() => {
    const recordType =
      filters.dataset === "Historical"
        ? "historical"
        : filters.dataset === "Predicted"
        ? "predicted"
        : "all";

    const fetchData = async () => {

      try {

        const res = await api.get("/forecast/kpis", {
          params: {
            state: filters.state,
            city: filters.city,
            crime_type: filters.crimeType,
            year: filters.year,
            record_type: recordType,
          }
        });

        const data = res.data;

        const newCards = [
          {
            title: "Total Crimes",
            value: data.total_crimes,
            color: "text-blue-600"
          },
          {
            title: "Crime Risk Index",
            value: Number(data.risk_index.toFixed(2)),
            color: "text-red-500"
          },
          {
            title: "High Risk Area",
            value: data.high_risk_city,
            color: "text-orange-500",
            isText: true
          },
          {
            title: "Crime Types",
            value: data.crime_types,
            color: "text-green-600"
          }
        ];

        setCards(newCards);

      } catch (err) {

        console.error("KPI fetch error:", err);

      }

    };

    fetchData();

  }, [filters]);


  /* -------- Animated Counter Effect -------- */

  useEffect(() => {

    const counters = {};

    cards.forEach(card => {

      if (card.isText) {
        counters[card.title] = card.value;
        return;
      }

      let start = 0;
      const end = card.value;

      const interval = setInterval(() => {

        start += end / 40;

        if (start >= end) {
          start = end;
          clearInterval(interval);
        }

        counters[card.title] = Math.round(start);

        setDisplayValues(prev => ({
          ...prev,
          [card.title]: counters[card.title]
        }));

      }, 20);

    });

  }, [cards]);



  return (

    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
    >

      {cards.map((card, index) => (

        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.15 }}
          whileHover={{
            scale: 1.05,
            boxShadow: "0px 10px 25px rgba(0,0,0,0.15)"
          }}
          whileTap={{ scale: 0.97 }}
          className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow transition"
        >

          <h3 className="text-gray-500 dark:text-gray-300 text-sm">
            {card.title}
          </h3>

          <p className={`text-2xl sm:text-3xl font-bold mt-2 break-words ${card.color}`}>

            {card.isText
              ? card.value
              : displayValues[card.title] ?? 0}

          </p>

        </motion.div>

      ))}

    </motion.div>

  );

};

export default KPISection;
