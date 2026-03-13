import { useEffect, useState } from "react";

const text = "AI PREDICTIVE POLICING NETWORK INITIALIZING...";

const TypingText = () => {

  const [display, setDisplay] = useState("");

  useEffect(() => {

    let i = 0;

    const interval = setInterval(() => {

      setDisplay(text.slice(0, i));
      i++;

      if (i > text.length) clearInterval(interval);

    }, 40);

    return () => clearInterval(interval);

  }, []);

  return (

    <div style={{
      color: "#00ffcc",
      fontFamily: "monospace",
      fontSize: "13px",
      marginBottom: "20px"
    }}>
      {display}
    </div>

  );

};

export default TypingText;