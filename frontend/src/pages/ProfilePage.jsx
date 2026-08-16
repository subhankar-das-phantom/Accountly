import React, { useState, useContext, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Mail, 
  Shield, 
  Globe, 
  Check, 
  LogOut,
  ChevronRight,
  CreditCard,
  Settings,
  Moon,
  Sun,
  Palette
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useTheme } from '../context/ThemeContext';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Input from '../components/common/Input';

const ProfilePage = () => {
  const { user, token, logout, updateProfile, changePassword } = useContext(AuthContext);
  const { currency, updateCurrency } = useCurrency();
  const { theme, updateTheme } = useTheme();
  const navigate = useNavigate();
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  
  const currencies = [
    { code: 'INR', locale: 'en-IN', name: 'Indian Rupee (₹)', symbol: '₹' },
    { code: 'USD', locale: 'en-US', name: 'US Dollar ($)', symbol: '$' },
    { code: 'EUR', locale: 'de-DE', name: 'Euro (€)', symbol: '€' },
    { code: 'GBP', locale: 'en-GB', name: 'British Pound (£)', symbol: '£' },
    { code: 'JPY', locale: 'ja-JP', name: 'Japanese Yen (¥)', symbol: '¥' },
    { code: 'AUD', locale: 'en-AU', name: 'Australian Dollar (A$)', symbol: 'A$' },
    { code: 'CAD', locale: 'en-CA', name: 'Canadian Dollar (C$)', symbol: 'C$' },
  ];
  
  // Edit Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ username: '', email: '' });

  // Change Password State
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  useEffect(() => {
    if (user) {
      setEditForm({ username: user.username, email: user.email });
    }
  }, [user]);

  const handleCurrencyChange = async (newCurrency) => {
    setIsUpdating(true);
    try {
      await updateCurrency(newCurrency);
      showSuccess('Currency preference updated successfully');
    } catch (error) {
      console.error('Failed to update currency:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleColorThemeChange = async (colorId) => {
    setIsUpdating(true);
    try {
      await updateTheme({ color: colorId });
      showSuccess('Color theme updated successfully');
    } catch (error) {
      console.error('Failed to update color theme:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    setError('');
    
    const res = await updateProfile(editForm);
    if (res.success) {
      showSuccess('Profile updated successfully');
      setIsEditing(false);
    } else {
      setError(res.error);
    }
    setIsUpdating(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setIsUpdating(true);
    setError('');

    const res = await changePassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword
    });

    if (res.success) {
      showSuccess('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordSection(false);
    } else {
      setError(res.error);
    }
    setIsUpdating(false);
  };

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* Header Section */}
          <Card className="p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-bl-full" />
            
            <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-full flex items-center justify-center shadow-xl ring-4 ring-white dark:ring-gray-800">
                <span className="text-4xl font-bold text-white">
                  {user?.username?.charAt(0).toUpperCase()}
                </span>
              </div>
              
              <div className="text-center sm:text-left flex-1 w-full">
                {isEditing ? (
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Username"
                        value={editForm.username}
                        onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                      />
                      <Input
                        label="Email"
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                      />
                    </div>
                    <div className="flex gap-2 justify-center sm:justify-start">
                      <Button
                        type="submit"
                        disabled={isUpdating}
                      >
                        Save Changes
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setIsEditing(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-center justify-center sm:justify-between mb-2">
                      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                        {user?.username}
                      </h1>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="ml-4 p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        <Settings className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4 text-sm sm:text-base text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>{user?.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <span>Account Active</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl flex items-center gap-2"
              >
                <Shield className="h-5 w-5" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Security Section */}
          <Card className="overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Security
              </h2>
            </div>
            
            <div className="p-6">
              {!showPasswordSection ? (
                <button
                  onClick={() => setShowPasswordSection(true)}
                  className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium hover:underline"
                >
                  Change Password
                </button>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                  <Input
                    label="Current Password"
                    type="password"
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                  />
                  <Input
                    label="New Password"
                    type="password"
                    required
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  />
                  <Input
                    label="Confirm New Password"
                    type="password"
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                  />
                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      disabled={isUpdating}
                    >
                      Update Password
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowPasswordSection(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </Card>

          {/* Settings Section (Currency) */}
          <Card className="overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Preferences
              </h2>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Currency Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                  Display Currency
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {currencies.map((curr) => (
                    <button
                      key={curr.code}
                      onClick={() => handleCurrencyChange(curr)}
                      disabled={isUpdating}
                      className={`relative flex items-center p-4 rounded-xl border-2 transition-all duration-200 ${
                        currency.code === curr.code
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 ${
                        currency.code === curr.code
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        <span className="text-base sm:text-lg font-bold">{curr.symbol}</span>
                      </div>
                      <div className="text-left flex-1">
                        <div className={`text-sm sm:text-base font-semibold ${
                          currency.code === curr.code
                            ? 'text-blue-900 dark:text-blue-100'
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {curr.code}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {curr.name}
                        </div>
                      </div>
                      {currency.code === curr.code && (
                        <div className="absolute top-4 right-4">
                          <Check className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Settings */}
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Appearance
                </label>
                
                <div className="space-y-6">
                  {/* Color Themes */}
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Color Theme</div>
                    <div className="flex gap-4 flex-wrap">
                      {[
                        { id: 'default', hex: '#2563eb', name: 'Default' },
                        { id: 'pink', hex: '#ec4899', name: 'Pink' },
                        { id: 'purple', hex: '#a855f7', name: 'Purple' },
                        { id: 'emerald', hex: '#10b981', name: 'Emerald' },
                      ].map((t) => (
                        <div key={t.id} className="flex flex-col items-center gap-2">
                          <button
                            onClick={() => handleColorThemeChange(t.id)}
                            style={{ backgroundColor: t.hex }}
                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform shadow-sm ${theme.color === t.id ? 'ring-4 ring-offset-2 ring-[var(--color-primary)] dark:ring-offset-gray-900 scale-110' : 'hover:scale-105'}`}
                            title={t.name}
                          >
                            {theme.color === t.id && <Check className="h-5 w-5 text-white" />}
                          </button>
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Success Message Toast */}
          <AnimatePresence>
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed bottom-8 right-8 bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50"
              >
                <Check className="h-5 w-5" />
                <span className="font-medium">{successMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Logout Button */}
          <Card className="overflow-hidden">
            <div className="p-6">
              <Button
                onClick={logout}
                variant="secondary"
                size="lg"
                className="w-full flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
                icon={LogOut}
              >
                Sign Out
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default ProfilePage;
