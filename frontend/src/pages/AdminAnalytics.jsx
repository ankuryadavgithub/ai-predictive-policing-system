import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import MainLayout from "../layout/MainLayout"
import api from "../services/api"

import {
BarChart,
Bar,
XAxis,
YAxis,
Tooltip,
ResponsiveContainer,
LineChart,
Line
} from "recharts"

const AdminAnalytics = () => {

const [typeData, setTypeData] = useState([])
const [districtData, setDistrictData] = useState([])
const [trendData, setTrendData] = useState([])

useEffect(() => {

loadData()

}, [])

const loadData = async () => {

try {

const type = await api.get("/admin/analytics/top-crime-types")
setTypeData(type.data)

const district = await api.get("/admin/analytics/top-districts")
setDistrictData(district.data)

const trend = await api.get("/admin/analytics/yearly-trend")
setTrendData(trend.data)

} catch (err) {

console.error("Analytics load error:", err)

}

}

return (

<MainLayout>

<motion.h1
initial={{ opacity: 0, y: -20 }}
animate={{ opacity: 1, y: 0 }}
className="text-2xl font-semibold mb-8 text-gray-800 dark:text-white"
>

Crime Intelligence Dashboard

</motion.h1>


{/* TOP SECTION */}

<div className="grid md:grid-cols-2 gap-8">

{/* Top Dangerous Districts */}

<div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow">

<h3 className="mb-4 font-semibold text-gray-700 dark:text-white">
Top Dangerous Districts
</h3>

<ResponsiveContainer width="100%" height={350}>

<BarChart data={districtData}>

<XAxis dataKey="district" />
<YAxis />
<Tooltip />

<Bar
dataKey="total"
fill="#dc2626"
radius={[6,6,0,0]}
/>

</BarChart>

</ResponsiveContainer>

</div>


{/* Top Crime Types */}

<div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow">

<h3 className="mb-4 font-semibold text-gray-700 dark:text-white">
Top Crime Types
</h3>

<ResponsiveContainer width="100%" height={350}>

<BarChart data={typeData}>

<XAxis dataKey="type" />
<YAxis />
<Tooltip />

<Bar
dataKey="total"
fill="#2563eb"
radius={[6,6,0,0]}
/>

</BarChart>

</ResponsiveContainer>

</div>

</div>


{/* YEARLY TREND */}

<div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow mt-8">

<h3 className="mb-4 font-semibold text-gray-700 dark:text-white">
Yearly Crime Trend
</h3>

<ResponsiveContainer width="100%" height={400}>

<LineChart data={trendData}>

<XAxis dataKey="year" />
<YAxis />
<Tooltip />

<Line
type="monotone"
dataKey="total"
stroke="#2563eb"
strokeWidth={3}
dot={{ r: 5 }}
activeDot={{ r: 8 }}
/>

</LineChart>

</ResponsiveContainer>

</div>

</MainLayout>

)

}

export default AdminAnalytics