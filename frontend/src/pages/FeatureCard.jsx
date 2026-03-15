import { motion } from "framer-motion";

const FeatureCard = ({icon,title,desc}) => {

return(

<motion.div
className="feature-card"
initial={{opacity:0,y:30}}
whileInView={{opacity:1,y:0}}
viewport={{once:true}}
transition={{duration:0.4}}
whileHover={{y:-8}}
>

<div className="feature-icon">{icon}</div>

<h3>{title}</h3>

<p>{desc}</p>

<div className="feature-preview">
<div className="preview-line"></div>
</div>

</motion.div>

);

};

export default FeatureCard;