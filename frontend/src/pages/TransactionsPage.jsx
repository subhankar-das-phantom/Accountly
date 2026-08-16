import React, { useState, useEffect, useContext } from "react";
import api from "../services/api";
import { useApi, globalMutate } from "../hooks/useApi";
import { motion, AnimatePresence } from "framer-motion";
import { AuthContext } from "../context/AuthContext";
import TransactionList from "../components/TransactionList";
import useDebounce from "../hooks/useDebounce";
import * as XLSX from "xlsx";
import TransactionForm from "../components/TransactionForm";
import {
  Plus,
  Filter,
  Download,
  Search,
  Calendar,
  TrendingUp,
  TrendingDown,
  Wallet,
  RefreshCw,
  BarChart3,
  X,
  FileSpreadsheet,
  FileText,
  File,
  CheckCircle2,
  SortAsc,
} from "lucide-react";
import { useCurrency } from "../context/CurrencyContext";
import { useTimeFilter } from "../context/TimeFilterContext";
import { formatCurrency as formatCurrencyUtil } from "../utils/currency";
import Button from "../components/common/Button";
import Card from "../components/common/Card";

const TransactionsPage = () => {
  const { currency } = useCurrency();
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDateRange, setExportDateRange] = useState({
    startDate: "",
    endDate: "",
    preset: "all",
  });
  const [exportFormat, setExportFormat] = useState("excel");

  // Filter and sort states
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [filters, setFilters] = useState({
    type: "",
    category: "",
    dateFrom: "",
    dateTo: "",
    minAmount: "",
    maxAmount: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  const { token } = useContext(AuthContext);
  const { timeFilter, setTimeFilter, getDateRange } = useTimeFilter();

  // Debounced search term
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Predefined categories
  const categories = [
    "Food & Dining",
    "Transportation",
    "Shopping",
    "Entertainment",
    "Bills & Utilities",
    "Healthcare",
    "Education",
    "Travel",
    "Salary",
    "Freelance",
    "Business",
    "Investments",
    "Other",
  ];

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
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

  // Build query string based on filters
  const buildQueryString = () => {
    const params = new URLSearchParams();

    // Add global time filter
    const { startDate, endDate } = getDateRange();
    if (startDate) {
      params.append("dateFrom", startDate.toISOString().split('T')[0]);
    }
    if (endDate) {
      params.append("dateTo", endDate.toISOString().split('T')[0]);
    }

    // Add all filter parameters
    if (debouncedSearchTerm) params.append("search", debouncedSearchTerm);
    if (filters.type) params.append("type", filters.type);
    if (filters.category) params.append("category", filters.category);
    if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.append("dateTo", filters.dateTo);
    if (filters.minAmount) params.append("minAmount", filters.minAmount);
    if (filters.maxAmount) params.append("maxAmount", filters.maxAmount);
    if (sortBy) params.append("sortBy", sortBy);
    if (sortOrder) params.append("sortOrder", sortOrder);

    return params.toString();
  };

  const queryString = buildQueryString();
  const { data: rawData, isLoading, mutate: mutateTransactions, isValidating } = useApi(
    token ? `transactions?${queryString}` : null
  );

  const isRefreshing = isValidating;
  const transactions = rawData?.transactions || rawData || [];

  // Calculate stats from the current dataset
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const expenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const stats = {
    totalIncome: income,
    totalExpenses: expenses,
    netBalance: income - expenses,
    transactionCount: transactions.length,
  };

  const refreshData = async () => {
    mutateTransactions();
  };

  const handleSubmit = async (transactionData) => {
    try {
      if (editingTransaction) {
        await api.put(
          `transactions/${editingTransaction._id}`,
          transactionData
        );
        setEditingTransaction(null);
      } else {
        await api.post("transactions", transactionData);
      }

      setShowAddForm(false);
      mutateTransactions(); // Refresh local list
      globalMutate('transactions/stats'); // Refresh dashboard stats
      globalMutate('transactions/chart-data'); // Refresh dashboard charts
    } catch (error) {
      console.error("Error saving transaction:", error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this transaction?")) {
      return;
    }

    try {
      await api.delete(`transactions/${id}`);
      mutateTransactions();
      globalMutate('transactions/stats');
      globalMutate('transactions/chart-data');
    } catch (error) {
      console.error("Error deleting transaction:", error);
    }
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setShowAddForm(true);
  };

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSortBy("date");
    setSortOrder("desc");
    setFilters({
      type: "",
      category: "",
      dateFrom: "",
      dateTo: "",
      minAmount: "",
      maxAmount: "",
    });
  };

  const formatCurrency = (value) => {
    return formatCurrencyUtil(value, currency.locale, currency.code);
  };

  const getPresetDates = (preset) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (preset) {
      case "thisMonth":
        return {
          startDate: new Date(now.getFullYear(), now.getMonth(), 1)
            .toISOString()
            .split("T")[0],
          endDate: today.toISOString().split("T")[0],
        };
      case "lastMonth":
        return {
          startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1)
            .toISOString()
            .split("T")[0],
          endDate: new Date(now.getFullYear(), now.getMonth(), 0)
            .toISOString()
            .split("T")[0],
        };
      case "thisYear":
        return {
          startDate: new Date(now.getFullYear(), 0, 1)
            .toISOString()
            .split("T")[0],
          endDate: today.toISOString().split("T")[0],
        };
      case "last30Days":
        return {
          startDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          endDate: today.toISOString().split("T")[0],
        };
      case "last90Days":
        return {
          startDate: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          endDate: today.toISOString().split("T")[0],
        };
      default:
        return { startDate: "", endDate: "" };
    }
  };

  const getFilteredTransactionsByDate = () => {
    let transactionsToExport = [...transactions];

    if (exportDateRange.startDate && exportDateRange.endDate) {
      const startDate = new Date(exportDateRange.startDate);
      const endDate = new Date(exportDateRange.endDate);
      endDate.setHours(23, 59, 59, 999);

      transactionsToExport = transactionsToExport.filter((t) => {
        const transactionDate = new Date(t.date);
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    }

    return transactionsToExport;
  };

  const calculateRangeStats = (transactions) => {
    const rangeIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const rangeExpenses = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    return {
      totalIncome: rangeIncome,
      totalExpenses: rangeExpenses,
      netBalance: rangeIncome - rangeExpenses,
      transactionCount: transactions.length,
    };
  };

  const exportToExcel = (transactionsToExport, rangeStats, dateRangeStr) => {
    const wb = XLSX.utils.book_new();

    // SHEET 1: ALL TRANSACTIONS
    const transactionData = [
      ["TRANSACTION REPORT"],
      [`Period: ${dateRangeStr}`],
      [
        `Generated: ${new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}`,
      ],
      [
        `Total Transactions: ${rangeStats.transactionCount} | Income: ${formatCurrency(rangeStats.totalIncome)} | Expenses: ${formatCurrency(rangeStats.totalExpenses)} | Net: ${formatCurrency(rangeStats.netBalance)}`,
      ],
      [],
      ["Date", "Type", "Category", "Description", "Amount", "Running Balance"],
    ];

    let runningBalance = 0;
    const sortedTransactions = [...transactionsToExport].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    sortedTransactions.forEach((t) => {
      const amount = parseFloat(t.amount);
      if (t.type === "income") {
        runningBalance += amount;
      } else {
        runningBalance -= amount;
      }

      transactionData.push([
        new Date(t.date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "2-digit",
        }),
        t.type.toUpperCase(),
        t.category,
        t.description || "",
        t.type === "income" ? amount.toFixed(2) : `-${amount.toFixed(2)}`,
        runningBalance.toFixed(2),
      ]);
    });

    transactionData.push(
      [],
      ["TOTALS", "", "", "", "", ""],
      ["Total Income", "", "", "", rangeStats.totalIncome.toFixed(2), ""],
      ["Total Expenses", "", "", "", rangeStats.totalExpenses.toFixed(2), ""],
      ["Net Balance", "", "", "", rangeStats.netBalance.toFixed(2), ""]
    );

    const wsTransactions = XLSX.utils.aoa_to_sheet(transactionData);
    wsTransactions["!cols"] = [
      { wch: 15 },
      { wch: 10 },
      { wch: 20 },
      { wch: 40 },
      { wch: 15 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, wsTransactions, "All Transactions");

    // SHEET 2: INCOME
    const incomeTransactions = transactionsToExport.filter(
      (t) => t.type === "income"
    );
    if (incomeTransactions.length > 0) {
      const incomeData = [
        ["INCOME TRANSACTIONS"],
        [`Period: ${dateRangeStr}`],
        [
          `Total Income: ${formatCurrency(rangeStats.totalIncome)} | Count: ${incomeTransactions.length}`,
        ],
        [],
        ["Date", "Category", "Description", "Amount"],
      ];

      incomeTransactions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach((t) => {
          incomeData.push([
            new Date(t.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "2-digit",
            }),
            t.category,
            t.description || "",
            parseFloat(t.amount).toFixed(2),
          ]);
        });

      incomeData.push([], ["TOTAL", "", "", rangeStats.totalIncome.toFixed(2)]);

      const wsIncome = XLSX.utils.aoa_to_sheet(incomeData);
      wsIncome["!cols"] = [
        { wch: 15 },
        { wch: 20 },
        { wch: 40 },
        { wch: 15 },
      ];
      XLSX.utils.book_append_sheet(wb, wsIncome, "Income");
    }

    // SHEET 3: EXPENSES
    const expenseTransactions = transactionsToExport.filter(
      (t) => t.type === "expense"
    );
    if (expenseTransactions.length > 0) {
      const expenseData = [
        ["EXPENSE TRANSACTIONS"],
        [`Period: ${dateRangeStr}`],
        [
          `Total Expenses: ${formatCurrency(rangeStats.totalExpenses)} | Count: ${expenseTransactions.length}`,
        ],
        [],
        ["Date", "Category", "Description", "Amount"],
      ];

      expenseTransactions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach((t) => {
          expenseData.push([
            new Date(t.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "2-digit",
            }),
            t.category,
            t.description || "",
            parseFloat(t.amount).toFixed(2),
          ]);
        });

      expenseData.push(
        [],
        ["TOTAL", "", "", rangeStats.totalExpenses.toFixed(2)]
      );

      const wsExpense = XLSX.utils.aoa_to_sheet(expenseData);
      wsExpense["!cols"] = [
        { wch: 15 },
        { wch: 20 },
        { wch: 40 },
        { wch: 15 },
      ];
      XLSX.utils.book_append_sheet(wb, wsExpense, "Expenses");
    }

    // SHEET 4: CATEGORY BREAKDOWN
    const categoryMap = {};
    transactionsToExport.forEach((t) => {
      if (!categoryMap[t.category]) {
        categoryMap[t.category] = { income: 0, expense: 0, count: 0, net: 0 };
      }
      const amount = parseFloat(t.amount);
      if (t.type === "income") {
        categoryMap[t.category].income += amount;
        categoryMap[t.category].net += amount;
      } else {
        categoryMap[t.category].expense += amount;
        categoryMap[t.category].net -= amount;
      }
      categoryMap[t.category].count += 1;
    });

    const categoryData = [
      ["CATEGORY BREAKDOWN"],
      [`Period: ${dateRangeStr}`],
      [`Total Categories: ${Object.keys(categoryMap).length}`],
      [],
      [
        "Category",
        "Income",
        "Expenses",
        "Net",
        "Transactions",
        "Avg per Transaction",
      ],
    ];

    Object.entries(categoryMap)
      .sort(
        (a, b) =>
          Math.abs(b[1].income + b[1].expense) -
          Math.abs(a[1].income + a[1].expense)
      )
      .forEach(([category, data]) => {
        categoryData.push([
          category,
          data.income.toFixed(2),
          data.expense.toFixed(2),
          data.net.toFixed(2),
          data.count,
          ((data.income + data.expense) / data.count).toFixed(2),
        ]);
      });

    const wsCategory = XLSX.utils.aoa_to_sheet(categoryData);
    wsCategory["!cols"] = [
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsCategory, "By Category");

    let filename = `Transactions_${dateRangeStr.replace(/\s/g, "_")}`;
    if (filters.type) filename += `_${filters.type}`;
    filename += ".xlsx";

    XLSX.writeFile(wb, filename);
    return filename;
  };

  const exportToCSV = (transactionsToExport, dateRangeStr) => {
    const csvContent = [
      ["Date", "Type", "Category", "Description", "Amount"],
      ...transactionsToExport
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map((t) => [
          new Date(t.date).toLocaleDateString(),
          t.type,
          t.category,
          t.description || "",
          t.amount,
        ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    let filename = `Transactions_${dateRangeStr.replace(/\s/g, "_")}.csv`;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
    return filename;
  };

  const exportToPDF = async (dateRangeStr) => {
    try {
      const params = new URLSearchParams();
      if (exportDateRange.startDate) params.append('startDate', exportDateRange.startDate);
      if (exportDateRange.endDate) params.append('endDate', exportDateRange.endDate);
      if (filters.type) params.append('type', filters.type);
      if (filters.category) params.append('category', filters.category);

      const response = await api.get(`transactions/report?${params.toString()}`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      let filename = `Transactions_Report_${dateRangeStr.replace(/\s/g, '_')}.pdf`;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      return filename;
    } catch (error) {
      console.error('Error exporting PDF:', error);
      throw error;
    }
  };

  const handleExport = async () => {
    try {
      const transactionsToExport = getFilteredTransactionsByDate();

      if (transactionsToExport.length === 0) {
        alert("No transactions found in the selected date range.");
        return;
      }

      const rangeStats = calculateRangeStats(transactionsToExport);

      const dateRangeStr =
        exportDateRange.startDate && exportDateRange.endDate
          ? `${new Date(exportDateRange.startDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })} to ${new Date(exportDateRange.endDate).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric", year: "numeric" }
            )}`
          : "All Time";

      let filename;

      switch (exportFormat) {
        case "excel":
          filename = exportToExcel(
            transactionsToExport,
            rangeStats,
            dateRangeStr
          );
          break;
        case "csv":
          filename = exportToCSV(transactionsToExport, dateRangeStr);
          break;
        case "pdf":
          filename = await exportToPDF(dateRangeStr);
          break;
        default:
          throw new Error("Invalid export format");
      }

      setShowExportModal(false);
      alert(
        `✅ Successfully exported ${rangeStats.transactionCount} transactions!\n\nPeriod: ${dateRangeStr}\nFormat: ${exportFormat.toUpperCase()}\nFile: ${filename}`
      );
    } catch (error) {
      console.error("Error exporting data:", error);
      alert("❌ Failed to export data. Please try again.");
    }
  };

  const handleExportClick = () => {
    setShowExportModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pt-20 px-4">
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
            className="flex flex-col space-y-4"
          >
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                All Transactions 📊
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                Manage and analyze your financial transactions
              </p>
            </div>

            {/* Controls Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label="Search transactions"
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                />
              </div>

              {/* Sort Dropdown */}
              <div className="relative min-w-[180px]">
                <label htmlFor="sort-select" className="sr-only">Sort transactions</label>
                <SortAsc className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" aria-hidden="true" />
                <select
                  id="sort-select"
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split("-");
                    setSortBy(field);
                    setSortOrder(order);
                  }}
                  aria-label="Sort transactions"
                  className="w-full pl-10 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer text-sm sm:text-base"
                >
                  <option value="date-desc">Date (Newest)</option>
                  <option value="date-asc">Date (Oldest)</option>
                  <option value="amount-desc">Amount (High-Low)</option>
                  <option value="amount-asc">Amount (Low-High)</option>
                  <option value="category-asc">Category (A-Z)</option>
                  <option value="category-desc">Category (Z-A)</option>
                </select>
              </div>

              {/* Time Filter */}
              <div className="relative min-w-[150px]">
                <label htmlFor="time-filter-transactions" className="sr-only">Time Filter</label>
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" aria-hidden="true" />
                <select
                  id="time-filter-transactions"
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  aria-label="Filter transactions by time period"
                  className="w-full pl-10 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer text-sm sm:text-base"
                >
                  <option value="thisWeek">This Week</option>
                  <option value="thisMonth">This Month</option>
                  <option value="thisYear">This Year</option>
                  <option value="all">All Time</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Filter Toggle */}
                <Button
                  variant={showFilters ? "secondary" : "outline"}
                  onClick={() => setShowFilters(!showFilters)}
                  className={showFilters ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-500" : ""}
                  icon={Filter}
                  aria-label="Toggle filters"
                />

                {/* Refresh Button */}
                <Button
                  variant="ghost"
                  onClick={refreshData}
                  disabled={isRefreshing}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                  aria-label="Refresh transactions"
                >
                  <RefreshCw
                    className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`}
                  />
                </Button>

                {/* Export Button */}
                <Button
                  variant="primary"
                  onClick={handleExportClick}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                  icon={Download}
                >
                  <span className="hidden sm:inline">Export</span>
                </Button>

                {/* Add Transaction Button */}
                <Button
                  onClick={() => {
                    setEditingTransaction(null);
                    setShowAddForm(true);
                  }}
                  icon={Plus}
                >
                  <span className="hidden sm:inline">Add</span>
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Advanced Filters */}
          <AnimatePresence>
            {showFilters && (
              <Card
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 sm:p-6 overflow-hidden"
              >
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                    Advanced Filters
                  </h2>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={clearFilters}
                      className="text-xs sm:text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    >
                      Clear All
                    </button>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Transaction Type
                    </label>
                    <select
                      value={filters.type}
                      onChange={(e) => updateFilter("type", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">All Types</option>
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Category
                    </label>
                    <select
                      value={filters.category}
                      onChange={(e) => updateFilter("category", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">All Categories</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Date From
                    </label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => updateFilter("dateFrom", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Date To
                    </label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => updateFilter("dateTo", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Min Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={filters.minAmount}
                      onChange={(e) =>
                        updateFilter("minAmount", e.target.value)
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Max Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={filters.maxAmount}
                      onChange={(e) =>
                        updateFilter("maxAmount", e.target.value)
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>
              </Card>
            )}
          </AnimatePresence>

          {/* Statistics Cards */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
          >
            <StatsCard
              title="Total Income"
              value={stats.totalIncome}
              icon={TrendingUp}
              color="green"
              change="+12.5%"
            />
            <StatsCard
              title="Total Expenses"
              value={stats.totalExpenses}
              icon={TrendingDown}
              color="red"
              change="-8.2%"
            />
            <StatsCard
              title="Net Balance"
              value={stats.netBalance}
              icon={Wallet}
              color={stats.netBalance >= 0 ? "green" : "red"}
              change={stats.netBalance >= 0 ? "+4.3%" : "-4.3%"}
            />
            <StatsCard
              title="Total Transactions"
              value={stats.transactionCount}
              icon={BarChart3}
              color="blue"
              change={`${stats.transactionCount} items`}
              isCount={true}
            />
          </motion.div>

          {/* Transaction List */}
          <motion.div variants={itemVariants}>
            <TransactionList
              transactions={transactions}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isLoading={isLoading}
            />
          </motion.div>
        </motion.div>

        {/* Export Modal - Keep the same as your original */}
        <AnimatePresence>
          {showExportModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col items-center overflow-y-auto p-4 sm:p-6"
              onClick={() => setShowExportModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-3xl my-auto flex-shrink-0 overflow-hidden max-h-[90vh] overflow-y-auto"
              >
                {/* Export Modal Content - Keep your existing export modal JSX */}
                {/* Header */}
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 sm:p-6 text-white sticky top-0 z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <Download className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <div>
                        <h2 className="text-lg sm:text-2xl font-bold">
                          Export Transactions
                        </h2>
                        <p className="text-green-100 text-xs sm:text-sm">
                          Choose format and date range
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowExportModal(false)}
                      className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-6 space-y-6">
                  {/* Current Stats */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          Total
                        </p>
                        <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                          {transactions.length}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          Income
                        </p>
                        <p className="text-base sm:text-lg font-bold text-green-600">
                          {formatCurrency(stats.totalIncome)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          Expenses
                        </p>
                        <p className="text-base sm:text-lg font-bold text-red-600">
                          {formatCurrency(stats.totalExpenses)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          Net
                        </p>
                        <p
                          className={`text-base sm:text-lg font-bold ${
                            stats.netBalance >= 0
                              ? "text-blue-600"
                              : "text-red-600"
                          }`}
                        >
                          {formatCurrency(stats.netBalance)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Export Format Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Select Export Format
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        {
                          value: "excel",
                          label: "Excel",
                          icon: FileSpreadsheet,
                          color: "green",
                          desc: "Multiple sheets with analysis",
                          activeClasses: "border-green-500 bg-green-50 dark:bg-green-900/20",
                          activeIconClasses: "text-green-600",
                        },
                        {
                          value: "pdf",
                          label: "PDF",
                          icon: FileText,
                          color: "red",
                          desc: "Professional report format",
                          activeClasses: "border-red-500 bg-red-50 dark:bg-red-900/20",
                          activeIconClasses: "text-red-600",
                        },
                        {
                          value: "csv",
                          label: "CSV",
                          icon: File,
                          color: "blue",
                          desc: "Simple spreadsheet data",
                          activeClasses: "border-blue-500 bg-blue-50 dark:bg-blue-900/20",
                          activeIconClasses: "text-blue-600",
                        },
                      ].map((format) => (
                        <button
                          key={format.value}
                          onClick={() => setExportFormat(format.value)}
                          className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                            exportFormat === format.value
                              ? format.activeClasses
                              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                          }`}
                        >
                          {exportFormat === format.value && (
                            <div className="absolute top-2 right-2">
                              <CheckCircle2 className={`h-5 w-5 ${format.activeIconClasses}`} />
                            </div>
                          )}
                          <format.icon
                            className={`h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 ${
                              exportFormat === format.value
                                ? format.activeIconClasses
                                : "text-gray-400"
                            }`}
                          />
                          <div className="text-center">
                            <p className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                              {format.label}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {format.desc}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date Range Presets */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Quick Select Period
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { value: "all", label: "All Time", icon: "📅" },
                        { value: "thisMonth", label: "This Month", icon: "📆" },
                        { value: "lastMonth", label: "Last Month", icon: "📋" },
                        { value: "thisYear", label: "This Year", icon: "🗓️" },
                        {
                          value: "last30Days",
                          label: "Last 30 Days",
                          icon: "⏰",
                        },
                        {
                          value: "last90Days",
                          label: "Last 90 Days",
                          icon: "📊",
                        },
                      ].map((preset) => (
                        <button
                          key={preset.value}
                          onClick={() => {
                            const dates = getPresetDates(preset.value);
                            setExportDateRange({
                              ...dates,
                              preset: preset.value,
                            });
                          }}
                          className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                            exportDateRange.preset === preset.value
                              ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                              : "border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700"
                          }`}
                        >
                          <div className="text-2xl mb-1">{preset.icon}</div>
                          <div className="text-xs sm:text-sm font-medium dark:text-white">
                            {preset.label}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Date Range */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Or Choose Custom Date Range
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-2">
                          Start Date
                        </label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="date"
                            value={exportDateRange.startDate}
                            onChange={(e) =>
                              setExportDateRange({
                                startDate: e.target.value,
                                endDate: exportDateRange.endDate,
                                preset: "custom",
                              })
                            }
                            className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-green-500 focus:ring-4 focus:ring-green-200 dark:focus:ring-green-900 transition-all text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-2">
                          End Date
                        </label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="date"
                            value={exportDateRange.endDate}
                            onChange={(e) =>
                              setExportDateRange({
                                startDate: exportDateRange.startDate,
                                endDate: e.target.value,
                                preset: "custom",
                              })
                            }
                            min={exportDateRange.startDate}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-green-500 focus:ring-4 focus:ring-green-200 dark:focus:ring-green-900 transition-all text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Selected Range Display */}
                  {exportDateRange.startDate && exportDateRange.endDate && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                      <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-400">
                        <Calendar className="h-5 w-5" />
                        <span className="font-medium text-sm">
                          Selected Period:{" "}
                          {new Date(
                            exportDateRange.startDate
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}{" "}
                          -{" "}
                          {new Date(exportDateRange.endDate).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 dark:bg-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sticky bottom-0">
                  <Button
                    variant="ghost"
                    onClick={() => setShowExportModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleExport}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 border-none"
                    icon={Download}
                  >
                    <span>
                      Export as {exportFormat.toUpperCase()}
                    </span>
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
                setEditingTransaction(null);
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
                  onSubmit={handleSubmit}
                  transaction={editingTransaction}
                  isLoading={false}
                  onClose={() => {
                    setShowAddForm(false);
                    setEditingTransaction(null);
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

// Stats Card Component
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
    green: "from-emerald-500 to-teal-600 text-emerald-700 bg-emerald-50 dark:bg-emerald-600 dark:text-white",
    red: "from-red-500 to-pink-600 text-red-700 bg-red-50 dark:bg-red-600 dark:text-white",
    blue: "from-blue-500 to-cyan-600 text-blue-700 bg-blue-50 dark:bg-blue-600 dark:text-white",
  };

  const formatValue = (val) => {
    if (isCount) return val.toLocaleString();
    return formatCurrencyUtil(val, currency.locale, currency.code);
  };

  return (
    <Card
      whileHover={{ y: -4 }}
      className="p-4 sm:p-6 transition-all duration-200"
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className={`p-2 sm:p-3 rounded-xl bg-gradient-to-r ${
            colorClasses[color].split(" ")[0]
          } ${colorClasses[color].split(" ")[1]}`}
        >
          <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
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

      <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
        {title}
      </h3>
      <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
        {formatValue(value)}
      </p>
    </Card>
  );
};

export default TransactionsPage;
