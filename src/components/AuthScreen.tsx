import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Mail, 
  Lock, 
  Phone, 
  ArrowRight, 
  ChevronLeft, 
  Smartphone,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../FirebaseProvider';
import { RippleButton } from './RippleButton';

export const AuthScreen = () => {
  const { 
    login, 
    loginWithEmail, 
    registerWithEmail, 
    resetPassword, 
    setupRecaptcha, 
    loginWithPhone 
  } = useAuth();

  const [mode, setMode] = useState<'options' | 'email-login' | 'email-register' | 'forgot-password' | 'phone'>('options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+91');
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const recaptchaVerifierRef = useRef<any>(null);

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await registerWithEmail(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await resetPassword(email);
      setSuccess('Password reset email sent!');
      setMode('email-login');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = setupRecaptcha('recaptcha-container');
      }
      const confirmationResult = await loginWithPhone(phoneNumber, recaptchaVerifierRef.current);
      setVerificationId(confirmationResult);
      setSuccess('OTP sent to your phone!');
    } catch (err: any) {
      console.error("Phone Auth Error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Phone authentication is not enabled in Firebase Console. Please enable it in the Authentication tab.');
      } else {
        setError(err.message || 'Failed to send OTP');
      }
      
      // Reset recaptcha on error to allow retry
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await verificationId.confirm(otp);
    } catch (err: any) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const renderOptions = () => (
    <div className="space-y-4 w-full max-w-sm">
      <RippleButton 
        onClick={login}
        className="w-full bg-white text-black px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-200 transition-all shadow-xl"
      >
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" referrerPolicy="no-referrer" className="w-5 h-5" />
        Continue with Google
      </RippleButton>

      <div className="relative flex items-center py-2">
        <div className="flex-grow border-t border-glass-border"></div>
        <span className="flex-shrink mx-4 text-text-secondary text-sm font-medium">or</span>
        <div className="flex-grow border-t border-glass-border"></div>
      </div>

      <button 
        onClick={() => setMode('email-login')}
        className="w-full bg-glass text-text-primary px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-glass/80 border border-subtle transition-all"
      >
        <Mail size={20} className="text-indigo-400" />
        Continue with Email
      </button>

      <button 
        onClick={() => setMode('phone')}
        className="w-full bg-glass text-text-primary px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-glass/80 border border-subtle transition-all"
      >
        <Smartphone size={20} className="text-emerald-400" />
        Continue with Phone
      </button>
    </div>
  );

  const renderEmailLogin = () => (
    <form onSubmit={handleEmailLogin} className="space-y-4 w-full max-w-sm">
      <div className="space-y-2 text-left">
        <label className="text-sm font-medium text-text-secondary ml-1">Email Address</label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
          <input 
            type="email" 
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full bg-glass border border-subtle rounded-2xl py-4 pl-12 pr-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
        </div>
      </div>

      <div className="space-y-2 text-left">
        <div className="flex justify-between items-center ml-1">
          <label className="text-sm font-medium text-text-secondary">Password</label>
          <button 
            type="button"
            onClick={() => setMode('forgot-password')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
          >
            Forgot Password?
          </button>
        </div>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
          <input 
            type="password" 
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-glass border border-subtle rounded-2xl py-4 pl-12 pr-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
        </div>
      </div>

      <RippleButton 
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
      >
        {loading ? 'Signing in...' : 'Sign In'}
        <ArrowRight size={18} />
      </RippleButton>

      <p className="text-text-secondary text-sm">
        Don't have an account?{' '}
        <button 
          type="button"
          onClick={() => setMode('email-register')}
          className="text-indigo-400 hover:text-indigo-300 font-bold"
        >
          Sign Up
        </button>
      </p>
    </form>
  );

  const renderEmailRegister = () => (
    <form onSubmit={handleEmailRegister} className="space-y-4 w-full max-w-sm">
      <div className="space-y-2 text-left">
        <label className="text-sm font-medium text-text-secondary ml-1">Email Address</label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
          <input 
            type="email" 
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full bg-glass border border-subtle rounded-2xl py-4 pl-12 pr-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
        </div>
      </div>

      <div className="space-y-2 text-left">
        <label className="text-sm font-medium text-text-secondary ml-1">Password</label>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
          <input 
            type="password" 
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            className="w-full bg-glass border border-subtle rounded-2xl py-4 pl-12 pr-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
        </div>
      </div>

      <RippleButton 
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
      >
        {loading ? 'Creating account...' : 'Create Account'}
        <ArrowRight size={18} />
      </RippleButton>

      <p className="text-text-secondary text-sm">
        Already have an account?{' '}
        <button 
          type="button"
          onClick={() => setMode('email-login')}
          className="text-indigo-400 hover:text-indigo-300 font-bold"
        >
          Sign In
        </button>
      </p>
    </form>
  );

  const renderForgotPassword = () => (
    <form onSubmit={handlePasswordReset} className="space-y-4 w-full max-w-sm">
      <div className="space-y-2 text-left">
        <label className="text-sm font-medium text-text-secondary ml-1">Email Address</label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
          <input 
            type="email" 
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full bg-glass border border-subtle rounded-2xl py-4 pl-12 pr-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
        </div>
      </div>

      <RippleButton 
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Send Reset Link'}
        <ArrowRight size={18} />
      </RippleButton>

      <button 
        type="button"
        onClick={() => setMode('email-login')}
        className="text-text-secondary hover:text-text-primary text-sm font-medium"
      >
        Back to Login
      </button>
    </form>
  );

  const renderPhoneAuth = () => (
    <div className="space-y-4 w-full max-w-sm">
      {!verificationId ? (
        <form onSubmit={handlePhoneSubmit} className="space-y-4">
          <div className="space-y-2 text-left">
            <label className="text-sm font-medium text-text-secondary ml-1">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
              <input 
                type="tel" 
                required
                value={phoneNumber}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.startsWith('+91') || val === '+' || val === '+9') {
                    setPhoneNumber(val);
                  } else if (val === '') {
                    setPhoneNumber('+91');
                  }
                }}
                placeholder="+91 98765 43210"
                className="w-full bg-glass border border-subtle rounded-2xl py-4 pl-12 pr-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
              />
            </div>
          </div>
          <div id="recaptcha-container"></div>
          <RippleButton 
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            {loading ? 'Sending code...' : 'Send Verification Code'}
            <ArrowRight size={18} />
          </RippleButton>
        </form>
      ) : (
        <form onSubmit={handleOtpSubmit} className="space-y-4">
          <div className="space-y-2 text-left">
            <label className="text-sm font-medium text-text-secondary ml-1">Verification Code</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
              <input 
                type="text" 
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit code"
                className="w-full bg-glass border border-subtle rounded-2xl py-4 pl-12 pr-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
              />
            </div>
          </div>
          <RippleButton 
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify & Sign In'}
            <ArrowRight size={18} />
          </RippleButton>
          <button 
            type="button"
            onClick={() => setVerificationId(null)}
            className="text-text-secondary hover:text-text-primary text-sm font-medium"
          >
            Change Phone Number
          </button>
        </form>
      )}
      <button 
        type="button"
        onClick={() => setMode('options')}
        className="text-text-secondary hover:text-text-primary text-sm font-medium"
      >
        Back to Options
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-center">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-4">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-28 h-28 flex items-center justify-center mx-auto"
          >
            <img src="/logo.svg" alt="Mark 1 Logo" className="w-24 h-24" />
          </motion.div>
          <div className="space-y-4">
            <h1 className="text-5xl font-black text-text-primary tracking-tighter">
              MARK<span className="text-indigo-500">1</span>
            </h1>
            <p className="text-text-secondary max-w-xs mx-auto text-sm font-medium">
              {mode === 'options' ? 'The next generation of creative tools and business engineering.' : 
               mode === 'email-login' ? 'Enter your credentials to access your workspace.' :
               mode === 'email-register' ? 'Join our academy of creative engineers.' :
               mode === 'forgot-password' ? 'We\'ll send you a link to reset your password.' :
               'We\'ll send a verification code to your phone.'}
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center"
          >
            {mode === 'options' && renderOptions()}
            {mode === 'email-login' && renderEmailLogin()}
            {mode === 'email-register' && renderEmailRegister()}
            {mode === 'forgot-password' && renderForgotPassword()}
            {mode === 'phone' && renderPhoneAuth()}
          </motion.div>
        </AnimatePresence>

        {/* Error/Success Messages */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/20 text-red-500 px-6 py-3 rounded-2xl flex items-center gap-3 backdrop-blur-xl z-50"
            >
              <AlertCircle size={20} />
              <span className="text-sm font-semibold">{error}</span>
            </motion.div>
          )}
          {success && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-6 py-3 rounded-2xl flex items-center gap-3 backdrop-blur-xl z-50"
            >
              <CheckCircle2 size={20} />
              <span className="text-sm font-semibold">{success}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {mode !== 'options' && mode !== 'phone' && (
          <button 
            onClick={() => setMode('options')}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mx-auto font-medium"
          >
            <ChevronLeft size={18} />
            Back to Options
          </button>
        )}
      </div>
    </div>
  );
};
