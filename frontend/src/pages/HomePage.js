import React,{useState} from 'react';
import Layout from '../components/Layout/Layout';

const HomePage = () => {
 const [stream, setStream] = useState(null);
  const openCamera = async() =>{
      try{
        const stream = await navigator.mediaDevices.getUserMedia({video: true});
        setStream(stream);
      }catch(error){
        console.log(error);
      }
  }
  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px' }}>
      <div style={{ width: '60%' }}>
        <h2>Welcome to Camera App</h2>
        <p>Click the start button to open your PC camera.</p>
      </div>
      <div style={{ width: '30%', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={openCamera} style={{ padding: '10px 20px', fontSize: '16px' }}>
          Start
        </button>
      </div>
      <div style={{ width: '100%', marginTop: '20px' }}>
        {stream && <video autoPlay playsInline ref={video => {
          if (video) video.srcObject = stream;
        }} />}
      </div>
    </div>
    </Layout>
  )
}

export default HomePage
