import React, { useState } from 'react';
import { Eye, EyeOff, Check, X } from 'lucide-react';

interface PasswordStrengthProps {
  onPasswordChange?: (password: string) => void;
}

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({ onPasswordChange }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const calculateStrength = () => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  };

  const getStrengthDetails = () => {
    const score = calculateStrength();
    if (password.length === 0) return { width: '0%', color: 'bg-slate-800', label: 'None' };
    if (score <= 2) return { width: '33%', color: 'bg-red-500', label: 'Weak' };
    if (score <= 4) return { width: '66%', color: 'bg-amber-500', label: 'Fair' };
    return { width: '100%', color: 'bg-green-500', label: 'Strong' };
  };

  const strengthDetails = getStrengthDetails();

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    if (onPasswordChange) {
      onPasswordChange(newPassword);
    }
  };

  const requirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={handlePasswordChange}
          placeholder="Enter new password"
          className="w-full bg-glass border border-subtle rounded-xl py-3 pl-4 pr-12 text-sm text-text-primary focus:outline-none focus:border-indigo-500 transition-all"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
          <span className="text-text-secondary">Strength: {strengthDetails.label}</span>
          <span className={strengthDetails.label === 'Strong' ? 'text-green-500' : 'text-text-secondary'}>
            {Math.round((calculateStrength() / 6) * 100)}%
          </span>
        </div>
        <div className="h-1.5 w-full bg-glass rounded-full overflow-hidden">
          <div 
            className={`h-full ${strengthDetails.color} transition-all duration-500 ease-out shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
            style={{ width: strengthDetails.width }}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {requirements.map((req, index) => (
          <div 
            key={index} 
            className={`flex items-center gap-2 text-xs transition-colors duration-300 ${req.met ? 'text-green-500' : 'text-text-secondary'}`}
          >
            <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${req.met ? 'bg-green-500/20 border-green-500/50' : 'border-subtle'}`}>
              {req.met ? <Check size={10} strokeWidth={4} /> : <X size={10} strokeWidth={4} />}
            </div>
            <span className="font-medium">{req.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
