
import React, { useState, useEffect } from 'react';
import { X, Bell, User, Save, Clock, CheckCircle, Smartphone, Mail } from 'lucide-react';
import * as StorageService from '../services/storageService';
import { AppConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChange: () => void;
  user?: any; // Current authenticated user
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onConfigChange, user }) => {
  const [config, setConfig] = useState<AppConfig>({ salesRepName: '', phoneNumber: '', enableReminders: false, reminderTime: '22:00' });
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const savedConfig = StorageService.loadConfig();
      setConfig(savedConfig);
      if ('Notification' in window) {
        setPermissionStatus(Notification.permission);
      }
      setSaved(false);
    }
  }, [isOpen]);

  const handleToggleReminder = async () => {
    if (!config.enableReminders) {
      // Turning ON
      if ('Notification' in window) {
        if (Notification.permission !== 'granted') {
          const result = await Notification.requestPermission();
          setPermissionStatus(result);
          if (result === 'granted') {
            setConfig(prev => ({ ...prev, enableReminders: true }));
          } else {
            alert("Permission denied. Please enable notifications in your browser settings.");
          }
        } else {
           setConfig(prev => ({ ...prev, enableReminders: true }));
        }
      } else {
        alert("Notifications are not supported in this browser.");
      }
    } else {
      // Turning OFF
      setConfig(prev => ({ ...prev, enableReminders: false }));
    }
  };

  const handleSave = () => {
    StorageService.saveConfig(config);
    onConfigChange();
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      {/* Modal Content */}
      <div className="relative bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-white p-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-2 transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
          
          {/* Personal Details */}
          <div className="space-y-4">
             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
               <User size={14} /> Personal Details
             </h3>
             
             {/* Name */}
             <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 ml-1">Full Name</label>
                <input 
                  type="text" 
                  value={config.salesRepName}
                  onChange={(e) => setConfig({ ...config, salesRepName: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all placeholder-gray-300"
                />
             </div>

             {/* Phone */}
             <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 ml-1">Phone Number</label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-3 text-gray-400" size={16} />
                  <input 
                    type="tel" 
                    value={config.phoneNumber || ''}
                    onChange={(e) => setConfig({ ...config, phoneNumber: e.target.value })}
                    placeholder="+971 50 123 4567"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all placeholder-gray-300"
                  />
                </div>
             </div>

             {/* Email (Read Only if Logged In) */}
             {user && (
               <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 ml-1">Account Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 text-gray-400" size={16} />
                    <input 
                      type="email" 
                      value={user.email}
                      disabled
                      className="w-full bg-gray-100 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm font-medium text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 px-1">To change email, please contact support.</p>
               </div>
             )}
          </div>

          <hr className="border-gray-100" />

          {/* Notifications */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Bell size={14} /> Notifications
              </label>
              
              <button 
                onClick={handleToggleReminder}
                className={`w-12 h-7 rounded-full transition-colors relative ${config.enableReminders ? 'bg-brand-500' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${config.enableReminders ? 'left-6' : 'left-1'}`}></div>
              </button>
            </div>

            {config.enableReminders && (
              <div className="bg-brand-50 rounded-xl p-4 border border-brand-100 animate-in fade-in slide-in-from-top-2">
                 <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-brand-900">Daily Reminder</span>
                    <Clock size={16} className="text-brand-400" />
                 </div>
                 <input 
                   type="time" 
                   value={config.reminderTime}
                   onChange={(e) => setConfig({ ...config, reminderTime: e.target.value })}
                   className="w-full bg-white border border-brand-200 rounded-lg px-3 py-2 text-center text-lg font-bold text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
                 />
              </div>
            )}
          </div>

          <button 
            onClick={handleSave}
            className={`w-full py-3.5 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${saved ? 'bg-green-500 text-white shadow-green-500/30' : 'bg-gray-900 text-white shadow-gray-900/20 hover:bg-black'}`}
          >
            {saved ? <CheckCircle size={18} /> : <Save size={18} />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
