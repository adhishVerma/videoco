import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { SocketProvider } from "./context/SocketContext";
import { PeerProvider } from "./context/PeerContext";
import Layout from "./components/Layout";
import { MediaStreamProvider } from "./context/MediaStreamContext";
import { BrowserRouter } from "react-router-dom";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <SocketProvider>
    <PeerProvider>
      <MediaStreamProvider>
        <BrowserRouter>
          <Layout>
            <App />
          </Layout>
        </BrowserRouter>
      </MediaStreamProvider>
    </PeerProvider>
  </SocketProvider>
);
