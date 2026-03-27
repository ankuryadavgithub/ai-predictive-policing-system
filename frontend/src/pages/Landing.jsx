import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  DatabaseZap,
  FileSearch,
  LayoutDashboard,
  MapPinned,
  Radar,
  Route,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Users,
} from "lucide-react";

import Navbar from "./Navbar";
import "./Landing.css";
import indiaMap from "../assets/india.svg";

const trustMetrics = [
  { value: "36", label: "States and UTs covered", detail: "Mapped across the national dataset" },
  { value: "541", label: "Districts modeled", detail: "Used in analytics and patrol scope" },
  { value: "6,674", label: "Cities analyzed", detail: "Historical and forecast coverage" },
  { value: "2020-2030", label: "Crime intelligence window", detail: "6 historical years plus 5 forecast years" },
];

const capabilityCards = [
  {
    icon: MapPinned,
    title: "Crime Heatmaps",
    desc: "Visualize hotspot intensity by state, city, year, and dataset using map-based crime clustering.",
    tag: "Public + Operations",
  },
  {
    icon: ShieldAlert,
    title: "Citizen Reporting",
    desc: "Submit crime reports with GPS/manual location, evidence files, and live status tracking.",
    tag: "Citizen",
  },
  {
    icon: ShieldCheck,
    title: "Police Verification",
    desc: "Review assigned or area-matched reports, inspect evidence, and verify or reject incidents.",
    tag: "Police",
  },
  {
    icon: Route,
    title: "Patrol Recommendation",
    desc: "Convert predicted crime pressure into deployment windows, priority ranking, and patrol directives.",
    tag: "Police + Admin",
  },
  {
    icon: Radar,
    title: "Mission Control",
    desc: "Run a cinematic live command view with rotating hotspots, incident feed, and operational pulse.",
    tag: "Police + Admin",
  },
  {
    icon: BarChart3,
    title: "Admin Analytics",
    desc: "Track top districts, top crime types, yearly trends, moderation queues, and system-wide activity.",
    tag: "Admin",
  },
];

const workflowSteps = [
  "Historical Data",
  "Prediction Layer",
  "Hotspot Intelligence",
  "Reporting and Verification",
  "Patrol Guidance",
  "Admin Oversight",
];

const audienceCards = [
  {
    title: "Citizen Access",
    desc: "Register, report incidents with evidence, and follow report status from submission to review.",
    action: "Create Citizen Account",
    path: "/register",
    icon: Users,
  },
  {
    title: "Police Access",
    desc: "Monitor assigned queues, verify incidents, receive patrol recommendations, and use Mission Control.",
    action: "Police Login",
    path: "/login",
    icon: ShieldCheck,
  },
  {
    title: "Admin Access",
    desc: "Approve officers, assign patrol areas, moderate reports, analyze trends, and manage evidence.",
    action: "Admin Login",
    path: "/login",
    icon: LayoutDashboard,
  },
];

const outcomeCards = [
  {
    title: "Faster situational awareness",
    desc: "Bring historical trends, predicted crime pressure, and active reporting into one operational picture.",
  },
  {
    title: "Better deployment decisions",
    desc: "Help police and administrators move from raw numbers to patrol priorities and response planning.",
  },
  {
    title: "Higher reporting traceability",
    desc: "Keep incident submissions, moderation, verification, and evidence review tied to one workflow.",
  },
];

