import Particles from "react-tsparticles";

const CinematicBackground = () => {

  return (
    <Particles
      options={{
        background: { color: "#000" },
        fpsLimit: 60,
        particles: {
          number: { value: 80 },
          color: { value: "#00ffff" },
          links: {
            enable: true,
            distance: 140,
            color: "#00ffff",
            opacity: 0.2
          },
          move: {
            enable: true,
            speed: 1
          },
          size: { value: 2 }
        }
      }}
      style={{
        position: "absolute",
        zIndex: 0
      }}
    />
  );

};

export default CinematicBackground;