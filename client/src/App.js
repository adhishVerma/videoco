import "./App.css";
import Room from "./pages/Room";
import Connect from "./pages/Connect";
import {  Route, Routes } from "react-router-dom";
import Login from "./components/Login";

function App() {
  return (
      <div className="App">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Connect />} />
          <Route path="/room/:roomId" element={<Room />} />
        </Routes>
      </div>
  );
}

export default App;
