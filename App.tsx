
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ReportEditor from './pages/ReportEditor';
import SharePage from './pages/SharePage';
import TestPage from './pages/TestPage';
import Welcome from './pages/Welcome';

// Component to handle initial redirect based on whether user has seen intro
const RootRedirect: React.FC = () => {
  let hasSeenIntro = false;
  try {
    hasSeenIntro = localStorage.getItem('dsr_intro_shown') === 'true';
  } catch (e) {
    console.warn("localStorage access denied", e);
  }
  
  return hasSeenIntro ? <Dashboard /> : <Navigate to="/welcome" replace />;
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/new" element={<ReportEditor />} />
        <Route path="/report/:id" element={<ReportEditor />} />
        <Route path="/share/:id" element={<SharePage />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
