import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  Loader2,
  Calendar,
  Tag,
  User,
  Store,
  ArrowLeft
} from 'lucide-react';
import api from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import { formatCurrency } from '../utils/currency';
import Chart from '../components/Chart';

const StatsCard = ({ title, value, icon: Icon, color, subtitle, explanation }) => {
  const { currency } = useCurrency();
  const colorClasses = {
    emerald: "from-emerald-500 to-teal-600 text-emerald-700 bg-emerald-50 dark:bg-emerald-600 dark:text-white",
    red: "from-red-500 to-rose-600 text-red-700 bg-red-50 dark:bg-red-600 dark:text-white",
    blue: "from-blue-500 to-cyan-600 text-blue-700 bg-blue-50 dark:bg-blue-600 dark:text-white",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700 transition-all duration-200 group">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl bg-gradient-to-r ${colorClasses[color].split(" ")[0]} ${colorClasses[color].split(" ")[1]}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${colorClasses[color].split(" ")[2]} ${colorClasses[color].split(" ")[3]} ${colorClasses[color].split(" ")[4]} ${colorClasses[color].split(" ")[5] || ''} ${colorClasses[color].split(" ")[6] || ''}`}>
          {subtitle}
        </div>
      </div>
      <div className="flex items-center gap-1 mb-1">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h3>
        {explanation && (
          <div className="relative flex items-center">
            <AlertCircle className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
            <div className="absolute bottom-full mb-2 hidden group-hover:block w-48 bg-gray-900 text-white text-xs rounded p-2 z-10 shadow-lg left-1/2 -translate-x-1/2 text-center">
              {explanation}
            </div>
          </div>
        )}
      </div>
      <p className="text-base sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
        {formatCurrency(value, currency.locale, currency.code)}
      </p>
    </div>
  );
};

