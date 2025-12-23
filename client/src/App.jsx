import { Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import Home from './pages/Home';
import Results from './pages/Results';
import Settings from './pages/Settings';
import Library from './pages/Library';
import './App.css';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    const savedBg = localStorage.getItem('app_background');
    if (savedBg) {
      document.documentElement.style.setProperty('--app-background', savedBg);
    }
  }, []);

  return (
    <>
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/results" element={<Results />} />
          <Route path="/library" element={<Library />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
