import api from './api';

const transactionService = {
  getAllTransactions: (params) => {
    return api.get('transactions', { params });
  },

  getTransactionStats: () => {
    return api.get('transactions/stats');
  },

  getChartData: () => {
    return api.get('transactions/chart-data');
  },

  createTransaction: (data) => {
    return api.post('transactions', data);
  },

  updateTransaction: (id, data) => {
    return api.put(`transactions/${id}`, data);
  },

  deleteTransaction: (id) => {
    return api.delete(`transactions/${id}`);
  },

  getReport: () => {
    return api.get('transactions/report', { responseType: 'blob' });
  },
};

export default transactionService;
