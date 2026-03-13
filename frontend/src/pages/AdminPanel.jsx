import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import MainLayout from "../layout/MainLayout"
import api from "../services/api"

const container = {
  hidden:{opacity:0},
  show:{
    opacity:1,
    transition:{staggerChildren:0.12}
  }
}

const rowAnim={
  hidden:{opacity:0,y:20},
  show:{opacity:1,y:0}
}

const AdminPanel = () => {

const [users,setUsers] = useState([])
const [stats,setStats] = useState({})

useEffect(()=>{
fetchUsers()
fetchAnalytics()
},[])

const fetchUsers = async()=>{
const res = await api.get("/admin/users")
setUsers(res.data)
}

const fetchAnalytics = async()=>{
const res = await api.get("/admin/analytics")
setStats(res.data)
}

const approveUser = async(id)=>{
await api.patch(`/admin/approve/${id}`)
setUsers(prev =>
prev.map(u =>
u.id===id ? {...u,status:"approved"} : u
))
}

const suspendUser = async(id)=>{
await api.patch(`/admin/suspend/${id}`)
setUsers(prev =>
prev.map(u =>
u.id===id ? {...u,status:"suspended"} : u
))
}

const deleteUser = async(id)=>{
await api.delete(`/admin/users/${id}`)
setUsers(prev => prev.filter(u=>u.id!==id))
}

return(

<MainLayout>

{/* COMMAND HEADER */}

<motion.div
initial={{opacity:0,y:-40}}
animate={{opacity:1,y:0}}
transition={{duration:.6}}
className="mb-10"
>

<h1 className="text-3xl font-bold text-gray-800 dark:text-white">

Administrator Command Center

</h1>

<p className="text-gray-500 dark:text-gray-400 mt-2">
Manage officers, monitor reports and control the policing network
</p>

</motion.div>


{/* KPI DASHBOARD */}

<motion.div
variants={container}
initial="hidden"
animate="show"
className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10"
>

<Card title="Total Users" value={stats.total_users}/>
<Card title="Pending Police" value={stats.pending_police}/>
<Card title="Total Reports" value={stats.total_reports}/>
<Card title="Verified Reports" value={stats.verified_reports}/>

</motion.div>


{/* USER MANAGEMENT TABLE */}

<motion.div
initial={{opacity:0,y:20}}
animate={{opacity:1,y:0}}
transition={{duration:.6}}
className="backdrop-blur-xl bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden"
>

<div className="p-5 border-b border-gray-200 dark:border-gray-700">

<h2 className="text-lg font-semibold text-gray-700 dark:text-white">

User Management

</h2>

</div>

<table className="w-full text-left">

<thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">

<tr>

<th className="p-4">Username</th>
<th className="p-4">Role</th>
<th className="p-4">Status</th>
<th className="p-4">Actions</th>

</tr>

</thead>

<motion.tbody
variants={container}
initial="hidden"
animate="show"
>

<AnimatePresence>

{users.map(user=>(

<motion.tr
key={user.id}
variants={rowAnim}
whileHover={{scale:1.02}}
className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
>

<td className="p-4 font-medium text-gray-700 dark:text-white">

{user.username}

</td>

<td className="p-4 capitalize text-gray-500 dark:text-gray-300">

{user.role}

</td>

<td className="p-4">

<StatusBadge status={user.status}/>

</td>

<td className="p-4 flex gap-3">

{user.status==="pending" && (

<ActionButton
color="green"
label="Approve"
onClick={()=>approveUser(user.id)}
/>

)}

<ActionButton
color="yellow"
label="Suspend"
onClick={()=>suspendUser(user.id)}
/>

<ActionButton
color="red"
label="Delete"
onClick={()=>deleteUser(user.id)}
/>

</td>

</motion.tr>

))}

</AnimatePresence>

</motion.tbody>

</table>

</motion.div>

</MainLayout>

)

}

export default AdminPanel



/* KPI CARD */

const Card = ({title,value}) => {

const [count,setCount] = useState(0)

useEffect(()=>{

let start=0
const end=value || 0

const timer=setInterval(()=>{

start+=Math.ceil(end/20)

if(start>=end){
start=end
clearInterval(timer)
}

setCount(start)

},40)

return ()=>clearInterval(timer)

},[value])

return(

<motion.div
whileHover={{scale:1.05}}
className="relative overflow-hidden bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
>

<div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 blur-xl"></div>

<p className="text-gray-500 text-sm">

{title}

</p>

<p className="text-3xl font-bold text-blue-600 mt-2">

{count}

</p>

</motion.div>

)

}


/* STATUS BADGE */

const StatusBadge = ({status}) => {

const color={
approved:"bg-green-100 text-green-700",
pending:"bg-yellow-100 text-yellow-700 animate-pulse",
suspended:"bg-red-100 text-red-700"
}

return(

<span className={`px-3 py-1 rounded-full text-xs font-semibold ${color[status]}`}>

{status}

</span>

)

}


/* ACTION BUTTON */

const ActionButton = ({label,color,onClick}) => {

const styles={
green:"text-green-600 hover:bg-green-50",
yellow:"text-yellow-600 hover:bg-yellow-50",
red:"text-red-600 hover:bg-red-50"
}

return(

<motion.button
whileHover={{scale:1.1}}
whileTap={{scale:.9}}
onClick={onClick}
className={`px-3 py-1 rounded transition ${styles[color]}`}
>

{label}

</motion.button>

)

}