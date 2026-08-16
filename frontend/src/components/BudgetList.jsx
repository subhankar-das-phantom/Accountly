import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit, Trash2, Target, Calendar, Coins, TrendingUp, AlertCircle } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import { formatCurrency } from '../utils/currency';

const BudgetList = ({ goals = [], onEdit, onDelete }) => {
  const { currency } = useCurrency();
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getMonthStatus = (month, year) => {
    const now = new Date();
    const goalDate = new Date(year, month);
    const currentDate = new Date(now.getFullYear(), now.getMonth());

    if (goalDate < currentDate) {
      return { label: 'Past', color: 'text-gray-500 bg-gray-100 dark:bg-gray-700' };
    } else if (goalDate.getTime() === currentDate.getTime()) {
      return { label: 'Current', color: 'text-green-600 bg-green-100 dark:bg-green-900/30' };
    } else {
      return { label: 'Upcoming', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' };
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3 }
    },
    exit: {
      opacity: 0,
      x: -100,
      transition: { duration: 0.2 }
    }
  };

  if (goals.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700"
      >
        <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">No budget goals yet</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">Create your first budget goal to get started</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      <AnimatePresence mode="popLayout">
        {goals.map((goal, index) => {
          const status = getMonthStatus(goal.month, goal.year);
          
          return (
            <motion.div
              key={goal._id}
              variants={itemVariants}
              layout
              whileHover={{ scale: 1.02 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-shadow duration-300"
            >
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 mb-3">
                      <div className="p-2 sm:p-2.5 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex-shrink-0">
                        <Target className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm sm:text-lg text-gray-900 dark:text-white truncate">
                          {goal.category}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                              {months[goal.month]} {goal.year}
                            </span>
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <Coins className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <span className="text-lg sm:text-2xl lg:text-2xl font-bold text-gray-900 dark:text-white break-words">
                      {formatCurrency(goal.amount, currency.locale, currency.code)}
                    </span>
                      <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">budget</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 ml-2 flex-shrink-0">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onEdit(goal)}
                      className="p-2 sm:p-2.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      title="Edit budget goal"
                    >
                      <Edit className="h-5 w-5" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onDelete(goal._id)}
                      className="p-2 sm:p-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      title="Delete budget goal"
                    >
                      <Trash2 className="h-5 w-5" />
                    </motion.button>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 px-4 sm:px-5 py-2.5 sm:py-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                    <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                    <span className="truncate">Track your spending against this goal</span>
                  </div>
                  {status.label === 'Current' && (
                    <span className="text-green-600 dark:text-green-400 font-medium flex-shrink-0 ml-2">Active Now</span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
};

export default BudgetList;
