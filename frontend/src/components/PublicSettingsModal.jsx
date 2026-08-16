import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Globe, Link as LinkIcon, Loader2 } from 'lucide-react';
import Button from './common/Button';
import api from '../services/api';

const PublicSettingsModal = ({ onClose }) => {
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const [publicAccess, setPublicAccess] = useState(false);
  const [privacyPolicy, setPrivacyPolicy] = useState('anonymized');

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const res = await api.get('organizations');
        if (res.data && res.data.length > 0) {
          const org = res.data[0];
          setOrganization(org);
          setPublicAccess(org.settings?.publicAccess || false);
          setPrivacyPolicy(org.settings?.publicContributorNames || 'anonymized');
        }
      } catch (err) {
        console.error('Failed to fetch organization', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrg();
  }, []);

  const handleSave = async () => {
    if (!organization) return;
    try {
      setSaving(true);
      await api.patch(`organizations/${organization._id}/public-settings`, {
        publicAccess,
        publicContributorNames: privacyPolicy
      });
      onClose();
    } catch (err) {
      console.error('Failed to update settings', err);
      alert('Failed to update public settings.');
    } finally {
      setSaving(false);
    }
  };

  const publicLink = organization ? `${window.location.origin}/#/public/${organization.slug}` : '';

  const copyLink = () => {
    navigator.clipboard.writeText(publicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
          <Globe className="h-5 w-5 mr-2 text-blue-600" />
          Public Transparency Settings
        </h2>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      ) : organization ? (
        <div className="space-y-6">
          
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Enable Public Dashboard</h3>
              <p className="text-xs text-gray-500">Allow anyone with the link to view your financial summary.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={publicAccess}
                onChange={(e) => setPublicAccess(e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Contributor Privacy</h3>
            <p className="text-xs text-gray-500 mb-2">How should contributor names appear on the public page?</p>
            <select
              value={privacyPolicy}
              onChange={(e) => setPrivacyPolicy(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="anonymized">Anonymized (e.g. Rahul D.)</option>
              <option value="full">Full Names (e.g. Rahul Dravid)</option>
              <option value="anonymous">Fully Anonymous (e.g. Anonymous)</option>
            </select>
          </div>

          {publicAccess && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
               <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Public Link</h3>
               <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-2 rounded border border-blue-200 dark:border-blue-700">
                  <span className="text-xs truncate mr-2 text-gray-600 dark:text-gray-400 font-mono">{publicLink}</span>
                  <button onClick={copyLink} className="text-blue-600 hover:text-blue-800 p-1 flex-shrink-0">
                    {copied ? <span className="text-xs font-bold">Copied!</span> : <LinkIcon className="h-4 w-4" />}
                  </button>
               </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 mt-6">
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
               {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>

        </div>
      ) : (
        <div className="text-center text-gray-500 p-4">No organization found.</div>
      )}
    </div>
  );
};

export default PublicSettingsModal;
