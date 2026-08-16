// frontend/src/components/BudgetForm.jsx
import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Target, Coins, Calendar, Tag, Save, Loader, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';

const BudgetForm = ({ onClose, onSubmit, goal = null }) => {
  const [formData, setFormData] = useState({
    category: '',
    customCategory: '',
    amount: '',
    month: new Date().getMonth(),
    year: new Date().getFullYear()
  });
  const [availableCategories, setAvailableCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const { token } = useContext(AuthContext);

  // Month names for display
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Generate year options (current year + 2 future years)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear + i);

  // Load existing goal data if editing
  useEffect(() => {
    if (goal) {
      setFormData({
        category: goal.category,
        customCategory: '',
        amount: goal.amount.toString(),
        month: goal.month,
        year: goal.year
      });
    }
  }, [goal]);

  // Fetch available categories from existing transactions
  useEffect(() => {
    const fetchCategories = async () => {
      if (!token) return;
      
      try {
        const response = await api.get('/budget/categories');
        setAvailableCategories(response.data);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    fetchCategories();
  }, [token]);

  // Form validation
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.category.trim()) {
      newErrors.category = 'Category is required';
    }
    if (formData.category === 'Other' && (!formData.customCategory || !formData.customCategory.trim())) {
      newErrors.customCategory = 'Please specify a category';
    }
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle input changes
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear errors when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitted(true);
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      const budgetData = {
        ...formData,
        category: formData.category === 'Other' ? formData.customCategory : formData.category,
        amount: parseFloat(formData.amount),
        month: parseInt(formData.month),
        year: parseInt(formData.year)
      };

      await onSubmit(budgetData);
      
    } catch (error) {
      console.error('Error saving budget goal:', error);
      // The error will be handled by the parent component
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden max-w-md w-full"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold">
                {goal ? 'Edit Budget Goal' : 'Set Budget Goal'}
              </h2>
              <p className="text-green-100 text-sm">
                Plan your monthly spending limits
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </motion.button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Category Field */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Category
          </label>
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
              className={`w-full pl-12 pr-4 py-3 rounded-xl border-2 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                errors.category && isSubmitted
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : 'border-gray-200 dark:border-gray-600 focus:border-green-500 focus:ring-green-200'
              } focus:ring-4 focus:outline-none cursor-pointer`}
            >
              <option value="">Select a category</option>
              {[
                'Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 
                'Bills & Utilities', 'Healthcare', 'Education', 'Travel', 'Other'
              ].map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              {availableCategories
                .filter(cat => ![
                  'Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 
                  'Bills & Utilities', 'Healthcare', 'Education', 'Travel', 'Other'
                ].includes(cat.category))
                .map((cat) => (
                  <option key={cat.category} value={cat.category}>{cat.category}</option>
              ))}
            </select>
          </div>
          <AnimatePresence>
            {errors.category && isSubmitted && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-2 flex items-center space-x-1 text-red-600"
              >
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{errors.category}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {formData.category === 'Other' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Specify
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={formData.customCategory}
                onChange={(e) => handleChange('customCategory', e.target.value)}
                placeholder="Enter custom reason"
                className={`w-full pl-12 pr-4 py-3 rounded-xl border-2 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${
                  errors.customCategory && isSubmitted
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                    : 'border-gray-200 dark:border-gray-600 focus:border-green-500 focus:ring-green-200'
                } focus:ring-4 focus:outline-none`}
              />
            </div>
            <AnimatePresence>
              {errors.customCategory && isSubmitted && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-2 flex items-center space-x-1 text-red-600"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{errors.customCategory}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Amount Field */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Budget Amount
          </label>
          <div className="relative">
            <Coins className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => handleChange('amount', e.target.value)}
              placeholder="0.00"
              className={`w-full pl-12 pr-4 py-3 rounded-xl border-2 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${
                errors.amount && isSubmitted
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : 'border-gray-200 dark:border-gray-600 focus:border-green-500 focus:ring-green-200'
              } focus:ring-4 focus:outline-none`}
            />
          </div>
          <AnimatePresence>
            {errors.amount && isSubmitted && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-2 flex items-center space-x-1 text-red-600"
              >
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{errors.amount}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Month and Year Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Month
            </label>
            <select
              value={formData.month}
              onChange={(e) => handleChange('month', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-green-500 focus:ring-green-200 focus:ring-4 focus:outline-none transition-all duration-200"
            >
              {months.map((month, index) => (
                <option key={index} value={index}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Year
            </label>
            <select
              value={formData.year}
              onChange={(e) => handleChange('year', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-green-500 focus:ring-green-200 focus:ring-4 focus:outline-none transition-all duration-200"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Month/Year Display */}
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-800 dark:text-green-200">
              Budget for <strong>{months[formData.month]} {formData.year}</strong>
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <motion.button
          type="submit"
          disabled={isLoading}
          whileHover={!isLoading ? { scale: 1.02 } : {}}
          whileTap={!isLoading ? { scale: 0.98 } : {}}
          className={`w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-200 ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl'
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            {isLoading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Loader className="h-5 w-5" />
                </motion.div>
                <span>{goal ? 'Updating...' : 'Creating...'}</span>
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                <span>{goal ? 'Update Budget Goal' : 'Create Budget Goal'}</span>
              </>
            )}
          </div>
        </motion.button>
      </form>
    </motion.div>
  );
};

export default BudgetForm;
