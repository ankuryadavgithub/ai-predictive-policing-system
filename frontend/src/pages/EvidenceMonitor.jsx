import { useEffect,useState } from "react"
import { motion } from "framer-motion"
import MainLayout from "../layout/MainLayout"
import api from "../services/api"

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

{file.file_type==="image" && (

<img
src={`http://127.0.0.1:8000${file.file_path}`}
className="rounded mb-3"
/>

)}

{file.file_type==="video" && (

<video
controls
className="rounded mb-3"
src={`http://127.0.0.1:8000${file.file_path}`}
/>

)}

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