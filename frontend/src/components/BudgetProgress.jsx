import React from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Coins,
  Target,
  Activity,
  Clock,
} from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import { formatCurrency } from '../utils/currency';

const BudgetProgress = ({ progress }) => {
  const { currency } = useCurrency();
  
  if (!progress || !progress.budgetProgress) {
    return null;
  }

  const { budgetProgress, summary } = progress;

  const getStatusColor = (status) => {
    switch (status) {
      case 'over':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return 'bg-green-500';
    }
  };

  const getStatusBgColor = (status) => {
    switch (status) {
      case 'over':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      default:
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'over':
        return <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case 'warning':
        return <Activity className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />;
    }
  };

  const getStatusMessage = (item) => {
    if (item.percentageUsed >= 100) {
      return `Over budget by ${formatCurrency(item.actualSpent - item.budgetAmount, currency.locale, currency.code)}`;
    } else if (item.percentageUsed >= 80) {
      return `${(100 - item.percentageUsed).toFixed(0)}% budget remaining`;
    } else {
      return `You're doing great! ${item.percentageUsed.toFixed(0)}% used`;
    }
  };

  const calculateDaysInMonth = () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.getDate();
  };

  const getCurrentDay = () => {
    return new Date().getDate();
  };

  const daysInMonth = calculateDaysInMonth();
  const currentDay = getCurrentDay();
  const daysRemaining = daysInMonth - currentDay;
  const monthProgress = (currentDay / daysInMonth) * 100;

  const getSpendingPace = (item) => {
    const expectedSpending = (item.budgetAmount * monthProgress) / 100;
    const difference = item.actualSpent - expectedSpending;
    const percentDiff = (difference / expectedSpending) * 100;

    if (Math.abs(percentDiff) < 10) {
      return { status: 'on-track', message: 'On track', color: 'text-green-600 dark:text-green-400' };
    } else if (difference > 0) {
      return { status: 'over-pace', message: `${Math.abs(percentDiff).toFixed(0)}% over pace`, color: 'text-orange-600 dark:text-orange-400' };
    } else {
      return { status: 'under-pace', message: `${Math.abs(percentDiff).toFixed(0)}% under pace`, color: 'text-blue-600 dark:text-blue-400' };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            Budget Progress
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Current month's spending vs budget goals
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {daysRemaining} days left
          </span>
        </div>
      </div>

      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Month Progress</span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Day {currentDay} of {daysInMonth}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${monthProgress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500"
          />
        </div>
      </div>

      <div className="space-y-4">
        {budgetProgress.map((item, index) => {
          const pace = getSpendingPace(item);
          const percentCapped = Math.min(item.percentageUsed, 100);
          
          return (
            <motion.div
              key={item.category}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`border rounded-xl p-4 ${getStatusBgColor(item.status)}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(item.status)}
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">
                      {item.category}
                    </h4>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {getStatusMessage(item)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatCurrency(item.actualSpent, currency.locale, currency.code)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    of {formatCurrency(item.budgetAmount, currency.locale, currency.code)}
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentCapped}%` }}
                    transition={{ duration: 0.8, delay: index * 0.1 }}
                    className={`h-3 rounded-full ${getStatusColor(item.status)}`}
                    style={{
                      boxShadow: item.status === 'over' 
                        ? 'inset 0 2px 4px rgba(0,0,0,0.3)' 
                        : 'none'
                    }}
                  />
                </div>
                
                {item.percentageUsed > 100 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="absolute -top-1 right-0 px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full"
                  >
                    {item.percentageUsed.toFixed(0)}%
                  </motion.div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Remaining</div>
                  <div className={`text-sm font-semibold ${
                    item.remaining >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatCurrency(Math.abs(item.remaining), currency.locale, currency.code)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Transactions</div>
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {item.transactionCount}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Spending Pace</div>
                  <div className={`text-xs font-medium ${pace.color}`}>
                    {pace.message}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Coins className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Total Budget
              </span>
            </div>
            <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
              {formatCurrency(summary.totalBudget, currency.locale, currency.code)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Across {summary.categoriesCount} categories
            </div>
          </div>

          <div className={`rounded-xl p-4 ${
            summary.totalSpent > summary.totalBudget
              ? 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20'
              : 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-2 rounded-lg ${
                summary.totalSpent > summary.totalBudget ? 'bg-red-500' : 'bg-green-500'
              }`}>
                {summary.totalSpent > summary.totalBudget ? (
                  <TrendingUp className="h-4 w-4 text-white" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-white" />
                )}
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Total Spent
              </span>
            </div>
            <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
              {formatCurrency(summary.totalSpent, currency.locale, currency.code)}
            </div>
            <div className={`text-xs font-medium mt-1 ${
              summary.totalSpent > summary.totalBudget
                ? 'text-red-600 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'
            }`}>
              {summary.overallPercentageUsed.toFixed(1)}% of total budget
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-xl text-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-sm opacity-90 mb-1">Total Remaining</div>
              <div className="text-xl sm:text-3xl font-bold truncate">
                {formatCurrency(summary.totalRemaining, currency.locale, currency.code)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm opacity-90 mb-1">Avg per day</div>
              <div className="text-lg sm:text-xl font-semibold truncate">
                {daysRemaining > 0 
                  ? formatCurrency(summary.totalRemaining / daysRemaining, currency.locale, currency.code)
                  : 'Last day!'
                }
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default BudgetProgress;
