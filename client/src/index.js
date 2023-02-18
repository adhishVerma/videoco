import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { SocketProvider } from "./context/SocketContext";
import { PeerProvider } from "./context/PeerContext";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <SocketProvider>
      <PeerProvider>
        <App />
      </PeerProvider>
    </SocketProvider>
  </React.StrictMode>
);
