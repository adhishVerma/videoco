import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import Layout from "./components/Layout";
import { MediaStreamProvider } from "./context/MediaStreamContext";
import { Provider } from "react-redux";
import { store } from './store/store';
import { BrowserRouter } from "react-router-dom";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(

  <Provider store={store}>
        <MediaStreamProvider>
          <BrowserRouter>
            <Layout>
              <App />
            </Layout>
          </BrowserRouter>
        </MediaStreamProvider>
  </Provider>
);
