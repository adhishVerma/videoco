import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SocketContext } from "../context/SocketContext";
import { v4 as uuidv4 } from 'uuid';

const Connect = () => {
  const {socket, setRoomId, roomId} = useContext(SocketContext);
  const [emailId, setEmailId] = useState("");
  const navigate = useNavigate();

  const handleRoomJoined = useCallback(({roomId}) => {
    navigate(`/room/${roomId}`);
  },[navigate])

  useEffect(() => {
    socket.on("joined-room", handleRoomJoined)
  },[socket, handleRoomJoined])

  const handleJoinRoom = (e) => {
    e.preventDefault();
    const room = uuidv4();
    setRoomId(room)
    socket.emit("join-room", {emailId, roomId:room})
  }

  return (
    <div className="flex flex-col gap-10 h-screen items-center justify-center">
      <div className="text-3xl">Call User</div>
      <div className="flex flex-col gap-10">
        <input type="email" placeholder="email" value={emailId} className="outline-none border-0 py-3 rounded-md px-5 text-lg text-gray-600" onChange={(e) => {setEmailId(e.target.value)}}/>
        <button className="bg-white hover:bg-gray-300 active:bg-gray-400 text-black rounded-2xl px-8 py-2 w-1/2 self-center" onClick={handleJoinRoom}>Invite</button>
      </div>
    </div>
  );
};

export default Connect;
