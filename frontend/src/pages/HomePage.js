import React from 'react';
import Layout from "./../components/Layout/Layout";
import '../styles/Homepage.css';
import axios from 'axios';

function App() {
  const startCamera = () => {
    axios.post('http://localhost:5000/start')
      .then(response => {
        console.log(response.data.message);
      })
      .catch(error => {
        console.error('There was an error starting the camera!', error);
      });
  };

  const stopCamera = () => {
    axios.post('http://localhost:5000/stop')
      .then(response => {
        console.log(response.data.message);
      })
      .catch(error => {
        console.error('There was an error stopping the camera!', error);
      });
  };

  return (
    <Layout>
      <div className="App">
        <p className="description">
          This is a <span>Hand-gesture-interpreter</span>, that captures the hand gesture<br/> through the PC camera,<br/>
          then interprets those gestures into a text form.
        </p>
        <div className="button-container">
          <button onClick={startCamera} className="action-button">Start</button>
          <button onClick={stopCamera} className="action-button">Stop</button>
        </div>
      </div>
    </Layout>
  );
}

export default App;
