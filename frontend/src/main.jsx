import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { TimeFilterProvider } from './context/TimeFilterContext';
import { ThemeProvider } from './context/ThemeContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <CurrencyProvider>
        <TimeFilterProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </TimeFilterProvider>
      </CurrencyProvider>
    </AuthProvider>
  </StrictMode>
);
