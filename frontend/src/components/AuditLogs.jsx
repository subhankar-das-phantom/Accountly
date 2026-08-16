import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Shield, CheckCircle, XCircle, AlertCircle, RefreshCw, X, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';
import Card from './common/Card';
import Button from './common/Button';

export const IntegrityCheck = ({ organizationId }) => {
  const [status, setStatus] = useState(null); // null | 'loading' | 'success' | 'error'
  const [data, setData] = useState(null);

  const runCheck = async () => {
    setStatus('loading');
    try {
      const res = await api.get(`organizations/${organizationId}/integrity-check`);
      setData(res.data);
      setStatus('success');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  return (
    <Card className="p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Financial Integrity</h2>
        </div>
        <Button onClick={runCheck} disabled={status === 'loading'} size="sm" variant="secondary">
          <RefreshCw className={`h-4 w-4 mr-2 ${status === 'loading' ? 'animate-spin' : ''}`} />
          Run Check
        </Button>
      </div>

      {status === null && (
        <p className="text-sm text-gray-500">Run a check to reconcile collected vs spent and verify the canonical balance.</p>
      )}

      {status === 'error' && (
        <div className="p-4 bg-red-50 text-red-700 rounded flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" /> Failed to run integrity check.
        </div>
      )}

      {status === 'success' && data && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Collected</span>
            <span className="font-medium text-gray-900 dark:text-white">₹{data.totalCollected.toLocaleString()}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Spent</span>
            <span className="font-medium text-gray-900 dark:text-white">₹{data.totalSpent.toLocaleString()}</span>
          </div>
          <div className="flex justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-600 dark:text-gray-400">Balance</span>
            <span className="font-bold text-gray-900 dark:text-white">₹{data.remainingBalance.toLocaleString()}</span>
          </div>
          
          <div className="flex items-center justify-center space-x-2">
            {data.valid ? (
              <>
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                <span className="text-emerald-600 font-medium">Verified</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="text-red-600 font-medium">Mismatch Detected</span>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

export const AuditLogs = ({ organizationId }) => {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`organizations/${organizationId}/audit-logs`, {
        params: { page: p, pageSize: 10 }
      });
      setLogs(res.data.logs);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(page);
  }, [organizationId, page]);

  const handleNext = () => {
    if (pagination?.hasMore) setPage(p => p + 1);
  };

  const handlePrev = () => {
    if (page > 1) setPage(p => p - 1);
  };

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Audit Logs</h2>
        <p className="text-sm text-gray-500">Traceable accountability for organizational configuration and financial mutations.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Admin</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" className="text-center py-4">Loading logs...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan="4" className="text-center py-4">No audit logs found.</td></tr>
            ) : (
              logs.map((log) => (
                <tr 
                  key={log.id} 
                  onClick={() => setSelectedLog(log)}
                  className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <td className="px-4 py-3 whitespace-nowrap">{format(new Date(log.createdAt), 'dd MMM yyyy HH:mm')}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{log.actor?.name || 'System'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">{log.action}</span>
                  </td>
                  <td className="px-4 py-3">{log.entityType}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex space-x-2">
            <Button size="sm" variant="secondary" onClick={handlePrev} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="secondary" onClick={handleNext} disabled={!pagination.hasMore}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {selectedLog && (
        <AuditLogModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </Card>
  );
};

const AuditLogModal = ({ log, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Audit Log Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Action</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{log.action}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Entity Type</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{log.entityType}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Date</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{format(new Date(log.createdAt), 'dd MMM yyyy HH:mm:ss')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Admin</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{log.actor?.name || 'System'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 border-b border-gray-200 dark:border-gray-700 pb-1">Before</h4>
              <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded text-xs text-gray-800 dark:text-gray-200 overflow-x-auto">
                {log.previousData ? JSON.stringify(log.previousData, null, 2) : 'null'}
              </pre>
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 border-b border-gray-200 dark:border-gray-700 pb-1">After</h4>
              <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded text-xs text-gray-800 dark:text-gray-200 overflow-x-auto">
                {log.newData ? JSON.stringify(log.newData, null, 2) : 'null'}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
