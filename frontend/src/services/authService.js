import api from './api';

const authService = {
  getUser: () => {
    return api.get('users/me');
  },

  register: (username, email, password) => {
    return api.post('users/register', { username, email, password });
  },

  login: (email, password) => {
    return api.post('users/login', { email, password });
  },

  updateProfile: (data) => {
    return api.put('users/me', data);
  },

  changePassword: (data) => {
    return api.put('users/me/password', data);
  },

  deleteAccount: () => {
    return api.delete('users/me');
  },
};

export default authService;
