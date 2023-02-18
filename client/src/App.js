import "./App.css";
import Footer from "./components/footer";
import Navbar from "./components/navbar";
import Stream from "./components/stream";
import {MediaStreamProvider} from "./context/MediaStreamContext";

function App() {
  return (
    <div className="App">
      <MediaStreamProvider>
        <Navbar />
        <Stream />
        <Footer />
      </MediaStreamProvider>
    </div>
  );
}

export default App;
