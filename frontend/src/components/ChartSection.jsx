import { useEffect, useState } from "react";
import api from "../services/api";
import { motion } from "framer-motion";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend
} from "recharts";

const ChartSection = ({ filters = {} }) => {

  const [data, setData] = useState([]);
  const [growth,setGrowth] = useState(0);
  const [displayGrowth,setDisplayGrowth] = useState(0);

  const state = filters.state ?? "All";
  const city = filters.city ?? "All";
  const crimeType = filters.crimeType ?? "All";
  const year = filters.year ?? 2030;
  const recordType =
    filters.dataset === "Historical"
      ? "historical"
      : filters.dataset === "Predicted"
      ? "predicted"
      : "all";

  useEffect(() => {

    const fetchData = async () => {

      try {

        const res = await api.get("/crimes/yearly", {
          params: {
            state,
            city,
            crime_type: crimeType,
            record_type: recordType,
          }
        });

        const filtered = res.data.filter(d => d.year <= year);

        const chartData = filtered.map(d => {

          if (d.year <= 2025) {
            return { year: d.year, historical: d.total };
          }

          return { year: d.year, predicted: d.total };

        });

        setData(chartData);

        if (filtered.length < 2) {
          setGrowth(0);
          return;
        }

        const first = filtered[0].total;
        const last = filtered[filtered.length-1].total;
        const g = first === 0 ? 0 : ((last-first)/first)*100;

        setGrowth(g);

      } catch (err) {

        console.error("Chart data fetch error:", err);
        setData([]);
        setGrowth(0);

      }

    };

    fetchData();

  }, [state, city, crimeType, year, recordType]);


  /* Animated Growth Counter */

  useEffect(()=>{

    let start = 0;

    const interval = setInterval(()=>{

      start += growth/40;

      if(start >= growth){

        start = growth;
        clearInterval(interval);

      }

      setDisplayGrowth(start.toFixed(1));

    },20);

    return ()=>clearInterval(interval);

  },[growth]);


  return (

    <motion.div
      initial={{opacity:0,y:40}}
      animate={{opacity:1,y:0}}
      transition={{duration:0.6}}
      className="w-full h-[420px]"
    >

      {/* Header */}

      <div className="flex justify-between mb-4">

        <div>

          <motion.h3
            initial={{x:-30,opacity:0}}
            animate={{x:0,opacity:1}}
            transition={{delay:0.2}}
            className="text-lg font-semibold text-gray-800 dark:text-white"
          >
            Crime Trend (Historical vs Predicted)
          </motion.h3>

          <p className="text-sm text-gray-500">
            Crime trend analysis
          </p>

        </div>

        {/* Growth Indicator */}

        <motion.div
          initial={{scale:0.8,opacity:0}}
          animate={{scale:1,opacity:1}}
          transition={{delay:0.3}}
          className="text-right"
        >

          <p className="text-sm text-gray-500">
            Growth
          </p>

          <p className="text-xl font-bold text-blue-600">
            {displayGrowth}%
          </p>

        </motion.div>

      </div>

      {data.length === 0 && (
        <div className="flex items-center justify-center h-[280px] text-sm text-gray-500 dark:text-gray-300">
          No chart data available for the selected filters.
        </div>
      )}

      {/* Animated Chart */}

      {data.length > 0 && (
      <ResponsiveContainer width="100%" height="100%">

        <LineChart data={data}>

          <CartesianGrid strokeDasharray="3 3" />

          <XAxis dataKey="year" />

          <YAxis />

          <Tooltip />

          <Legend />

          <Line
            type="monotone"
            dataKey="historical"
            stroke="#2563eb"
            strokeWidth={3}
            dot={{ r:4 }}
            activeDot={{ r:7 }}
            animationDuration={1200}
            name="Historical Crimes"
          />

          <Line
            type="monotone"
            dataKey="predicted"
            stroke="#ef4444"
            strokeWidth={3}
            strokeDasharray="5 5"
            dot={{ r:4 }}
            activeDot={{ r:7 }}
            animationDuration={1400}
            name="Predicted Crimes"
          />

        </LineChart>

      </ResponsiveContainer>
      )}

    </motion.div>

  );

};

export default ChartSection;
