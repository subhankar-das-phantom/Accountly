import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useApi, globalMutate } from "../hooks/useApi";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Calendar,
  Target,
  PieChart,
  BarChart3,
  RefreshCw,
  Filter,
  Download,
  AlertCircle,
  CheckCircle,
  Wallet,
} from "lucide-react";

import Chart from "../components/Chart";
import TransactionList from "../components/TransactionList";
import TransactionForm from "../components/TransactionForm";
import BudgetForm from "../components/BudgetForm";
import { AuthContext } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";
import { useTimeFilter } from "../context/TimeFilterContext";
import { formatCurrency } from "../utils/currency";
import Button from "../components/common/Button";
import Card from "../components/common/Card";

const HomePage = () => {
  const { token, user } = useContext(AuthContext);
  const { timeFilter, setTimeFilter } = useTimeFilter();

  const { data: allTransactionsRaw, isLoading: isLoadingTransactions, mutate: mutateTransactions, isValidating: isValidatingTransactions } = useApi(token ? 'transactions' : null);
  const { data: statsRaw, isLoading: isLoadingStats, isValidating: isValidatingStats } = useApi(token ? 'transactions/stats' : null);
  const { data: chartDataRaw, isLoading: isLoadingChart, isValidating: isValidatingChart } = useApi(token ? 'transactions/chart-data' : null);

  const allTransactions = Array.isArray(allTransactionsRaw?.transactions || allTransactionsRaw) ? (allTransactionsRaw?.transactions || allTransactionsRaw) : [];
  const recentTransactions = allTransactions.slice(0, 5);
  const stats = statsRaw || {
    totalIncomeAllTime: 0,
    totalExpensesAllTime: 0,
    netBalanceAllTime: 0,
    transactionCount: 0,
    currentMonth: { income: 0, expenses: 0, netBalance: 0 },
    previousMonth: { income: 0, expenses: 0, netBalance: 0 },
  };
  const chartData = chartDataRaw || [];

  const isLoading = isLoadingTransactions || isLoadingStats || isLoadingChart;
  const isRefreshing = isValidatingTransactions || isValidatingStats || isValidatingChart;

  const [showAddForm, setShowAddForm] = useState(false);
  const [editTransaction, setEditTransaction] = useState(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [editingBudgetGoal, setEditingBudgetGoal] = useState(null);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 },
    },
  };

  // handle budget goal submission
  const handleBudgetGoalSubmit = async (budgetData) => {
    try {
      if (editingBudgetGoal) {
        // Update existing budget goal
        await api.put(
          `budget/${editingBudgetGoal._id}`,
          budgetData
        );
      } else {
        // Create new budget goal
        await api.post("budget", budgetData);
      }

      // Close the form and reset editing state
      setShowBudgetForm(false);
      setEditingBudgetGoal(null);

      // Show success message
      if (typeof showNotification === "function") {
        showNotification(
          editingBudgetGoal
            ? "Budget goal updated successfully!"
            : "Budget goal created successfully!",
          "success"
        );
      }

      // Refresh data if needed
      await refreshData();
    } catch (error) {
      console.error("Error saving budget goal:", error);

      let errorMessage = "Failed to save budget goal. Please try again.";

      if (error.response?.status === 400) {
        errorMessage =
          error.response.data.message ||
          "Budget goal for this category and month already exists.";
      }

      if (typeof showNotification === "function") {
        showNotification(errorMessage, "error");
      } else {
        alert(errorMessage);
      }
    }
  };

  // notification function
  const showNotification = (message, type = "info") => {
    // Create notification element
    const notification = document.createElement("div");
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transform transition-all duration-300 ${
      type === "success"
        ? "bg-green-500 text-white"
        : type === "error"
        ? "bg-red-500 text-white"
        : type === "warning"
        ? "bg-yellow-500 text-black"
        : "bg-blue-500 text-white"
    }`;

    notification.innerHTML = `
    <div class="flex items-center space-x-2">
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        ${
          type === "success"
            ? '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>'
            : '<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>'
        }
      </svg>
      <span>${message}</span>
    </div>
  `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => (notification.style.transform = "translateX(0)"), 10);

    // Remove after 4 seconds
    setTimeout(() => {
      notification.style.transform = "translateX(100%)";
      setTimeout(() => document.body.removeChild(notification), 300);
    }, 4000);
  };



  // Helper to calculate percentage change
  const calculatePercentageChange = (current, previous) => {
    // Handle edge cases
    if (previous === 0) {
      if (current === 0) return "0%";
      return current > 0 ? "New!" : "New!"; // Show "New!" instead of infinity
    }

    const change = ((current - previous) / previous) * 100;
    const formattedChange =
      Math.abs(change) >= 1000
        ? change > 0
          ? "+999%+"
          : "-999%+" // Cap extremely high percentages
        : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;

    return formattedChange;
  };

  // Calculate changes for display (based on current month vs previous month from backend)
  const incomeChange =
    stats.currentMonth && stats.previousMonth
      ? calculatePercentageChange(
          stats.currentMonth.income,
          stats.previousMonth.income
        )
      : "N/A";

  const expensesChange =
    stats.currentMonth && stats.previousMonth
      ? calculatePercentageChange(
          stats.currentMonth.expenses,
          stats.previousMonth.expenses
        )
      : "N/A";

  const netBalanceChange =
    stats.currentMonth && stats.previousMonth
      ? calculatePercentageChange(
          stats.currentMonth.netBalance,
          stats.previousMonth.netBalance
        )
      : "N/A";

  // Refresh data
  const refreshData = async () => {
    mutateTransactions();
    globalMutate('transactions/stats');
    globalMutate('transactions/chart-data');
  };

  // Handle form submission
  const handleAddTransaction = async (transactionData) => {
    try {
      if (editTransaction) {
        await api.put(
          `transactions/${editTransaction._id}`,
          transactionData
        );
        setEditTransaction(null);
      } else {
        await api.post(
          "transactions",
          transactionData
        );
      }

      setShowAddForm(false);
      await refreshData();
    } catch (error) {
      console.error("Error saving transaction:", error);
    }
  };

  // Handle transaction edit
  const handleEditTransaction = (transaction) => {
    setEditTransaction(transaction);
    setShowAddForm(true);
  };

  // Handle transaction delete
  const handleDeleteTransaction = async (id) => {
    try {
      await api.delete(`transactions/${id}`);
      await refreshData();
    } catch (error) {
      console.error("Error deleting transaction:", error);
    }
  };

  // Calculate filtered stats based on time filter
  const getFilteredStats = () => {
    const now = new Date();
    let filteredTransactions = allTransactions;

    switch (timeFilter) {
      case "thisWeek":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filteredTransactions = allTransactions.filter(
          (t) => {
            const date = new Date(t.date);
            return date >= weekAgo && date <= now;
          }
        );
        break;
      case "thisMonth":
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        filteredTransactions = allTransactions.filter(
          (t) => {
            const date = new Date(t.date);
            return date >= monthStart && date <= now;
          }
        );
        break;
      case "thisYear":
        const yearStart = new Date(now.getFullYear(), 0, 1);
        filteredTransactions = allTransactions.filter(
          (t) => {
            const date = new Date(t.date);
            return date >= yearStart && date <= now;
          }
        );
        break;
      default:
        break;
    }

    const income = filteredTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const expenses = filteredTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    return {
      income,
      expenses,
      netBalance: income - expenses,
      count: filteredTransactions.length,
    };
  };

  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  const filteredStats = getFilteredStats();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"
                ></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
              <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* Header Section */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col md:flex-row md:items-center md:justify-between"
          >
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Welcome back, {user?.username}! 👋
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Here's your financial overview for today
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap mt-4 md:mt-0">
              {/* Time Filter */}
              <label htmlFor="time-filter" className="sr-only">Time Filter</label>
              <select
                id="time-filter"
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                aria-label="Filter transactions by time period"
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
              >
                <option value="thisWeek">This Week</option>
                <option value="thisMonth">This Month</option>
                <option value="thisYear">This Year</option>
                <option value="all">All Time</option>
              </select>

              {/* Refresh Button */}
              <Button
                variant="secondary"
                onClick={refreshData}
                disabled={isRefreshing}
                className="p-2"
                aria-label="Refresh data"
              >
                <RefreshCw
                  className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`}
                />
              </Button>

              {/* Add Transaction Button */}
              <Button
                onClick={() => {
                  setEditTransaction(null);
                  setShowAddForm(true);
                }}
                icon={Plus}
              >
                <span className="hidden sm:inline">Add Transaction</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </motion.div>

          {/* Stats Cards */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            <StatsCard
              title="Total Income"
              value={filteredStats.income}
              icon={TrendingUp}
              color="green"
              change={incomeChange}
            />
            <StatsCard
              title="Total Expenses"
              value={filteredStats.expenses}
              icon={TrendingDown}
              color="red"
              change={expensesChange}
            />
            <StatsCard
              title="Net Balance"
              value={filteredStats.netBalance}
              icon={Wallet}
              color={filteredStats.netBalance >= 0 ? "green" : "red"}
              change={netBalanceChange}
            />
            <StatsCard
              title="Transactions"
              value={filteredStats.count}
              icon={BarChart3}
              color="blue"
              change={`${filteredStats.count} total`}
              isCount={true}
            />
          </motion.div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Chart Section */}
            <motion.div variants={itemVariants}>
              <Chart data={chartData} title="Expense Categories" />
            </motion.div>

            {/* Recent Transactions */}
            <motion.div variants={itemVariants}>
              <TransactionList
                transactions={recentTransactions}
                onEdit={handleEditTransaction}
                onDelete={handleDeleteTransaction}
                isLoading={false}
              />
            </motion.div>
          </div>

          {/* Quick Actions */}
          <Card className="p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <QuickActionCard
                title="Download PDF Report"
                description="Comprehensive financial analysis"
                icon={Download}
                color="blue"
                onClick={async () => {
                  try {
                    // Show loading state
                    setIsGeneratingReport?.(true);

                    const response = await api.get(
                      "transactions/report",
                      {
                        responseType: "blob",
                      }
                    );

                    // Create download link
                    const url = window.URL.createObjectURL(
                      new Blob([response.data], { type: "application/pdf" })
                    );
                    const link = document.createElement("a");
                    link.href = url;

                    // Dynamic filename with date
                    const today = new Date().toISOString().split("T")[0];
                    link.setAttribute(
                      "download",
                      `Financial_Report_${today}.pdf`
                    );

                    // Trigger download
                    document.body.appendChild(link);
                    link.click();

                    // Cleanup
                    link.parentNode.removeChild(link);
                    window.URL.revokeObjectURL(url);

                    // Success notification
                    if (typeof showNotification === "function") {
                      showNotification(
                        "PDF report downloaded successfully!",
                        "success"
                      );
                    }
                  } catch (error) {
                    console.error("Error downloading PDF report:", error);

                    if (error.response?.status === 404) {
                      alert("No transactions found for report generation");
                    } else {
                      alert("Failed to generate PDF report. Please try again.");
                    }
                  } finally {
                    setIsGeneratingReport?.(false);
                  }
                }}
              />

              <QuickActionCard
                title="Set Budget Goal"
                description="Plan your monthly budget"
                icon={Target}
                color="green"
                onClick={() => {
                  setEditingBudgetGoal(null);
                  setShowBudgetForm(true);
                }}
              />
            </div>
          </Card>
        </motion.div>

        {/* Add/Edit Transaction Modal */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col items-center overflow-y-auto p-4 sm:p-6"
              onClick={() => {
                setShowAddForm(false);
                setEditTransaction(null);
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md my-auto flex-shrink-0"
              >
                <TransactionForm
                  onSubmit={handleAddTransaction}
                  transaction={editTransaction}
                  isLoading={false}
                  onClose={() => {
                    setShowAddForm(false);
                    setEditTransaction(null);
                  }}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Set Budget Goal Modal */}
        <AnimatePresence>
          {showBudgetForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col items-center overflow-y-auto p-4 sm:p-6"
              onClick={() => {
                setShowBudgetForm(false);
                setEditingBudgetGoal(null); // Add this line if you plan to support editing
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md my-auto flex-shrink-0"
              >
                <BudgetForm
                  onClose={() => {
                    setShowBudgetForm(false);
                    setEditingBudgetGoal?.(null); // Add this if you have editing state
                  }}
                  goal={editingBudgetGoal} // Add this if you support editing
                  onSubmit={async (budgetData) => {
                    try {
                      // Fix: Use correct API endpoint and include all required data
                      await api.post(
                        "budget", // Fixed endpoint
                        {
                          category: budgetData.category,
                          amount: budgetData.amount,
                          month: budgetData.month, // Now included
                          year: budgetData.year, // Now included
                        }
                      );

                      showNotification(
                        "Budget goal set successfully!",
                        "success"
                      );
                      setShowBudgetForm(false);

                      // Refresh data if you have a refresh function
                      if (typeof refreshData === "function") {
                        await refreshData();
                      }
                    } catch (error) {
                      console.error("Error setting budget goal:", error);

                      // Better error handling
                      let errorMessage = "Failed to set budget goal.";

                      if (error.response?.status === 400) {
                        errorMessage =
                          error.response.data.message ||
                          "Budget goal for this category and month already exists.";
                      }

                      showNotification(errorMessage, "error");
                    }
                  }}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const StatsCard = ({
  title,
  value,
  icon: Icon,
  color,
  change,
  isCount = false,
}) => {
  const { currency } = useCurrency();
  
  const colorClasses = {
    green:
      "from-emerald-500 to-teal-600 text-emerald-700 bg-emerald-50 dark:bg-emerald-600 dark:text-white",
    red: "from-red-500 to-rose-600 text-red-700 bg-red-50 dark:bg-red-600 dark:text-white",
    blue: "from-blue-500 to-cyan-600 text-blue-700 bg-blue-50 dark:bg-blue-600 dark:text-white",

  };

  const formatValue = (val) => {
    if (isCount) return val.toLocaleString();
    return formatCurrency(val, currency.locale, currency.code);
  };

  return (
    <Card
      whileHover={{ y: -4 }}
      className="p-6 transition-all duration-200"
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className={`p-3 rounded-xl bg-gradient-to-r ${
            colorClasses[color].split(" ")[0]
          } ${colorClasses[color].split(" ")[1]}`}
        >
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            colorClasses[color].split(" ")[2]
          } ${colorClasses[color].split(" ")[3]} ${
            colorClasses[color].split(" ")[4]
          } ${colorClasses[color].split(" ")[5] || ''} ${colorClasses[color].split(" ")[6] || ''}`}
        >
          {change}
        </div>
      </div>

      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
        {title}
      </h3>
      <p className="text-base sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
        {formatValue(value)}
      </p>
    </Card>
  );
};

// Quick Action Card Component
const QuickActionCard = ({
  title,
  description,
  icon: Icon,
  color,
  onClick,
}) => {
  const colorClasses = {
    blue: "text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20",
    green: "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20",

  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 transition-all duration-200 text-left ${colorClasses[color]}`}
    >
      <div className="flex items-start space-x-3">
        <Icon className="h-5 w-5 sm:h-6 sm:w-6 mt-1" />
        <div>
          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-1">
            {title}
          </h4>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        </div>
      </div>
    </motion.button>
  );
};

export default HomePage;
