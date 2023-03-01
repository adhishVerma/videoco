import "./App.css";
import Stream from "./components/stream";
import Connect from "./pages/Connect";
import { BrowserRouter, Route, Routes } from "react-router-dom";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Connect />} />
          <Route path="/room/:roomId" element={<Stream />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
