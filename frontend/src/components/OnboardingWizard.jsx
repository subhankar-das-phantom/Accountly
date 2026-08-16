import React, { useState } from 'react';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  Globe, 
  Target, 
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  DollarSign
} from 'lucide-react';
import Button from './common/Button';

const currencies = [
  { code: 'INR', label: 'Indian Rupee (₹)', symbol: '₹' },
  { code: 'USD', label: 'US Dollar ($)', symbol: '$' },
  { code: 'EUR', label: 'Euro (€)', symbol: '€' },
  { code: 'GBP', label: 'British Pound (£)', symbol: '£' }
];

const steps = [
  { title: 'Welcome', icon: Building2 },
  { title: 'Organization', icon: Building2 },
  { title: 'Transparency', icon: Globe },
  { title: 'Ready', icon: CheckCircle }
];

const OnboardingWizard = ({ organization, onComplete }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: organization?.name || '',
    description: organization?.description || '',
    currencyCode: organization?.currency?.code || 'INR',
    publicAccess: organization?.settings?.publicAccess || false,
    fundTarget: organization?.settings?.fundTarget || '',
    publicTarget: organization?.settings?.publicTarget || false
  });

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleFinish = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        currency: {
          code: formData.currencyCode,
          locale: formData.currencyCode === 'INR' ? 'en-IN' : 'en-US' // Simplification
        },
        settings: {
          publicAccess: formData.publicAccess,
          fundTarget: formData.fundTarget ? Number(formData.fundTarget) : 0,
          publicTarget: formData.publicTarget,
          isOnboarded: true
        }
      };

      await api.put(`organizations/${organization._id}`, payload);
      
      onComplete();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => {
        const isActive = index === activeStep;
        const isCompleted = index < activeStep;
        return (
          <React.Fragment key={index}>
            <div className={`flex flex-col items-center ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                isActive ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30' : 
                isCompleted ? 'border-green-600 bg-green-50 dark:bg-green-900/30' : 
                'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800'
              }`}>
                {isCompleted ? <CheckCircle className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
              </div>
              <span className="text-xs font-medium mt-2 hidden sm:block">{step.title}</span>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-12 sm:w-24 h-1 mx-2 sm:mx-4 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-center py-8">
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4">Welcome to Accountly!</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto text-lg leading-relaxed">
              Let's set up your organization's financial workspace. This will only take a minute and will help you track contributions, expenses, and maintain transparency.
            </p>
          </motion.div>
        );
      case 1:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">What are you organizing?</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organization or Event Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 sm:py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="e.g. Annual College Cultural Event"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Short Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 sm:py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                placeholder="Describe your organization's purpose..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base Currency</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  name="currencyCode"
                  value={formData.currencyCode}
                  onChange={handleChange}
                  className="w-full pl-11 pr-4 py-2 sm:py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                >
                  {currencies.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Transparency & Targets</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Accountly is built for transparency. You can share a read-only public page showing financial activity.
            </p>

            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between cursor-pointer" onClick={() => setFormData(prev => ({...prev, publicAccess: !prev.publicAccess}))}>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Enable Public Transparency Page</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Allow anyone with the link to view your financial summary.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={formData.publicAccess} onChange={handleChange} name="publicAccess" />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="pt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fund Target (Optional)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-gray-500 font-semibold">{currencies.find(c => c.code === formData.currencyCode)?.symbol || ''}</span>
                </div>
                <input
                  type="number"
                  name="fundTarget"
                  value={formData.fundTarget}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 sm:py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Set a financial goal"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Leave empty if you don't have a specific goal.</p>
            </div>

            {Number(formData.fundTarget) > 0 && (
              <div className="p-4 rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 flex items-center justify-between cursor-pointer" onClick={() => setFormData(prev => ({...prev, publicTarget: !prev.publicTarget}))}>
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">Show Target Progress Publicly</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">Display a progress bar on the public page.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={formData.publicTarget} onChange={handleChange} name="publicTarget" />
                  <div className="w-11 h-6 bg-blue-200 peer-focus:outline-none rounded-full peer dark:bg-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-blue-400 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            )}
          </motion.div>
        );
      case 3:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-center py-8">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4">You're all set!</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto text-lg leading-relaxed">
              Your workspace is configured. Next, you can add other administrators, define custom contributor fields in Settings, and start recording your finances.
            </p>
            {error && (
              <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                {error}
              </div>
            )}
          </motion.div>
        );
      default:
        return 'Unknown step';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-900 flex flex-col pt-12 sm:pt-24 px-4 overflow-y-auto">
      <div className="w-full max-w-3xl mx-auto pb-24">
        {renderStepIndicator()}
        
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-6 sm:p-10 min-h-[400px]">
            <AnimatePresence mode="wait">
              {renderStepContent(activeStep)}
            </AnimatePresence>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-800/50 p-6 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <Button
              variant="secondary"
              disabled={activeStep === 0 || loading}
              onClick={handleBack}
              className={activeStep === 0 ? 'invisible' : ''}
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            
            {activeStep === steps.length - 1 ? (
              <Button 
                onClick={handleFinish} 
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 border-transparent text-white"
              >
                {loading ? 'Saving...' : 'Go to Dashboard'} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!formData.name && activeStep === 1}>
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