// Simplified read-only row
const PublicRecordRow = ({ record, type }) => {
  const { currency } = useCurrency();
  const isContribution = type === 'contribution';

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="mx-4 my-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start sm:items-center space-x-4 flex-1 min-w-0 w-full">
        <div
          className={`p-2 rounded-lg flex-shrink-0 ${
            isContribution
              ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
              : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
          }`}
        >
          {isContribution ? (
            <TrendingUp className="h-5 w-5" />
          ) : (
            <TrendingDown className="h-5 w-5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 mb-1 min-w-0">
            <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white truncate flex-1">
              {isContribution ? record.contributorName : (record.description || "No description")}
            </h3>
            <span
              className={`text-base sm:text-xl font-bold whitespace-nowrap flex-shrink-0 ${
                isContribution
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {isContribution ? "+" : "-"}
              {formatCurrency(record.amount, currency.locale, currency.code)}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-sm text-gray-500 dark:text-gray-400">
            {!isContribution && record.category && (
              <div className="flex items-center space-x-1">
                <Tag className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{record.category}</span>
              </div>
            )}
            
            {!isContribution && record.recipientName && (
              <div className="flex items-center space-x-1">
                <Store className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{record.recipientName}</span>
              </div>
            )}

            <div className="flex items-center space-x-1">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span>{formatDate(record.date)}</span>
            </div>
            
            {record.status && record.status !== 'received' && (
               <div className="flex items-center space-x-1">
                <span className="truncate uppercase text-xs font-bold tracking-wider opacity-75">{record.status}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PublicDashboard = () => {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  
  const [contributions, setContributions] = useState([]);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        // 1. Fetch main summary
        const res = await api.get(`/public/organizations/${slug}`);
        setDashboardData(res.data);

        // 2. Fetch first page of contributions
        const contribRes = await api.get(`/public/organizations/${slug}/contributions?limit=5`);
        setContributions(contribRes.data.contributions);

        // 3. Fetch first page of expenses
        const expRes = await api.get(`/public/organizations/${slug}/expenses?limit=5`);
        setExpenses(expRes.data.expenses);
        
        setError(null);
      } catch (err) {
        if (err.response?.status === 403) {
          setError("This transparency page is currently unavailable.");
        } else if (err.response?.status === 404) {
          setError("Organization not found.");
        } else {
          setError("An error occurred while loading the transparency dashboard.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
        <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{error}</h1>
        <Link to="/" className="text-blue-600 hover:underline flex items-center mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Return to Home
        </Link>
      </div>
    );
  }

  if (!dashboardData) return null;

  const { organization, summary, analytics } = dashboardData;

  // Prepare stats cards format
  const stats = [
    {
      title: "Total Collected",
      value: summary.totalCollected,
      icon: TrendingUp,
      color: "blue",
      subtitle: `${summary.contributionCount} Contributions`,
      explanation: "Total funds received by the organization across all time."
    },
    {
      title: "Total Spent",
      value: summary.totalSpent,
      icon: TrendingDown,
      color: "red",
      subtitle: `${summary.expenseCount} Expenses`,
      explanation: "Total funds spent by the organization across all time."
    },
    {
      title: "Remaining Balance",
      value: summary.remainingBalance,
      icon: Building2,
      color: summary.remainingBalance >= 0 ? "emerald" : "red",
      subtitle: "Current Funds",
      explanation: "Total Collected minus Total Spent."
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-8 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-2">Accountly Transparency</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-4">
            {organization.name}
          </h1>
          {organization.description && (
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              {organization.description}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Fund Flow Visualization */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700 text-center">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Fund Flow Transparency</h2>
          <div className="flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-8">
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/30 border-4 border-blue-500 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-2">
                <TrendingUp className="w-10 h-10" />
              </div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">Collected</span>
            </div>
            
            <div className="h-12 w-1 bg-gray-300 dark:bg-gray-700 md:h-1 md:w-24 rounded-full relative">
              <div className="absolute right-1/2 top-1/2 -translate-y-1/2 translate-x-1/2 md:translate-x-0 md:right-0 md:translate-y-1/2 w-3 h-3 bg-gray-400 rotate-45 transform md:-mt-1.5 md:-mr-1.5 md:border-t-2 md:border-r-2 md:bg-transparent md:border-gray-400 hidden md:block"></div>
            </div>

            <div className="flex flex-col items-center relative">
              <div className="w-32 h-32 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border-4 border-emerald-500 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2 shadow-lg">
                <Building2 className="w-12 h-12" />
              </div>
              <span className="font-bold text-lg text-gray-900 dark:text-white">Organization Fund</span>
              <span className="text-sm font-medium text-emerald-600">Balance: {summary.remainingBalance.toLocaleString()}</span>
            </div>

            <div className="h-12 w-1 bg-gray-300 dark:bg-gray-700 md:h-1 md:w-24 rounded-full relative">
              <div className="absolute right-1/2 top-1/2 -translate-y-1/2 translate-x-1/2 md:translate-x-0 md:right-0 md:translate-y-1/2 w-3 h-3 bg-gray-400 rotate-45 transform md:-mt-1.5 md:-mr-1.5 md:border-t-2 md:border-r-2 md:bg-transparent md:border-gray-400 hidden md:block"></div>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-red-100 dark:bg-red-900/30 border-4 border-red-500 flex items-center justify-center text-red-600 dark:text-red-400 mb-2">
                <TrendingDown className="w-10 h-10" />
              </div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">Spent</span>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, idx) => (
            <StatsCard key={idx} {...stat} />
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {analytics.topExpenseCategories?.length > 0 && (
             <Chart data={analytics.topExpenseCategories.map(c => ({ name: c.category, value: c.amount }))} title="Spent Categories Breakdown" />
           )}
           {analytics.topContributionCategories?.length > 0 && (
             <Chart data={analytics.topContributionCategories.map(c => ({ name: c.category, value: c.amount }))} title="Contribution Sources" />
           )}
        </div>

        {/* Records Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Contributions */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Recent Contributions</h2>
              <div className="w-16 h-1 bg-green-500 rounded-full" />
            </div>
            <div className="py-2 h-[400px] overflow-y-auto custom-scrollbar">
              {contributions.length === 0 ? (
                <div className="text-center text-gray-500 p-8">No contributions recorded yet.</div>
              ) : (
                contributions.map(c => <PublicRecordRow key={c.id} record={c} type="contribution" />)
              )}
            </div>
          </div>

          {/* Expenses */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Recent Expenses</h2>
              <div className="w-16 h-1 bg-red-500 rounded-full" />
            </div>
            <div className="py-2 h-[400px] overflow-y-auto custom-scrollbar">
              {expenses.length === 0 ? (
                <div className="text-center text-gray-500 p-8">No expenses recorded yet.</div>
              ) : (
                expenses.map(e => <PublicRecordRow key={e.id} record={e} type="expense" />)
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default PublicDashboard;
