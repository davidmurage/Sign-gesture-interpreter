import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import '../styles/HomePage.css';
import Layout from './../components/Layout/Layout';

const INFERENCE_URL = (process.env.REACT_APP_INFERENCE_URL || 'http://127.0.0.1:5001').replace(/\/$/, '');
const POLL_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 8000;

const HomePage = () => {
  const [cameraRequested, setCameraRequested] = useState(false);
  const [result, setResult] = useState({ text: null, confidence: null });
  const [status, setStatus] = useState('Camera is stopped.');
  const [error, setError] = useState('');
  const webcamRef = useRef(null);
  const timerRef = useRef(null);
  const requestRef = useRef(null);
  const activeRef = useRef(false);
  const sessionRef = useRef(0);

  const releaseCamera = useCallback(() => {
    const stream = webcamRef.current?.video?.srcObject;
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const cancelSession = useCallback(() => {
    sessionRef.current += 1;
    activeRef.current = false;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    requestRef.current?.abort();
    requestRef.current = null;
    releaseCamera();
  }, [releaseCamera]);

  const stopCamera = useCallback(() => {
    cancelSession();
    setCameraRequested(false);
    setResult({ text: null, confidence: null });
    setError('');
    setStatus('Camera is stopped.');
  }, [cancelSession]);

  const captureImage = useCallback(async (session) => {
    if (!activeRef.current || session !== sessionRef.current || requestRef.current) return;
    const image = webcamRef.current?.getScreenshot();
    if (!image) {
      if (activeRef.current && session === sessionRef.current) {
        timerRef.current = setTimeout(() => captureImage(session), POLL_DELAY_MS);
      }
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${INFERENCE_URL}/interpret`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }), signal: controller.signal,
      });
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('protocol');
      }
      if (!response.ok) {
        const safeMessage = typeof data?.error === 'string' ? data.error : 'The frame was rejected.';
        throw new Error(`server:${safeMessage}`);
      }
      if (typeof data?.handDetected !== 'boolean' ||
          (data.handDetected && typeof (data.text || data.label) !== 'string')) {
        throw new Error('protocol');
      }
      if (activeRef.current && session === sessionRef.current &&
          requestRef.current === controller) {
        setResult(data.handDetected
          ? { text: data.text || data.label, confidence: data.confidence }
          : { text: null, confidence: null });
        setError('');
        setStatus(data.handDetected ? 'Gesture recognized.' : 'No hand detected.');
      }
    } catch (requestError) {
      if (activeRef.current && session === sessionRef.current &&
          requestRef.current === controller) {
        setResult({ text: null, confidence: null });
        if (requestError.name === 'AbortError') {
          setError('The inference request timed out. Retrying...');
        } else if (requestError.message?.startsWith('server:')) {
          setError(`${requestError.message.slice(7)} Retrying...`);
        } else if (requestError.message === 'protocol') {
          setError('The inference service returned an invalid response. Retrying...');
        } else {
          setError('The inference service is unavailable. Retrying...');
        }
      }
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
      if (activeRef.current && session === sessionRef.current) {
        timerRef.current = setTimeout(() => captureImage(session), POLL_DELAY_MS);
      }
    }
  }, []);

  const startCamera = () => {
    cancelSession();
    setError('');
    setResult({ text: null, confidence: null });
    setStatus('Requesting camera permission...');
    setCameraRequested(true);
  };

  const handleUserMedia = () => {
    if (activeRef.current) return;
    activeRef.current = true;
    const session = sessionRef.current;
    setStatus('Camera is running.');
    captureImage(session);
  };

  const handleUserMediaError = () => {
    cancelSession();
    setCameraRequested(false);
    setResult({ text: null, confidence: null });
    setError('Camera access was denied or no camera is available. Check browser permissions and try again.');
    setStatus('Camera could not start.');
  };

  useEffect(() => cancelSession, [cancelSession]);

  return <Layout><main className="interpreter-page">
    <section className="interpreter-intro">
      <h1>Static Sign Interpreter</h1>
      <p>Show one supported static gesture at a time. Recognition is limited to the supplied model vocabulary.</p>
    </section>
    <section className="interpreter-panel" aria-label="Sign interpreter">
      <div className="camera-feed">
        <h2>Camera Feed</h2>
        {cameraRequested && <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg"
          videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
          onUserMedia={handleUserMedia} onUserMediaError={handleUserMediaError} />}
      </div>
      <div className="controls">
        {!cameraRequested ? <button onClick={startCamera}>Start Camera</button>
          : <button onClick={stopCamera}>Stop Camera</button>}
      </div>
      <div className="result" role="status" aria-live="polite">
        <p>{status}</p>
        {result.text && <p className="prediction">{result.text}{Number.isFinite(result.confidence) && ` (${result.confidence.toFixed(2)}%)`}</p>}
        {error && <p className="error">{error}</p>}
      </div>
    </section>
  </main></Layout>;
};

export default HomePage;
