import React, { useEffect, useState } from "react";
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { SocketContext } from "../context/SocketContext";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const { userEmail, socket, setUserEmail } = useContext(SocketContext);

  const handleLogin = () => {
    setUserEmail(email)
    socket.emit('login', {email})
  }

  useEffect(() => {
    if (userEmail.length > 2){
      navigate('/')
    }
  },[navigate,userEmail])

  return (
    <div className="flex flex-col gap-10 h-screen items-center justify-center">
      <div className="text-3xl">Login</div>
      <div className="flex flex-col gap-10">
        <input
          type="email"
          placeholder="email"
          value={email}
          className="outline-none border-0 py-3 rounded-md px-5 text-lg text-gray-600"
          onChange={(e) => {setEmail(e.target.value)}}
        />
        <button className="bg-white hover:bg-gray-300 active:bg-gray-400 text-black rounded-2xl px-8 py-2 w-1/2 self-center" onClick={handleLogin}>
          Login
        </button>
      </div>
    </div>
  );
};

export default Login;
