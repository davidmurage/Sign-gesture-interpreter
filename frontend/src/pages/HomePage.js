import React, { useState, useRef } from 'react';
import axios from 'axios';
import Layout from "./../components/Layout/Layout";

function App() {
  const [cameraOn, setCameraOn] = useState(false);
  const [prediction, setPrediction] = useState('');
  const videoRef = useRef(null);
  let captureInterval;

  const startCamera = () => {
    setCameraOn(true);
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        videoRef.current.srcObject = stream;
        captureInterval = setInterval(captureFrame, 1000); // Capture a frame every second
      })
      .catch(err => {
        console.error("Error accessing the camera", err);
      });
  };

  const stopCamera = () => {
    setCameraOn(false);
    clearInterval(captureInterval);
    let stream = videoRef.current.srcObject;
    let tracks = stream.getTracks();

    tracks.forEach(track => track.stop());
    videoRef.current.srcObject = null;
  };

  const captureFrame = async () => {
    const video = videoRef.current;
    if (video) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      const blob = await fetch(dataUrl).then(res => res.blob());
      const file = new File([blob], 'frame.jpg', { type: 'image/jpeg' });
      
      const formData = new FormData();
      formData.append('file', file);

      axios.post('http://localhost:5000/predict', formData)
        .then(response => {
          setPrediction(response.data.prediction);
        })
        .catch(error => {
          console.error('Error uploading image:', error);
        });
    }
  };

  return (
    <Layout>
      <div className="App">
      <h1>Sign Gesture Interpreter</h1>
      <button onClick={startCamera}>Start</button>
      <button onClick={stopCamera}>Stop</button>
      <div>
        {cameraOn && <video ref={videoRef} autoPlay />}
      </div>
      <div>
        <h2>Prediction: {prediction}</h2>
      </div>
    </div>
    </Layout>
    
  );
}

export default App;
