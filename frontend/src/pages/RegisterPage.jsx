import React, { useState, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  User,
  UserPlus,
  AlertCircle,
  CheckCircle,
  Check,
  Shield
} from 'lucide-react';
import Input from '../components/common/Input';
import Button from '../components/common/Button';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  const { register, token } = useContext(AuthContext);
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

  // Password strength checker
  const getPasswordStrength = (password) => {
    let strength = 0;
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
    
    Object.values(checks).forEach(check => {
      if (check) strength++;
    });
    
    return { strength, checks };
  };

  const passwordAnalysis = getPasswordStrength(formData.password);

  // Form validation
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }
    
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
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
    if (registerError) {
      setRegisterError('');
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitted(true);
    setRegisterError('');
    setSuccessMessage('');
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await register(formData.username, formData.email, formData.password);
      
      if (result.success) {
        setSuccessMessage('Account created successfully! Redirecting to the dashboard...');
        
        // Success animation delay
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        setRegisterError(result.error || 'Registration failed. Please try again.');
        setIsLoading(false);
      }
      
    } catch (err) {
      // Fallback for unexpected errors
      setRegisterError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 flex items-center justify-center px-4 py-8">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400 to-cyan-600 rounded-full opacity-20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full opacity-20 blur-3xl" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative w-full max-w-md"
      >
        {/* Register Card */}
        <motion.div
          variants={itemVariants}
          className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/50 p-6 sm:p-8"
        >
          {/* Header */}
          <motion.div
            variants={itemVariants}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl shadow-lg mb-4">
              <UserPlus className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
            
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Create Account 🚀
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Join thousands managing their finances smartly
            </p>
          </motion.div>

          {/* Success Message */}
          <AnimatePresence>
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl"
              >
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    {successMessage}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Register Error Alert */}
          <AnimatePresence>
            {registerError && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
              >
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-medium text-red-800 dark:text-red-200">
                    {registerError}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Field */}
            <motion.div variants={itemVariants}>
              <Input
                label="Username"
                icon={User}
                type="text"
                value={formData.username}
                onChange={(e) => handleChange('username', e.target.value)}
                placeholder="Choose a username"
                error={isSubmitted ? errors.username : ''}
              />
            </motion.div>

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
                placeholder="Create a strong password"
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
              
              {/* Password Strength Indicator */}
              {formData.password && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          passwordAnalysis.strength <= 2 ? 'bg-red-500' :
                          passwordAnalysis.strength <= 3 ? 'bg-yellow-500' :
                          passwordAnalysis.strength <= 4 ? 'bg-blue-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${(passwordAnalysis.strength / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {passwordAnalysis.strength <= 2 ? 'Weak' :
                       passwordAnalysis.strength <= 3 ? 'Fair' :
                       passwordAnalysis.strength <= 4 ? 'Good' : 'Strong'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {Object.entries(passwordAnalysis.checks).map(([key, passed]) => (
                      <div key={key} className={`flex items-center space-x-1 ${passed ? 'text-green-600' : 'text-gray-400'}`}>
                        <Check className={`h-3 w-3 ${passed ? 'text-green-600' : 'text-gray-400'}`} />
                        <span>
                          {key === 'length' ? '8+ chars' :
                           key === 'lowercase' ? 'Lowercase' :
                           key === 'uppercase' ? 'Uppercase' :
                           key === 'number' ? 'Number' : 'Special'}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* Confirm Password Field */}
            <motion.div variants={itemVariants}>
              <Input
                label="Confirm Password"
                icon={Shield}
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                placeholder="Confirm your password"
                error={isSubmitted ? errors.confirmPassword : ''}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200 focus:outline-none"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                }
              />
            </motion.div>

            {/* Submit Button */}
            <motion.div variants={itemVariants}>
              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
                icon={!isLoading ? UserPlus : undefined}
              >
                Create Account
              </Button>
            </motion.div>
          </form>

          {/* Login Link */}
          <motion.div
            variants={itemVariants}
            className="mt-8 text-center"
          >
            <p className="text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-cyan-600 hover:text-blue-700 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors duration-200"
              >
                Sign in here
              </Link>
            </p>
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.div
          variants={itemVariants}
          className="mt-8 text-center"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">
            By creating an account, you agree to our{' '}
            <Link to="/terms" className="text-cyan-600 hover:text-blue-700 dark:text-cyan-400">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-cyan-600 hover:text-blue-700 dark:text-cyan-400">
              Privacy Policy
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
