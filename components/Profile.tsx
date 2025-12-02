
import React, { useState, useRef } from 'react';
import { User, UserRole, BaseViewProps } from '../types';
import { 
  AlertCircle, Heart, Settings, Plus, Trash2, X, Save, Camera, 
  Image as ImageIcon, LogOut, Copy, Check, ChevronLeft, ChevronRight, 
  CreditCard, Shield, Lock, Crown, Mail 
} from 'lucide-react';

interface ProfileProps extends BaseViewProps {
  users: User[];
  onAdd: (user: Omit<User, 'id'>) => Promise<User | undefined>;
  onUpdate: (id: string, data: Partial<User>) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  currentUser: User;
  onLogout: () => void;
}

const Profile: React.FC<ProfileProps> = ({ users, onAdd, onUpdate, onDelete, onBack, currentUser, onLogout, t }) => {
  // Navigation State
  const [activeSection, setActiveSection] = useState<'main' | 'settings' | 'plan' | 'security' | 'payment'>('main');

  // Main Profile State
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Edit Profile Form
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>(UserRole.CHILD);
  const [editAllergies, setEditAllergies] = useState<string[]>([]);
  const [editPreferences, setEditPreferences] = useState<string[]>([]);
  const [newAllergyInput, setNewAllergyInput] = useState('');
  const [newPreferenceInput, setNewPreferenceInput] = useState('');

  // Add User Form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
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
    
    const finalEmail = newEmail.trim() || `${newName.toLowerCase().replace(/\s/g, '')}@${currentUser.householdId}.helpy`;

    const newUser: Omit<User, 'id'> = {
      householdId: currentUser.householdId,
      name: newName,
      email: finalEmail,
      role: newRole,
      avatar: `https://picsum.photos/200/200?random=${Date.now()}`,
      allergies: [],
      preferences: []
    };
    
    const createdUser = await onAdd(newUser);
    
    if (createdUser) {
        let baseUrl = window.location.href.split('?')[0].split('#')[0];
        if (baseUrl.startsWith('blob:') || window.location.protocol === 'blob:') {
            const origin = window.location.origin;
            baseUrl = (origin && origin !== 'null') ? origin : 'https://helpy-app.web.app';
            if (!baseUrl.endsWith('/')) baseUrl += '/';
        }
        const link = `${baseUrl}#invite?hid=${currentUser.householdId}&uid=${createdUser.id}`;
        setInviteLink(link);
    }

    setIsAddModalOpen(false);
    setNewName('');
    setNewEmail('');
    setNewRole(UserRole.CHILD);
  };

  const copyInviteLink = () => {
    if (inviteLink) {
        navigator.clipboard.writeText(inviteLink);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleDeleteUser = (id: string) => {
    if (users.length <= 1) return; 
    onDelete(id);
    if (selectedUserId === id) {
       const remaining = users.filter(u => u.id !== id);
       if (remaining.length > 0) setSelectedUserId(remaining[0].id);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdate(selectedUserId, { avatar: reader.result as string });
        setShowPhotoOptions(false);
      };
      reader.readAsDataURL(file);
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
                selectedPlan === p.id ? 'border-brand-primary bg-[#E6F7FB]/50' : 'border-gray-100 bg-white'
              }`}
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-bold text-lg ${selectedPlan === p.id ? 'text-brand-primary' : 'text-gray-800'}`}>{p.name}</span>
                  {selectedPlan === p.id && <span className="bg-brand-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Active</span>}
                </div>
                <p className="text-gray-500 text-sm font-medium mb-2">{p.price}</p>
                <div className="space-y-1">
                   {p.features.map(f => <p key={f} className="text-xs text-gray-400 flex items-center gap-1"><Check size={10}/> {f}</p>)}
                </div>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedPlan === p.id ? 'border-brand-primary bg-brand-primary text-white' : 'border-gray-200'}`}>
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
                  onChange={e => setSecurityData({...securityData, email: e.target.value})}
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
                  onChange={e => setSecurityData({...securityData, currentPassword: e.target.value})}
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
                  onChange={e => setSecurityData({...securityData, newPassword: e.target.value})}
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
          <div className="flex justify-between items-end">
             <div>
                <p className="text-[10px] opacity-60 font-bold tracking-wider">CARD HOLDER</p>
                <p className="text-sm font-medium tracking-wide uppercase">{paymentData.name || 'YOUR NAME'}</p>
             </div>
             <div>
                <p className="text-[10px] opacity-60 font-bold tracking-wider">EXPIRES</p>
                <p className="text-sm font-medium tracking-wide">{paymentData.expiry || 'MM/YY'}</p>
             </div>
          </div>
        </div>

        <div className="space-y-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="space-y-1">
             <label className="text-xs font-bold text-gray-500 ml-1">Card Number</label>
             <input 
                type="text" 
                placeholder="0000 0000 0000 0000"
                maxLength={19}
                value={paymentData.cardNumber} 
                onChange={e => setPaymentData({...paymentData, cardNumber: e.target.value})}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-mono text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none"
             />
          </div>
          <div className="flex gap-4">
            <div className="space-y-1 flex-1">
               <label className="text-xs font-bold text-gray-500 ml-1">Expiry</label>
               <input 
                  type="text" 
                  placeholder="MM/YY"
                  maxLength={5}
                  value={paymentData.expiry} 
                  onChange={e => setPaymentData({...paymentData, expiry: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-mono text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none"
               />
            </div>
            <div className="space-y-1 w-24">
               <label className="text-xs font-bold text-gray-500 ml-1">CVC</label>
               <input 
                  type="text" 
                  placeholder="123"
                  maxLength={3}
                  value={paymentData.cvc} 
                  onChange={e => setPaymentData({...paymentData, cvc: e.target.value})}
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
                onChange={e => setPaymentData({...paymentData, name: e.target.value})}
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
                <div className="w-10 h-10 rounded-full bg-[#E6F7FB] text-[#3EAFD2] flex items-center justify-center">
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
    <div className="px-4 pt-16 pb-24 animate-slide-up page-content relative">
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
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#4CAF50] border-2 border-white rounded-full"></div>
                  )}
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${isSelected ? 'text-brand-primary' : 'text-gray-500'}`}>
                  {user.name.split(' ')[0]} {isCurrent ? '(You)' : ''}
                </span>
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
                    className="absolute -bottom-2 -right-2 p-2 bg-white rounded-full shadow-md text-gray-600 hover:text-brand-primary transition-colors border border-gray-100 z-10"
                >
                    <Camera size={14} />
                </button>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{selectedUser.name}</h2>
              <span className={`inline-block mt-1 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide ${getRoleBadgeColor(selectedUser.role)}`}>
                {selectedUser.role}
              </span>
              {selectedUser.email && (
                 <p className="text-xs text-gray-400 mt-1">{selectedUser.email}</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2 text-red-500 font-semibold text-sm">
                 <AlertCircle size={16} />
                 <span>{t['profile.allergies']}</span>
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
              <div className="flex items-center gap-2 mb-2 text-[#4CAF50] font-semibold text-sm">
                 <Heart size={16} />
                 <span>{t['profile.preferences']}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedUser.preferences && selectedUser.preferences.length > 0 ? (
                  selectedUser.preferences.map((pref, i) => (
                    <span key={i} className="bg-[#E8F5E9] text-[#4CAF50] border border-[#4CAF50]/20 px-3 py-1 rounded-lg text-xs font-medium">
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
      
      <button 
        onClick={onLogout}
        className="mt-4 mb-6 w-full py-3 rounded-xl border-2 border-red-100 text-red-500 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
      >
        <LogOut size={18} />
        {t['profile.logout']}
      </button>

      {/* Footer */}
      <div className="helpy-footer">
        <span className="helpy-logo">helpy</span>
      </div>

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
                            placeholder="Name (e.g. Uncle Bob)"
                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none font-semibold text-gray-800"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Email (Optional)</label>
                        <input 
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="For login (Optional)"
                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none text-gray-800"
                        />
                        <p className="text-[10px] text-gray-400 mt-1 ml-1">Required for them to login on their own device.</p>
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

      {/* Invite Link Modal */}
      {inviteLink && (
        <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-slide-up">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-16 h-16 bg-[#E8F5E9] rounded-full flex items-center justify-center text-[#4CAF50] mb-4">
                        <Check size={32} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800">Member Added!</h3>
                    <p className="text-gray-500 text-sm mt-2">
                        Share this link with them so they can set their PIN and join the household.
                    </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center gap-3 mb-6 overflow-hidden">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-400 mb-1">{t['profile.invite_link']}</p>
                        <p className="text-sm font-semibold text-brand-primary truncate">{inviteLink}</p>
                    </div>
                </div>

                <button 
                    onClick={copyInviteLink}
                    className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${isCopied ? 'bg-[#4CAF50] text-white' : 'bg-brand-primary text-white hover:bg-brand-secondary'}`}
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

                    <div>
                        <div className="flex items-center gap-2 mb-2 text-red-500 font-semibold text-sm">
                            <AlertCircle size={16} />
                            <span>{t['profile.allergies']}</span>
                        </div>
                        <div className="flex gap-2 mb-3">
                            <input 
                                type="text"
                                value={newAllergyInput}
                                onChange={(e) => setNewAllergyInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addAllergy()}
                                placeholder="Add allergy..."
                                className="flex-1 bg-gray-50 border-none rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 outline-none"
                            />
                            <button onClick={addAllergy} className="bg-red-100 text-red-600 p-2 rounded-xl hover:bg-red-200">
                                <Plus size={20} />
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

                    <div>
                        <div className="flex items-center gap-2 mb-2 text-[#4CAF50] font-semibold text-sm">
                            <Heart size={16} />
                            <span>{t['profile.preferences']}</span>
                        </div>
                        <div className="flex gap-2 mb-3">
                            <input 
                                type="text"
                                value={newPreferenceInput}
                                onChange={(e) => setNewPreferenceInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addPreference()}
                                placeholder="Add preference..."
                                className="flex-1 bg-gray-50 border-none rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#4CAF50]/30 outline-none"
                            />
                            <button onClick={addPreference} className="bg-[#E8F5E9] text-[#4CAF50] p-2 rounded-xl hover:bg-[#4CAF50]/20">
                                <Plus size={20} />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                             {editPreferences.map((item, i) => (
                                <span key={i} className="bg-[#E8F5E9] text-[#4CAF50] border border-[#4CAF50]/20 pl-3 pr-1 py-1 rounded-lg text-xs font-medium flex items-center gap-1">
                                    {item}
                                    <button onClick={() => setEditPreferences(prev => prev.filter((_, idx) => idx !== i))} className="p-0.5 hover:bg-[#4CAF50]/20 rounded-full">
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
                        {t['meals.save_changes']}
                    </button>
                </div>
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