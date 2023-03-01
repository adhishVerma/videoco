import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { SocketProvider } from "./context/SocketContext";
import { PeerProvider } from "./context/PeerContext";
import Layout from "./components/Layout";
import { MediaStreamProvider } from "./context/MediaStreamContext";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <SocketProvider>
      <PeerProvider>
        <MediaStreamProvider>
          <Layout>
            <App />
          </Layout>
        </MediaStreamProvider>
      </PeerProvider>
    </SocketProvider>
  </React.StrictMode>
);
