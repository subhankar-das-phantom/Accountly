import React, { useState, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn,
  Wallet,
  AlertCircle
} from 'lucide-react';
import Input from '../components/common/Input';
import Button from '../components/common/Button';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const { login, token } = useContext(AuthContext);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (token) {
      navigate('/');
    }
  }, [token, navigate]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4 }
    }
  };

  const inputVariants = {
    focus: { scale: 1.02, transition: { duration: 0.2 } },
    blur: { scale: 1, transition: { duration: 0.2 } }
  };

  // Form validation
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle input changes
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear errors when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    if (loginError) {
      setLoginError('');
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitted(true);
    setLoginError('');
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await login(formData.email, formData.password);
      
      if (result.success) {
        // Success animation delay
        setTimeout(() => {
          navigate('/');
        }, 500);
      } else {
        setLoginError(result.error || 'Login failed. Please try again.');
        setIsLoading(false);
      }
      
    } catch (err) {
      setLoginError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 flex items-center justify-center px-4 py-8">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full opacity-20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-400 to-cyan-600 rounded-full opacity-20 blur-3xl" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative w-full max-w-md"
      >
        {/* Login Card */}
        <motion.div
          variants={itemVariants}
          className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/50 p-6 sm:p-8"
        >
          {/* Header */}
          <motion.div
            variants={itemVariants}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl shadow-lg mb-4">
              <Wallet className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
            
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome Back! 👋
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Sign in to access your financial dashboard
            </p>
          </motion.div>

          {/* Login Error Alert */}
          <AnimatePresence>
            {loginError && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
              >
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-medium text-red-800 dark:text-red-200">
                    {loginError}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <motion.div variants={itemVariants}>
              <Input
                label="Email Address"
                icon={Mail}
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="Enter your email"
                error={isSubmitted ? errors.email : ''}
              />
            </motion.div>

            {/* Password Field */}
            <motion.div variants={itemVariants}>
              <Input
                label="Password"
                icon={Lock}
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="Enter your password"
                error={isSubmitted ? errors.password : ''}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                }
              />
            </motion.div>

            {/* Forgot Password Link */}
            <motion.div variants={itemVariants} className="text-right">
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200"
              >
                Forgot your password?
              </Link>
            </motion.div>

            {/* Submit Button */}
            <motion.div variants={itemVariants}>
              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full py-3 sm:py-4"
                icon={!isLoading ? LogIn : undefined}
              >
                Sign In
              </Button>
            </motion.div>
          </form>

          {/* Register Link */}
          <motion.div
            variants={itemVariants}
            className="mt-8 text-center"
          >
            <p className="text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200"
              >
                Create one here
              </Link>
            </p>
          </motion.div>

          {/* Demo Credentials */}
          <motion.div
            variants={itemVariants}
            className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-2 font-medium">
              Demo Credentials
            </p>
            <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
              <div className="flex justify-between">
                <span>Email:</span>
                <span className="font-mono">demo@example.com</span>
              </div>
              <div className="flex justify-between">
                <span>Password:</span>
                <span className="font-mono">123456</span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.div
          variants={itemVariants}
          className="mt-8 text-center"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">
            By signing in, you agree to our{' '}
            <Link to="/terms" className="text-blue-600 hover:text-blue-700 dark:text-blue-400">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-blue-600 hover:text-blue-700 dark:text-blue-400">
              Privacy Policy
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
