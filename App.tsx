import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ReportEditor from './pages/ReportEditor';
import SharePage from './pages/SharePage';
import TestPage from './pages/TestPage';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
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