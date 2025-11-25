
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { ShieldCheck, ChevronRight, Loader2, Lock } from 'lucide-react';

interface InviteSetupProps {
  householdId: string;
  userId: string;
  onComplete: (user: User) => void;
}

const InviteSetup: React.FC<InviteSetupProps> = ({ householdId, userId, onComplete }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await getUser(householdId, userId);
        if (userData) {
          setUser(userData);
        } else {
          setError('Invitation invalid or expired.');
        }
      } catch (e) {
        setError('Could not load invitation.');
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [householdId, userId]);

  const handleJoin = async () => {
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (pin.length < 4) {
      setError('PIN must be 4-6 digits.');
      return;
    }

    setIsRegistering(true);
    try {
      if (user && user.email) {
        const finalUser = await completeInviteRegistration(
            userId, // The temp ID
            user.email, 
            password, 
            pin
        );
        onComplete(finalUser);
      }
    } catch (e: any) {
      console.error(e);
      if (e.code === 'auth/email-already-in-use') {
          setError('This email is already registered. Please Login instead.');
      } else {
          setError('Failed to create account. ' + (e.message || ''));
      }
      setIsRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <Loader2 size={40} className="text-brand-primary animate-spin" />
        <p className="mt-4 text-gray-500 font-medium">Loading invitation...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-4">
           <ShieldCheck size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Invitation Error</h1>
        <p className="text-gray-500 mt-2">{error}</p>
        <button onClick={() => window.location.search = ''} className="mt-6 text-brand-primary font-bold">Go to Login</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-brand-primary to-brand-secondary flex flex-col items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-sm bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/50 max-h-[90vh] overflow-y-auto">
        
        <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-full mx-auto mb-4 p-1 border-2 border-brand-primary bg-white">
                <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Welcome, {user.name.split(' ')[0]}!</h1>
            <p className="text-gray-500 text-xs mt-1">Accept invitation for {user.email}</p>
        </div>

        <div className="space-y-4">
            
            {/* Password Section */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 ml-1 flex items-center gap-1">
                    <Lock size={12} /> Set Account Password
                </label>
                <input 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-gray-800 font-medium outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all"
                    placeholder="Minimum 6 characters"
                />
            </div>

            {/* PIN Section */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 ml-1">Set Quick Login PIN</label>
                <input 
                    type="tel"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-center text-xl tracking-widest text-gray-800 font-bold outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all"
                    placeholder="••••"
                />
                <p className="text-[10px] text-gray-400 ml-1">Used for quick access inside the house.</p>
            </div>

            {error && (
                <div className="p-3 bg-red-50 text-red-500 text-xs font-bold rounded-xl border border-red-100 text-center animate-pulse">
                    {error}
                </div>
            )}

            <button 
                onClick={handleJoin}
                disabled={isRegistering}
                className="w-full bg-brand-primary text-white py-4 rounded-xl font-bold text-sm shadow-lg shadow-brand-primary/30 hover:bg-brand-secondary hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-70"
            >
                {isRegistering ? <Loader2 className="animate-spin" /> : (
                    <>Join Household <ChevronRight size={16} /></>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default InviteSetup;