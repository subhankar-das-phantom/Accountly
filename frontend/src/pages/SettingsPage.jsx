import React, { useState, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import { Globe, Settings as SettingsIcon, Plus, Trash2, Edit2, Loader2, Save, X, Users } from 'lucide-react';
import api from '../services/api';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { IntegrityCheck, AuditLogs } from '../components/AuditLogs';

const SettingsPage = () => {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);

  // Settings State
  const [publicAccess, setPublicAccess] = useState(false);
  const [privacyPolicy, setPrivacyPolicy] = useState('anonymized');
  const [savingPublic, setSavingPublic] = useState(false);

  const fetchOrg = async () => {
    try {
      setLoading(true);
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

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchOrg();
  }, [token, navigate]);

  const handleSavePublicSettings = async () => {
    if (!organization) return;
    try {
      setSavingPublic(true);
      await api.patch(`organizations/${organization._id}/public-settings`, {
        publicAccess,
        publicContributorNames: privacyPolicy
      });
      alert('Public settings updated successfully.');
    } catch (err) {
      console.error('Failed to update settings', err);
      alert('Failed to update public settings.');
    } finally {
      setSavingPublic(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 flex justify-center">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 flex justify-center text-gray-500">
        No organization found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 px-4 pb-12">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="flex items-center space-x-3 mb-6">
          <SettingsIcon className="h-8 w-8 text-gray-800 dark:text-white" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Organization Settings</h1>
        </div>

        {/* Public Transparency Settings */}
        <Card className="p-6">
          <div className="flex items-center mb-4">
            <Globe className="h-6 w-6 mr-2 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Public Transparency</h2>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
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
                className="w-full sm:max-w-xs px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="anonymized">Anonymized (e.g. Rahul D.)</option>
                <option value="full">Full Names (e.g. Rahul Dravid)</option>
                <option value="anonymous">Fully Anonymous (e.g. Anonymous)</option>
              </select>
            </div>

            {publicAccess && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Public Link</h3>
                <div className="flex items-center space-x-2">
                   <a href={`/#/public/${organization.slug}`} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline break-all">
                      {window.location.origin}/#/public/{organization.slug}
                   </a>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSavePublicSettings} disabled={savingPublic}>
                 {savingPublic ? 'Saving...' : 'Save Public Settings'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Contributor Fields Builder */}
        <ContributorFieldBuilder organization={organization} onRefresh={fetchOrg} />

        {/* Members & Access */}
        <OrganizationMembers organization={organization} />

        {/* Audit & Integrity */}
        <div className="pt-8 border-t border-gray-200 dark:border-gray-800">
          <IntegrityCheck organizationId={organization._id} />
          <AuditLogs organizationId={organization._id} />
        </div>

        {/* Danger Zone */}
        <OrganizationLifecycle organization={organization} onRefresh={fetchOrg} />
      </div>
    </div>
  );
};

// ... existing components ...
const ContributorFieldBuilder = ({ organization, onRefresh }) => {
  const [fields, setFields] = useState(organization.contributorFields || []);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    key: '',
    label: '',
    type: 'text',
    required: false,
    publicVisibility: 'visible',
    options: ''
  });

  const handleDelete = async (key) => {
    if (!window.confirm('Are you sure you want to remove this field? Historical data will be preserved.')) return;
    try {
      await api.delete(`organizations/${organization._id}/contributor-fields/${key}`);
      onRefresh();
    } catch (err) {
      alert('Failed to delete field.');
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        key: formData.key,
        label: formData.label,
        type: formData.type,
        required: formData.required,
        publicVisibility: formData.publicVisibility,
        options: formData.type === 'select' ? formData.options.split(',').map(s => s.trim()).filter(Boolean) : []
      };

      await api.post(`organizations/${organization._id}/contributor-fields`, payload);
      setFormData({ key: '', label: '', type: 'text', required: false, publicVisibility: 'visible', options: '' });
      setShowAdd(false);
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to add field.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Contributor Fields</h2>
          <p className="text-sm text-gray-500">Define custom metadata to collect for contributions.</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)} variant={showAdd ? 'secondary' : 'primary'} size="sm">
          {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4 mr-2" />}
          {showAdd ? 'Cancel' : 'Add Field'}
        </Button>
      </div>

      {showAdd && (
        <form onSubmit={handleAddSubmit} className="mb-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Field Key (Safe ID)</label>
              <input required type="text" value={formData.key} onChange={e => setFormData({...formData, key: e.target.value})} placeholder="e.g. department" className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Label (Display Name)</label>
              <input required type="text" value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})} placeholder="e.g. Department" className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
              <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="select">Select</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Public Visibility</label>
              <select value={formData.publicVisibility} onChange={e => setFormData({...formData, publicVisibility: e.target.value})} className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="visible">Visible Publicly</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
          </div>
          
          {formData.type === 'select' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Options (Comma separated)</label>
              <input required type="text" value={formData.options} onChange={e => setFormData({...formData, options: e.target.value})} placeholder="BCA, BBA, BHM" className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input type="checkbox" id="required" checked={formData.required} onChange={e => setFormData({...formData, required: e.target.checked})} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <label htmlFor="required" className="text-sm text-gray-700 dark:text-gray-300">Required Field</label>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Add Field'}
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {organization.contributorFields?.map(field => (
          <div key={field.key} className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-semibold text-gray-900 dark:text-white">{field.label}</h3>
                <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full font-mono">{field.key}</span>
                {field.required && <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">Required</span>}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-2">
                <span className="capitalize">{field.type}</span>
                <span>•</span>
                <span className={field.publicVisibility === 'hidden' ? 'text-orange-500' : 'text-green-500'}>
                  {field.publicVisibility === 'hidden' ? 'Private' : 'Public'}
                </span>
                {field.type === 'select' && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-[200px]">{field.options.join(', ')}</span>
                  </>
                )}
              </div>
            </div>
            <button onClick={() => handleDelete(field.key)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition">
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        ))}
        {(!organization.contributorFields || organization.contributorFields.length === 0) && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No contributor fields configured. Add one above.
          </div>
        )}
      </div>
    </Card>
  );
};

