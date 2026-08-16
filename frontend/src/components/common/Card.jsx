import React from 'react';
import { motion } from 'framer-motion';

const Card = ({ children, className = '', ...props }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 sm:p-6 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default Card;
