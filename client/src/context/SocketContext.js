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
const socket = io('https://videoco-express.onrender.com/');

// setting up socket provider
export const SocketProvider = (props) => {
  const [userEmail, setUserEmail] = React.useState("");
  const [roomId, setRoomId] = React.useState(null);
  const [guestEmail, setGuestEmail] = React.useState("");
  return (
    <SocketContext.Provider value={{socket, roomId, setRoomId, userEmail, setUserEmail, guestEmail, setGuestEmail}}>{props.children}</SocketContext.Provider>
  );
};
