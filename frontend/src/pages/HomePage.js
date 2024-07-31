import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import '../styles/Homepage.css';
import Layout from "./../components/Layout/Layout";

const HomePage = () => {
  const [interpretedText, setInterpretedText] = useState('');
  const [cameraRunning, setCameraRunning] = useState(false);
  const [confidence, setConfidence] = useState('');

  const webcamRef = useRef(null);

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: 'user',
  };

  const startCamera = async () => {
    const response = await fetch('http://127.0.0.1:5000/start', { method: 'POST' });
    const data = await response.json();
    if (data.message === 'Camera started') {
      setCameraRunning(true);
    }
  };

  const stopCamera = async () => {
    const response = await fetch('http://127.0.0.1:5000/stop', { method: 'POST' });
    const data = await response.json();
    if (data.message === 'Camera stopped') {
      setCameraRunning(false);
    }
  };

  const captureImage = useCallback(async () => {
    if (webcamRef.current && cameraRunning) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        const response = await fetch('http://127.0.0.1:5000/interpret', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: imageSrc }),
        });
        const data = await response.json();
        setInterpretedText(data.interpretedText);
        setConfidence(data.confidence);
      }
    }
  }, [webcamRef, cameraRunning]);

  useEffect(() => {
    const interval = setInterval(captureImage, 1000);
    return () => clearInterval(interval);
  }, [captureImage]);

  return (
    <Layout>
      <div className="App">
        <div className="container">
          <div className="left-section">
            <p>
              Welcome to the Hand Gesture Interpreter! This application captures hand gestures 
              through your PC camera and interprets them into text using advanced machine learning models.
              Click the button to start the camera and begin interpreting gestures.
            </p>
          </div>
          <div className="right-section">
            <div className="camera-feed">
              <h2>Camera Feed</h2>
              {cameraRunning && (
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                />
              )}
            </div>
            <div className="controls">
              {!cameraRunning ? (
                <button onClick={startCamera}>Start Camera</button>
              ) : (
                <button onClick={stopCamera}>Stop Camera</button>
              )}
            </div>
            <div className="interpreted-text">
             {/* <h2>Interpreted Text</h2>*/}
              <p>{interpretedText} {confidence && `(${confidence.toFixed(2)}%)`}</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default HomePage;