const Landing = () => {
  const navigate = useNavigate();
  const heroRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const mapY = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const glowY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const panelY = useTransform(scrollYProgress, [0, 1], [0, 36]);

  return (
    <div className="landing">
      <div className="landing-grid" />
      <div className="landing-glow landing-glow-one" />
      <div className="landing-glow landing-glow-two" />

      <Navbar />

      <section id="hero" className="hero" ref={heroRef}>
        <div className="hero-copy">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="eyebrow"
          >
            <DatabaseZap size={16} />
            <span>AI crime intelligence for citizens, police, and administrators</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 36 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            Predict crime trends, surface hotspots, and coordinate response from one operational platform.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.08 }}
            className="hero-summary"
          >
            The AI Based Predictive Policing System combines historical crime data, forecast intelligence,
            citizen reporting, police verification, patrol recommendation, and admin oversight into one
            connected workflow built for Indian city-scale crime analysis.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.16 }}
            className="hero-actions"
          >
            <button className="primary-cta" onClick={() => navigate("/register")}>
              Get Started
              <ArrowRight size={18} />
            </button>

            <button className="secondary-cta" onClick={() => navigate("/login")}>
              Police/Admin Login
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.22 }}
            className="hero-quick-links"
          >
            <button onClick={() => navigate("/report")}>Report Crime</button>
            <button onClick={() => document.getElementById("workflow")?.scrollIntoView({ behavior: "smooth" })}>
              See How It Works
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.26 }}
            className="hero-proof"
          >
            <div className="proof-card">
              <strong>1.97M+</strong>
              <span>modeled crime records across historical and predicted datasets</span>
            </div>
            <div className="proof-card">
              <strong>Live operations stack</strong>
              <span>heatmaps, report verification, patrol recommendations, and Mission Control</span>
            </div>
          </motion.div>
        </div>

        <div className="hero-visual">
          <div className="command-frame">
            <motion.div className="map-glow" style={{ y: glowY }} />
            <motion.img src={indiaMap} alt="India crime intelligence map" className="india-map" style={{ y: mapY }} />

            <svg className="network-layer" viewBox="0 0 500 520" aria-hidden="true">
              <path d="M250 120 Q325 150 370 230" />
              <path d="M370 230 Q352 305 302 382" />
              <path d="M302 382 Q238 434 188 420" />
              <path d="M188 420 Q144 338 160 250" />
              <path d="M160 250 Q205 168 250 120" />
              <path d="M250 120 Q220 236 302 382" />
            </svg>

            <span className="city-node delhi" />
            <span className="city-node mumbai" />
            <span className="city-node bangalore" />
            <span className="city-node kolkata" />
            <span className="city-node hyderabad" />

            <div className="orbit-ring" />

            <motion.div className="hero-panel hero-panel-top" style={{ y: panelY }}>
              <FileSearch size={16} />
              <div>
                <strong>Citizen Reporting</strong>
                <span>Evidence-backed incident intake</span>
              </div>
            </motion.div>

            <motion.div className="hero-panel hero-panel-right" style={{ y: panelY }}>
              <Route size={16} />
              <div>
                <strong>Patrol Guidance</strong>
                <span>Forecast-led deployment priorities</span>
              </div>
            </motion.div>

            <motion.div className="hero-panel hero-panel-bottom" style={{ y: panelY }}>
              <Siren size={16} />
              <div>
                <strong>Mission Control</strong>
                <span>Live operational command view</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="metrics" className="trust-section">
        <div className="section-head">
          <span className="section-label">Trust Metrics</span>
          <h2>Real project coverage, not placeholder claims.</h2>
          <p>
            The landing page metrics below are aligned with the current dataset and live project structure.
          </p>
        </div>

        <div className="trust-grid">
          {trustMetrics.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.45, delay: index * 0.06 }}
              className="trust-card"
            >
              <strong>{item.value}</strong>
              <h3>{item.label}</h3>
              <p>{item.detail}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="capabilities" className="capabilities-section">
        <div className="section-head">
          <span className="section-label">Core Capabilities</span>
          <h2>Built around the modules the system actually provides.</h2>
          <p>
            Instead of generic AI claims, the page now highlights the concrete tools already present in the platform.
          </p>
        </div>

        <div className="capability-grid">
          {capabilityCards.map(({ icon: Icon, title, desc, tag }, index) => (
            <motion.article
              key={title}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: index * 0.05 }}
              className="capability-card"
            >
              <div className="capability-top">
                <span className="capability-icon">
                  <Icon size={20} />
                </span>
                <span className="capability-tag">{tag}</span>
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section id="workflow" className="workflow-section">
        <div className="section-head">
          <span className="section-label">How It Works</span>
          <h2>From raw data to verified field action.</h2>
          <p>
            The platform turns historical and predicted crime intelligence into operational guidance and review workflows.
          </p>
        </div>

        <div className="workflow-strip">
          {workflowSteps.map((step, index) => (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              className="workflow-step"
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="audiences" className="audience-section">
        <div className="section-head">
          <span className="section-label">Audience Access</span>
          <h2>One platform, three focused entry points.</h2>
          <p>
            Citizens, police officers, and admins all use the same system, but each role sees a different workflow.
          </p>
        </div>

        <div className="audience-grid">
          {audienceCards.map(({ title, desc, action, path, icon: Icon }, index) => (
            <motion.article
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
              className="audience-card"
            >
              <span className="audience-icon">
                <Icon size={20} />
              </span>
              <h3>{title}</h3>
              <p>{desc}</p>
              <button onClick={() => navigate(path)}>
                {action}
                <ArrowRight size={16} />
              </button>
            </motion.article>
          ))}
        </div>
      </section>

      <section id="outcomes" className="outcomes-section">
        <div className="section-head">
          <span className="section-label">System Value</span>
          <h2>Designed to improve visibility, coordination, and decision quality.</h2>
        </div>

        <div className="outcome-grid">
          {outcomeCards.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.4, delay: index * 0.07 }}
              className="outcome-card"
            >
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="about" className="about-section">
        <div className="about-copy">
          <span className="section-label">About The Project</span>
          <h2>An AI-enabled predictive policing platform grounded in dataset-backed intelligence.</h2>
          <p>
            This project brings together historical crime analysis, predicted crime trends, geospatial visualization,
            evidence-backed citizen reporting, police verification, patrol recommendation, and administrative oversight.
          </p>
          <p>
            Rather than acting as a generic demo screen, the platform is structured like an operational system:
            citizens submit reports, police review incidents, admins manage access and assignments, and prediction-driven
            interfaces help surface priority zones for action.
          </p>
        </div>

        <div className="about-panel">
          <div className="about-stat">
            <strong>Historical window</strong>
            <span>2020 to 2025</span>
          </div>
          <div className="about-stat">
            <strong>Forecast horizon</strong>
            <span>2026 to 2030</span>
          </div>
          <div className="about-stat">
            <strong>Operational layers</strong>
            <span>Reporting, verification, patrol, analytics, command view</span>
          </div>
        </div>
      </section>

      <footer id="footer" className="landing-footer">
        <div className="footer-brand">
          <h3>AI Based Predictive Policing System</h3>
          <p>
            A mixed-audience platform for citizen reporting, police workflows, patrol intelligence, and admin oversight.
          </p>
        </div>

        <div className="footer-links">
          <div>
            <strong>Explore</strong>
            <button onClick={() => document.getElementById("capabilities")?.scrollIntoView({ behavior: "smooth" })}>
              Capabilities
            </button>
            <button onClick={() => document.getElementById("workflow")?.scrollIntoView({ behavior: "smooth" })}>
              Workflow
            </button>
            <button onClick={() => document.getElementById("about")?.scrollIntoView({ behavior: "smooth" })}>
              About
            </button>
          </div>

          <div>
            <strong>Access</strong>
            <button onClick={() => navigate("/register")}>Create Account</button>
            <button onClick={() => navigate("/login")}>Login</button>
            <button onClick={() => navigate("/report")}>Report Crime</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
