import { useEffect,useState } from "react"
import { motion } from "framer-motion"
import MainLayout from "../layout/MainLayout"
import api from "../services/api"
import ProtectedMedia from "../components/ProtectedMedia"

const EvidenceMonitor = ()=>{
const [files,setFiles] = useState([])

useEffect(()=>{

loadEvidence()

},[])

const loadEvidence = async()=>{

const res = await api.get("/admin/evidence")
setFiles(res.data)

}

const deleteFile = async(id)=>{

await api.delete(`/admin/evidence/${id}`)

setFiles(prev=>prev.filter(f=>f.id!==id))

}

return(

<MainLayout>

<motion.h1
initial={{opacity:0,y:-20}}
animate={{opacity:1,y:0}}
className="text-2xl font-semibold mb-6 text-gray-800 dark:text-white"
>

Evidence Monitoring

</motion.h1>

<div className="grid md:grid-cols-3 gap-6">

{files.map(file=>(

<motion.div
key={file.id}
whileHover={{scale:1.03}}
className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow"
>

<ProtectedMedia
file={file}
className="rounded mb-3 w-full max-h-64 object-cover"
alt={file.original_file_name}
/>

<button
onClick={()=>deleteFile(file.id)}
className="text-red-600"
>

Delete Evidence

</button>

</motion.div>

))}

</div>

</MainLayout>

)

}

export default EvidenceMonitor
