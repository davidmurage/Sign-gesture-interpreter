import {Route, Routes} from 'react-router-dom';
import HomePage from "./pages/HomePage";
import Register from './pages/Auth/Register';
import Login from './pages/Auth/Login';
import ForgotPasssword from './pages/Auth/ForgotPassword';
import './App.css';

function App() {
  return (
    <>
    <Routes>
      <Route path='/' element={<HomePage/>}/>
      <Route path='/login' element={<Login/>}/>
      <Route path='/register' element={<Register/>}/>
      <Route path='/forgot-password' element={<ForgotPasssword/>}/>
    </Routes>
    </>
  );
}

export default App;
