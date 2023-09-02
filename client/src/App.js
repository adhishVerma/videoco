import React,  {useEffect} from 'react';
import "./App.css";
import Room from "./pages/Room";
import Connect from "./pages/Connect";
import { Route, Routes } from "react-router-dom";
import JoinRequest from "./components/JoinRoom/JoinRequest";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { connectWithSocketIOServer } from './utils/wss';


function App() {
  useEffect(() => {
    connectWithSocketIOServer();
  }, [])
  return (
    <div className="App">
      <ToastContainer
        position="top-center"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <Routes>
        <Route path="/join-room" element={<JoinRequest />} />
        <Route path="/" element={<Connect />} />
        <Route path="/room" element={<Room />} />
      </Routes>
    </div>
  );
}

export default App;
