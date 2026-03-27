import Globe from "react-globe.gl";
import { useEffect, useMemo, useRef } from "react";

const INDIA_OUTLINE = [
  { lat: 35.55, lng: 74.2 },
  { lat: 34.3, lng: 76.9 },
  { lat: 32.7, lng: 78.4 },
  { lat: 30.8, lng: 79.6 },
  { lat: 28.8, lng: 77.2 },
  { lat: 27.5, lng: 79.8 },
  { lat: 26.4, lng: 82.8 },
  { lat: 26.7, lng: 88.2 },
  { lat: 27.8, lng: 91.7 },
  { lat: 25.8, lng: 92.8 },
  { lat: 24.1, lng: 92.2 },
  { lat: 23.0, lng: 91.4 },
  { lat: 21.7, lng: 89.2 },
  { lat: 19.8, lng: 85.9 },
  { lat: 16.4, lng: 82.5 },
  { lat: 13.0, lng: 80.5 },
  { lat: 10.9, lng: 79.8 },
  { lat: 8.3, lng: 77.8 },
  { lat: 11.4, lng: 75.8 },
  { lat: 13.7, lng: 74.6 },
  { lat: 16.0, lng: 73.4 },
  { lat: 18.8, lng: 72.6 },
  { lat: 21.0, lng: 70.4 },
  { lat: 23.1, lng: 69.2 },
  { lat: 24.8, lng: 71.4 },
  { lat: 27.2, lng: 72.9 },
  { lat: 29.6, lng: 73.6 },
  { lat: 32.1, lng: 74.2 },
  { lat: 35.55, lng: 74.2 },
];

const INDIA_MARKERS = [
  { lat: 28.6139, lng: 77.209, size: 0.24, color: "#8be9ff" },
  { lat: 19.076, lng: 72.8777, size: 0.28, color: "#60a5fa" },
  { lat: 12.9716, lng: 77.5946, size: 0.24, color: "#67e8f9" },
  { lat: 22.5726, lng: 88.3639, size: 0.24, color: "#93c5fd" },
  { lat: 17.385, lng: 78.4867, size: 0.22, color: "#7dd3fc" },
];

const INDIA_RINGS = [
  { lat: 22.8, lng: 79.2, maxR: 6.4, propagationSpeed: 0.95, repeatPeriod: 1200 },
  { lat: 28.6139, lng: 77.209, maxR: 3.2, propagationSpeed: 1.25, repeatPeriod: 1500 },
  { lat: 19.076, lng: 72.8777, maxR: 3.8, propagationSpeed: 1.1, repeatPeriod: 1800 },
];

const CrimeGlobe = () => {
  const globeRef = useRef();

  const indiaArcs = useMemo(
    () =>
      INDIA_OUTLINE.slice(0, -1).map((point, index) => ({
        startLat: point.lat,
        startLng: point.lng,
        endLat: INDIA_OUTLINE[index + 1].lat,
        endLng: INDIA_OUTLINE[index + 1].lng,
        color: ["rgba(103,232,249,0.9)", "rgba(37,99,235,0.9)"],
      })),
    []
  );

  useEffect(() => {
    if (!globeRef.current) return;

    const controls = globeRef.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.34;
    controls.enableZoom = false;
    controls.enablePan = false;

    globeRef.current.pointOfView({
      lat: 20,
      lng: 78,
      altitude: 2.15,
    });
  }, []);

  return (
    <div
      style={{
        width: "600px",
        height: "600px",
        opacity: 0.52,
        pointerEvents: "none",
      }}
    >
      <Globe
        ref={globeRef}
        width={600}
        height={600}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        showAtmosphere
        atmosphereColor="#67e8f9"
        atmosphereAltitude={0.18}
        arcsData={indiaArcs}
        arcColor={(d) => d.color}
        arcAltitude={0.03}
        arcStroke={0.95}
        arcDashLength={0.45}
        arcDashGap={1.1}
        arcDashAnimateTime={3200}
        pointsData={INDIA_MARKERS}
        pointLat={(d) => d.lat}
        pointLng={(d) => d.lng}
        pointColor={(d) => d.color}
        pointAltitude={(d) => d.size}
        pointRadius={0.28}
        pointsMerge={false}
        ringsData={INDIA_RINGS}
        ringLat={(d) => d.lat}
        ringLng={(d) => d.lng}
        ringColor={() => ["rgba(103,232,249,0.75)", "rgba(37,99,235,0.05)"]}
        ringMaxRadius={(d) => d.maxR}
        ringPropagationSpeed={(d) => d.propagationSpeed}
        ringRepeatPeriod={(d) => d.repeatPeriod}
      />
    </div>
  );
};

export default CrimeGlobe;
