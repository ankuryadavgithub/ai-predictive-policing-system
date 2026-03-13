import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import MainLayout from "../layout/MainLayout"
import api from "../services/api"

const AdminReports = () => {

const [reports,setReports] = useState([])

useEffect(()=>{
fetchReports()
},[])

const fetchReports = async()=>{

const res = await api.get("/admin/reports")
setReports(res.data)

}

const resolveReport = async(id)=>{

await api.patch(`/admin/reports/${id}/resolve`)

setReports(prev =>
prev.map(r =>
r.id===id ? {...r,status:"Resolved"} : r
))

}

const markFake = async(id)=>{

await api.patch(`/admin/reports/${id}/fake`)

setReports(prev =>
prev.map(r =>
r.id===id ? {...r,status:"Fake"} : r
))

}

const deleteReport = async(id)=>{

await api.delete(`/admin/reports/${id}`)

setReports(prev => prev.filter(r=>r.id!==id))

}

return(

<MainLayout>

<motion.h1
initial={{opacity:0,y:-20}}
animate={{opacity:1,y:0}}
className="text-2xl font-semibold mb-6 text-gray-800 dark:text-white"
>

Crime Report Moderation

</motion.h1>

<div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">

<table className="w-full text-left">

<thead className="bg-gray-100 dark:bg-gray-700">

<tr>

<th className="p-4">Report ID</th>
<th className="p-4">Crime Type</th>
<th className="p-4">Status</th>
<th className="p-4">Actions</th>

</tr>

</thead>

<tbody>

{reports.map(report=>(

<motion.tr
key={report.id}
whileHover={{scale:1.01}}
className="border-t hover:bg-gray-50 dark:hover:bg-gray-700"
>

<td className="p-4">{report.report_id}</td>
<td className="p-4">{report.crime_type}</td>
<td className="p-4">{report.status}</td>

<td className="p-4 flex gap-3">

<button
onClick={()=>resolveReport(report.id)}
className="text-green-600"
>
Resolve
</button>

<button
onClick={()=>markFake(report.id)}
className="text-yellow-600"
>
Fake
</button>

<button
onClick={()=>deleteReport(report.id)}
className="text-red-600"
>
Delete
</button>

</td>

</motion.tr>

))}

</tbody>

</table>

</div>

</MainLayout>

)

}

export default AdminReports