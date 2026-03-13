import Particles from "react-tsparticles";

const AuthBackground = () => {

  return (
    <Particles
      options={{
        background: { color: "#000" },
        particles: {
          number: { value: 60 },
          color: { value: "#1e90ff" },
          links: {
            enable: true,
            distance: 150,
            color: "#1e90ff",
            opacity: 0.3
          },
          move: {
            enable: true,
            speed: 1
          },
          size: {
            value: 2
          }
        }
      }}
      style={{
        position: "absolute",
        zIndex: 0
      }}
    />
  );

};

export default AuthBackground;