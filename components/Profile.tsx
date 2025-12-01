import React, { useState, useRef } from 'react';
import {
  AlertCircle, Heart, Settings, Plus, Trash2, X, Save, Camera,
  Image as ImageIcon, LogOut, Copy, Check, ChevronLeft, ChevronRight,
  CreditCard, Shield, Lock, Crown, Mail, Share2
} from 'lucide-react';
import { User, UserRole, BaseViewProps } from '../types';
import { createInvite } from '../services/inviteService';

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
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'plus' | 'family'>('free');
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

  // --- Helper Functions ---
  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.MASTER: return 'bg-blue-100 text-blue-700';
      case UserRole.SPOUSE: return 'bg-purple-100 text-purple-700';
      case UserRole.HELPER: return 'bg-orange-100 text-orange-700';
      case UserRole.CHILD: return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  // --- User Management Handlers ---
  const handleAddUser = async () => {
    if (!newName.trim()) return;

    // For CHILD: Add directly to Supabase (no Clerk invite needed)
    if (newRole === UserRole.CHILD) {
      const childUser: Omit<User, 'id'> = {
        householdId: currentUser.householdId,
        name: newName,
        email: `${newName.toLowerCase().replace(/\s/g, '')}@${currentUser.householdId}.helpy`,
        role: newRole,
        avatar: `https://picsum.photos/200/200?random=${Date.now()}`,
        allergies: [],
        preferences: [],
        status: 'active',
        expiresAt: null
      };
      await onAdd(childUser);
      setIsAddModalOpen(false);
      resetForm();
      return;
    }

    try {
      const { user, inviteLink: link } = await createInvite({
        name: newName,
        role: newRole,
        householdId: currentUser.householdId,
        inviterId: currentUser.id
      });
      
      setInviteLink(link); // Show the invite modal
      setIsAddModalOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Failed to create invite:', error);
      alert(`Failed to create invite: ${error.message}`);
    }
  };
  
  const handleDeleteUser = async (id: string) => {
    if (users.length <= 1) {
      alert('Cannot delete the last family member.');
      return;
    }
    
    // Find the user to get their details for the confirmation message
    const userToDelete = users.find(u => u.id === id);
    if (!userToDelete) {
      alert('User not found.');
      return;
    }
    
    // Add confirmation dialog with user name
    const confirmDelete = window.confirm(
      `Are you sure you want to remove ${userToDelete.name} from your household?`
    );
    if (!confirmDelete) return;
    
    try {
      // CRITICAL: onDelete expects the user's ID 
      // This ID should match what's stored in your Supabase profiles table
      console.log('Deleting user:', {
        userId: id,
        userName: userToDelete.name,
        userEmail: userToDelete.email,
        userRole: userToDelete.role
      });
      
      await onDelete(id);
      
      // Update selected user after deletion
      if (selectedUserId === id) {
        const remaining = users.filter(u => u.id !== id);
        if (remaining.length > 0) setSelectedUserId(remaining[0].id);
      }
    } catch (error: any) {
      console.error('Delete failed:', error);
      
      // Provide more specific error message
      const errorMessage = error?.message || 'Failed to delete family member. Please try again.';
      alert(`Error: ${errorMessage}`);
    }
  };


  const handleOpenEdit = () => {
    if (!selectedUser) return;
    setEditName(selectedUser.name);
    setEditRole(selectedUser.role);
    setEditAllergies([...(selectedUser.allergies || [])]);
    setEditPreferences([...(selectedUser.preferences || [])]);
    setNewAllergyInput('');
    setNewPreferenceInput('');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    onUpdate(selectedUserId, {
      name: editName,
      role: editRole,
      allergies: editAllergies,
      preferences: editPreferences
    });
    setIsEditModalOpen(false);
  };

  const addAllergy = () => {
    if (newAllergyInput.trim()) {
      setEditAllergies([...editAllergies, newAllergyInput.trim()]);
      setNewAllergyInput('');
    }
  };

  const addPreference = () => {
    if (newPreferenceInput.trim()) {
      setEditPreferences([...editPreferences, newPreferenceInput.trim()]);
      setNewPreferenceInput('');
    }
  };

  // --- Invite Handlers ---
  const copyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const shareInviteLink = async () => {
    if (inviteLink && navigator.share) {
      await navigator.share({
        title: 'Join Helpy',
        text: 'Click the link to join our household on Helpy!',
        url: inviteLink
      });
    } else {
      copyInviteLink();
    }
  };

  const handleReinvite = (userId: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/invite?hid=${currentUser.householdId}&uid=${userId}`;
    setInviteLink(link);
  };

  // --- Photo Handlers ---
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Compress image before saving to reduce lag
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      // Resize to max 200x200 (avatar size)
      const maxSize = 200;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      // Convert to compressed JPEG (0.7 quality)
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
      
      onUpdate(selectedUserId, { avatar: compressedBase64 });
      setShowPhotoOptions(false);
      
      // Clean up
      URL.revokeObjectURL(img.src);
    };

    img.src = URL.createObjectURL(file);
  };

  // --- Settings Renderers ---
  const renderSettingsHeader = (title: string, onBackOverride?: () => void) => (
    <div className="flex items-center gap-3 mb-6">
      <button
        onClick={onBackOverride || (() => setActiveSection('settings'))}
        className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
      >
        <ChevronLeft size={20} className="text-gray-600" />
      </button>
      <h2 className="text-xl font-bold text-gray-800">{title}</h2>
    </div>
  );

  // --- Settings Views ---
  if (activeSection === 'plan') {
    return (
      <div className="px-4 pt-16 pb-24 h-full animate-slide-up flex flex-col">
        {renderSettingsHeader('Change Plan')}
        <div className="space-y-4">
          {[
            { id: 'free', name: 'Basic', price: 'Free', features: ['Up to 4 Members', 'Basic AI Suggestions'] },
            { id: 'plus', name: 'Helpy Plus', price: '$4.99/mo', features: ['Up to 8 Members', 'Advanced Receipt Scan', 'Priority Support'] },
            { id: 'family', name: 'Family Pro', price: '$9.99/mo', features: ['Unlimited Members', 'Full AI Features', 'Export Data'] },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPlan(p.id as any)}
              className={`w-full p-4 rounded-2xl border-2 transition-all text-left flex justify-between items-center ${
                selectedPlan === p.id ? 'border-brand-primary bg-blue-50/50' : 'border-gray-100 bg-white'
              }`}
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-bold text-lg ${selectedPlan === p.id ? 'text-brand-primary' : 'text-gray-800'}`}>
                    {p.name}
                  </span>
                  {p.id === 'plus' && <Crown size={16} className="text-yellow-500" />}
                </div>
                <p className="text-sm text-gray-500">{p.price}</p>
                <ul className="mt-2 space-y-1">
                  {p.features.map((f, i) => (
                    <li key={i} className="text-xs text-gray-400 flex items-center gap-1">
                      <Check size={12} className="text-green-500" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                selectedPlan === p.id ? 'border-brand-primary bg-brand-primary text-white' : 'border-gray-200'
              }`}>
                {selectedPlan === p.id && <Check size={14} strokeWidth={3} />}
              </div>
            </button>
          ))}
        </div>
        <div className="mt-auto pt-4">
          <button onClick={() => setActiveSection('settings')} className="w-full bg-brand-primary text-white py-4 rounded-xl font-bold shadow-lg hover:bg-brand-secondary transition-colors">
            Update Plan
          </button>
        </div>
      </div>
    );
  }

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
              placeholder="1234 5678 9012 3456"
              maxLength={19}
              value={paymentData.cardNumber}
              onChange={e => setPaymentData({ ...paymentData, cardNumber: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-mono text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 ml-1">Expiry</label>
              <input
                type="text"
                placeholder="MM/YY"
                maxLength={5}
                value={paymentData.expiry}
                onChange={e => setPaymentData({ ...paymentData, expiry: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-mono text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 ml-1">CVC</label>
              <input
                type="text"
                placeholder="123"
                maxLength={3}
                value={paymentData.cvc}
                onChange={e => setPaymentData({ ...paymentData, cvc: e.target.value })}
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
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <item.icon size={20} />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-gray-800 text-sm">{item.label}</h3>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // --- Main Profile View (Default) ---
  return (
    <div className="px-4 pt-16 pb-24 h-full animate-slide-up flex flex-col relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-brand-text">{t['profile.title']}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSection('settings')}
            className="p-2 rounded-full bg-white shadow-sm border border-gray-100 text-gray-500 hover:text-brand-primary hover:bg-gray-50 transition-colors"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={onBack}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <span className="text-sm font-bold text-gray-500 px-2">{t['profile.back']}</span>
          </button>
        </div>
      </div>

      {/* Family Carousel */}
      <div className="mb-8">
        <div className="flex gap-4 overflow-x-auto no-scrollbar py-2 px-1 items-start">
          {users.map(user => {
            const isSelected = user.id === selectedUserId;
            const isCurrent = user.id === currentUser.id;
            return (
              <div
                key={user.id}
                onClick={() => setSelectedUserId(user.id)}
                className={`flex flex-col items-center gap-2 cursor-pointer transition-all duration-300 ${isSelected ? 'scale-105 opacity-100' : 'scale-95 opacity-60'}`}
              >
                <div className={`w-16 h-16 rounded-full p-1 relative ${isSelected ? 'bg-brand-primary' : 'bg-transparent'}`}>
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full rounded-full object-cover border-2 border-white"
                  />
                  {isCurrent && (
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                  )}
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${isSelected ? 'text-brand-primary' : 'text-gray-500'}`}>
                  {user.name.split(' ')[0]} {isCurrent ? '(You)' : ''}
                </span>
                {user.status === 'pending' && (
                  <span className="text-[10px] text-orange-500 font-bold">Pending</span>
                )}
              </div>
            );
          })}
          <div
            onClick={() => setIsAddModalOpen(true)}
            className="flex flex-col items-center gap-2 cursor-pointer scale-95 opacity-60 hover:opacity-100 transition-opacity"
          >
            <div id="onboarding-add-member-btn" className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center border-2 border-white">
              <Plus size={24} className="text-gray-500" />
            </div>
            <span className="text-xs font-medium text-gray-500">{t['common.add']}</span>
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
                className="absolute -bottom-2 -right-2 p-2 bg-white rounded-full shadow-md text-gray-400 hover:text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera size={14} />
              </button>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{selectedUser.name}</h2>
              <span className={`inline-block mt-1 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide ${getRoleBadgeColor(selectedUser.role)}`}>
                {selectedUser.role}
              </span>
              {selectedUser.email && <p className="text-xs text-gray-400 mt-1">{selectedUser.email}</p>}
            </div>
          </div>

          {/* Allergies & Preferences */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={14} className="text-red-400" />
                <span className="text-xs font-bold text-gray-500">{t['profile.allergies']}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedUser.allergies && selectedUser.allergies.length > 0 ? (
                  selectedUser.allergies.map((allergy, i) => (
                    <span key={i} className="bg-red-50 text-red-600 border border-red-100 px-3 py-1 rounded-lg text-xs font-medium">
                      {allergy}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400 italic">{t['profile.none_added']}</span>
                )}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Heart size={14} className="text-green-500" />
                <span className="text-xs font-bold text-gray-500">{t['profile.preferences']}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedUser.preferences && selectedUser.preferences.length > 0 ? (
                  selectedUser.preferences.map((pref, i) => (
                    <span key={i} className="bg-green-50 text-green-700 border border-green-100 px-3 py-1 rounded-lg text-xs font-medium">
                      {pref}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400 italic">{t['profile.none_added']}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logout Button */}
      <button
        onClick={onLogout}
        className="mt-4 mb-6 w-full py-3 rounded-xl border-2 border-red-100 text-red-500 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
      >
        <LogOut size={18} />
        {t['profile.logout']}
      </button>

      {/* ==================== MODALS ==================== */}

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">{t['profile.add_member']}</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Sarah"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(UserRole).map(role => (
                    <button
                      key={role}
                      onClick={() => setNewRole(role)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-colors ${
                        newRole === role
                          ? 'bg-brand-primary text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8">
              <button
                onClick={handleAddUser}
                disabled={!newName.trim()}
                className="w-full bg-brand-primary text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                {t['profile.add_member']}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl animate-slide-up flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h3 className="text-xl font-bold text-gray-800">{t['profile.edit_profile']}</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto px-1 flex-1">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none font-semibold text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.values(UserRole).map(role => (
                      <button
                        key={role}
                        onClick={() => setEditRole(role)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-colors ${
                          editRole === role
                            ? 'bg-brand-primary text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Allergies Section */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">{t['profile.allergies']}</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newAllergyInput}
                    onChange={(e) => setNewAllergyInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addAllergy()}
                    placeholder="Add allergy..."
                    className="flex-1 bg-gray-50 border-none rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                  <button
                    onClick={addAllergy}
                    className="px-3 py-2 bg-red-100 text-red-600 rounded-xl text-xs font-bold hover:bg-red-200"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editAllergies.map((item, i) => (
                    <span key={i} className="bg-red-50 text-red-600 border border-red-100 pl-3 pr-1 py-1 rounded-lg text-xs font-medium flex items-center gap-1">
                      {item}
                      <button onClick={() => setEditAllergies(prev => prev.filter((_, idx) => idx !== i))} className="p-0.5 hover:bg-red-100 rounded-full">
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                  {editAllergies.length === 0 && <span className="text-xs text-gray-400 italic">{t['profile.none_added']}</span>}
                </div>
              </div>

              {/* Preferences Section */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">{t['profile.preferences']}</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newPreferenceInput}
                    onChange={(e) => setNewPreferenceInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addPreference()}
                    placeholder="Add preference..."
                    className="flex-1 bg-gray-50 border-none rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                  <button
                    onClick={addPreference}
                    className="px-3 py-2 bg-green-100 text-green-600 rounded-xl text-xs font-bold hover:bg-green-200"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editPreferences.map((item, i) => (
                    <span key={i} className="bg-green-50 text-green-700 border border-green-100 pl-3 pr-1 py-1 rounded-lg text-xs font-medium flex items-center gap-1">
                      {item}
                      <button onClick={() => setEditPreferences(prev => prev.filter((_, idx) => idx !== i))} className="p-0.5 hover:bg-green-100 rounded-full">
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                  {editPreferences.length === 0 && <span className="text-xs text-gray-400 italic">{t['profile.none_added']}</span>}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 shrink-0">
              <button
                onClick={handleSaveEdit}
                className="w-full bg-brand-primary text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand-secondary transition-colors"
              >
                <Save size={18} />
                {t['common.save'] || 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Link Modal */}
      {inviteLink && (
        <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-slide-up">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4">
                <Check size={32} />
              </div>
              <h3 className="text-2xl font-bold text-gray-800">Invite Ready!</h3>
              <p className="text-gray-500 text-sm mt-2">Share this link so they can join your household.</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center gap-3 mb-6 overflow-hidden">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-400 mb-1">{t['profile.invite_link']}</p>
                <p className="text-sm font-semibold text-brand-primary truncate">{inviteLink}</p>
              </div>
            </div>
            <button
              onClick={shareInviteLink}
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-brand-primary text-white hover:bg-brand-secondary transition-all mb-3"
            >
              <Share2 size={18} /> Share Link
            </button>
            <button
              onClick={copyInviteLink}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${isCopied ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {isCopied ? <Check size={18} /> : <Copy size={18} />}
              {isCopied ? t['profile.copied'] : t['profile.copy_link']}
            </button>
            <button
              onClick={() => setInviteLink(null)}
              className="w-full mt-3 py-3 rounded-xl text-gray-400 font-bold text-sm hover:bg-gray-50"
            >
              {t['common.cancel']}
            </button>
          </div>
        </div>
      )}

      {/* Photo Options Modal */}
      {showPhotoOptions && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">{t['profile.change_photo']}</h3>
              <button
                onClick={() => setShowPhotoOptions(false)}
                className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="w-full py-4 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center gap-3 font-bold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Camera size={20} />
                {t['profile.take_photo']}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center gap-3 font-bold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <ImageIcon size={20} />
                {t['profile.choose_library']}
              </button>
            </div>

            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handlePhotoSelect}
            />
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;