const OrganizationMembers = ({ organization }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('ADMIN');
  const [saving, setSaving] = useState(false);
  const { user } = useContext(AuthContext);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await api.get(`organizations/${organization._id}/members`);
      setMembers(res.data);
    } catch (err) {
      console.error('Failed to fetch members', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organization) fetchMembers();
  }, [organization]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`organizations/${organization._id}/members`, { email, role });
      setEmail('');
      setRole('ADMIN');
      setShowAdd(false);
      fetchMembers();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to add member.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    try {
      await api.delete(`organizations/${organization._id}/members/${memberId}`);
      fetchMembers();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to remove member.');
    }
  };

  if (loading) return null;

  const currentMembership = members.find(m => m.userId?._id === user?.id || m.userId === user?.id);
  const isOwner = currentMembership?.role === 'OWNER';

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Users className="h-6 w-6 mr-2 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Members & Access</h2>
            <p className="text-sm text-gray-500">Manage who can access and administer this organization.</p>
          </div>
        </div>
        {isOwner && (
          <Button onClick={() => setShowAdd(!showAdd)} variant={showAdd ? 'secondary' : 'primary'} size="sm">
            {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4 mr-2" />}
            {showAdd ? 'Cancel' : 'Add Member'}
          </Button>
        )}
      </div>

      {showAdd && isOwner && (
        <form onSubmit={handleAddMember} className="mb-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">User Email</label>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="User must already have an Accountly account" className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
              <select value={role} onChange={e => setRole(e.target.value)} className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="ADMIN">ADMIN (Manage financials & reports)</option>
                <option value="OWNER">OWNER (Full control including deletion)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? 'Adding...' : 'Add Member'}
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-800 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3 rounded-tl-lg">User</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3 text-right rounded-tr-lg">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map(member => (
              <tr key={member._id} className="border-b dark:border-gray-700 last:border-0">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                  {member.userId?.username} {member.userId?._id === user?.id && '(You)'}
                </td>
                <td className="px-4 py-3">{member.userId?.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${member.role === 'OWNER' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                    {member.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {isOwner && member.role !== 'OWNER' && (
                    <button onClick={() => handleRemoveMember(member._id)} className="text-red-500 hover:text-red-700">
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

const OrganizationLifecycle = ({ organization, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    if (organization) {
      api.get(`organizations/${organization._id}/members`).then(res => setMembers(res.data)).catch(console.error);
    }
  }, [organization]);

  const currentMembership = members.find(m => m.userId?._id === user?.id || m.userId === user?.id);
  const isOwner = currentMembership?.role === 'OWNER';

  if (!isOwner) return null; // Only OWNER can see Danger Zone

  const isArchived = organization.status === 'ARCHIVED';

  const handleAction = async () => {
    const action = isArchived ? 'restore' : 'archive';
    if (!window.confirm(`Are you sure you want to ${action} this organization?`)) return;

    setLoading(true);
    try {
      await api.post(`organizations/${organization._id}/${action}`);
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.message || `Failed to ${action} organization.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-8 border-t border-red-200 dark:border-red-900">
      <Card className="p-6 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">Danger Zone</h2>
            <p className="text-sm text-red-600 dark:text-red-300 mb-4 max-w-xl">
              {isArchived 
                ? "This organization is currently archived and read-only. Restoring it will allow new financial records to be added and edited."
                : "Archiving this organization will make it read-only. No new financial records can be added or edited, but all existing data and public pages will remain accessible."
              }
            </p>
          </div>
          <Button 
            onClick={handleAction} 
            disabled={loading}
            className={isArchived ? "bg-green-600 hover:bg-green-700 text-white border-transparent" : "bg-red-600 hover:bg-red-700 text-white border-transparent"}
          >
            {loading ? 'Processing...' : (isArchived ? 'Restore Organization' : 'Archive Organization')}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default SettingsPage;
