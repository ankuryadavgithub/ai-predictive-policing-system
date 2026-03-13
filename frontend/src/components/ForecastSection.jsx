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

  useEffect(()=>{

    const fetchForecast = async()=>{

      try{

        const res = await api.get("/crimes/yearly",{
          params:{
            state,
            city,
            crime_type:crimeType
          }
        });

        const historical = res.data.filter(d=>d.year<=2025);

        if(historical.length < 2) return;

        const first = historical[0].total;
        const last = historical[historical.length-1].total;

        const rate = (last-first)/historical.length;

        const predictions=[];

        let prev = last;

        for(let year=2026;year<=2030;year++){

          const predicted = Math.round(prev + rate);

          predictions.push({
            year,
            predicted
          });

          prev = predicted;

        }

        setData(predictions);

        const growthPercent =
          ((predictions[predictions.length-1].predicted - last)/last)*100;

        setGrowth(growthPercent);

        if(growthPercent > 20) setRisk("High");
        else if(growthPercent > 5) setRisk("Medium");
        else setRisk("Low");

      }catch(err){

        console.error("Forecast error",err);

      }

    };

    fetchForecast();

  },[state,city,crimeType]);



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


      {/* Animated Chart */}

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

    </motion.div>

  );

};

export default ForecastSection;