import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import api from '../services/api';

const CurrencyContext = createContext();

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [currency, setCurrency] = useState({ code: 'INR', locale: 'en-IN' });

  useEffect(() => {
    if (user && user.currency) {
      setCurrency(user.currency);
    }
  }, [user]);

  const updateCurrency = async (newCurrency) => {
    try {
      const { code, locale } = newCurrency;
      const res = await api.put('/users/me/currency', { code, locale });
      setCurrency(res.data);
      return res.data;
    } catch (error) {
      console.error('Error updating currency:', error);
      throw error;
    }
  };

  const value = { currency, updateCurrency };
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};
