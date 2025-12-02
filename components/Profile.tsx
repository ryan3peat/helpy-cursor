import React, { useState, useRef } from 'react';
import {
  AlertCircle, Heart, Settings, Plus, Trash2, X, Save, Camera,
  Image as ImageIcon, LogOut, Copy, Check, ChevronLeft, ChevronRight,
  CreditCard, Shield, Lock, Crown, Mail, Share2
} from 'lucide-react';
import { User, UserRole, BaseViewProps } from '../types';
import { createInvite } from '../services/inviteService';
import { createCheckoutSession, createPortalSession } from '../services/stripeService';

interface ProfileProps extends BaseViewProps {
  users: User[];
  onAdd: (user: Omit<User, 'id'>) => Promise<User | undefined>;
  onUpdate: (id: string, data: Partial<User>) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  currentUser: User;
  onLogout: () => void;
}

const Profile: React.FC<ProfileProps> = ({
  users, onAdd, onUpdate, onDelete, onBack, currentUser, onLogout, t
}) => {
  // Navigation State
  const [activeSection, setActiveSection] = useState<'main' | 'settings' | 'plan' | 'security' | 'payment'>('main');

  // Main Profile State
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Edit Profile Form State
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>(UserRole.CHILD);
  const [editAllergies, setEditAllergies] = useState<string[]>([]);
  const [editPreferences, setEditPreferences] = useState<string[]>([]);
  const [newAllergyInput, setNewAllergyInput] = useState('');
  const [newPreferenceInput, setNewPreferenceInput] = useState('');

  // Add User Form State
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.CHILD);

  // Settings State
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'core' | 'pro'>('free');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    plan: string;
    status: string;
    periodEnd?: string;
  } | null>(null);
  
  const [securityData, setSecurityData] = useState({
    email: currentUser.email || '',
    currentPassword: '',
    newPassword: ''
  });
  const [paymentData, setPaymentData] = useState({
    cardNumber: '',
    expiry: '',
    cvc: '',
    name: currentUser.name || ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const selectedUser = users.find(u => u.id === selectedUserId) || users[0];

  const resetForm = () => {
    setNewName('');
    setNewRole(UserRole.CHILD);
  };

  // Stripe Checkout Handler
  const handleSelectPlan = async (plan: 'core' | 'pro', period: 'monthly' | 'yearly') => {
    try {
      setIsLoading(true);
      const checkoutUrl = await createCheckoutSession(
        currentUser.householdId,
        plan,
        period,
        currentUser.email || ''
      );
      
      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Checkout error:', error);
      alert(error instanceof Error ? error.message : 'Failed to start checkout. Please try again.');
      setIsLoading(false);
    }
  };

  // Stripe Portal Handler (for managing existing subscription)
  const handleManageSubscription = async () => {
    try {
      setIsLoading(true);
      const portalUrl = await createPortalSession(currentUser.householdId);
      window.location.href = portalUrl;
    } catch (error) {
      console.error('Portal error:', error);
      alert(error instanceof Error ? error.message : 'Failed to open subscription management.');
      setIsLoading(false);
    }
  };

  // --- Helper Functions ---
  // Colors based on brand palette: #3EAFD2, #FF9800, #7E57C2, #4CAF50, #F06292, #AB47BC, #757575
  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.MASTER: return 'bg-[#E6F7FB] text-[#3EAFD2]';
      case UserRole.SPOUSE: return 'bg-[#F3E5F5] text-[#AB47BC]';
      case UserRole.HELPER: return 'bg-[#FFF3E0] text-[#FF9800]';
      case UserRole.CHILD: return 'bg-[#E8F5E9] text-[#4CAF50]';
      default: return 'bg-[#F5F5F5] text-[#757575]';
    }
  };

  const handleAddUser = async () => {
    if (!newName.trim()) return;
    const newUser: Omit<User, 'id'> = {
      householdId: currentUser.householdId,
      email: '',
      name: newName,
      role: newRole,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(newName)}`,
      allergies: [],
      preferences: [],
      status: 'pending'
    };
    const createdUser = await onAdd(newUser);
    if (createdUser) {
      const link = await createInvite({
        name: newName,
        role: newRole,
        householdId: currentUser.householdId,
        inviterId: currentUser.id
      });
      setInviteLink(link.inviteLink);
    }
    resetForm();
    setIsAddModalOpen(false);
  };

  const handleDeleteUser = (id: string) => {
    if (window.confirm(t['profile.confirmDelete'] || 'Delete this user?')) {
      onDelete(id);
      if (selectedUserId === id) {
        setSelectedUserId(currentUser.id);
      }
    }
  };

  const handleReinvite = async (userId: string) => {
    try {
      const { resendInvite } = await import('../services/inviteService');
      const result = await resendInvite(userId, currentUser.householdId);
      setInviteLink(result.inviteLink);
      setIsCopied(false);
    } catch (error) {
      console.error('Failed to resend invite:', error);
      alert('Failed to generate new invite link');
    }
  };

  const handleCopyInvite = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleOpenEdit = () => {
    setEditName(selectedUser.name);
    setEditRole(selectedUser.role);
    setEditAllergies([...(selectedUser.allergies || [])]);
    setEditPreferences([...(selectedUser.preferences || [])]);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    onUpdate(selectedUser.id, {
      name: editName,
      role: editRole,
      allergies: editAllergies,
      preferences: editPreferences
    });
    setIsEditModalOpen(false);
  };

  const addAllergy = () => {
    if (newAllergyInput.trim() && !editAllergies.includes(newAllergyInput.trim())) {
      setEditAllergies([...editAllergies, newAllergyInput.trim()]);
      setNewAllergyInput('');
    }
  };

  const removeAllergy = (item: string) => {
    setEditAllergies(editAllergies.filter(a => a !== item));
  };

  const addPreference = () => {
    if (newPreferenceInput.trim() && !editPreferences.includes(newPreferenceInput.trim())) {
      setEditPreferences([...editPreferences, newPreferenceInput.trim()]);
      setNewPreferenceInput('');
    }
  };

  const removePreference = (item: string) => {
    setEditPreferences(editPreferences.filter(p => p !== item));
  };

  const renderSettingsHeader = (title: string, onBackOverride?: () => void) => (
    <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3 z-10">
      <button
        onClick={onBackOverride || (() => setActiveSection('main'))}
        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
      >
        <ChevronLeft size={24} className="text-gray-700" />
      </button>
      <h2 className="text-xl font-bold text-gray-800">{title}</h2>
    </div>
  );

  // =====================================================
  // MAIN PROFILE VIEW
  // =====================================================
  if (activeSection === 'main') {
    return (
      <div className="h-full overflow-y-auto pb-24 bg-gradient-to-b from-gray-50 to-white">
        {/* Header with Logout */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-gray-800">{t['nav.profile']}</h1>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
          >
            <LogOut size={18} />
            <span className="text-sm font-semibold">{t['profile.logout']}</span>
          </button>
        </div>

        <div className="px-4 pt-6 space-y-6">
          {/* Invite Link Modal */}
          {inviteLink && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl animate-slide-up">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800">Invitation Link</h3>
                  <button onClick={() => setInviteLink(null)} className="p-2 hover:bg-gray-100 rounded-full">
                    <X size={20} />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mb-4">Share this link with the new member:</p>
                <div className="bg-gray-50 p-3 rounded-xl mb-4 break-all text-sm font-mono text-gray-700">
                  {inviteLink}
                </div>
                <button
                  onClick={handleCopyInvite}
                  className="w-full bg-brand-primary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-secondary transition-colors"
                >
                  {isCopied ? <Check size={18} /> : <Copy size={18} />}
                  {isCopied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}

          {/* User Carousel */}
          <div className="bg-gradient-to-br from-brand-primary to-brand-secondary rounded-3xl p-6 shadow-lg">
            <h2 className="text-white text-lg font-bold mb-4">{t['profile.familyMembers']}</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {users.map((user) => {
                const isCurrent = user.id === currentUser.id;
                const isSelected = user.id === selectedUserId;
                return (
                  <div
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id)}
                    className={`flex flex-col items-center gap-2 cursor-pointer transition-all ${isSelected ? 'scale-110' : 'scale-95 opacity-60'
                      }`}
                  >
                    <div className={`w-16 h-16 rounded-full overflow-hidden border-4 ${isSelected ? 'border-white shadow-xl' : 'border-white/50'
                      }`}>
                      <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    </div>
                    <span className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-white/70'}`}>
                      {user.name.split(' ')[0]} {isCurrent ? '(You)' : ''}
                    </span>
                    {user.status === 'pending' && (
                      <span className="text-[10px] text-orange-300 font-bold">Pending</span>
                    )}
                  </div>
                );
              })}
              <div
                onClick={() => setIsAddModalOpen(true)}
                className="flex flex-col items-center gap-2 cursor-pointer scale-95 opacity-60 hover:opacity-100 transition-opacity"
              >
                <div id="onboarding-add-member-btn" className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/50">
                  <Plus size={24} className="text-white" />
                </div>
                <span className="text-xs font-medium text-white/70">{t['common.add']}</span>
              </div>
            </div>
          </div>

          {/* Selected User Profile Card */}
          {selectedUser && (
            <div className="bg-white rounded-3xl shadow-sm p-6 mb-6 animate-fade-in relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 flex gap-2">
                {selectedUser.id !== currentUser.id && (
                  <button
                    onClick={() => handleDeleteUser(selectedUser.id)}
                    className="p-2 text-red-300 hover:text-red-500 bg-red-50 rounded-full transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <button
                  onClick={handleOpenEdit}
                  className="p-2 text-gray-400 hover:text-brand-primary bg-gray-50 rounded-full"
                >
                  <Settings size={18} />
                </button>
                {selectedUser.status === 'pending' && (
                  <button
                    onClick={() => handleReinvite(selectedUser.id)}
                    className="p-2 text-blue-500 hover:text-blue-700 bg-blue-50 rounded-full transition-colors"
                  >
                    <Share2 size={18} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="relative group">
                  <div
                    className="w-20 h-20 rounded-2xl overflow-hidden shadow-md bg-gray-100 cursor-pointer"
                    onClick={() => setShowPhotoOptions(true)}
                  >
                    <img src={selectedUser.avatar} alt={selectedUser.name} className="w-full h-full object-cover" />
                  </div>
                  <button
                    onClick={() => setShowPhotoOptions(true)}
                    className="absolute -bottom-1 -right-1 bg-brand-primary text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Camera size={14} />
                  </button>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{selectedUser.name}</h3>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mt-1 ${getRoleBadgeColor(selectedUser.role)}`}>
                    {selectedUser.role}
                  </span>
                </div>
              </div>

              {/* Allergies */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={16} className="text-red-500" />
                  <h4 className="text-sm font-bold text-gray-700">{t['profile.allergies']}</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedUser.allergies && selectedUser.allergies.length > 0 ? (
                    selectedUser.allergies.map((allergy) => (
                      <span key={allergy} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium">
                        {allergy}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 italic">{t['profile.none']}</span>
                  )}
                </div>
              </div>

              {/* Preferences */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Heart size={16} className="text-pink-500" />
                  <h4 className="text-sm font-bold text-gray-700">{t['profile.preferences']}</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedUser.preferences && selectedUser.preferences.length > 0 ? (
                    selectedUser.preferences.map((pref) => (
                      <span key={pref} className="px-3 py-1 bg-pink-50 text-pink-700 rounded-full text-xs font-medium">
                        {pref}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 italic">{t['profile.none']}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quick Settings Button */}
          <button
            onClick={() => setActiveSection('settings')}
            className="w-full bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-xl flex items-center justify-center">
                <Settings size={20} className="text-white" />
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-800">Settings</p>
                <p className="text-xs text-gray-500">Manage your account</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Add User Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 animate-slide-up shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800">{t['profile.addMember']}</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t['common.name']}</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    placeholder="Enter name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t['profile.role']}</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  >
                    <option value={UserRole.SPOUSE}>Spouse</option>
                    <option value={UserRole.HELPER}>Helper</option>
                    <option value={UserRole.CHILD}>Child</option>
                  </select>
                </div>
                <button
                  onClick={handleAddUser}
                  className="w-full bg-brand-primary text-white py-4 rounded-xl font-bold shadow-lg hover:bg-brand-secondary transition-colors"
                >
                  {t['common.add']}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {isEditModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
            <div className="bg-white rounded-3xl w-full max-w-lg p-6 animate-slide-up shadow-2xl my-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800">Edit Profile</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  >
                    <option value={UserRole.MASTER}>Master</option>
                    <option value={UserRole.SPOUSE}>Spouse</option>
                    <option value={UserRole.HELPER}>Helper</option>
                    <option value={UserRole.CHILD}>Child</option>
                  </select>
                </div>

                {/* Allergies */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Allergies</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newAllergyInput}
                      onChange={(e) => setNewAllergyInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addAllergy()}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      placeholder="Add allergy"
                    />
                    <button onClick={addAllergy} className="px-4 py-2 bg-brand-primary text-white rounded-xl font-semibold">
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editAllergies.map((allergy) => (
                      <span key={allergy} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium flex items-center gap-1">
                        {allergy}
                        <button onClick={() => removeAllergy(allergy)} className="hover:bg-red-200 rounded-full p-0.5">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Preferences */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Preferences</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newPreferenceInput}
                      onChange={(e) => setNewPreferenceInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addPreference()}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      placeholder="Add preference"
                    />
                    <button onClick={addPreference} className="px-4 py-2 bg-brand-primary text-white rounded-xl font-semibold">
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editPreferences.map((pref) => (
                      <span key={pref} className="px-3 py-1 bg-pink-50 text-pink-700 rounded-full text-xs font-medium flex items-center gap-1">
                        {pref}
                        <button onClick={() => removePreference(pref)} className="hover:bg-pink-200 rounded-full p-0.5">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 bg-brand-primary text-white py-3 rounded-xl font-bold hover:bg-brand-secondary transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Photo Options Modal */}
        {showPhotoOptions && (
          <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 animate-slide-up">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Change Photo</h3>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    cameraInputRef.current?.click();
                    setShowPhotoOptions(false);
                  }}
                  className="w-full flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <Camera size={20} className="text-gray-600" />
                  <span className="font-semibold text-gray-700">Take Photo</span>
                </button>
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowPhotoOptions(false);
                  }}
                  className="w-full flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <ImageIcon size={20} className="text-gray-600" />
                  <span className="font-semibold text-gray-700">Choose from Library</span>
                </button>
                <button
                  onClick={() => setShowPhotoOptions(false)}
                  className="w-full p-4 bg-gray-100 rounded-xl font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" />
      </div>
    );
  }

  // =====================================================
  // PLAN SELECTION VIEW
  // =====================================================
  if (activeSection === 'plan') {
    const plans = [
      {
        id: 'free',
        name: 'Free',
        monthlyPrice: 0,
        yearlyPrice: 0,
        features: ['Up to 4 family members', 'Basic features'],
        highlight: false
      },
      {
        id: 'core',
        name: 'Core',
        monthlyPrice: 88,
        yearlyPrice: 850,
        features: ['Up to 6 family members', '2 helpers', 'Receipt scanning', 'Priority support'],
        highlight: false
      },
      {
        id: 'pro',
        name: 'Pro',
        monthlyPrice: 118,
        yearlyPrice: 1080,
        features: ['Up to 10 family members', 'Unlimited helpers', 'Advanced AI', 'Data export', 'Premium support'],
        highlight: true
      }
    ];

    return (
      <div className="px-4 pt-16 pb-24 h-full animate-slide-up flex flex-col overflow-y-auto">
        {renderSettingsHeader('Choose Your Plan')}

        {/* Billing Period Toggle */}
        <div className="mt-6 mb-6 flex justify-center">
          <div className="bg-gray-100 rounded-full p-1 inline-flex">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-white text-brand-primary shadow-sm'
                  : 'text-gray-600'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${
                billingPeriod === 'yearly'
                  ? 'bg-white text-brand-primary shadow-sm'
                  : 'text-gray-600'
              }`}
            >
              Yearly
              <span className="ml-1 text-xs text-green-600">Save 20%</span>
            </button>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="space-y-4 mb-6">
          {plans.map((p) => {
            const price = billingPeriod === 'monthly' ? p.monthlyPrice : p.yearlyPrice;
            const isCurrentPlan = selectedPlan === p.id;
            const isFree = p.id === 'free';

            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl p-6 border-2 transition-all ${
                  p.highlight
                    ? 'border-brand-primary shadow-lg'
                    : isCurrentPlan
                    ? 'border-brand-primary'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{p.name}</h3>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-bold text-gray-900">
                        ${price}
                      </span>
                      {!isFree && (
                        <span className="text-gray-500 text-sm">
                          /{billingPeriod === 'monthly' ? 'mo' : 'yr'}
                        </span>
                      )}
                    </div>
                  </div>
                  {p.highlight && (
                    <span className="bg-brand-primary text-white text-xs font-bold px-3 py-1 rounded-full">
                      Popular
                    </span>
                  )}
                </div>

                <ul className="space-y-2 mb-6">
                  {p.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                      <Check size={16} className="text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {!isFree ? (
                  <button
                    onClick={() => handleSelectPlan(p.id as 'core' | 'pro', billingPeriod)}
                    disabled={isLoading}
                    className={`w-full py-3 rounded-xl font-bold transition-all ${
                      isCurrentPlan
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-brand-primary text-white hover:bg-brand-secondary'
                    }`}
                  >
                    {isLoading ? 'Processing...' : isCurrentPlan ? 'Current Plan' : 'Select Plan'}
                  </button>
                ) : (
                  <div className="w-full py-3 text-center text-gray-500 text-sm font-semibold">
                    Always Free
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Manage Subscription Button (if they have an active subscription) */}
        {subscriptionInfo?.status === 'active' && (
          <button
            onClick={handleManageSubscription}
            disabled={isLoading}
            className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
          >
            {isLoading ? 'Loading...' : 'Manage Subscription'}
          </button>
        )}
      </div>
    );
  }

  // =====================================================
  // SECURITY VIEW
  // =====================================================
  if (activeSection === 'security') {
    return (
      <div className="px-4 pt-16 pb-24 h-full animate-slide-up flex flex-col">
        {renderSettingsHeader('Update Credentials')}
        <div className="space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 ml-1">Email Address</label>
            <div className="relative">
              <input
                type="email"
                value={securityData.email}
                onChange={e => setSecurityData({ ...securityData, email: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-medium focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none pl-10"
              />
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 ml-1">Current Password</label>
            <div className="relative">
              <input
                type="password"
                placeholder="••••••••"
                value={securityData.currentPassword}
                onChange={e => setSecurityData({ ...securityData, currentPassword: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-medium focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none pl-10"
              />
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 ml-1">New Password</label>
            <div className="relative">
              <input
                type="password"
                placeholder="••••••••"
                value={securityData.newPassword}
                onChange={e => setSecurityData({ ...securityData, newPassword: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-medium focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none pl-10"
              />
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
        </div>
        <div className="mt-auto pt-4">
          <button onClick={() => setActiveSection('settings')} className="w-full bg-brand-primary text-white py-4 rounded-xl font-bold shadow-lg hover:bg-brand-secondary transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  // =====================================================
  // PAYMENT VIEW
  // =====================================================
  if (activeSection === 'payment') {
    return (
      <div className="px-4 pt-16 pb-24 h-full animate-slide-up flex flex-col">
        {renderSettingsHeader('Payment Method')}

        {/* Card Preview */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 text-white shadow-xl mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="flex justify-between items-start mb-8">
            <CreditCard size={24} className="opacity-80" />
            <span className="text-xs font-mono bg-white/10 px-2 py-1 rounded">DEBIT</span>
          </div>
          <div className="text-xl font-mono tracking-widest mb-4">
            {paymentData.cardNumber || '•••• •••• •••• ••••'}
          </div>
          <div className="flex justify-between text-sm">
            <span className="opacity-70">{paymentData.name || 'CARDHOLDER'}</span>
            <span className="opacity-70">{paymentData.expiry || 'MM/YY'}</span>
          </div>
        </div>

        <div className="space-y-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 ml-1">Card Number</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="1234 5678 9012 3456"
              maxLength={19}
              value={paymentData.cardNumber}
              onChange={e => {
                // Only allow digits and format with spaces every 4 digits
                const digitsOnly = e.target.value.replace(/\D/g, '');
                const formatted = digitsOnly.replace(/(\d{4})(?=\d)/g, '$1 ').slice(0, 19);
                setPaymentData({ ...paymentData, cardNumber: formatted });
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-mono text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 ml-1">Expiry</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="MM/YY"
                maxLength={5}
                value={paymentData.expiry}
                onChange={e => {
                  // Only allow digits and auto-format as MM/YY
                  const digitsOnly = e.target.value.replace(/\D/g, '');
                  let formatted = digitsOnly;
                  if (digitsOnly.length >= 2) {
                    formatted = digitsOnly.slice(0, 2) + '/' + digitsOnly.slice(2, 4);
                  }
                  setPaymentData({ ...paymentData, expiry: formatted });
                }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-mono text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 ml-1">CVC</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="123"
                maxLength={4}
                value={paymentData.cvc}
                onChange={e => {
                  // Only allow digits for CVC
                  const value = e.target.value.replace(/\D/g, '');
                  setPaymentData({ ...paymentData, cvc: value });
                }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-mono text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 ml-1">Cardholder Name</label>
            <input
              type="text"
              placeholder="Name on card"
              value={paymentData.name}
              onChange={e => setPaymentData({ ...paymentData, name: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-medium text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none"
            />
          </div>
        </div>

        <div className="mt-auto pt-4">
          <button onClick={() => setActiveSection('settings')} className="w-full bg-brand-primary text-white py-4 rounded-xl font-bold shadow-lg hover:bg-brand-secondary transition-colors">
            Save Payment Method
          </button>
        </div>
      </div>
    );
  }

  // =====================================================
  // SETTINGS MENU VIEW
  // =====================================================
  if (activeSection === 'settings') {
    return (
      <div className="px-4 pt-16 pb-24 h-full animate-slide-up flex flex-col">
        {renderSettingsHeader('Settings', () => setActiveSection('main'))}

        <div className="space-y-3">
          {[
            { id: 'plan', label: 'Change Plan', icon: Crown, desc: 'Manage your subscription' },
            { id: 'security', label: 'Update Credentials', icon: Shield, desc: 'Email & Password' },
            { id: 'payment', label: 'Manage Payment', icon: CreditCard, desc: 'Cards & Billing' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as any)}
              className="w-full bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-xl flex items-center justify-center">
                  <item.icon size={20} className="text-white" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-800">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-gray-400" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
};

export default Profile;