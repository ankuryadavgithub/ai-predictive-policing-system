import CountUp from "react-countup";

const LiveCrimeStats = () => {

  return (

    <div className="crime-stats">

      <div className="stat">

        <h3>
          <CountUp end={45821} duration={3}/>
        </h3>

        <p>Reports Processed</p>

      </div>

      <div className="stat">

        <h3>
          <CountUp end={1289} duration={3}/>
        </h3>

        <p>Active Investigations</p>

      </div>

      <div className="stat">

        <h3>
          <CountUp end={87} duration={3}/>
        </h3>

        <p>High Risk Zones</p>

      </div>

    </div>

  );

};

export default LiveCrimeStats;