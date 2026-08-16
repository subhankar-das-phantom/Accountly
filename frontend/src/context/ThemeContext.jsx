import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import api from '../services/api';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [theme, setTheme] = useState(() => {
    // Check local storage first for instant load
    const savedTheme = localStorage.getItem('app-theme');
    return savedTheme ? JSON.parse(savedTheme) : { color: 'default' };
  });

  useEffect(() => {
    // Sync with user's saved preferences
    if (user && user.theme) {
      setTheme(user.theme);
      localStorage.setItem('app-theme', JSON.stringify(user.theme));
    }
  }, [user]);

  useEffect(() => {
    // Apply theme classes to html element
    const html = document.documentElement;
    
    // Handle color theme
    const colorClasses = ['theme-default', 'theme-pink', 'theme-purple', 'theme-emerald'];
    html.classList.remove(...colorClasses);
    
    if (theme.color !== 'default') {
      html.classList.add(`theme-${theme.color}`);
    } else {
      html.classList.add('theme-default');
    }
    
    // Save to localStorage for instant load on refresh
    localStorage.setItem('app-theme', JSON.stringify(theme));

  }, [theme]);

  const updateTheme = async (newThemeUpdates) => {
    const updatedTheme = { ...theme, ...newThemeUpdates };
    setTheme(updatedTheme);

    if (user) {
      try {
        await api.put('/users/me/theme', newThemeUpdates);
      } catch (error) {
        console.error('Error updating theme:', error);
      }
    }
  };

  const value = { theme, updateTheme };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
