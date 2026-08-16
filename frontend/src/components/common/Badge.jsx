import React from 'react';

const variants = {
  primary: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  info: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const Badge = ({ children, variant = 'primary', className = '' }) => {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
