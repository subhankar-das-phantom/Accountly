import React from 'react';
import { motion } from 'framer-motion';
import { Loader } from 'lucide-react';

const variants = {
  primary: 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl',
  secondary: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm',
  outline: 'bg-transparent border-2 border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',
  ghost: 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent',
  danger: 'bg-red-500 hover:bg-red-600 text-white shadow-md hover:shadow-lg',
};

const sizes = {
  sm: 'px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm',
  md: 'px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base',
  lg: 'px-5 sm:px-6 py-2.5 sm:py-3.5 text-base sm:text-lg',
};

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  isLoading = false, 
  disabled = false, 
  icon: Icon,
  type = 'button',
  onClick,
  ...props 
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed';
  
  return (
    <motion.button
      type={type}
      whileHover={!disabled && !isLoading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !isLoading ? { scale: 0.98 } : {}}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      onClick={onClick}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader className="w-5 h-5 mr-2 animate-spin" />
          <span>Loading...</span>
        </>
      ) : (
        <>
          {Icon && <Icon className={`w-5 h-5 ${children ? 'mr-2' : ''}`} />}
          {children}
        </>
      )}
    </motion.button>
  );
};

export default Button;
