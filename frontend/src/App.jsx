import React from 'react';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';

import TransactionsPage from './pages/TransactionsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import BudgetPage from './pages/BudgetPage';
import DistributionsPage from './pages/DistributionsPage';
import DistributionAnalyticsPage from './pages/DistributionAnalyticsPage';
import PublicDashboard from './pages/PublicDashboard';

import { AnimatePresence } from 'framer-motion';

function App() {
  return (
    <Router>
      <Navbar />
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/public/:slug" element={<PublicDashboard />} />
            <Route path="/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/budget" element={<ProtectedRoute><BudgetPage /></ProtectedRoute>} />
            <Route path="/distributions" element={<ProtectedRoute operatorAllowed={true}><DistributionsPage /></ProtectedRoute>} />
            <Route path="/distribution/analytics" element={<ProtectedRoute adminOnly={true}><DistributionAnalyticsPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute operatorAllowed={true}><ProfilePage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute adminOnly={true}><SettingsPage /></ProtectedRoute>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Routes>
        </AnimatePresence>
    </Router>
  );
}

export default App;