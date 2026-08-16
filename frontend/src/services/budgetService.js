// frontend/src/services/budgetService.js
import api from './api';

export const getBudgets = async () => {
  try {
    const response = await api.get('/budget');
    return response.data;
  } catch (error) {
    console.error('Error fetching budgets:', error);
    throw error;
  }
};

export const getBudgetProgress = async () => {
  try {
    const response = await api.get('/budget/progress');
    return response.data;
  } catch (error) {
    console.error('Error fetching budget progress:', error);
    throw error;
  }
};

export const addBudget = async (budgetData) => {
  try {
    const response = await api.post('/budget', budgetData);
    return response.data;
  } catch (error) {
    console.error('Error adding budget:', error);
    throw error;
  }
};

export const updateBudget = async (id, budgetData) => {
  try {
    const response = await api.put(`/budget/${id}`, budgetData);
    return response.data;
  } catch (error) {
    console.error('Error updating budget:', error);
    throw error;
  }
};

export const deleteBudget = async (id) => {
  try {
    const response = await api.delete(`/budget/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting budget:', error);
    throw error;
  }
};