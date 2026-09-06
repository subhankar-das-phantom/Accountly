import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  RotateCcw, 
  Package, 
  Search, 
  Filter, 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle, 
  Calendar, 
  ChevronRight, 
  ChevronLeft, 
  UserCheck, 
  Activity, 
  X, 
  ExternalLink, 
  ShieldCheck,
  User,
  History,
  Info
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import useDistributionSync from '../hooks/useDistributionSync';
import distributionService from '../services/distributionService';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';

const DistributionAnalyticsPage = () => {
  const { token, user, isAdmin } = useContext(AuthContext);
  const navigate = useNavigate();
  const { data: orgData } = useApi(token ? 'organizations' : null);
  const activeOrg = orgData && orgData.length > 0 ? orgData[0] : null;

  // SWR cached campaigns query (shares global cache with HomePage and DistributionsPage)
  const {
    data: campaignsData,
    isLoading: isCampaignsLoading,
    mutate: mutateCampaigns
  } = useApi(token ? 'distributions/campaigns' : null, {
    dedupingInterval: 5000
  });

  const campaigns = campaignsData || [];
  const isLoadingCampaigns = isCampaignsLoading && !campaignsData;
  const [selectedCampaignId, setSelectedCampaignId] = useState('ALL');

  // Summary Metrics State
  const [summary, setSummary] = useState({
    eligibleCount: 0,
    distributedCount: 0,
    pendingCount: 0,
    remainingCount: 0,
    distributionRate: 0,
    totalQuantityDistributed: 0,
    reversedCount: 0
  });
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  // Operators Breakdown State
  const [operatorsData, setOperatorsData] = useState([]);
  const [isLoadingOperators, setIsLoadingOperators] = useState(true);

  // Operator Drilldown Drawer State
  const [drilldownOperator, setDrilldownOperator] = useState(null);
  const [drilldownRecipients, setDrilldownRecipients] = useState([]);
  const [drilldownTotal, setDrilldownTotal] = useState(0);
  const [drilldownPage, setDrilldownPage] = useState(1);
  const [drilldownSearch, setDrilldownSearch] = useState('');
  const [isLoadingDrilldown, setIsLoadingDrilldown] = useState(false);

  // Recipient Lookup State
  const [recipientSearchInput, setRecipientSearchInput] = useState('');
  const [recipientHistory, setRecipientHistory] = useState(null);
  const [isSearchingRecipient, setIsSearchingRecipient] = useState(false);
  const [searchedRecipientName, setSearchedRecipientName] = useState('');

  // Activity Log State
  const [activities, setActivities] = useState([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [activityPageSize] = useState(15);
  const [activitySearch, setActivitySearch] = useState('');
  const [activityOperatorFilter, setActivityOperatorFilter] = useState('');
  const [activityStatusFilter, setActivityStatusFilter] = useState('ALL');
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);

  // Undo / Reversal Modal State
  const [undoActivity, setUndoActivity] = useState(null);
  const [undoReason, setUndoReason] = useState('');
  const [isSubmittingUndo, setIsSubmittingUndo] = useState(false);

  // Toast Notification
  const [notification, setNotification] = useState(null);
  const showToast = (message, type = 'success') => {
    setNotification({ message, type, id: Date.now() });
    setTimeout(() => {
      setNotification(prev => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Auto-select first active campaign when campaigns load
  useEffect(() => {
    if (campaigns.length > 0 && selectedCampaignId === 'ALL') {
      const active = campaigns.find(c => c.status === 'ACTIVE') || campaigns[0];
      if (active) {
        setSelectedCampaignId(active._id);
      }
    }
  }, [campaigns, selectedCampaignId]);

  // Load KPI Summary
  const loadSummary = useCallback(async () => {
    try {
      setIsLoadingSummary(true);
      const data = await distributionService.getAnalyticsSummary(selectedCampaignId);
      setSummary(data);
    } catch (err) {
      console.error('Error loading summary:', err);
    } finally {
      setIsLoadingSummary(false);
    }
  }, [selectedCampaignId]);

  // Load Operator Breakdown
  const loadOperators = useCallback(async () => {
    try {
      setIsLoadingOperators(true);
      const data = await distributionService.getDistributionByOperator(selectedCampaignId);
      setOperatorsData(data);
    } catch (err) {
      console.error('Error loading operators:', err);
    } finally {
      setIsLoadingOperators(false);
    }
  }, [selectedCampaignId]);

  // Load Activity Feed
  const loadActivities = useCallback(async () => {
    try {
      setIsLoadingActivities(true);
      const params = {
        page: activityPage,
        pageSize: activityPageSize,
        campaignId: selectedCampaignId !== 'ALL' ? selectedCampaignId : undefined,
        operatorId: activityOperatorFilter || undefined,
        status: activityStatusFilter !== 'ALL' ? activityStatusFilter : undefined,
        search: activitySearch ? activitySearch.trim() : undefined
      };
      const data = await distributionService.getDistributionActivity(params);
      setActivities(data.activities || []);
      setActivityTotal(data.total || 0);
    } catch (err) {
      console.error('Error loading activities:', err);
    } finally {
      setIsLoadingActivities(false);
    }
  }, [selectedCampaignId, activityPage, activityPageSize, activityOperatorFilter, activityStatusFilter, activitySearch]);

  // Reload on campaign change
  useEffect(() => {
    if (token) {
      loadSummary();
      loadOperators();
      loadActivities();
    }
  }, [token, selectedCampaignId, loadSummary, loadOperators, loadActivities]);

  // Real-time SSE Sync for live analytics updates
  const activeSseCampaignId = selectedCampaignId !== 'ALL' ? selectedCampaignId : (campaigns[0]?._id || null);
  const handleRealtimeEvent = useCallback(() => {
    loadSummary();
    loadOperators();
    loadActivities();
    if (drilldownOperator) {
      loadDrilldownRecipients(drilldownOperator._id, drilldownPage, drilldownSearch);
    }
  }, [loadSummary, loadOperators, loadActivities, drilldownOperator, drilldownPage, drilldownSearch]);

  const { connectionStatus } = useDistributionSync({
    campaignId: activeSseCampaignId,
    orgId: activeOrg?._id,
    token,
    onEvent: handleRealtimeEvent,
    onReconnect: handleRealtimeEvent
  });

  // Operator Drilldown loader
  const loadDrilldownRecipients = async (operatorId, page = 1, search = '') => {
    if (!operatorId || operatorId === 'undefined') return;
    try {
      setIsLoadingDrilldown(true);
      const res = await distributionService.getOperatorHistory(operatorId, {
        campaignId: selectedCampaignId !== 'ALL' ? selectedCampaignId : undefined,
        page,
        pageSize: 15,
        search: search.trim() || undefined
      });
      const list = res.recipients || res.records || [];
      setDrilldownRecipients(list);
      setDrilldownTotal(res.total ?? res.pagination?.totalCount ?? list.length);
    } catch (err) {
      console.error('Error loading operator drilldown:', err);
      showToast('Failed to load operator recipient drilldown', 'error');
    } finally {
      setIsLoadingDrilldown(false);
    }
  };

  const handleOpenDrilldown = (op) => {
    const operatorId = op.operator?._id || op._id;
    if (!operatorId) {
      showToast('Operator ID not available for drilldown', 'error');
      return;
    }
    const safeOp = {
      ...op,
      _id: operatorId,
      username: op.operator?.username || op.username || 'Operator'
    };
    setDrilldownOperator(safeOp);
    setDrilldownPage(1);
    setDrilldownSearch('');
    loadDrilldownRecipients(operatorId, 1, '');
  };

  // Recipient History Search
  const handleSearchRecipient = async (e) => {
    if (e) e.preventDefault();
    if (!recipientSearchInput.trim()) return;

    try {
      setIsSearchingRecipient(true);
      setSearchedRecipientName(recipientSearchInput.trim());
      const data = await distributionService.getRecipientHistory({
        recipientName: recipientSearchInput.trim(),
        campaignId: selectedCampaignId !== 'ALL' ? selectedCampaignId : undefined
      });
      setRecipientHistory(data);
    } catch (err) {
      console.error('Error searching recipient:', err);
      showToast('Recipient history search failed', 'error');
    } finally {
      setIsSearchingRecipient(false);
    }
  };

  // Undo Confirmation Submission
  const handleConfirmUndo = async () => {
    if (!undoActivity) return;
    try {
      setIsSubmittingUndo(true);
      const campaignId = undoActivity.campaignId?._id || undoActivity.campaignId || selectedCampaignId;
      const recordId = undoActivity.recordId?._id || undoActivity.recordId;

      await distributionService.undoDistribution(campaignId, recordId, undoReason);
      showToast('Distribution reversed successfully', 'success');
      setUndoActivity(null);
      setUndoReason('');

      loadSummary();
      loadOperators();
      loadActivities();
      if (drilldownOperator) {
        loadDrilldownRecipients(drilldownOperator._id, drilldownPage, drilldownSearch);
      }
    } catch (err) {
      console.error('Undo distribution error:', err);
      showToast(err.response?.data?.message || 'Failed to reverse distribution', 'error');
    } finally {
      setIsSubmittingUndo(false);
    }
  };

  const totalOperatorDistributions = operatorsData.reduce((acc, op) => acc + (op.distributedCount || 0), 0);
  const totalOperatorQuantity = operatorsData.reduce((acc, op) => acc + (op.totalQuantity || 0), 0);
  const totalOperatorReversals = operatorsData.reduce((acc, op) => acc + (op.reversedCount || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 px-3 sm:px-6 lg:px-8 pb-16">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Toast Notification Alert */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2 text-sm font-medium border ${
                notification.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-800'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800'
              }`}
            >
              {notification.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              )}
              <span>{notification.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ======================================================== */}
        {/* HEADER & CAMPAIGN CONTROLS */}
        {/* ======================================================== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  Distribution Analytics & Accountability
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  Real-time operator oversight, recipient audit logs, and distribution tracking.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Live SSE Pulse */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600">
              <span className={`w-2.5 h-2.5 rounded-full ${
                connectionStatus === 'CONNECTED'
                  ? 'bg-emerald-500 animate-pulse'
                  : connectionStatus === 'RECONNECTING'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-gray-400'
              }`} />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                {connectionStatus === 'CONNECTED' ? 'Live Stream' : connectionStatus === 'RECONNECTING' ? 'Reconnecting...' : 'Sync Offline'}
              </span>
            </div>

            {/* Campaign Selector */}
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="px-3.5 py-2 text-sm font-medium rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Campaigns</option>
              {campaigns.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.itemName || 'Item'})
                </option>
              ))}
            </select>

            {/* Link to Counter Mode */}
            <Link to="/distributions">
              <Button variant="secondary" icon={Package} size="sm">
                Counter Mode
              </Button>
            </Link>
          </div>
        </div>

        {/* ======================================================== */}
        {/* KPI SUMMARY CARDS (6-metric responsive grid) */}
        {/* ======================================================== */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
          <Card className="p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Eligible</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {isLoadingSummary ? '...' : summary.eligibleCount}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </Card>

          <Card className="p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Distributed</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {isLoadingSummary ? '...' : summary.distributedCount}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </Card>

          <Card className="p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {isLoadingSummary ? '...' : (summary.pendingCount ?? summary.remainingCount ?? 0)}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </Card>

          <Card className="p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Rate</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                  {isLoadingSummary ? '...' : `${summary.distributionRate}%`}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </Card>

          <Card className="p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider">Total Items</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                  {isLoadingSummary ? '...' : (summary.totalQuantityDistributed || summary.distributedCount || 0)}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                <Package className="w-5 h-5" />
              </div>
            </div>
          </Card>

          <Card className="p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400 uppercase tracking-wider">Reversals</p>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                  {isLoadingSummary ? '...' : (summary.reversedCount || 0)}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
                <RotateCcw className="w-5 h-5" />
              </div>
            </div>
          </Card>
        </div>

        {/* ======================================================== */}
        {/* OPERATOR BREAKDOWN & TRACEABILITY TABLE */}
        {/* ======================================================== */}
        <Card className="p-0 overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-gray-50/50 dark:bg-gray-800/50">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>Distribution by Operator</span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Operator activity breakdown with full drilldown to the exact recipients served.
              </p>
            </div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 self-start sm:self-auto">
              Total Active Operators: <span className="font-bold text-gray-900 dark:text-white">{operatorsData.length}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-5 py-3.5">Operator</th>
                  <th className="px-5 py-3.5 text-center">Distributed Count</th>
                  <th className="px-5 py-3.5 text-center">Total Quantity</th>
                  <th className="px-5 py-3.5 text-center">Reversals</th>
                  <th className="px-5 py-3.5">Last Active</th>
                  <th className="px-5 py-3.5 text-right">Traceability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {isLoadingOperators ? (
                  <tr key="operators-loading">
                    <td colSpan="6" className="px-5 py-8 text-center text-gray-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                      Loading operator breakdown...
                    </td>
                  </tr>
                ) : operatorsData.length === 0 ? (
                  <tr key="operators-empty">
                    <td colSpan="6" className="px-5 py-8 text-center text-gray-500">
                      No distributions recorded for this campaign yet.
                    </td>
                  </tr>
                ) : (
                  operatorsData.map((op, idx) => {
                    const opId = op.operator?._id || op._id || `op-row-${idx}`;
                    const opUsername = op.operator?.username || op.username || 'System Operator';
                    const opEmail = op.operator?.email || op.email;
                    return (
                      <tr key={opId} className="hover:bg-blue-50/40 dark:hover:bg-blue-900/20 transition-colors">
                        <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                              {opUsername ? opUsername.charAt(0).toUpperCase() : 'O'}
                            </div>
                            <div>
                              <span>{opUsername}</span>
                              {opEmail && (
                                <span className="block text-xs font-normal text-gray-400">{opEmail}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800">
                            {op.distributedCount || 0}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                          {op.totalQuantity || 0}
                        </td>
                        <td className="px-5 py-4 text-center text-xs whitespace-nowrap">
                          {op.reversedCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-semibold border border-rose-200 dark:border-rose-800">
                              {op.reversedCount}
                            </span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">
                          {op.lastActivity ? (
                            <div>
                              <span>{new Date(op.lastActivity).toLocaleDateString()}</span>
                              <span className="text-gray-400 block">{new Date(op.lastActivity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenDrilldown(op)}
                            icon={ChevronRight}
                          >
                            View Recipients ({op.distributedCount})
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}

                {/* Authoritative Reconciled Totals Row */}
                {!isLoadingOperators && operatorsData.length > 0 && (
                  <tr key="reconciled-summary-row" className="bg-gray-100/70 dark:bg-gray-800/80 font-bold text-gray-900 dark:text-white border-t-2 border-gray-300 dark:border-gray-600">
                    <td className="px-5 py-3.5">
                      Total Reconciled Sum
                    </td>
                    <td className="px-5 py-3.5 text-center text-emerald-600 dark:text-emerald-400">
                      {totalOperatorDistributions}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {totalOperatorQuantity}
                    </td>
                    <td className="px-5 py-3.5 text-center text-rose-600 dark:text-rose-400">
                      {totalOperatorReversals}
                    </td>
                    <td colSpan="2" className="px-5 py-3.5 text-right text-xs font-normal text-gray-500">
                      Reconciled with {summary.distributedCount} total campaign distributions
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ======================================================== */}
        {/* RECIPIENT HISTORY LOOKUP CARD */}
        {/* ======================================================== */}
        <Card className="p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>Individual Recipient History Lookup</span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Look up any recipient to see the exact items received, timestamps, and operators.
              </p>
            </div>
          </div>

          <form onSubmit={handleSearchRecipient} className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search participant name (e.g. Rahul, Priya Sharma, Contributor 1)..."
                value={recipientSearchInput}
                onChange={(e) => setRecipientSearchInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSearchingRecipient}
            >
              Look Up
            </Button>
          </form>

          {recipientHistory && (
            <div className="mt-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Recipient: {recipientHistory.recipientName}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Total records found: {recipientHistory.total}
                  </p>
                </div>
                <button
                  onClick={() => setRecipientHistory(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {recipientHistory.history.length === 0 ? (
                <p className="text-xs text-gray-500 py-3 text-center">
                  No distribution history found for "{recipientHistory.recipientName}".
                </p>
              ) : (
                <div className="space-y-2.5">
                  {recipientHistory.history.map((h, i) => (
                    <div
                      key={h._id || i}
                      className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-sm text-gray-900 dark:text-white">
                            {h.item || 'Item'}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                            Qty: {h.quantity || 1}
                          </span>
                          <Badge variant={h.status === 'DISTRIBUTED' ? 'success' : 'danger'}>
                            {h.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Campaign: <span className="text-gray-700 dark:text-gray-300 font-medium">{h.campaignId?.name || 'Distribution Campaign'}</span>
                          {' • '}
                          Distributed by: <span className="text-gray-700 dark:text-gray-300 font-medium">{h.operator?.username || 'Operator'}</span>
                        </p>
                      </div>

                      <div className="text-right text-xs text-gray-500">
                        <div className="flex items-center sm:justify-end space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>{new Date(h.distributedAt).toLocaleDateString()} {new Date(h.distributedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {h.status === 'REVERSED' && h.reversal && (
                          <div className="text-[11px] text-rose-500 mt-0.5">
                            Reversed by {h.reversal.reversedBy?.username || 'Admin'}: "{h.reversal.reason || 'No reason provided'}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ======================================================== */}
        {/* FULL ACTIVITY FEED AUDIT LOG (with server-side filters & pagination) */}
        {/* ======================================================== */}
        <Card className="p-0 overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gray-50/50 dark:bg-gray-800/50">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>Distribution Activity Audit Feed</span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Non-destructive historical stream of all distribution events, timestamps, and reversal reasons.
              </p>
            </div>

            {/* Activity Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter recipient..."
                  value={activitySearch}
                  onChange={(e) => {
                    setActivitySearch(e.target.value);
                    setActivityPage(1);
                  }}
                  className="pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <select
                value={activityOperatorFilter}
                onChange={(e) => {
                  setActivityOperatorFilter(e.target.value);
                  setActivityPage(1);
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">All Operators</option>
                {operatorsData.map((op) => (
                  <option key={op._id || op.username} value={op._id}>
                    {op.username}
                  </option>
                ))}
              </select>

              <select
                value={activityStatusFilter}
                onChange={(e) => {
                  setActivityStatusFilter(e.target.value);
                  setActivityPage(1);
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="DISTRIBUTED">Distributed</option>
                <option value="REVERSED">Reversed</option>
              </select>

              <Button
                variant="secondary"
                size="sm"
                onClick={loadActivities}
                icon={RefreshCw}
                className="text-xs py-1.5"
              >
                Refresh
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Recipient</th>
                  <th className="px-5 py-3.5">Item & Qty</th>
                  <th className="px-5 py-3.5">Distributed By</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Reversal Details</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {isLoadingActivities ? (
                  <tr key="activities-loading">
                    <td colSpan="7" className="px-5 py-8 text-center text-gray-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                      Loading activity feed...
                    </td>
                  </tr>
                ) : activities.length === 0 ? (
                  <tr key="activities-empty">
                    <td colSpan="7" className="px-5 py-8 text-center text-gray-500">
                      No distribution activities match the selected filters.
                    </td>
                  </tr>
                ) : (
                  activities.map((act) => {
                    const isRev = act.status === 'REVERSED';
                    return (
                      <tr key={act._id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/60 transition-colors">
                        <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                          <span>{new Date(act.distributedAt).toLocaleDateString()}</span>
                          <span className="text-gray-400 block text-[11px]">{new Date(act.distributedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                          {act.recipient?.name || 'Anonymous Recipient'}
                        </td>
                        <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                          <span className="font-medium text-gray-800 dark:text-gray-200">{act.item || 'Item'}</span>
                          <span className="ml-2 text-gray-400">x{act.quantity || 1}</span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          <span className="font-medium">{act.operator?.username || 'Operator'}</span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <Badge variant={isRev ? 'danger' : 'success'}>
                            {act.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                          {isRev && act.reversal ? (
                            <div>
                              <span className="text-rose-600 font-medium">Reversed by {act.reversal.reversedBy?.username || 'Admin'}</span>
                              <span className="block text-gray-400 text-[11px]">"{act.reversal.reason || 'No reason specified'}"</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          {!isRev && isAdmin && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setUndoActivity(act);
                                setUndoReason('');
                              }}
                              className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400"
                              icon={RotateCcw}
                            >
                              Reverse
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Activity Feed Pagination */}
          {activityTotal > activityPageSize && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 text-xs">
              <span className="text-gray-500">
                Showing {((activityPage - 1) * activityPageSize) + 1} - {Math.min(activityPage * activityPageSize, activityTotal)} of {activityTotal} activities
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={activityPage <= 1}
                  onClick={() => setActivityPage(p => p - 1)}
                  icon={ChevronLeft}
                >
                  Previous
                </Button>
                <span className="font-semibold px-2 text-gray-700 dark:text-gray-300">
                  Page {activityPage} of {Math.ceil(activityTotal / activityPageSize)}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={activityPage >= Math.ceil(activityTotal / activityPageSize)}
                  onClick={() => setActivityPage(p => p + 1)}
                  icon={ChevronRight}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>

      </div>

      {/* ======================================================== */}
      {/* OPERATOR EXACT RECIPIENTS DRILLDOWN MODAL */}
      {/* ======================================================== */}
      <AnimatePresence>
        {drilldownOperator && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/80">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                    {drilldownOperator.username?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Recipients Distributed by {drilldownOperator.username}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Total items distributed: <span className="font-bold text-emerald-600">{drilldownOperator.distributedCount}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDrilldownOperator(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Within Drilldown */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search recipient name within this operator's history..."
                    value={drilldownSearch}
                    onChange={(e) => {
                      setDrilldownSearch(e.target.value);
                      setDrilldownPage(1);
                      loadDrilldownRecipients(drilldownOperator._id, 1, e.target.value);
                    }}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Drilldown List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {isLoadingDrilldown ? (
                  <div className="py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading traceable recipient list...
                  </div>
                ) : drilldownRecipients.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    No recipients match the query.
                  </div>
                ) : (
                  drilldownRecipients.map((item, idx) => (
                    <div
                      key={item._id || idx}
                      className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="w-6 text-center text-xs font-mono text-gray-400">
                          {((drilldownPage - 1) * 15) + idx + 1}
                        </span>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">
                            {item.recipient?.name || 'Participant'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Item: <span className="font-semibold text-gray-700 dark:text-gray-300">{item.item || 'Item'}</span>
                            {' • '}
                            Quantity: <span className="font-semibold text-gray-700 dark:text-gray-300">{item.quantity || 1}</span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <Badge variant={item.status === 'DISTRIBUTED' ? 'success' : 'danger'}>
                          {item.status}
                        </Badge>
                        <p className="text-[11px] text-gray-400 mt-1">
                          {new Date(item.distributedAt).toLocaleDateString()} {new Date(item.distributedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Drilldown Pagination */}
              {drilldownTotal > 15 && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800">
                  <span className="text-gray-500">
                    Total: {drilldownTotal} recipients
                  </span>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={drilldownPage <= 1}
                      onClick={() => {
                        const newP = drilldownPage - 1;
                        setDrilldownPage(newP);
                        loadDrilldownRecipients(drilldownOperator._id, newP, drilldownSearch);
                      }}
                      icon={ChevronLeft}
                    >
                      Prev
                    </Button>
                    <span>Page {drilldownPage} of {Math.ceil(drilldownTotal / 15)}</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={drilldownPage >= Math.ceil(drilldownTotal / 15)}
                      onClick={() => {
                        const newP = drilldownPage + 1;
                        setDrilldownPage(newP);
                        loadDrilldownRecipients(drilldownOperator._id, newP, drilldownSearch);
                      }}
                      icon={ChevronRight}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* UNDO / REVERSAL CONFIRMATION MODAL */}
      {/* ======================================================== */}
      <AnimatePresence>
        {undoActivity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center space-x-3 text-rose-600 mb-4">
                <div className="p-2.5 bg-rose-50 dark:bg-rose-900/30 rounded-xl">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Reverse Distribution?
                </h3>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                You are about to reverse the distribution for <strong>{undoActivity.recipient?.name}</strong> ({undoActivity.item || 'Item'}). 
                The record will return to PENDING, while the historical activity entry will be immutably preserved with status REVERSED.
              </p>

              <div className="mb-5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Reversal Reason
                </label>
                <textarea
                  rows="3"
                  placeholder="e.g. Distributed wrong size, accidental double click, recipient absent..."
                  value={undoReason}
                  onChange={(e) => setUndoReason(e.target.value)}
                  className="w-full p-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setUndoActivity(null);
                    setUndoReason('');
                  }}
                  disabled={isSubmittingUndo}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleConfirmUndo}
                  isLoading={isSubmittingUndo}
                >
                  Confirm Reversal
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DistributionAnalyticsPage;
