import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import api from "../services/api";

const FilterPanel = ({ filters, setFilters }) => {

  const handleChange = (field,value)=>{
  setFilters(prev => ({
    ...prev,
    [field]: value
  }));
};

const [cities,setCities] = useState([]);

useEffect(()=>{

const fetchCities = async()=>{

try{

const res = await api.get("/crimes/cities",{
params:{ state: filters.state }
});

setCities(res.data);

}catch(err){

console.error("City fetch error",err);

}

};

fetchCities();

},[filters.state]);


  const resetFilters = ()=>{
    setFilters({
      state:"All",
      city: "All",
      crimeType:"All",
      year:2024,
      dataset:"Historical"
    });
  };

  return (
    <motion.div
      initial={{opacity:0}}
      animate={{opacity:1}}
      transition={{duration:0.3}}
      className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow mb-6"
    >

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">

        <div>
          <label className="text-sm text-gray-500 dark:text-white">State</label>
          <select
            value={filters.state}
            onChange={(e)=>handleChange("state",e.target.value)}
            className="bg-white dark:bg-gray-800 dark:text-white w-full mt-1 p-2 border rounded"
          >
            <option value="All">All</option>
            <option value="Andaman And Nicobar Islands">Andaman And Nicobar Islands</option>
            <option value="Andhra Pradesh">Andhra Pradesh</option>
            <option value="Arunachal Pradesh">Arunachal Pradesh</option>
            <option value="Assam">Assam</option>
            <option value="Bihar">Bihar</option>
            <option value="Chhattisgarh">Chhattisgarh</option>
            <option value="Dadra And Nagar Haveli And Daman And Diu">Dadra And Nagar Haveli And Daman And Diu</option>
            <option value="Delhi">Delhi</option>
            <option value="Goa">Goa</option>
            <option value="Gujarat">Gujarat</option>
            <option value="Haryana">Haryana</option>
            <option value="Himachal Pradesh">Himachal Pradesh</option>
            <option value="Jammu & Kashmir">Jammu & Kashmir</option>
            <option value="Jharkhand">Jharkhand</option>
            <option value="Karnataka">Karnataka</option>
            <option value="Kerala">Kerala</option>
            <option value="Ladakh">Ladakh</option>
            <option value="Lakshadweep">Lakshadweep</option>
            <option value="Madhya Pradesh">Madhya Pradesh</option>
            <option value="Maharashtra">Maharashtra</option>
            <option value="Manipur">Manipur</option>
            <option value="Meghalaya">Meghalaya</option>
            <option value="Mizoram">Mizoram</option>
            <option value="Nagaland">Nagaland</option>
            <option value="Odisha">Odisha</option>
            <option value="Puducherry">Puducherry</option>
            <option value="Punjab">Punjab</option>
            <option value="Rajasthan">Rajasthan</option>
            <option value="Sikkim">Sikkim</option>
            <option value="Tamil Nadu">Tamil Nadu</option>
            <option value="Telangana">Telangana</option>
            <option value="Tripura">Tripura</option>
            <option value="Uttar Pradesh">Uttar Pradesh</option>
            <option value="Uttarakhand">Uttarakhand</option>
            <option value="West Bengal">West Bengal</option>
                      </select>
        </div>
        <div>
        <label className="text-sm text-gray-500 dark:text-white">City</label>

        <select
        value={filters.city}
        onChange={(e)=>handleChange("city",e.target.value)}
        className="bg-white dark:bg-gray-800 dark:text-white w-full mt-1 p-2 border rounded"
        >

        <option value="All">All Cities</option>

        {cities.map((city)=>(
        <option key={city} value={city}>
        {city}
        </option>
        ))}

        </select>
        </div>
        <div>
          <label className="text-sm text-gray-500 dark:text-white">Crime Type</label>
          <select
            value={filters.crimeType}
            onChange={(e)=>handleChange("crimeType",e.target.value)}
            className="bg-white dark:bg-gray-800 dark:text-white w-full mt-1 p-2 border rounded"
          >
            <option value="All">All Crimes</option>
            <option value="Murder">Murder</option>
            <option value="Attempt_to_Murder">Attempt to Murder</option>
            <option value="Kidnapping_Abduction">Kidnapping & Abduction</option>
            <option value="Rape">Rape</option>
            <option value="Assault">Assault</option>
            <option value="Riots">Riots</option>
            <option value="Theft">Theft</option>
            <option value="Burglary">Burglary</option>
            <option value="Robbery">Robbery</option>
            <option value="Dacoity">Dacoity</option>
            <option value="Auto_Theft">Auto Theft</option>
            <option value="Cheating_Fraud">Cheating / Fraud</option>
            <option value="Cyber_Crime">Cyber Crime</option>
            <option value="Dowry_Deaths">Dowry Deaths</option>
            <option value="Domestic_Violence">Domestic Violence</option>
            <option value="Drug_Offences">Drug Offences</option>
            <option value="Arms_Act_Offences">Arms Act Offences</option>
            <option value="Total_Estimated_Crimes">Total Crimes</option>
          </select>
        </div>

        <div>
          <label className="text-sm text-gray-500 dark:text-white">Year</label>

          <input
            type="range"
            min="2020"
            max="2030"
            value={filters.year}
            onChange={(e)=>handleChange("year",Number(e.target.value))}
            className="w-full mt-3"
          />

          <p className="text-xs text-gray-500 dark:text-gray-300">
            {filters.year}
          </p>
        </div>

        <div>
          <label className="text-sm text-gray-500 dark:text-white">Dataset</label>
          <select
            value={filters.dataset}
            onChange={(e)=>handleChange("dataset",e.target.value)}
            className="bg-white dark:bg-gray-800 dark:text-white w-full mt-1 p-2 border rounded"
          >
            <option>Historical</option>
            <option>Predicted</option>
            <option>Combined</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={resetFilters}
            className="w-full bg-gray-200 hover:bg-gray-300 p-2 rounded transition"
          >
            Reset Filters
          </button>
        </div>

      </div>

    </motion.div>
  );
};

export default FilterPanel;