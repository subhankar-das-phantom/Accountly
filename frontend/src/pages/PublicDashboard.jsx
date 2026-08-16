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
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  Target,
  List
} from 'lucide-react';
import api from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import { formatCurrency } from '../utils/currency';
import Chart from '../components/Chart';
import PublicTransactionList from '../components/PublicTransactionList';

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
  const { currency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [activeTab, setActiveTab] = useState('contributions');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        // 1. Fetch main summary
        const res = await api.get(`/public/organizations/${slug}`);
        setDashboardData(res.data);
        
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
      {/* Premium Hero Header */}
      <div className="relative bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Subtle Background Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-full bg-blue-500/5 dark:bg-blue-500/10 blur-3xl rounded-full pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 relative z-10 text-center">
          <div className="inline-flex items-center space-x-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-6 border border-blue-100 dark:border-blue-800/50">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span>Accountly Transparency</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight">
            {organization.name}
          </h1>
          
          {organization.description && (
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto font-medium leading-relaxed">
              {organization.description}
            </p>
          )}

          {organization.status === 'ARCHIVED' && (
            <div className="mt-8 inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500 border border-yellow-200 dark:border-yellow-800/50 shadow-sm">
              <AlertCircle className="w-5 h-5 mr-2" />
              Archived Organization
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Fund Flow Visualization */}
        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] p-6 sm:p-10 border border-gray-100 dark:border-gray-700/50 relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>

          <div className="text-center mb-10 relative z-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Fund Flow</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Real-time overview of incoming and outgoing funds</p>
          </div>

          <div className="flex flex-col md:flex-row items-stretch justify-center gap-4 sm:gap-6 lg:gap-8 relative z-10 max-w-5xl mx-auto">
            
            {/* Collected Node */}
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
              <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-all duration-300">
                <TrendingUp className="w-8 h-8" />
              </div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Total Collected</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(summary.totalCollected, currency.locale, currency.code)}
              </span>
            </div>

            {/* Connection Arrow (Mobile: Down, Desktop: Right) */}
            <div className="flex items-center justify-center py-2 md:py-0">
              <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center text-gray-400 dark:text-gray-500 md:rotate-0">
                <ArrowDown className="w-5 h-5 md:hidden" />
                <ArrowRight className="w-5 h-5 hidden md:block" />
              </div>
            </div>

            {/* Central Organization Fund Node */}
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg shadow-emerald-500/10 flex flex-col items-center justify-center relative overflow-hidden group border border-emerald-200 dark:border-emerald-500/30 transform md:-translate-y-2 transition-all duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-emerald-400/10 dark:bg-emerald-500/10 blur-3xl rounded-full pointer-events-none"></div>

              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 group-hover:scale-110 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40 transition-all duration-300 relative z-10">
                <Building2 className="w-8 h-8" />
              </div>
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-widest relative z-10">Current Balance</span>
              <span className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white mb-4 tracking-tight relative z-10">
                {formatCurrency(summary.remainingBalance, currency.locale, currency.code)}
              </span>
              <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 shadow-sm relative z-10">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-2"></span>
                Available Funds
              </div>
            </div>

            {/* Connection Arrow (Mobile: Down, Desktop: Right) */}
            <div className="flex items-center justify-center py-2 md:py-0">
              <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center text-gray-400 dark:text-gray-500">
                <ArrowDown className="w-5 h-5 md:hidden" />
                <ArrowRight className="w-5 h-5 hidden md:block" />
              </div>
            </div>

            {/* Spent Node */}
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center relative overflow-hidden group hover:border-red-500/30 transition-all duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
              <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600 mb-4 group-hover:scale-110 group-hover:bg-red-100 dark:group-hover:bg-red-900/40 transition-all duration-300">
                <TrendingDown className="w-8 h-8" />
              </div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Total Spent</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(summary.totalSpent, currency.locale, currency.code)}
              </span>
            </div>

          </div>
        </div>

        {/* Target Progress */}
        {organization.settings?.publicTarget && organization.settings?.fundTarget > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">Fund Target</h2>
              <Target className="w-6 h-6 text-blue-500" />
            </div>
            <div className="max-w-3xl mx-auto">
              <div className="flex justify-between text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                <span>Collected</span>
                <span>Target</span>
              </div>
              <div className="flex justify-between text-2xl font-bold text-gray-900 dark:text-white mb-4">
                <span>{formatCurrency(summary.totalCollected, organization.currency.locale, organization.currency.code)}</span>
                <span>{formatCurrency(organization.settings.fundTarget, organization.currency.locale, organization.currency.code)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-6 dark:bg-gray-700 overflow-hidden relative">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 h-6 rounded-full transition-all duration-1000 ease-out" 
                  style={{ width: `${Math.min((summary.totalCollected / organization.settings.fundTarget) * 100, 100)}%` }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
                  {((summary.totalCollected / organization.settings.fundTarget) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}

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
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden mt-8">
          <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center">
                <List className="w-5 h-5 mr-2 text-blue-500" />
                Financial Records
              </h2>
            </div>
            <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700 pb-2">
              <button
                className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'contributions' 
                    ? 'border-green-500 text-green-600 dark:text-green-400' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
                onClick={() => setActiveTab('contributions')}
              >
                Contributions
              </button>
              <button
                className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'expenses' 
                    ? 'border-red-500 text-red-600 dark:text-red-400' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
                onClick={() => setActiveTab('expenses')}
              >
                Expenses
              </button>
            </div>
          </div>
          <div className="p-0">
            <PublicTransactionList 
              type={activeTab} 
              slug={slug} 
              currency={organization.currency} 
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default PublicDashboard;
