import React from 'react';
import Layout from "./../components/Layout/Layout"
import '../styles/Homepage.css'

const App = () => {
  const startDetection = async () => {
    try {
      const response = await fetch('http://localhost:5000/start');
      const data = await response.json();
      console.log(data.status);
    } catch (error) {
      console.error("Error starting detection:", error);
    }
  };

  const stopDetection = async () => {
    try {
      const response = await fetch('http://localhost:5000/stop');
      const data = await response.json();
      console.log(data.status);
    } catch (error) {
      console.error("Error stopping detection:", error);
    }
  };

  return (
    <Layout>
      <div className='container'>
        <h1>Sign-Gesture-Interpreter</h1>

        <div className='right-side'>
        <div className='start'>
        <button onClick={startDetection}>Start</button>
        </div>
       
       <div className='stop'>
       <button onClick={stopDetection}>Stop</button>
       </div>
        </div>

        <div className='left-side'>
          <p></p>
        </div>

       
       
      </div>
    </Layout>
  );
};

export default App;
