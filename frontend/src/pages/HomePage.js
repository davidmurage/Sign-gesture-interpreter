import React from 'react';
import Layout from "./../components/Layout/Layout"
import '../styles/Homepage.css'
import axios from 'axios'

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
      <button onClick={startCamera}>Start</button>
      <button onClick={stopCamera}>Stop</button>
    </div>
    </Layout>
  );
}

export default App;
