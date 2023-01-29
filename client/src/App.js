import './App.css';
import Footer from './components/footer';
import Navbar from './components/navbar';
import Stream from './components/stream';

function App() {
  return (
    <div className="App">
      <Navbar/>
        <Stream/>
      <Footer/>
    </div>
  );
}

export default App;
