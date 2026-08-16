import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import api from '../services/api';
import Button from './common/Button';

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
    <Button 
      variant="outline" 
      onClick={handleExport}
      disabled={isExporting}
      className={`flex items-center gap-2 ${className}`}
    >
      {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {isExporting ? 'Exporting...' : 'Export to Excel'}
    </Button>
  );
};

export default ExcelExportButton;
