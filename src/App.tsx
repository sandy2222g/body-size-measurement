import { Routes, Route } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from './components/Header';
import Home from './pages/Home';
import Measurement from './pages/Measurement';
import Results from './pages/Results';
import Profile from './pages/Profile';
import { MeasurementProvider } from './context/MeasurementContext';

function App() {
  return (
    <MeasurementProvider>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Header />
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="container mx-auto px-4 py-8"
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/measurement" element={<Measurement />} />
            <Route path="/results" element={<Results />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </motion.main>
      </div>
    </MeasurementProvider>
  );
}

export default App;