import React from 'react';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import { Container } from '@mui/material';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

import ProfilePage from './pages/ProfilePage';

import TransactionsPage from './pages/TransactionsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import BudgetPage from './pages/BudgetPage';

import { AnimatePresence } from 'framer-motion';

function App() {
  return (
    <Router>
      <Navbar />
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/budget" element={<BudgetPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Routes>
        </AnimatePresence>
    </Router>
  );
}

export default App;