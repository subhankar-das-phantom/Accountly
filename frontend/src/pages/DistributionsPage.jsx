import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import useSWRInfinite from 'swr/infinite';
import { useInView } from 'react-intersection-observer';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  Users, 
  Download, 
  RotateCcw, 
  ArrowLeft, 
  RefreshCw, 
  Edit3, 
  Trash2, 
  AlertCircle, 
  X, 
  TrendingUp,
  Check
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import useDistributionSync from '../hooks/useDistributionSync';
import api from '../services/api';
import distributionService from '../services/distributionService';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import { formatCurrency } from '../utils/currency';

const DistributionsPage = () => {
  const { token } = useContext(AuthContext);
  const { data: orgData } = useApi(token ? 'organizations' : null);
  const activeOrg = orgData && orgData.length > 0 ? orgData[0] : null;
  const isArchived = activeOrg?.status === 'ARCHIVED';

  // Campaigns state
  const [campaigns, setCampaigns] = useState([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  // Search and Filter states (modeled like PublicTransactionList)
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PENDING, DISTRIBUTED

  // Debounce search input by 300ms for instant typing feel
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Modals & Form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    itemName: '',
    description: '',
    status: 'ACTIVE'
  });
  const [isSubmittingCampaign, setIsSubmittingCampaign] = useState(false);

  // Undo confirmation modal
  const [undoModalRecord, setUndoModalRecord] = useState(null);
  const [undoReason, setUndoReason] = useState('');
  const [isUndoing, setIsUndoing] = useState(false);

  // Action feedback / notifications
  const [notification, setNotification] = useState(null);
  const [isDistributingId, setIsDistributingId] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const searchInputRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type, id: Date.now() });
    setTimeout(() => {
      setNotification(prev => (prev?.message === message ? null : prev));
    }, 3500);
  };

  // Fetch campaigns
  const fetchCampaigns = useCallback(async () => {
    try {
      setIsLoadingCampaigns(true);
      const data = await distributionService.getCampaigns();
      setCampaigns(data);
      setSelectedCampaign(prev => {
        if (!prev) return null;
        const updated = data.find(c => c._id === prev._id);
        return updated || prev;
      });
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      showToast('Failed to load distribution campaigns', 'error');
    } finally {
      setIsLoadingCampaigns(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchCampaigns();
    }
  }, [token, fetchCampaigns]);

  // ========================================================
  // SWR INFINITE RECORDS FETCHING (Identical to PublicTransactionList)
  // ========================================================
  const selectedCampaignId = selectedCampaign?._id;

  const getKey = (pageIndex, previousPageData) => {
    if (!selectedCampaignId) return null;
    // Stop if reached the end of pages
    if (previousPageData && (pageIndex >= previousPageData.pagination?.totalPages || previousPageData.records?.length === 0)) {
      return null;
    }
    const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';
    const statusParam = statusFilter && statusFilter !== 'ALL' ? `&status=${statusFilter}` : '';
    return `/distributions/campaigns/${selectedCampaignId}/records?page=${pageIndex + 1}&pageSize=25${searchParam}${statusParam}`;
  };

  const {
    data,
    error: recordsError,
    size,
    setSize,
    isValidating,
    mutate: mutateRecords
  } = useSWRInfinite(
    getKey,
    (url) => api.get(url).then(res => res.data),
    {
      revalidateOnFocus: false,
      revalidateFirstPage: false,
      dedupingInterval: 1000
    }
  );

  // Infinite Scroll IntersectionObserver (from react-intersection-observer, identical to PublicTransactionList)
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
    rootMargin: '200px'
  });

  // Flatten SWR pages into a single flat array
  const records = data ? data.flatMap(page => page.records) : [];
  const totalCount = data?.[0]?.pagination?.totalCount ?? 0;
  const isReachingEnd = !data || (data[data.length - 1]?.records?.length < 25) || (records.length >= totalCount);
  const isLoadingInitialData = !data && !recordsError && Boolean(selectedCampaignId);
  const isLoadingMore = !isLoadingInitialData && isValidating && size > 1;
  const isEmpty = !isLoadingInitialData && records.length === 0;

  useEffect(() => {
    if (inView && !isReachingEnd && !isValidating) {
      setSize(prev => prev + 1);
    }
  }, [inView, isReachingEnd, isValidating, setSize]);

  // ========================================================
  // REAL-TIME SURGICAL DISTRIBUTION SYNCHRONIZATION
  // ========================================================
  const handleRealtimeDistributionUpdate = useCallback((event) => {
    if (!event || event.campaignId !== selectedCampaignId) return;

    // 1. Authoritative campaign counters update in place (zero flicker, no skeleton loaders)
    if (event.stats) {
      setSelectedCampaign(prev => (prev && prev._id === event.campaignId ? { ...prev, stats: event.stats } : prev));
      setCampaigns(prevList =>
        prevList.map(c => (c._id === event.campaignId ? { ...c, stats: event.stats } : c))
      );
    }

    // 2. Surgical SWR record update in memory without page reload or remount
    mutateRecords(
      prevPages => {
        if (!prevPages) return prevPages;

        return prevPages.map(page => {
          if (!page || !page.records) return page;
          const recordExists = page.records.some(r => r._id === event.recordId);
          if (!recordExists) return page;

          let updatedRecords = page.records;
          let updatedPagination = page.pagination ? { ...page.pagination } : undefined;

          if (statusFilter === 'ALL') {
            // ALL filter: update in place
            updatedRecords = page.records.map(r =>
              r._id === event.recordId
                ? {
                    ...r,
                    status: event.status,
                    distributedAt: event.distributedAt,
                    distributedBy: event.distributedBy,
                    notes: event.notes !== undefined ? event.notes : r.notes
                  }
                : r
            );
          } else if (statusFilter === 'PENDING') {
            if (event.status === 'DISTRIBUTED') {
              // Smoothly transition out of PENDING view
              updatedRecords = page.records.filter(r => r._id !== event.recordId);
              if (updatedPagination && updatedPagination.totalCount > 0) {
                updatedPagination.totalCount -= 1;
              }
            } else if (event.status === 'PENDING') {
              // Undo: update record in place
              updatedRecords = page.records.map(r =>
                r._id === event.recordId
                  ? {
                      ...r,
                      status: 'PENDING',
                      distributedAt: null,
                      distributedBy: null,
                      notes: event.notes !== undefined ? event.notes : r.notes
                    }
                  : r
              );
            }
          } else if (statusFilter === 'DISTRIBUTED') {
            if (event.status === 'PENDING') {
              // Undo: smoothly transition out of DISTRIBUTED view
              updatedRecords = page.records.filter(r => r._id !== event.recordId);
              if (updatedPagination && updatedPagination.totalCount > 0) {
                updatedPagination.totalCount -= 1;
              }
            } else if (event.status === 'DISTRIBUTED') {
              // Distributed: update in place
              updatedRecords = page.records.map(r =>
                r._id === event.recordId
                  ? {
                      ...r,
                      status: 'DISTRIBUTED',
                      distributedAt: event.distributedAt,
                      distributedBy: event.distributedBy,
                      notes: event.notes !== undefined ? event.notes : r.notes
                    }
                  : r
              );
            }
          }

          return {
            ...page,
            records: updatedRecords,
            pagination: updatedPagination
          };
        });
      },
      false // false guarantees NO network refetch, in-memory surgical update, zero flicker!
    );
  }, [selectedCampaignId, statusFilter, mutateRecords]);

  const handleReconnectRevalidation = useCallback(() => {
    if (!selectedCampaignId) return;

    // Silent background revalidation
    mutateRecords();

    // Silently fetch fresh authoritative stats
    distributionService.getCampaignById(selectedCampaignId).then(fresh => {
      if (fresh) {
        setSelectedCampaign(prev => (prev && prev._id === fresh._id ? fresh : prev));
        setCampaigns(prevList => prevList.map(c => (c._id === fresh._id ? fresh : c)));
      }
    }).catch(err => {
      console.warn('[RealtimeSync] Silent revalidation error:', err);
    });
  }, [selectedCampaignId, mutateRecords]);

  // Hook into real-time multi-device sync
  const { connectionStatus } = useDistributionSync({
    campaignId: selectedCampaignId,
    orgId: activeOrg?._id,
    token,
    onEvent: handleRealtimeDistributionUpdate,
    onReconnect: handleReconnectRevalidation
  });

  // Focus search with '/' shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchInput('');
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Open Create / Edit modal
  const handleOpenCreateModal = (campaign = null) => {
    if (campaign) {
      setEditingCampaign(campaign);
      setCampaignForm({
        name: campaign.name,
        itemName: campaign.itemName,
        description: campaign.description || '',
        status: campaign.status
      });
    } else {
      setEditingCampaign(null);
      setCampaignForm({
        name: '',
        itemName: '',
        description: '',
        status: 'ACTIVE'
      });
    }
    setShowCreateModal(true);
  };

  const handleSaveCampaign = async (e) => {
    e.preventDefault();
    if (!campaignForm.name.trim() || !campaignForm.itemName.trim()) {
      showToast('Campaign Name and Item Name are required', 'error');
      return;
    }

    try {
      setIsSubmittingCampaign(true);
      if (editingCampaign) {
        await distributionService.updateCampaign(editingCampaign._id, campaignForm);
        showToast('Campaign updated successfully');
      } else {
        await distributionService.createCampaign(campaignForm);
        showToast('Campaign created & eligible contributors enrolled!');
      }
      setShowCreateModal(false);
      await fetchCampaigns();
    } catch (err) {
      console.error('Error saving campaign:', err);
      showToast(err.response?.data?.error || err.message || 'Failed to save campaign', 'error');
    } finally {
      setIsSubmittingCampaign(false);
    }
  };

  const handleDeleteCampaign = async (campaign) => {
    if (!window.confirm(`Are you sure you want to delete "${campaign.name}"? All associated distribution records will be removed.`)) {
      return;
    }
    try {
      await distributionService.deleteCampaign(campaign._id);
      showToast('Campaign deleted successfully');
      if (selectedCampaign?._id === campaign._id) {
        setSelectedCampaign(null);
      }
      await fetchCampaigns();
    } catch (err) {
      console.error('Error deleting campaign:', err);
      showToast('Failed to delete campaign', 'error');
    }
  };

  // Sync contributors
  const handleSyncContributors = async () => {
    if (!selectedCampaign) return;
    try {
      setIsSyncing(true);
      const res = await distributionService.syncEligibleContributors(selectedCampaign._id);
      if (res.enrolledCount > 0) {
        showToast(`Enrolled ${res.enrolledCount} newly added contributors!`);
      } else {
        showToast('All eligible contributors are already enrolled.');
      }
      await fetchCampaigns();
      await mutateRecords();
    } catch (err) {
      console.error('Error syncing contributors:', err);
      showToast('Failed to sync contributors', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Distribute Record with optimistic SWR cache update & concurrency conflict handling
  const handleDistribute = async (record) => {
    if (isArchived) {
      showToast('Organization is archived (Read-Only)', 'error');
      return;
    }
    const campaignId = record.campaignId || selectedCampaign?._id;
    if (!campaignId) {
      showToast('Campaign ID is missing', 'error');
      return;
    }

    try {
      setIsDistributingId(record._id);
      const updated = await distributionService.distributeRecord(campaignId, record._id);
      
      // Optimistically update SWR cache in memory for instantaneous UI response
      mutateRecords(
        prevPages => {
          if (!prevPages) return prevPages;
          return prevPages.map(page => ({
            ...page,
            records: page.records.map(r => r._id === record._id ? { ...r, ...updated } : r)
          }));
        },
        false
      );

      // Update live campaign stats authoritatively
      if (updated.stats) {
        setSelectedCampaign(prev => (prev ? { ...prev, stats: updated.stats } : prev));
        setCampaigns(prevList => prevList.map(c => (c._id === campaignId ? { ...c, stats: updated.stats } : c)));
      } else {
        setSelectedCampaign(prev => {
          if (!prev) return prev;
          const newDist = (prev.stats?.distributedCount || 0) + 1;
          const eligible = prev.stats?.eligibleCount || 0;
          return {
            ...prev,
            stats: {
              ...prev.stats,
              distributedCount: newDist,
              remainingCount: Math.max(0, eligible - newDist),
              progressPercentage: eligible > 0 ? Number(((newDist / eligible) * 100).toFixed(1)) : 0
            }
          };
        });
      }

      showToast(`Item distributed to ${record.contributor?.name}!`, 'success');
    } catch (err) {
      console.error('Distribution error:', err);
      if (err.response?.status === 409) {
        const conflict = err.response.data;
        showToast(
          `Conflict: Already distributed by ${conflict.distributedBy || 'another admin'} at ${new Date(conflict.distributedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 
          'error'
        );
        mutateRecords(
          prevPages => {
            if (!prevPages) return prevPages;
            return prevPages.map(page => ({
              ...page,
              records: page.records.map(r => r._id === record._id ? {
                ...r,
                status: 'DISTRIBUTED',
                distributedAt: conflict.distributedAt,
                distributedBy: { username: conflict.distributedBy }
              } : r)
            }));
          },
          false
        );
      } else {
        showToast(err.response?.data?.message || 'Failed to mark as distributed', 'error');
      }
    } finally {
      setIsDistributingId(null);
    }
  };

  // Undo Distribution with optimistic SWR cache update
  const handleConfirmUndo = async () => {
    if (!undoModalRecord) return;
    const campaignId = undoModalRecord.campaignId || selectedCampaign?._id;
    if (!campaignId) return;

    try {
      setIsUndoing(true);
      const updated = await distributionService.undoDistribution(
        campaignId,
        undoModalRecord._id,
        undoReason
      );

      mutateRecords(
        prevPages => {
          if (!prevPages) return prevPages;
          return prevPages.map(page => ({
            ...page,
            records: page.records.map(r => r._id === undoModalRecord._id ? { ...r, ...updated } : r)
          }));
        },
        false
      );

      // Update live campaign stats authoritatively
      if (updated.stats) {
        setSelectedCampaign(prev => (prev ? { ...prev, stats: updated.stats } : prev));
        setCampaigns(prevList => prevList.map(c => (c._id === campaignId ? { ...c, stats: updated.stats } : c)));
      } else {
        setSelectedCampaign(prev => {
          if (!prev) return prev;
          const newDist = Math.max(0, (prev.stats?.distributedCount || 0) - 1);
          const eligible = prev.stats?.eligibleCount || 0;
          return {
            ...prev,
            stats: {
              ...prev.stats,
              distributedCount: newDist,
              remainingCount: Math.max(0, eligible - newDist),
              progressPercentage: eligible > 0 ? Number(((newDist / eligible) * 100).toFixed(1)) : 0
            }
          };
        });
      }

      showToast(`Distribution undone for ${undoModalRecord.contributor?.name}`);
      setUndoModalRecord(null);
      setUndoReason('');
    } catch (err) {
      console.error('Undo error:', err);
      showToast('Failed to undo distribution', 'error');
    } finally {
      setIsUndoing(false);
    }
  };

  // Excel Export
  const handleExportExcel = async (campaign) => {
    try {
      showToast('Generating Excel report...');
      await distributionService.exportExcel(campaign._id, campaign.name);
      showToast('Excel report downloaded successfully!');
    } catch (err) {
      console.error('Export error:', err);
      showToast('Failed to export Excel report', 'error');
    }
  };

  const configuredFields = activeOrg?.contributorFields || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pt-20 pb-12 px-3 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Global Toast Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-20 right-4 z-50 flex items-center space-x-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium border ${
                notification.type === 'error'
                  ? 'bg-red-600 text-white border-red-700'
                  : 'bg-emerald-600 text-white border-emerald-700'
              }`}
            >
              {notification.type === 'error' ? (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{notification.message}</span>
              <button 
                onClick={() => setNotification(null)}
                className="ml-2 hover:opacity-80 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Archived Warning Banner */}
        {isArchived && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-3.5 rounded shadow-sm">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mr-2" />
              <p className="text-xs sm:text-sm font-medium text-yellow-800 dark:text-yellow-200">
                ARCHIVED ORGANIZATION — Read-only. Distributions cannot be modified.
              </p>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 1: CAMPAIGN LIST VIEW */}
        {/* ======================================================== */}
        {!selectedCampaign ? (
          <div className="space-y-5">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  Distribution Campaigns 📦
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  Manage contributor entitlements, track real-time distribution, and prevent duplicate hand-outs
                </p>
              </div>

              <Button
                onClick={() => handleOpenCreateModal()}
                disabled={isArchived}
                icon={Plus}
                size="sm"
                className="self-start sm:self-auto"
              >
                Create Campaign
              </Button>
            </div>

            {/* Campaign Cards Grid */}
            {isLoadingCampaigns ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-48 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <Card className="py-12 text-center">
                <div className="w-14 h-14 mx-auto mb-3 p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
                  <Package className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                  No Distribution Campaigns Yet
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-4">
                  Create a campaign (e.g. "Tiffin Distribution", "Event Kits") to track which eligible contributors have received their items.
                </p>
                <Button
                  onClick={() => handleOpenCreateModal()}
                  disabled={isArchived}
                  icon={Plus}
                  size="sm"
                >
                  Create First Campaign
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {campaigns.map(camp => {
                  const eligible = camp.stats?.eligibleCount || 0;
                  const distributed = camp.stats?.distributedCount || 0;
                  const remaining = camp.stats?.remainingCount || 0;
                  const pct = camp.stats?.progressPercentage || 0;

                  return (
                    <Card
                      key={camp._id}
                      className="p-4 sm:p-5 flex flex-col justify-between h-full border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-150"
                    >
                      <div>
                        {/* Top: Item & Status Badge */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                            <Package className="w-3 h-3 mr-1 text-blue-600 dark:text-blue-400" />
                            {camp.itemName}
                          </span>
                          <Badge 
                            variant={
                              camp.status === 'COMPLETED' ? 'success' :
                              camp.status === 'ACTIVE' ? 'primary' : 'gray'
                            }
                          >
                            {camp.status}
                          </Badge>
                        </div>

                        {/* Name & Description */}
                        <h3 className="text-base font-bold text-gray-900 dark:text-white line-clamp-1">
                          {camp.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-1">
                          {camp.description || 'No description'}
                        </p>

                        {/* Compact Progress */}
                        <div className="space-y-1 mb-3">
                          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                            <span>Progress</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{pct}%</span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                pct === 100 ? 'bg-emerald-500' : 'bg-blue-600'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Compact Stats Row */}
                        <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-3 text-center border border-gray-100 dark:border-gray-700/60">
                          <div>
                            <div className="text-[10px] uppercase text-gray-400">Eligible</div>
                            <div className="text-sm font-bold text-gray-900 dark:text-white">{eligible}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase text-emerald-600 dark:text-emerald-400">Done</div>
                            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{distributed}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase text-amber-600 dark:text-amber-400">Left</div>
                            <div className="text-sm font-bold text-amber-600 dark:text-amber-400">{remaining}</div>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-1.5">
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1 py-1.5 text-xs font-semibold"
                          onClick={() => {
                            setSelectedCampaign(camp);
                            setSearchInput('');
                            setDebouncedSearch('');
                          }}
                        >
                          Open Counter
                        </Button>

                        <button
                          onClick={() => handleExportExcel(camp)}
                          title="Export Excel"
                          className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleOpenCreateModal(camp)}
                          disabled={isArchived}
                          title="Edit"
                          className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteCampaign(camp)}
                          disabled={isArchived}
                          title="Delete"
                          className="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : (

        /* ======================================================== */
        /* VIEW 2: CAMPAIGN COUNTER & ROSTER VIEW */
        /* ======================================================== */
          <div className="space-y-4">
            {/* Top Navigation & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <button
                  onClick={() => {
                    setSelectedCampaign(null);
                    setSearchInput('');
                    setDebouncedSearch('');
                  }}
                  className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm"
                  title="Back to campaigns"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <div className="flex items-center space-x-2">
                    <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                      {selectedCampaign.name}
                    </h1>
                    <Badge variant={selectedCampaign.status === 'COMPLETED' ? 'success' : 'primary'}>
                      {selectedCampaign.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Allocated item: <span className="font-semibold text-gray-700 dark:text-gray-300">{selectedCampaign.itemName}</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons & Real-Time Sync Status */}
              <div className="flex items-center gap-2">
                <div 
                  title={connectionStatus === 'CONNECTED' ? 'Real-time multi-device synchronization active' : 'Reconnecting to real-time sync stream...'}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-xs"
                >
                  <span className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'CONNECTED'
                      ? 'bg-emerald-500 animate-pulse'
                      : connectionStatus === 'RECONNECTING'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-gray-400'
                  }`} />
                  <span className="text-gray-600 dark:text-gray-300 text-[11px] sm:text-xs font-medium">
                    {connectionStatus === 'CONNECTED' ? 'Live Sync' : connectionStatus === 'RECONNECTING' ? 'Reconnecting...' : 'Sync Offline'}
                  </span>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSyncContributors}
                  isLoading={isSyncing}
                  disabled={isArchived}
                  icon={RefreshCw}
                  className="text-xs"
                >
                  <span className="hidden sm:inline">Sync Contributors</span>
                  <span className="sm:hidden">Sync</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleExportExcel(selectedCampaign)}
                  icon={Download}
                  className="text-xs"
                >
                  <span className="hidden sm:inline">Export Excel</span>
                  <span className="sm:hidden">Excel</span>
                </Button>
              </div>
            </div>

            {/* Compact Metrics Bar (2x2 on Mobile, 4-col on Desktop) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
              <Card className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">Eligible</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-0.5">
                      {selectedCampaign.stats?.eligibleCount || 0}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
              </Card>

              <Card className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">Distributed</p>
                    <p className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {selectedCampaign.stats?.distributedCount || 0}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
              </Card>

              <Card className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">Remaining</p>
                    <p className="text-lg sm:text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                      {selectedCampaign.stats?.remainingCount || 0}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
              </Card>

              <Card className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">Completion</p>
                    <p className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                      {selectedCampaign.stats?.progressPercentage || 0}%
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Search & Status Filter Controls (Speed & Accuracy Optimized) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Search Bar - Realtime typing + Debounced SWR execution */}
              <div className="relative flex-1">
                {searchInput !== debouncedSearch || (isValidating && !isLoadingMore) ? (
                  <RefreshCw className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-500 animate-spin" />
                ) : (
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                )}
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search contributor name... (Press / to focus)"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                {searchInput && (
                  <button
                    onClick={() => {
                      setSearchInput('');
                      setDebouncedSearch('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Status Segmented Control */}
              <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg p-0.5 bg-white dark:bg-gray-800 self-stretch sm:self-auto">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    statusFilter === 'ALL'
                      ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                  }`}
                >
                  All ({totalCount})
                </button>
                <button
                  onClick={() => setStatusFilter('PENDING')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    statusFilter === 'PENDING'
                      ? 'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-semibold'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => setStatusFilter('DISTRIBUTED')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    statusFilter === 'DISTRIBUTED'
                      ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                  }`}
                >
                  Distributed
                </button>
              </div>
            </div>

            {/* ======================================================== */}
            {/* CONTENT AREA: DESKTOP TABLE + MOBILE OPTIMIZED LIST */}
            {/* ======================================================== */}
            {isLoadingInitialData ? (
              <div className="space-y-3">
                {/* Desktop Table Skeleton */}
                <div className="hidden md:block">
                  <Card className="overflow-hidden p-0 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="bg-gray-50/80 dark:bg-gray-800/80 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                      <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-28 animate-pulse" />
                      <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse" />
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="px-4 py-3 flex items-center justify-between gap-4 animate-pulse">
                          <div className="flex items-center space-x-3 w-1/4">
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                              <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
                            </div>
                          </div>
                          {configuredFields.map(f => (
                            <div key={f.key} className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                          ))}
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-20" />
                          <div className="h-3.5 bg-gray-100 dark:bg-gray-800 rounded w-24" />
                          <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded-lg w-20" />
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                {/* Mobile List Skeleton */}
                <div className="md:hidden space-y-2.5">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="p-3.5 border border-gray-200 dark:border-gray-700 animate-pulse space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-36" />
                        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-16" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-16" />
                        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-14" />
                      </div>
                      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-full" />
                    </Card>
                  ))}
                </div>
              </div>
            ) : isEmpty ? (
              <Card className="py-12 text-center">
                <Users className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  No contributors found
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {debouncedSearch
                    ? `No contributor matching "${debouncedSearch}".`
                    : 'No records match the current status filter.'}
                </p>
              </Card>
            ) : (
              <>
                {/* 1. DESKTOP TABLE VIEW (Visible on tablet & desktop) */}
                <div className="hidden md:block">
                  <Card className="overflow-hidden p-0 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                      <thead className="bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
                        <tr>
                          <th className="px-4 py-3">Contributor</th>
                          {configuredFields.map(f => (
                            <th key={f.key} className="px-4 py-3">{f.label || f.key}</th>
                          ))}
                          <th className="px-4 py-3">Contribution</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Distribution Details</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {records.map((r) => {
                          const isDist = r.status === 'DISTRIBUTED';
                          const isProcessing = isDistributingId === r._id;

                          return (
                            <tr key={r._id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/60 transition-colors">
                              {/* Contributor Name */}
                              <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                                {r.contributor?.name || 'Anonymous'}
                              </td>

                              {/* Dynamic Org Metadata */}
                              {configuredFields.map(f => (
                                <td key={f.key} className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                  {r.contributor?.metadata?.[f.key] || '—'}
                                </td>
                              ))}

                              {/* Contribution */}
                              <td className="px-4 py-3 text-xs whitespace-nowrap">
                                {r.contributionId?.amount != null ? (
                                  <div>
                                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                                      {formatCurrency(r.contributionId.amount, activeOrg?.currency?.locale, activeOrg?.currency?.code)}
                                    </span>
                                    {r.contributionId?.category && (
                                      <span className="text-gray-400 block text-[11px]">{r.contributionId.category}</span>
                                    )}
                                  </div>
                                ) : (
                                  '—'
                                )}
                              </td>

                              {/* Status Badge */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <Badge variant={isDist ? 'success' : 'warning'}>
                                  {isDist ? 'Distributed' : 'Pending'}
                                </Badge>
                              </td>

                              {/* Distribution Details */}
                              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                                {isDist ? (
                                  <div>
                                    <span>
                                      {new Date(r.distributedAt).toLocaleDateString()} {new Date(r.distributedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="block text-gray-400 text-[11px]">
                                      by {r.distributedBy?.username || 'Admin'}
                                    </span>
                                  </div>
                                ) : (
                                  '—'
                                )}
                              </td>

                              {/* Action Button */}
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                {isDist ? (
                                  <button
                                    onClick={() => {
                                      setUndoModalRecord(r);
                                      setUndoReason('');
                                    }}
                                    disabled={isArchived}
                                    className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 font-medium disabled:opacity-40"
                                  >
                                    Undo
                                  </button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    className="py-1 px-3 text-xs font-semibold"
                                    onClick={() => handleDistribute(r)}
                                    disabled={isArchived || isProcessing}
                                    isLoading={isProcessing}
                                    icon={Check}
                                  >
                                    Distribute
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Lazy Loading Skeleton Rows for Desktop */}
                        {isLoadingMore && [1, 2, 3].map(i => (
                          <tr key={`loading-more-desktop-${i}`} className="animate-pulse bg-gray-50/50 dark:bg-gray-800/40">
                            <td className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-28" /></td>
                            {configuredFields.map(f => (
                              <td key={f.key} className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" /></td>
                            ))}
                            <td className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" /></td>
                            <td className="px-4 py-3"><div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-20" /></td>
                            <td className="px-4 py-3"><div className="h-3.5 bg-gray-100 dark:bg-gray-800 rounded w-24" /></td>
                            <td className="px-4 py-3 text-right"><div className="h-7 bg-gray-200 dark:bg-gray-700 rounded-lg w-20 ml-auto" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                </div>

                {/* 2. MOBILE OPTIMIZED LIST VIEW (Visible only on mobile devices) */}
                <div className="md:hidden space-y-2.5">
                  {records.map((r) => {
                    const isDist = r.status === 'DISTRIBUTED';
                    const isProcessing = isDistributingId === r._id;

                    return (
                      <Card
                        key={r._id}
                        className={`p-3.5 transition-all border ${
                          isDist
                            ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/15 dark:bg-emerald-950/10'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                        }`}
                      >
                        {/* Row 1: Name + Status */}
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                            {r.contributor?.name || 'Anonymous Contributor'}
                          </h4>
                          <Badge variant={isDist ? 'success' : 'warning'} className="flex-shrink-0">
                            {isDist ? 'Distributed' : 'Pending'}
                          </Badge>
                        </div>

                        {/* Row 2: Contribution Info & Dynamic Metadata Tags */}
                        <div className="flex flex-wrap items-center gap-1.5 text-xs mb-2.5">
                          {r.contributionId?.amount != null && (
                            <span className="font-semibold text-gray-700 dark:text-gray-300">
                              {formatCurrency(r.contributionId.amount, activeOrg?.currency?.locale, activeOrg?.currency?.code)}
                            </span>
                          )}

                          {configuredFields.map(f => {
                            const val = r.contributor?.metadata?.[f.key];
                            if (!val) return null;
                            return (
                              <span
                                key={f.key}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                              >
                                <span className="text-gray-400 mr-0.5">{f.label || f.key}:</span>
                                <strong>{String(val)}</strong>
                              </span>
                            );
                          })}
                        </div>

                        {/* Row 3: Action or Distributed Stamp */}
                        {isDist ? (
                          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700/60 text-xs text-gray-500">
                            <span>
                              {new Date(r.distributedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} by {r.distributedBy?.username || 'Admin'}
                            </span>
                            <button
                              onClick={() => {
                                setUndoModalRecord(r);
                                setUndoReason('');
                              }}
                              disabled={isArchived}
                              className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 font-medium disabled:opacity-40"
                            >
                              Undo
                            </button>
                          </div>
                        ) : (
                          <Button
                            variant="primary"
                            className="w-full py-2 text-xs font-semibold"
                            onClick={() => handleDistribute(r)}
                            disabled={isArchived || isProcessing}
                            isLoading={isProcessing}
                            icon={Check}
                          >
                            Mark Distributed
                          </Button>
                        )}
                      </Card>
                    );
                  })}

                  {/* Lazy Loading Skeleton Cardlets for Mobile */}
                  {isLoadingMore && [1, 2].map(i => (
                    <Card key={`mobile-loading-more-${i}`} className="p-3.5 border border-gray-200 dark:border-gray-700 animate-pulse space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
                        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-16" />
                      </div>
                      <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-full" />
                    </Card>
                  ))}
                </div>

                {/* Infinite Scroll / InView Sentinel (Exact mechanism as PublicTransactionList) */}
                <div ref={loadMoreRef} className="pt-4 pb-2 text-center">
                  {!isReachingEnd ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSize(size + 1)}
                      isLoading={isLoadingMore}
                      icon={RefreshCw}
                      className="text-xs"
                    >
                      {isLoadingMore ? 'Loading next 25...' : `Load Next 25 (${totalCount - records.length} remaining)`}
                    </Button>
                  ) : records.length > 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Showing all {records.length} of {totalCount} contributors
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* CREATE / EDIT CAMPAIGN MODAL */}
        {/* ======================================================== */}
        <AnimatePresence>
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg p-5 sm:p-6 space-y-3.5"
              >
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                    {editingCampaign ? 'Edit Campaign' : 'Create Distribution Campaign'}
                  </h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveCampaign} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                      Campaign Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={campaignForm.name}
                      onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                      placeholder="e.g. Tiffin Distribution, Fest Kits"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                      Item Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={campaignForm.itemName}
                      onChange={(e) => setCampaignForm({ ...campaignForm, itemName: e.target.value })}
                      placeholder="e.g. Tiffin Packet, Meal Box, Gift Kit"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={campaignForm.description}
                      onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                      placeholder="Pickup location, counter instructions..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {editingCampaign && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                        Status
                      </label>
                      <select
                        value={campaignForm.status}
                        onChange={(e) => setCampaignForm({ ...campaignForm, status: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="DRAFT">DRAFT</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </div>
                  )}

                  <div className="pt-2.5 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      type="button"
                      size="sm"
                      onClick={() => setShowCreateModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      type="submit"
                      size="sm"
                      isLoading={isSubmittingCampaign}
                    >
                      {editingCampaign ? 'Save Changes' : 'Create Campaign'}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ======================================================== */}
        {/* CONFIRM UNDO MODAL */}
        {/* ======================================================== */}
        <AnimatePresence>
          {undoModalRecord && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md p-5 sm:p-6 space-y-3.5"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      Undo Distribution?
                    </h3>
                    <p className="text-xs text-gray-500">
                      Revert status back to Pending
                    </p>
                  </div>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Undo distribution for{' '}
                  <strong className="text-gray-900 dark:text-white">
                    {undoModalRecord.contributor?.name}
                  </strong>
                  ? This reversal will be recorded in the audit trail.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Reason (Optional)
                  </label>
                  <input
                    type="text"
                    value={undoReason}
                    onChange={(e) => setUndoReason(e.target.value)}
                    placeholder="e.g. Accidental click"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setUndoModalRecord(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleConfirmUndo}
                    isLoading={isUndoing}
                  >
                    Confirm Undo
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default DistributionsPage;
