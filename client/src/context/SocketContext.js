import React, { createContext } from "react";
import { useContext } from "react";
import { io } from "socket.io-client";

// context api to create context
export const SocketContext = createContext();

// creating custom hook to use Socket Context everywhere
export const useSocket = () => {
  return useContext(SocketContext)
}

// initializing a new socket connection when the app loads
const socket = io('http://localhost:5000');

// setting up socket provider
export const SocketProvider = (props) => {
  const [userEmail, setUserEmail] = React.useState("");
  const [roomId, setRoomId] = React.useState(null);
  return (
    <SocketContext.Provider value={{socket, roomId, setRoomId, userEmail, setUserEmail}}>{props.children}</SocketContext.Provider>
  );
};
