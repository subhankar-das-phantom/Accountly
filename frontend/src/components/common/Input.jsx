import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

const Input = ({
  label,
  type = 'text',
  name,
  value,
  onChange,
  placeholder,
  error,
  icon: Icon,
  rightIcon,
  className = '',
  containerClassName = '',
  ...props
}) => {
  return (
    <div className={`w-full ${containerClassName}`}>
      {label && (
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full ${Icon ? 'pl-12' : 'pl-4'} ${rightIcon ? 'pr-12' : 'pr-4'} py-3 rounded-xl border-2 transition-all duration-200 
            bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400
            ${error 
              ? 'border-red-400 focus:border-red-500 focus:ring-red-200' 
              : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-200 dark:focus:ring-blue-800'
            } focus:ring-4 focus:outline-none ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
            {rightIcon}
          </div>
        )}
      </div>
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-2 flex items-center space-x-1 text-red-600 text-sm"
          >
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Input;
