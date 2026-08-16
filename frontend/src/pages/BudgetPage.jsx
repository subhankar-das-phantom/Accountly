import React, { useState, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi, globalMutate } from '../hooks/useApi';
import { 
  Target, 
  Plus, 
  TrendingUp, 
  AlertCircle, 
  DollarSign, 
  Calendar,
  PieChart,
  ArrowUp,
  ArrowDown,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingDown,
  Coins
} from 'lucide-react';
import BudgetForm from '../components/BudgetForm';
import BudgetList from '../components/BudgetList';
import BudgetProgress from '../components/BudgetProgress';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useTimeFilter } from '../context/TimeFilterContext';
import { formatCurrency } from '../utils/currency';
import Button from '../components/common/Button';
import Card from '../components/common/Card';

const BudgetPage = () => {
  const { token } = useContext(AuthContext);
  const { currency } = useCurrency();
  const { timeFilter } = useTimeFilter();

  const { data: budgetGoalsRaw, isLoading: isGoalsLoading, mutate: mutateGoals, isValidating: isGoalsValidating } = useApi(token ? '/budget' : null);
  const { data: budgetProgressRaw, isLoading: isProgressLoading, mutate: mutateProgress, isValidating: isProgressValidating } = useApi(token ? '/budget/progress' : null, { refreshInterval: 30000 });

  const budgetGoals = budgetGoalsRaw || [];
  const budgetProgress = budgetProgressRaw || null;
  const isLoading = isGoalsLoading || isProgressLoading;
  const isRefreshing = isGoalsValidating || isProgressValidating;

  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const refreshData = () => {
    mutateGoals();
    mutateProgress();
  };

  const handleSubmit = async (budgetData) => {
    try {
      if (editingGoal) {
        await api.put(`/budget/${editingGoal._id}`, budgetData);
        setSuccessMessage('Budget goal updated successfully!');
      } else {
        await api.post('/budget', budgetData);
        setSuccessMessage('Budget goal created successfully!');
      }
      
      refreshData();
      
      setShowForm(false);
      setEditingGoal(null);
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error saving budget goal:', err);
      setError(err.response?.data?.message || 'Failed to save budget goal');
      setTimeout(() => setError(null), 5000);
      throw err;
    }
  };

  const handleEdit = (goal) => {
    setEditingGoal(goal);
    setShowForm(true);
  };

  const handleDelete = async (goalId) => {
    if (!window.confirm('Are you sure you want to delete this budget goal?')) {
      return;
    }
    
    try {
      await api.delete(`/budget/${goalId}`);
      setSuccessMessage('Budget goal deleted successfully!');
      
      refreshData();
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error deleting budget goal:', err);
      setError('Failed to delete budget goal');
      setTimeout(() => setError(null), 5000);
    }
  };

  const stats = budgetProgress?.summary || {
    totalBudget: 0,
    totalSpent: 0,
    totalRemaining: 0,
    overallPercentageUsed: 0,
    categoriesCount: 0
  };

  const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

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
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pt-20 pb-24 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <div className="p-2 sm:p-2.5 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
                  <Target className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                </div>
                <span className="truncate">Budget Management</span>
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {currentMonth}
                </span>
                {timeFilter !== 'all' && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                    Filtered: {timeFilter === 'thisWeek' ? 'This Week' : timeFilter === 'thisMonth' ? 'This Month' : 'This Year'}
                  </span>
                )}
              </p>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="secondary"
                onClick={refreshData}
                disabled={isRefreshing}
                className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl min-w-[44px]"
              >
                <motion.div
                  animate={isRefreshing ? { rotate: 360 } : {}}
                  transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}
                  className="sm:mr-2"
                >
                  <RefreshCw className="h-5 w-5" />
                </motion.div>
                <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              </Button>

              <Button
                onClick={() => {
                  setEditingGoal(null);
                  setShowForm(true);
                }}
                className="bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg hover:shadow-xl min-w-[44px]"
                icon={Plus}
              >
                <span className="hidden sm:inline">New Budget Goal</span>
              </Button>
            </div>
          </motion.div>
        </div>

        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-3 text-green-800 dark:text-green-200"
            >
              <Sparkles className="h-5 w-5" />
              <span>{successMessage}</span>
            </motion.div>
          )}
          
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-blue-500 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-800 dark:text-red-200"
            >
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="h-12 w-12 text-green-600" />
            </motion.div>
          </div>
        )}

        {!isLoading && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Coins className="h-6 w-6" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium opacity-90">Total Budget</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold mb-1 truncate">
                  {formatCurrency(stats.totalBudget, currency.locale, currency.code)}
                </p>
                <p className="text-xs sm:text-sm opacity-75">Allocated this month</p>
              </Card>

              <Card className={`text-white border-none ${
                stats.totalSpent > stats.totalBudget
                  ? 'bg-gradient-to-br from-red-500 to-red-600'
                  : 'bg-gradient-to-br from-orange-500 to-orange-600'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <TrendingDown className="h-6 w-6" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium opacity-90">Total Spent</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold mb-1 truncate">
                  {formatCurrency(stats.totalSpent, currency.locale, currency.code)}
                </p>
                <p className="text-xs sm:text-sm opacity-75">
                  {stats.overallPercentageUsed.toFixed(1)}% of budget
                </p>
              </Card>

              <Card className={`text-white border-none ${
                stats.totalRemaining >= 0
                  ? 'bg-gradient-to-br from-green-500 to-green-600'
                  : 'bg-gradient-to-br from-red-500 to-red-600'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <ArrowUp className="h-6 w-6" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium opacity-90">Remaining</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold mb-1 truncate">
                  {formatCurrency(Math.abs(stats.totalRemaining), currency.locale, currency.code)}
                </p>
                <p className="text-xs sm:text-sm opacity-75">
                  {stats.totalRemaining >= 0 ? 'Still available' : 'Over budget'}
                </p>
              </Card>

              <Card className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-none">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <PieChart className="h-6 w-6" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium opacity-90">Categories</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold mb-1 truncate">
                  {stats.categoriesCount}
                </p>
                <p className="text-xs sm:text-sm opacity-75">Budget goals set</p>
              </Card>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <motion.div variants={itemVariants}>
                {budgetProgress && budgetProgress.budgetProgress.length > 0 ? (
                  <BudgetProgress progress={budgetProgress} />
                ) : (
                  <Card className="text-center p-8">
                    <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">
                      No budget progress yet
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">
                      Create your first budget goal to start tracking
                    </p>
                  </Card>
                )}
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="p-6">
                  <h3 className="text-xl font-bold mb-6 text-gray-800 dark:text-white flex items-center gap-2">
                    <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    Your Budget Goals
                  </h3>
                  {budgetGoals.length > 0 ? (
                    <BudgetList 
                      goals={budgetGoals} 
                      onEdit={handleEdit} 
                      onDelete={handleDelete} 
                    />
                  ) : (
                    <div className="text-center py-12">
                      <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">
                        No budget goals yet
                      </p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">
                        Click "New Budget Goal" to get started
                      </p>
                    </div>
                  )}
                </Card>
              </motion.div>
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col items-center overflow-y-auto p-4 sm:p-6"
            onClick={() => {
              setShowForm(false);
              setEditingGoal(null);
            }}
          >
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md my-auto flex-shrink-0">
              <BudgetForm
                onClose={() => {
                  setShowForm(false);
                  setEditingGoal(null);
                }}
                onSubmit={handleSubmit}
                goal={editingGoal}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default BudgetPage;
