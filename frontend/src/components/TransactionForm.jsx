import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Coins, 
  Calendar, 
  Tag, 
  FileText, 
  TrendingUp, 
  TrendingDown,
  Save,
  Plus,
  AlertCircle,
  X
} from 'lucide-react';

const TransactionForm = ({ onSubmit, transaction, isLoading = false, onClose }) => {
  const [formData, setFormData] = useState({
    type: 'expense',
    category: '',
    customCategory: '',
    amount: '',
    date: '',
    description: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Predefined categories
  const categories = {
    expense: [
      'Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 
      'Bills & Utilities', 'Healthcare', 'Education', 'Travel', 'Other'
    ],
    income: [
      'Salary', 'Freelance', 'Business', 'Investments', 
      'Rental', 'Gifts', 'Bonus', 'Other'
    ]
  };

  useEffect(() => {
    if (transaction) {
      const type = transaction.type || 'expense';
      const category = transaction.category || '';
      const isCustom = category && !categories[type].includes(category) && category !== 'Other';
      
      setFormData({
        type: type,
        category: isCustom ? 'Other' : category,
        customCategory: isCustom ? category : '',
        amount: transaction.amount || '',
        date: transaction.date ? transaction.date.substring(0, 10) : '',
        description: transaction.description || ''
      });
    }
  }, [transaction]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.category.trim()) newErrors.category = 'Category is required';
    if (formData.category === 'Other' && (!formData.customCategory || !formData.customCategory.trim())) {
      newErrors.customCategory = 'Please specify a category';
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    if (!formData.date) newErrors.date = 'Date is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitted(true);
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit({
        ...formData,
        category: formData.category === 'Other' ? formData.customCategory : formData.category,
        amount: parseFloat(formData.amount)
      });
      
      if (!transaction) {
        setFormData({
          type: 'expense',
          category: '',
          customCategory: '',
          amount: '',
          date: '',
          description: ''
        });
        setIsSubmitted(false);
      }
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const inputVariants = {
    focus: { scale: 1.02, transition: { duration: 0.2 } },
    blur: { scale: 1, transition: { duration: 0.2 } }
  };

  const buttonVariants = {
    idle: { scale: 1 },
    hover: { scale: 1.05, transition: { duration: 0.2 } },
    tap: { scale: 0.95, transition: { duration: 0.1 } }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-800"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-8 flex items-start justify-between"
      >
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mb-2">
            {transaction ? 'Edit Transaction' : 'Add New Transaction'}
          </h2>
          <div className="w-[185px] h-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full" />
        </div>
        {onClose && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            type="button"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
          >
            <X className="h-5 w-5" />
          </motion.button>
        )}
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Transaction Type */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Transaction Type
          </label>
          <div className="grid grid-cols-2 gap-4">
            {['expense', 'income'].map((type) => (
              <motion.button
                key={type}
                type="button"
                onClick={() => {
                  handleChange('type', type);
                  handleChange('category', ''); // Reset category when type changes
                }}
                variants={buttonVariants}
                initial="idle"
                whileHover="hover"
                whileTap="tap"
                className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                  formData.type === type
                    ? type === 'expense'
                      ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                      : 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 text-gray-600 dark:text-gray-400'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  {type === 'expense' ? (
                    <TrendingDown className="h-5 w-5" />
                  ) : (
                    <TrendingUp className="h-5 w-5" />
                  )}
                  <span className="font-medium capitalize">{type}</span>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Category Selection */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <FormField
            label="Category"
            icon={Tag}
            error={errors.category}
            isSubmitted={isSubmitted}
          >
            <motion.select
              variants={inputVariants}
              whileFocus="focus"
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
              className={`w-full pl-10 pr-4 py-3 rounded-xl border transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                errors.category && isSubmitted
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : 'border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-200 dark:focus:ring-blue-800'
              } focus:ring-2 focus:outline-none`}
            >
              <option value="">Select a category</option>
              {categories[formData.type].map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </motion.select>
          </FormField>

          {formData.category === 'Other' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4"
            >
              <FormField
                label="Specify"
                icon={Tag}
                error={errors.customCategory}
                isSubmitted={isSubmitted}
              >
                <motion.input
                  variants={inputVariants}
                  whileFocus="focus"
                  type="text"
                  value={formData.customCategory}
                  onChange={(e) => handleChange('customCategory', e.target.value)}
                  placeholder="Enter custom reason"
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                    errors.customCategory && isSubmitted
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                      : 'border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-200 dark:focus:ring-blue-800'
                  } focus:ring-2 focus:outline-none`}
                />
              </FormField>
            </motion.div>
          )}
        </motion.div>

        {/* Amount */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <FormField
            label="Amount"
            icon={Coins}
            error={errors.amount}
            isSubmitted={isSubmitted}
          >
            <motion.input
              variants={inputVariants}
              whileFocus="focus"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => handleChange('amount', e.target.value)}
              placeholder="0.00"
              className={`w-full pl-10 pr-4 py-3 rounded-xl border transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                errors.amount && isSubmitted
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : 'border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-200 dark:focus:ring-blue-800'
              } focus:ring-2 focus:outline-none`}
            />
          </FormField>
        </motion.div>

        {/* Date */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
        >
          <FormField
            label="Date"
            icon={Calendar}
            error={errors.date}
            isSubmitted={isSubmitted}
          >
            <motion.input
              variants={inputVariants}
              whileFocus="focus"
              type="date"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              className={`w-full pl-10 pr-4 py-3 rounded-xl border transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                errors.date && isSubmitted
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : 'border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-200 dark:focus:ring-blue-800'
              } focus:ring-2 focus:outline-none`}
            />
          </FormField>
        </motion.div>

        {/* Description */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
        >
          <FormField
            label="Description"
            icon={FileText}
            error={errors.description}
            isSubmitted={isSubmitted}
          >
            <motion.textarea
              variants={inputVariants}
              whileFocus="focus"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Enter transaction details..."
              rows="3"
              className={`w-full pl-10 pr-4 py-3 rounded-xl border transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none ${
                errors.description && isSubmitted
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : 'border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-200 dark:focus:ring-blue-800'
              } focus:ring-2 focus:outline-none`}
            />
          </FormField>
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="pt-6"
        >
          <motion.button
            type="submit"
            disabled={isLoading}
            variants={buttonVariants}
            initial="idle"
            whileHover={!isLoading ? "hover" : "idle"}
            whileTap={!isLoading ? "tap" : "idle"}
            className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200 ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 shadow-lg hover:shadow-xl'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                />
              ) : transaction ? (
                <Save className="h-5 w-5" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
              <span>
                {isLoading ? 'Processing...' : transaction ? 'Update Transaction' : 'Add Transaction'}
              </span>
            </div>
          </motion.button>
        </motion.div>
      </form>
    </motion.div>
  );
};

// FormField component for consistent field styling
const FormField = ({ label, icon: Icon, children, error, isSubmitted }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      {label}
    </label>
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
      {children}
    </div>
    <AnimatePresence>
      {error && isSubmitted && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mt-2 flex items-center space-x-1 text-red-600"
        >
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export default TransactionForm;
