import React from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useCurrency } from '../context/CurrencyContext';
import { formatCurrency } from '../utils/currency';

const Chart = ({ data, title = "Expense Breakdown" }) => {
  const { currency } = useCurrency();
  
  // Modern gradient colors for a beautiful look
  const COLORS = [
    '#2563eb', // Blue
    '#10b981', // Emerald  
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#84cc16'  // Lime
  ];

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
        >
          <p className="text-gray-800 dark:text-gray-200 font-medium">
            {payload[0].name}
          </p>
          <p className="text-blue-600 dark:text-blue-400 font-semibold">
            {formatCurrency(payload[0].value, currency.locale, currency.code)}
          </p>
        </motion.div>
      );
    }
    return null;
  };

  // Custom legend component
  const CustomLegend = ({ payload }) => {
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload.map((entry, index) => (
          <motion.div
            key={`legend-${index}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-2"
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
              {entry.value}
            </span>
          </motion.div>
        ))}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-800 backdrop-blur-sm"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <h3 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mb-2">
          {title}
        </h3>
        <div className="w-[185px] h-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full" />
      </motion.div>

      {/* Chart Container */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="relative"
      >
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => 
                percent > 5 ? `${(percent * 100).toFixed(0)}%` : ''
              }
              outerRadius={90}
              fill="#8884d8"
              dataKey="value"
              animationBegin={600}
              animationDuration={1000}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]}
                  className="hover:opacity-80 transition-opacity duration-200"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        
        <CustomLegend payload={data.map((entry, index) => ({
          color: COLORS[index % COLORS.length],
          value: entry.name || entry.category
        }))} />

        {/* Decorative elements */}
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full opacity-20 animate-pulse" />
        <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full opacity-20 animate-pulse" style={{ animationDelay: '1s' }} />
      </motion.div>

      {/* Summary Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-6 grid grid-cols-2 gap-4"
      >
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-4 rounded-xl">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Amount</p>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(data.reduce((sum, item) => sum + item.value, 0), currency.locale, currency.code)}
          </p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-4 rounded-xl">
          <p className="text-sm text-gray-600 dark:text-gray-400">Categories</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {data.length}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Chart;