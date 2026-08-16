import React, { createContext, useState, useContext } from 'react';

const TimeFilterContext = createContext();

export const TimeFilterProvider = ({ children }) => {
  const [timeFilter, setTimeFilter] = useState('all');

  // Helper function to get date range based on filter
  const getDateRange = () => {
    const now = new Date();
    let startDate, endDate;

    switch (timeFilter) {
      case 'thisWeek':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = weekAgo;
        endDate = now;
        break;
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
        break;
      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = now;
        break;
      case 'all':
      default:
        startDate = null;
        endDate = null;
        break;
    }

    return { startDate, endDate };
  };

  // Helper function to filter transactions
  const filterTransactions = (transactions) => {
    if (timeFilter === 'all') return transactions;

    const { startDate } = getDateRange();
    if (!startDate) return transactions;

    return transactions.filter((t) => new Date(t.date) >= startDate);
  };

  const value = {
    timeFilter,
    setTimeFilter,
    getDateRange,
    filterTransactions,
  };

  return (
    <TimeFilterContext.Provider value={value}>
      {children}
    </TimeFilterContext.Provider>
  );
};

export const useTimeFilter = () => {
  const context = useContext(TimeFilterContext);
  if (!context) {
    throw new Error('useTimeFilter must be used within a TimeFilterProvider');
  }
  return context;
};

export default TimeFilterContext;
