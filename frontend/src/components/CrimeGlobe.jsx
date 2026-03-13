import Globe from "react-globe.gl";
import { useRef, useEffect } from "react";

const CrimeGlobe = () => {

  const globeRef = useRef();

  useEffect(() => {

    if (!globeRef.current) return;

    const controls = globeRef.current.controls();

    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;

    // Initial camera position
    globeRef.current.pointOfView({
      lat: 20,
      lng: 78,
      altitude: 2.2
    });

  }, []);

  return (

    <div
      style={{
        width: "600px",
        height: "600px",
        opacity: 0.35,
        pointerEvents: "none"
      }}
    >

      <Globe
        ref={globeRef}
        width={600}
        height={600}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        backgroundColor="rgba(0,0,0,0)"
      />

    </div>

  );

};

export default CrimeGlobe;