
import React, { useState } from 'react';
import { X, Mail, Lock, Loader2, LogIn, UserPlus, LogOut, User } from 'lucide-react';
import * as AuthService from '../services/authService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onAuthSuccess: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, user, onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await AuthService.signIn(email, password);
      } else {
        await AuthService.signUp(email, password);
      }
      onAuthSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    await AuthService.signOut();
    onAuthSuccess(); // actually onAuthChange
    onClose();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      {/* Modal Content */}
      <div className="relative bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 p-6 text-white text-center relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-brand-100 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition-all">
            <X size={18} />
          </button>
          
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-md shadow-inner">
             <User size={32} className="text-white" />
          </div>
          
          <h2 className="text-xl font-bold">
            {user ? 'Account' : (isLogin ? 'Welcome Back' : 'Create Account')}
          </h2>
          {!user && <p className="text-brand-100 text-xs mt-1">Sync your sales data across devices</p>}
        </div>

        <div className="p-6">
          {user ? (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Signed in as</p>
                <p className="font-medium text-gray-900 break-all">{user.email}</p>
              </div>
              <button 
                onClick={handleSignOut}
                disabled={loading}
                className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 hover:text-red-600 transition-all"
              >
                {loading ? <Loader2 className="animate-spin" /> : <LogOut size={18} />}
                Sign Out
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-100 font-medium">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input 
                    type="email" 
                    required
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all outline-none font-medium"
                    placeholder="name@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input 
                    type="password" 
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all outline-none font-medium"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3.5 bg-brand-600 text-white font-bold rounded-xl shadow-lg shadow-brand-500/30 hover:bg-brand-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : (isLogin ? <LogIn size={18} /> : <UserPlus size={18} />)}
                {isLogin ? 'Sign In' : 'Create Account'}
              </button>

              <div className="pt-2 text-center">
                <button 
                  type="button"
                  onClick={() => { setError(null); setIsLogin(!isLogin); }}
                  className="text-xs font-bold text-brand-600 hover:text-brand-800 transition-colors"
                >
                  {isLogin ? "New user? Create an account" : "Already have an account? Sign in"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
