import "./App.css";
import Room from "./pages/Room";
import Connect from "./pages/Connect";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Login from "./components/login";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login/>}/>
          <Route path="/" element={<Connect />} />
          <Route path="/room/:roomId" element={<Room />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
