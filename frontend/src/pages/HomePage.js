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
        {/*<h1>Sign-Gesture-Interpreter</h1>*/}

        <div className='left-side'>
          <p>This is an <span>AI</span> that captures the hand gesture, through the camera of the Pc.<br/> After capturing the hand gesture 
          it will later interpret it into a textual form.<br/> For interpretation to occur, a model is trained using tensorflow, and each gesture
          is given a label. </p>
        </div>

        <div className='rigt-side'>
        <div className='start'>
        <button onClick={startDetection}>Start</button>
        </div>
       
       <div className='stop'>
       <button onClick={stopDetection}>Stop</button>
       </div>
        </div>

       

       
       
      </div>
    </Layout>
  );
};

export default App;
