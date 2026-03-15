import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import FeatureCard from "./FeatureCard";
import Navbar from "./Navbar";
import "./Landing.css";
import indiaMap from "../assets/india.svg";

const Landing = () => {

const navigate = useNavigate();
const heroRef = useRef(null);

/* SCROLL PARALLAX */

const { scrollYProgress } = useScroll({
target: heroRef,
offset: ["start start","end start"]
});

const mapY = useTransform(scrollYProgress,[0,1],[0,80]);
const glowY = useTransform(scrollYProgress,[0,1],[0,120]);
const networkY = useTransform(scrollYProgress,[0,1],[0,60]);
const panelsY = useTransform(scrollYProgress,[0,1],[0,40]);

return(

<div className="landing">

<Navbar/>

{/* HERO */}

<section id="hero" className="hero" ref={heroRef}>

<div className="hero-left">

<motion.h1
initial={{opacity:0,y:40}}
animate={{opacity:1,y:0}}
transition={{duration:0.6}}
>

AI Based <span>Predictive</span><br/>
Policing System

</motion.h1>

<p>
Leverage machine learning to forecast crime trends,
identify hotspots and support data-driven policing.
</p>

<div className="hero-buttons">

<button
className="login-btn"
onClick={()=>navigate("/login")}
>
Login
</button>

<button
className="register-btn"
onClick={()=>navigate("/register")}
>
Register
</button>

</div>

</div>


{/* MAP VISUAL */}

<div className="hero-visual">

<div className="map-container">

{/* GLOW BACKGROUND */}

<motion.div
className="map-glow"
style={{y:glowY}}
/>

{/* INDIA MAP */}

<motion.img
src={indiaMap}
className="india-map"
alt="India Map"
style={{y:mapY}}
/>

{/* NETWORK LINES */}

<motion.svg
className="network-layer"
viewBox="0 0 500 520"
style={{y:networkY}}
>

<path d="M260 150 Q320 180 360 240"/>
<path d="M360 240 Q340 300 300 380"/>
<path d="M300 380 Q240 420 200 420"/>
<path d="M200 420 Q150 350 160 260"/>
<path d="M160 260 Q210 180 260 150"/>

</motion.svg>


{/* CITY NODES */}

<div className="city-node delhi"></div>
<div className="city-node mumbai"></div>
<div className="city-node bangalore"></div>
<div className="city-node kolkata"></div>
<div className="city-node hyderabad"></div>


{/* ORBIT RING */}

<div className="orbit-ring"></div>


{/* AI PANELS */}

<motion.div className="ai-panel panel1" style={{y:panelsY}}>
AI Algorithms
</motion.div>

<motion.div className="ai-panel panel2" style={{y:panelsY}}>
Crime Data
</motion.div>

<motion.div className="ai-panel panel3" style={{y:panelsY}}>
AI Prediction
</motion.div>

</div>

</div>

</section>


{/* FEATURES */}

<section id="features" className="features">

<FeatureCard
icon="🤖"
title="AI Crime Prediction"
desc="Predict crime patterns using machine learning."
/>

<FeatureCard
icon="🔥"
title="Crime Heatmap"
desc="Visualize crime hotspots across cities."
/>

<FeatureCard
icon="📱"
title="Citizen Reporting"
desc="Citizens report crimes with evidence."
/>

<FeatureCard
icon="🚓"
title="Police Verification"
desc="Police verify reports and manage cases."
/>

<FeatureCard
icon="📊"
title="Crime Analytics"
desc="Interactive dashboards for predictions."
/>

</section>


{/* SOLUTIONS */}

<section id="solutions" className="solutions">

<h2 className="section-title">AI Powered Solutions</h2>

<div className="solutions-grid">

<div className="solution-card">
<div className="solution-icon">🧠</div>
<h3>Predictive Crime Intelligence</h3>
<p>
AI models analyze historical crime data to forecast
future incidents and identify high-risk zones.
</p>
</div>

<div className="solution-card">
<div className="solution-icon">🛰️</div>
<h3>Real-Time Surveillance Mapping</h3>
<p>
Monitor crime patterns across cities with dynamic
heatmaps and geospatial intelligence.
</p>
</div>

<div className="solution-card">
<div className="solution-icon">⚡</div>
<h3>Rapid Incident Response</h3>
<p>
Enable police units to respond faster using
AI-assisted alerts and predictive analytics.
</p>
</div>

</div>

</section>


{/* ABOUT */}

<section id="about" className="about">

<h2 className="section-title">About the System</h2>

<div className="about-container">

<div className="about-text">

<p>
The AI Based Predictive Policing System leverages
machine learning, crime analytics and geospatial
intelligence to help law enforcement agencies
prevent crime before it happens.
</p>

<p>
By analyzing historical crime data and identifying
patterns, the platform enables police departments
to deploy resources strategically and maintain
safer communities.
</p>

</div>

<div className="about-stats">

<div className="stat-card">
<h3>50+</h3>
<p>Cities Analyzed</p>
</div>

<div className="stat-card">
<h3>1M+</h3>
<p>Crime Records</p>
</div>

<div className="stat-card">
<h3>95%</h3>
<p>Prediction Accuracy</p>
</div>

</div>

</div>

</section>


{/* CONTACT */}

<section id="contact" className="contact">

<h2 className="section-title">Contact</h2>

<div className="contact-container">

<div className="contact-card">
<h3>Email</h3>
<p>support@predictivepolicing.ai</p>
</div>

<div className="contact-card">
<h3>Research Team</h3>
<p>AI Crime Analytics Lab</p>
</div>

<div className="contact-card">
<h3>Location</h3>
<p>Mumbai, India</p>
</div>

</div>

</section>


{/* FOOTER */}

<footer className="footer">

<div>Company Information</div>
<div>Privacy Policy</div>
<div>Social Media</div>

</footer>

</div>

);

};

export default Landing;