import api from './api';

export const distributionService = {
  // Campaign endpoints
  getCampaigns: async () => {
    const res = await api.get('distributions/campaigns');
    return res.data;
  },

  getCampaignById: async (campaignId) => {
    const res = await api.get(`distributions/campaigns/${campaignId}`);
    return res.data;
  },

  createCampaign: async (campaignData) => {
    const res = await api.post('distributions/campaigns', campaignData);
    return res.data;
  },

  updateCampaign: async (campaignId, updateData) => {
    const res = await api.put(`distributions/campaigns/${campaignId}`, updateData);
    return res.data;
  },

  deleteCampaign: async (campaignId) => {
    const res = await api.delete(`distributions/campaigns/${campaignId}`);
    return res.data;
  },

  syncEligibleContributors: async (campaignId) => {
    const res = await api.post(`distributions/campaigns/${campaignId}/sync`);
    return res.data;
  },

  // Record & Counter endpoints
  getRecords: async (campaignId, params = {}) => {
    const res = await api.get(`distributions/campaigns/${campaignId}/records`, { params });
    return res.data;
  },

  distributeRecord: async (campaignId, recordId, notes = '') => {
    const res = await api.post(`distributions/campaigns/${campaignId}/records/${recordId}/distribute`, { notes });
    return res.data;
  },

  undoDistribution: async (campaignId, recordId, reason = '') => {
    const res = await api.post(`distributions/campaigns/${campaignId}/records/${recordId}/undo`, { reason });
    return res.data;
  },

  // Export
  exportExcel: async (campaignId, campaignName = 'Campaign') => {
    const response = await api.get(`distributions/campaigns/${campaignId}/export/excel`, {
      responseType: 'blob'
    });

    const url = window.URL.createObjectURL(new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }));
    const link = document.createElement('a');
    link.href = url;
    const sanitizedName = campaignName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `Distribution_${sanitizedName}_${dateStr}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // Administrative Analytics & Activity Endpoints
  getAnalyticsSummary: async (campaignId = 'ALL') => {
    const res = await api.get('distributions/analytics/summary', {
      params: { campaignId }
    });
    return res.data;
  },

  getDistributionByOperator: async (campaignId = 'ALL') => {
    const res = await api.get('distributions/analytics/operators', {
      params: { campaignId }
    });
    return res.data;
  },

  getOperatorHistory: async (operatorId, params = {}) => {
    const res = await api.get(`distributions/analytics/operators/${operatorId}/history`, {
      params
    });
    return res.data;
  },

  getDistributionActivity: async (params = {}) => {
    const res = await api.get('distributions/analytics/activity', {
      params
    });
    return res.data;
  },

  getRecipientHistory: async (params = {}) => {
    const res = await api.get('distributions/analytics/recipients/history', {
      params
    });
    return res.data;
  },

  // Operator Management Endpoints
  getDistributionOperators: async () => {
    const res = await api.get('distributions/operators');
    return res.data;
  },

  addDistributionOperator: async (payload) => {
    const data = typeof payload === 'string' ? { email: payload } : payload;
    const res = await api.post('distributions/operators', data);
    return res.data;
  },

  setOperatorStatus: async (memberId, status) => {
    const res = await api.patch(`distributions/operators/${memberId}/status`, { status });
    return res.data;
  }
};

export default distributionService;
