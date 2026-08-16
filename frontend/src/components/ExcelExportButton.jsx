import React, { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../services/api';

const ExcelExportButton = ({ organizationId, className = '' }) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await api.get(`/organizations/${organizationId}/reports/excel`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Accountly_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export Excel report:', error);
      alert('Failed to generate Excel report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <motion.button
      whileHover={!isExporting ? { scale: 1.02 } : {}}
      whileTap={!isExporting ? { scale: 0.98 } : {}}
      onClick={handleExport}
      disabled={isExporting}
      className={`w-full p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 transition-all duration-200 text-left text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <div className="flex items-start space-x-3">
        {isExporting ? (
          <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 mt-1 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-5 w-5 sm:h-6 sm:w-6 mt-1" />
        )}
        <div>
          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-1">
            {isExporting ? 'Exporting...' : 'Export to Excel'}
          </h4>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            Download spreadsheet format
          </p>
        </div>
      </div>
    </motion.button>
  );
};

export default ExcelExportButton;
