import React, { useContext, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../context/AuthContext';
import { 
  Wallet, 
  User, 
  LogOut, 
  Menu, 
  X, 
  Home, 
  CreditCard,
  UserPlus,
  LogIn,
  PieChart,
  PiggyBank
} from 'lucide-react';
import Button from './common/Button';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const isActiveLink = (path) => location.pathname === path;

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center space-x-2"
          >
            <Link to="/" className="flex items-center space-x-2 group">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-base sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                FinanceTracker
              </span>
            </Link>
          </motion.div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {user ? (
              <>
                {/* Navigation Links */}
                <NavItem 
                  to="/" 
                  icon={Home} 
                  label="Dashboard" 
                  isActive={isActiveLink('/')}
                />
                <NavItem 
                  to="/transactions" 
                  icon={CreditCard} 
                  label="Transactions" 
                  isActive={isActiveLink('/transactions')}
                />
                <NavItem 
                  to="/analytics" 
                  icon={PieChart} 
                  label="Analytics" 
                  isActive={isActiveLink('/analytics')}
                />
                <NavItem 
                  to="/budget" 
                  icon={PiggyBank} 
                  label="Budget" 
                  isActive={isActiveLink('/budget')}
                />
                  <div className="flex items-center space-x-4 ml-6 pl-6 border-l border-gray-200 dark:border-gray-700">
                    <Link to="/profile">
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ scale: 1.05 }}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-white">
                            {user.username?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden lg:block">
                          {user.username}
                        </span>
                      </motion.div>
                    </Link>
                    
                    <Button
                      variant="danger"
                      onClick={logout}
                      className="ml-4"
                      icon={LogOut}
                    >
                      <span className="hidden lg:inline">Logout</span>
                    </Button>
                  </div>
              </>
            ) : (
              <>
                <NavItem 
                  to="/login" 
                  icon={LogIn} 
                  label="Login" 
                  isActive={isActiveLink('/login')}
                />
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center space-x-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow duration-200"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Register</span>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={toggleMobileMenu}
            className="md:hidden p-1.5 sm:p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <Menu className="h-5 w-5 sm:h-6 sm:w-6" />}
          </motion.button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200/50 dark:border-gray-700/50"
          >
            <div className="px-4 py-4 space-y-2">
              {user ? (
                <>
                  <MobileNavItem 
                    to="/" 
                    icon={Home} 
                    label="Dashboard" 
                    onClick={() => setIsMobileMenuOpen(false)}
                  />
                  <MobileNavItem 
                    to="/transactions" 
                    icon={CreditCard} 
                    label="Transactions" 
                    onClick={() => setIsMobileMenuOpen(false)}
                  />
                  <MobileNavItem 
                    to="/analytics" 
                    icon={PieChart} 
                    label="Analytics" 
                    onClick={() => setIsMobileMenuOpen(false)}
                  />
                  <MobileNavItem 
                    to="/budget" 
                    icon={PiggyBank} 
                    label="Budget" 
                    onClick={() => setIsMobileMenuOpen(false)}
                  />
                  
                  {/* User Info */}
                  <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                    <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)}>
                      <div className="flex items-center space-x-3 px-3 py-2 hover:bg-cyan-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-white">
                            {user.username?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {user.username}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            View Profile
                          </span>
                        </div>
                      </div>
                    </Link>
                    <Button
                      variant="danger"
                      onClick={() => {
                        logout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full justify-start"
                      icon={LogOut}
                    >
                      Logout
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <MobileNavItem 
                    to="/login" 
                    icon={LogIn} 
                    label="Login" 
                    onClick={() => setIsMobileMenuOpen(false)}
                  />
                  <MobileNavItem 
                    to="/register" 
                    icon={UserPlus} 
                    label="Register" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    isPrimary={true}
                  />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

// Desktop Navigation Item Component
const NavItem = ({ to, icon: Icon, label, isActive }) => (
  <motion.div
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
  >
    <Link
      to={to}
      className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/60 text-blue-700 dark:text-blue-50'
          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  </motion.div>
);

// Mobile Navigation Item Component
const MobileNavItem = ({ to, icon: Icon, label, onClick, isPrimary = false }) => (
  <motion.div
    whileTap={{ scale: 0.95 }}
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.3 }}
  >
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center space-x-2 px-2.5 py-2 sm:px-3 sm:py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
        isPrimary
          ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white'
          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  </motion.div>
);

export default Navbar;
