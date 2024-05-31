import React from 'react';
import Layout from "./../components/Layout/Layout"

const App = () => {
  const startDetection = async () => {
    const response = await fetch('http://localhost:5000/start');
    const data = await response.json();
    console.log(data.status);
  };

  const stopDetection = async () => {
    const response = await fetch('http://localhost:5000/stop');
    const data = await response.json();
    console.log(data.status);
  };

  return (
    <Layout>
    <div>
      <h1>Sign-Gesture-Interpreter</h1>
      <button onClick={startDetection}>Start</button>
      <button onClick={stopDetection}>Stop</button>
    </div>
    </Layout>
    
  );
};

export default App;
