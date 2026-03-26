import { useEffect, useState } from "react";
import api from "../services/api";
import { motion } from "framer-motion";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";

const ForecastSection = ({ filters = {} }) => {

  const [data,setData] = useState([]);
  const [growth,setGrowth] = useState(0);
  const [risk,setRisk] = useState("Low");
  const [displayGrowth,setDisplayGrowth] = useState(0);

  const state = filters.state ?? "All";
  const city = filters.city ?? "All";
  const crimeType = filters.crimeType ?? "All";
  const dataset = filters.dataset ?? "Historical";

  useEffect(()=>{

    const fetchForecast = async()=>{

      try{
        if (dataset === "Historical") {
          setData([]);
          setGrowth(0);
          setRisk("Low");
          return;
        }

        const res = await api.get("/crimes/yearly",{
          params:{
            state,
            city,
            crime_type:crimeType,
            record_type:"predicted"
          }
        });

        const predictions = res.data
          .filter(d => d.year >= 2026 && d.year <= 2030)
          .map(d => ({
            year: d.year,
            predicted: d.total
          }));

        if(predictions.length === 0){
          setData([]);
          setGrowth(0);
          setRisk("Low");
          return;
        }

        setData(predictions);

        const first = predictions[0].predicted;
        const last = predictions[predictions.length-1].predicted;
        const growthPercent = first === 0 ? 0 : ((last - first)/first)*100;

        setGrowth(growthPercent);

        if(growthPercent > 20) setRisk("High");
        else if(growthPercent > 5) setRisk("Medium");
        else setRisk("Low");

      }catch(err){

        console.error("Forecast error",err);
        setData([]);
        setGrowth(0);
        setRisk("Low");

      }

    };

    fetchForecast();

  },[state,city,crimeType,dataset]);



  /* ---------- Animated Counter ---------- */

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


  return(

    <motion.div
      initial={{opacity:0,y:40}}
      animate={{opacity:1,y:0}}
      transition={{duration:0.6}}
      className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow mt-6"
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
            AI Crime Forecast
          </motion.h3>

          <p className="text-sm text-gray-500">
            Predicted crime growth (2026–2030)
          </p>

        </div>

        {/* Animated Stats */}

        <motion.div
          initial={{scale:0.8,opacity:0}}
          animate={{scale:1,opacity:1}}
          transition={{delay:0.3}}
          className="text-right"
        >

          <p className="text-sm text-gray-500">Growth</p>

          <p className="text-2xl font-bold text-red-500">
            {displayGrowth}%
          </p>

          <p className="text-sm mt-1">
            Risk Level:
            <span
              className={`ml-2 font-semibold ${
                risk==="High"
                  ? "text-red-500"
                  : risk==="Medium"
                  ? "text-orange-400"
                  : "text-green-500"
              }`}
            >
              {risk}
            </span>
          </p>

        </motion.div>

      </div>

      {dataset === "Historical" && (
        <div className="flex items-center justify-center h-[260px] text-sm text-gray-500 dark:text-gray-300">
          Forecast is shown for predicted or combined datasets.
        </div>
      )}

      {dataset !== "Historical" && data.length === 0 && (
        <div className="flex items-center justify-center h-[260px] text-sm text-gray-500 dark:text-gray-300">
          No forecast data available for the selected filters.
        </div>
      )}

      {/* Animated Chart */}

      {dataset !== "Historical" && data.length > 0 && (
      <ResponsiveContainer width="100%" height={260}>

        <BarChart data={data}>

          <CartesianGrid strokeDasharray="3 3"/>

          <XAxis dataKey="year"/>

          <YAxis/>

          <Tooltip/>

          <Bar
            dataKey="predicted"
            fill="#ef4444"
            radius={[6,6,0,0]}
            animationDuration={1200}
          />

        </BarChart>

      </ResponsiveContainer>
      )}

    </motion.div>

  );

};

export default ForecastSection;
