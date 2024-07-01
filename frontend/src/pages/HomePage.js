import React, { useState } from 'react';
import '../styles/Homepage.css';

const HomePage = () => {
  const [interpretedText, setInterpretedText] = useState('');
  const [cameraRunning, setCameraRunning] = useState(false);

  const startCamera = async () => {
    const response = await fetch('http://localhost:5000/start', { method: 'POST' });
    const data = await response.json();
    if (data.message === 'Camera started') {
      setCameraRunning(true);
    }
  };

  const stopCamera = async () => {
    const response = await fetch('http://localhost:5000/stop', { method: 'POST' });
    const data = await response.json();
    if (data.message === 'Camera stopped') {
      setCameraRunning(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Sign Gesture Interpreter</h1>
      </header>
      <div className="camera-feed">
        <h2>Camera Feed</h2>
        <p>Live camera feed will be displayed here.</p>
      </div>
      <div className="controls">
        {!cameraRunning ? (
          <button onClick={startCamera}>Start Camera</button>
        ) : (
          <button onClick={stopCamera}>Stop Camera</button>
        )}
      </div>
      <div className="interpreted-text">
        <h2>Interpreted Text</h2>
        <p>{interpretedText}</p>
      </div>
    </div>
  );
};

export default HomePage;
