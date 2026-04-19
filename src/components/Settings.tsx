import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SplitText } from './SplitText';
import { PasswordStrength } from './PasswordStrength';
import { useTheme } from '../ThemeContext';
import { ThemeSelector } from './ThemeSelector';
import { 
  User, 
  Shield, 
  Lock, 
  Bell,
  Check,
  Eye, 
  Info, 
  ChevronRight, 
  ChevronLeft,
  Key, 
  Smartphone, 
  Globe, 
  Volume2, 
  HelpCircle,
  LogOut,
  Trash2,
  Users,
  EyeOff,
  Mail,
  Mic,
  Share2,
  ArrowLeft,
  Edit2,
  MessageSquare,
  Star,
  Palette
} from 'lucide-react';
import { useAuth, UserProfile } from '../FirebaseProvider';
import { updateEmail, db, collection, addDoc, serverTimestamp } from '../firebase';

interface SettingsProps {
  userRole: 'guest' | 'member' | 'admin';
  registerBackHandler?: (handler: () => boolean) => () => void;
  onEditProfile?: () => void;
}

interface SubTab {
  id: string;
  label: string;
  icon: any;
  desc?: string;
  variant?: 'default' | 'danger';
}

interface Category {
  id: string;
  icon: any;
  label: string;
  desc: string;
  subTabs: SubTab[];
}

const SETTINGS_CATEGORIES: Category[] = [
  { 
    id: 'account', 
    icon: Shield, 
    label: 'Your account', 
    desc: 'See information about your account or learn about your account deactivation options',
    subTabs: [
      { id: 'info', label: 'Account information', icon: User, desc: 'See your account information like your phone number and email address.' },
      { id: 'password', label: 'Change your password', icon: Key, desc: 'Change your password at any time.' },
      { id: 'deactivate', label: 'Deactivate', icon: Trash2, desc: 'Find out how you can deactivate your account.', variant: 'danger' }
    ]
  },
  { 
    id: 'feedback', 
    icon: MessageSquare, 
    label: 'Give feedback', 
    desc: 'Share your thoughts and help us improve the platform.',
    subTabs: [
      { id: 'feedback', label: 'Give feedback', icon: MessageSquare, desc: 'Share your thoughts and help us improve the platform.' }
    ]
  },
  { 
    id: 'privacy', 
    icon: Lock, 
    label: 'Privacy and safety', 
    desc: 'Manage what information you allow others to see and what information you see.',
    subTabs: [
      { id: 'audience', label: 'Audience', icon: Users, desc: 'Manage what information you allow others to see.' },
      { id: 'posts', label: 'Your Posts', icon: Share2, desc: 'Manage the information associated with your posts.' },
      { id: 'content', label: 'Content', icon: EyeOff, desc: 'Decide what you see on the platform based on your interests.' },
      { id: 'mute', label: 'Mute and block', icon: Bell, desc: 'Manage the accounts, words, and notifications that you’ve muted or blocked.' },
      { id: 'messages', label: 'Direct Messages', icon: Mail, desc: 'Manage who can message you directly.' },
      { id: 'spaces', label: 'Spaces', icon: Mic, desc: 'Manage who can see your Spaces listening activity.' }
    ]
  },
  { 
    id: 'notifications', 
    icon: Bell, 
    label: 'Notifications', 
    desc: 'Select the kinds of notifications you get about your activities, interests, and recommendations.',
    subTabs: [
      { id: 'preferences', label: 'Preferences', icon: Smartphone, desc: 'Select your preferences by notification type.' }
    ]
  },
  { 
    id: 'display', 
    icon: Eye, 
    label: 'Accessibility, display, and languages', 
    desc: 'Manage how content is displayed to you.',
    subTabs: [
      { id: 'accessibility', label: 'Accessibility', icon: Eye, desc: 'Manage aspects of your experience such as high contrast and motion.' },
      { id: 'display', label: 'Display', icon: Smartphone, desc: 'Manage your font size, color, and background.' },
      { id: 'languages', label: 'Languages', icon: Globe, desc: 'Manage which languages are used to personalize your experience.' },
      { id: 'data', label: 'Data usage', icon: Volume2, desc: 'Limit how much data the platform uses.' }
    ]
  },
];

export const Settings = ({ userRole, registerBackHandler, onEditProfile }: SettingsProps) => {
  const { theme, toggleTheme } = useTheme();
  const { user, userProfile, logout, updateUserProfile } = useAuth();
  const [activeCategory, setActiveCategory] = useState('account');
  const [activeSubTab, setActiveSubTab] = useState('');
  const [showSubSettings, setShowSubSettings] = useState(false);
  
  // Account Info Editing States
  const [editingField, setEditingField] = useState<'username' | 'phone' | 'email' | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Feedback States
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState('feature');
  const [feedbackSent, setFeedbackSent] = useState(false);

  const [notificationPrefs, setNotificationPrefs] = useState({
    push: {
      likes: true,
      replies: true,
      mentions: true,
      follows: true,
    },
    inApp: {
      likes: true,
      replies: true,
      mentions: true,
      follows: true,
    }
  });

  // Sync notification prefs from userProfile
  React.useEffect(() => {
    if (userProfile?.notificationPrefs) {
      setNotificationPrefs(userProfile.notificationPrefs);
    }
  }, [userProfile]);

  const handleTogglePref = async (channel: 'push' | 'inApp', type: 'likes' | 'replies' | 'mentions' | 'follows') => {
    const newPrefs = {
      ...notificationPrefs,
      [channel]: {
        ...notificationPrefs[channel],
        [type]: !notificationPrefs[channel][type]
      }
    };
    
    setNotificationPrefs(newPrefs);
    
    if (user) {
      try {
        await updateUserProfile({ notificationPrefs: newPrefs });
      } catch (err) {
        console.error("Failed to update notification preferences", err);
      }
    }
  };

  const currentCategory = useMemo(() => 
    SETTINGS_CATEGORIES.find(c => c.id === activeCategory) || SETTINGS_CATEGORIES[0],
  [activeCategory]);

  React.useEffect(() => {
    if (currentCategory.subTabs.length > 0) {
      setActiveSubTab(currentCategory.subTabs[0].id);
    }
  }, [activeCategory]);

  React.useEffect(() => {
    if (registerBackHandler && showSubSettings) {
      return registerBackHandler(() => {
        setShowSubSettings(false);
        return true;
      });
    }
  }, [registerBackHandler, showSubSettings]);

  const handleUpdateField = async () => {
    if (!user || isSaving) return;
    setIsSaving(true);
    setError(null);

    try {
      if (editingField === 'username') {
        await updateUserProfile({ handle: tempValue.startsWith('@') ? tempValue : `@${tempValue}` });
      } else if (editingField === 'phone') {
        await updateUserProfile({ phone: tempValue });
      } else if (editingField === 'email') {
        // Special case for email - we try to update auth email too
        try {
          await updateEmail(user, tempValue);
          await updateUserProfile({ email: tempValue });
        } catch (e: any) {
          if (e.code === 'auth/requires-recent-login') {
            throw new Error('Please log out and log back in to change your email for security.');
          }
          throw e;
        }
      }
      setEditingField(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update field');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!user || feedbackRating === 0 || isSaving) return;
    setIsSaving(true);
    setError(null);

    try {
      await addDoc(collection(db, 'feedback'), {
        userId: user.uid,
        userHandle: userProfile?.handle || 'unknown',
        rating: feedbackRating,
        comment: feedbackComment,
        category: feedbackCategory,
        createdAt: serverTimestamp()
      });
      setFeedbackSent(true);
      // Reset form
      setFeedbackRating(0);
      setFeedbackComment('');
      setFeedbackCategory('feature');
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setIsSaving(false);
    }
  };

  const renderSubTabContent = () => {
    const subTab = currentCategory.subTabs.find(s => s.id === activeSubTab);
    if (!subTab) return null;

    return (
      <motion.div
        key={subTab.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="p-4 md:p-8 space-y-6"
      >
        <div className="space-y-2">
          {subTab.id === 'info' && activeCategory === 'account' ? (
            <div className="flex flex-col">
              <SplitText text={subTab.label} className="text-2xl font-black tracking-tight text-text-primary" />
              <p className="text-text-secondary text-xs font-bold uppercase tracking-widest">{userProfile?.handle || '@user'}</p>
            </div>
          ) : activeCategory === 'feedback' ? (
            <div className="flex flex-col">
              <SplitText text="Give feedback" className="text-2xl font-black tracking-tight text-text-primary" />
              <p className="text-text-secondary text-sm leading-relaxed max-w-xl">Share your thoughts and help us improve the platform.</p>
            </div>
          ) : (
            <>
              <SplitText text={subTab.label} className="text-2xl font-black tracking-tight text-text-primary" />
              {subTab.desc && <p className="text-text-secondary text-sm leading-relaxed max-w-xl">{subTab.desc}</p>}
            </>
          )}
        </div>

        <div className="glass-card !p-6 space-y-6">
          {subTab.id !== 'info' && activeCategory !== 'feedback' && (
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl bg-glass ${subTab.variant === 'danger' ? 'text-red-400' : 'text-indigo-400'}`}>
                <subTab.icon size={24} />
              </div>
              <div>
                <p className="font-bold text-lg text-text-primary">Configure {subTab.label}</p>
                <p className="text-xs text-text-secondary">Manage your settings for this section.</p>
              </div>
            </div>
          )}

          <div className={`${subTab.id !== 'info' ? 'space-y-4 pt-4 border-t border-subtle' : ''}`}>
            {subTab.id === 'edit' ? (
              <div className="space-y-4">
                <p className="text-sm text-text-secondary">You can update your profile information directly from your profile page or by clicking the button below.</p>
                <button 
                  onClick={onEditProfile}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                >
                  <User size={18} />
                  Open Profile Editor
                </button>
              </div>
            ) : subTab.id === 'password' ? (
              <PasswordStrength />
            ) : subTab.id === 'feedback' ? (
              <div className="space-y-6">
                {feedbackSent ? (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center justify-center py-8 text-center space-y-4"
                  >
                    <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-2">
                      <Check size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-text-primary">Thank you!</h3>
                    <p className="text-sm text-text-secondary max-w-xs">Your feedback has been received. We appreciate your input and will use it to improve the platform.</p>
                    <button 
                      onClick={() => setFeedbackSent(false)}
                      className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-500 transition-colors"
                    >
                      Send another
                    </button>
                  </motion.div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Rating</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setFeedbackRating(star)}
                            className={`p-2 rounded-lg transition-all ${feedbackRating >= star ? 'text-yellow-400' : 'text-text-secondary hover:text-text-primary opacity-50'}`}
                          >
                            <Star size={24} fill={feedbackRating >= star ? "currentColor" : "none"} />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Category</label>
                      <div className="flex flex-wrap gap-2">
                        {['feature', 'bug', 'design', 'other'].map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setFeedbackCategory(cat)}
                            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all border ${
                              feedbackCategory === cat 
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                                : 'bg-glass border-subtle text-text-secondary hover:border-indigo-500/50'
                            }`}
                          >
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Comment (optional)</label>
                      <textarea
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        placeholder="Tell us what's on your mind... what can we do better?"
                        rows={4}
                        className="w-full bg-slate-950 border border-subtle focus:border-indigo-500 rounded-2xl p-4 text-sm text-text-primary outline-none transition-colors resize-none"
                      />
                    </div>

                    {error && <p className="text-xs text-red-500">{error}</p>}

                    <button
                      onClick={handleSubmitFeedback}
                      disabled={feedbackRating === 0 || isSaving}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Feedback'
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : subTab.id === 'info' ? (
              <div className="space-y-0 divide-y divide-subtle -mx-6 -mb-6">
                {/* Username */}
                <div 
                  onClick={() => {
                    if (editingField !== 'username') {
                      setEditingField('username');
                      setTempValue(userProfile?.handle || '');
                    }
                  }}
                  className={`px-6 py-4 hover:bg-glass transition-colors cursor-pointer group ${editingField === 'username' ? 'bg-glass' : ''}`}
                >
                  <p className="text-xs font-bold text-text-secondary uppercase tracking-tight mb-1 group-hover:text-indigo-400 transition-colors">Username</p>
                  {editingField === 'username' ? (
                    <div className="space-y-3 pt-1" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="text"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        className="w-full bg-slate-950 border border-indigo-500/30 rounded-lg px-3 py-2 text-sm text-text-primary focus:ring-1 focus:ring-indigo-500 outline-none"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingField(null)} className="px-3 py-1 text-[10px] font-bold text-text-secondary">Cancel</button>
                        <button 
                          onClick={handleUpdateField} 
                          disabled={isSaving}
                          className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg disabled:opacity-50"
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-text-primary">{userProfile?.handle || '@user'}</p>
                  )}
                </div>
                
                {/* Phone */}
                <div 
                  onClick={() => {
                    if (editingField !== 'phone') {
                      setEditingField('phone');
                      setTempValue(userProfile?.phone || '');
                    }
                  }}
                  className={`px-6 py-4 hover:bg-glass transition-colors cursor-pointer group ${editingField === 'phone' ? 'bg-glass' : ''}`}
                >
                  <p className="text-xs font-bold text-text-secondary uppercase tracking-tight mb-1 group-hover:text-indigo-400 transition-colors">Phone</p>
                  {editingField === 'phone' ? (
                    <div className="space-y-3 pt-1" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="tel"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        className="w-full bg-slate-950 border border-indigo-500/30 rounded-lg px-3 py-2 text-sm text-text-primary focus:ring-1 focus:ring-indigo-500 outline-none"
                        placeholder="Add phone number"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingField(null)} className="px-3 py-1 text-[10px] font-bold text-text-secondary">Cancel</button>
                        <button 
                          onClick={handleUpdateField}
                          disabled={isSaving}
                          className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg disabled:opacity-50"
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-sm font-medium ${userProfile?.phone ? 'text-text-primary' : 'text-indigo-400'}`}>
                      {userProfile?.phone || 'Add'}
                    </p>
                  )}
                </div>

                {/* Email Address */}
                <div 
                  onClick={() => {
                    if (editingField !== 'email') {
                      setEditingField('email');
                      setTempValue(user?.email || '');
                    }
                  }}
                  className={`px-6 py-4 hover:bg-glass transition-colors cursor-pointer group ${editingField === 'email' ? 'bg-glass' : ''}`}
                >
                  <p className="text-xs font-bold text-text-secondary uppercase tracking-tight mb-1 group-hover:text-indigo-400 transition-colors">Email address</p>
                  {editingField === 'email' ? (
                    <div className="space-y-3 pt-1" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="email"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        className="w-full bg-slate-950 border border-indigo-500/30 rounded-lg px-3 py-2 text-sm text-text-primary focus:ring-1 focus:ring-indigo-500 outline-none"
                        autoFocus
                      />
                      {error && editingField === 'email' && <p className="text-[10px] text-red-400">{error}</p>}
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setEditingField(null); setError(null); }} className="px-3 py-1 text-[10px] font-bold text-text-secondary">Cancel</button>
                        <button 
                          onClick={handleUpdateField}
                          disabled={isSaving}
                          className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg disabled:opacity-50"
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-text-primary">{user?.email || 'Not provided'}</p>
                  )}
                </div>

                <div className="px-6 py-4 hover:bg-glass transition-colors cursor-pointer group">
                  <div className="flex flex-col">
                    <p className="text-xs font-bold text-text-secondary uppercase tracking-tight mb-1 group-hover:text-indigo-400 transition-colors">Country</p>
                    <p className="text-sm font-medium text-text-primary">{userProfile?.location || 'India'}</p>
                    <p className="text-[10px] text-text-secondary mt-1">Select the country you live in. <span className="text-indigo-400 cursor-pointer hover:underline">Learn more</span></p>
                  </div>
                </div>

                <div className="px-6 py-6 mt-4">
                  <button 
                    onClick={() => logout()}
                    className="text-red-500 font-bold text-sm hover:text-red-400 transition-colors flex items-center gap-2"
                  >
                    <LogOut size={16} />
                    Log out
                  </button>
                </div>
              </div>
            ) : activeCategory === 'notifications' && subTab.id === 'preferences' ? (
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <Smartphone size={16} />
                    <h4 className="text-[10px] font-black uppercase tracking-widest">Push Notifications</h4>
                  </div>
                  <div className="space-y-4 pt-2">
                    <Toggle 
                      label="Likes" 
                      desc="Get a push notification when someone likes your post."
                      enabled={notificationPrefs.push.likes} 
                      onChange={() => handleTogglePref('push', 'likes')} 
                    />
                    <Toggle 
                      label="Replies" 
                      desc="Get a push notification when someone replies to your post."
                      enabled={notificationPrefs.push.replies} 
                      onChange={() => handleTogglePref('push', 'replies')} 
                    />
                    <Toggle 
                      label="Mentions" 
                      desc="Get a push notification when someone mentions you."
                      enabled={notificationPrefs.push.mentions} 
                      onChange={() => handleTogglePref('push', 'mentions')} 
                    />
                    <Toggle 
                      label="Follows" 
                      desc="Get a push notification when someone starts following you."
                      enabled={notificationPrefs.push.follows} 
                      onChange={() => handleTogglePref('push', 'follows')} 
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-subtle space-y-4">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <Bell size={16} />
                    <h4 className="text-[10px] font-black uppercase tracking-widest">In-App Notifications</h4>
                  </div>
                  <div className="space-y-4 pt-2">
                    <Toggle 
                      label="Likes" 
                      desc="See notifications for likes within the application."
                      enabled={notificationPrefs.inApp.likes} 
                      onChange={() => handleTogglePref('inApp', 'likes')} 
                    />
                    <Toggle 
                      label="Replies" 
                      desc="See notifications for replies within the application."
                      enabled={notificationPrefs.inApp.replies} 
                      onChange={() => handleTogglePref('inApp', 'replies')} 
                    />
                    <Toggle 
                      label="Mentions" 
                      desc="See notifications for mentions within the application."
                      enabled={notificationPrefs.inApp.mentions} 
                      onChange={() => handleTogglePref('inApp', 'mentions')} 
                    />
                    <Toggle 
                      label="Follows" 
                      desc="See notifications for new followers within the application."
                      enabled={notificationPrefs.inApp.follows} 
                      onChange={() => handleTogglePref('inApp', 'follows')} 
                    />
                  </div>
                </div>
              </div>
            ) : activeCategory === 'display' && subTab.id === 'display' ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Application Theme</h4>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Personalize your experience by choosing from our curated themes or create your own custom visual style.
                  </p>
                  <ThemeSelector />
                </div>
              </div>
            ) : (
              <>
                {/* Mock settings controls */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-secondary">Enable feature</span>
                  <div className="w-10 h-5 bg-indigo-600 rounded-full relative">
                    <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-secondary">Receive updates</span>
                  <div className="w-10 h-5 bg-glass rounded-full relative">
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white/20 rounded-full shadow-sm" />
                  </div>
                </div>
              </>
            )}
          </div>

          {subTab.variant === 'danger' && (
            <button className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-bold text-sm transition-all border border-red-500/20">
              Proceed with {subTab.label}
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-full max-w-6xl mx-auto glass-card !p-0 overflow-hidden border border-subtle rounded-[2rem]">
      {/* Categories Sidebar */}
      <div className={`w-full md:w-80 border-r border-subtle flex flex-col bg-bg-primary/20 ${showSubSettings ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 border-b border-subtle">
          <SplitText text="Settings" className="text-2xl font-black tracking-tight text-text-primary" />
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {SETTINGS_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                setShowSubSettings(true);
              }}
              className={`w-full flex items-center justify-between px-6 py-4 transition-all group ${
                activeCategory === cat.id 
                  ? 'bg-glass text-text-primary' 
                  : 'text-text-secondary hover:bg-glass hover:text-text-primary'
              }`}
            >
              <div className="flex items-center gap-4">
                <cat.icon size={20} className={activeCategory === cat.id ? 'text-indigo-400' : 'group-hover:text-text-primary'} />
                <span className="font-bold text-sm text-left">{cat.label}</span>
              </div>
              <ChevronRight size={16} className={`transition-transform ${activeCategory === cat.id ? 'translate-x-1 opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className={`flex-1 bg-bg-primary/40 flex flex-col overflow-hidden ${!showSubSettings ? 'hidden md:flex' : 'flex'}`}>
        {/* Sub-tabs Header */}
        <div className="border-b border-subtle bg-glass px-4 md:px-8 overflow-x-auto scrollbar-hide flex-shrink-0">
          <div className="flex items-center gap-2 py-4">
            {/* Back button for mobile */}
            <button 
              onClick={() => setShowSubSettings(false)}
              className="md:hidden p-2 glass rounded-xl text-text-secondary hover:text-text-primary transition-colors"
            >
              <ChevronLeft size={20} />
            </button>

            {currentCategory.subTabs.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setActiveSubTab(sub.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                  activeSubTab === sub.id
                    ? 'bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/20'
                    : 'bg-glass text-text-secondary border-subtle hover:bg-glass/80 hover:text-text-primary'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sub-tab Content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {renderSubTabContent()}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

interface SettingItemProps {
  icon: any;
  label: string;
  desc?: string;
  variant?: 'default' | 'danger';
}

const SettingItem = ({ icon: Icon, label, desc, variant = 'default' }: SettingItemProps) => (
  <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-glass transition-all group text-left">
    <div className="flex items-center gap-4">
      <div className={`p-2 rounded-xl bg-glass ${variant === 'danger' ? 'text-red-400' : 'text-text-secondary group-hover:text-text-primary'}`}>
        <Icon size={20} />
      </div>
      <div className="space-y-0.5">
        <p className={`font-bold text-sm ${variant === 'danger' ? 'text-red-400' : 'text-text-primary'}`}>{label}</p>
        {desc && <p className="text-xs text-text-secondary leading-relaxed">{desc}</p>}
      </div>
    </div>
    <ChevronRight size={16} className="text-text-secondary group-hover:text-text-primary transition-transform group-hover:translate-x-1" />
  </button>
);

const Toggle = ({ enabled, onChange, label, desc }: { enabled: boolean, onChange: () => void, label: string, desc?: string }) => (
  <div className="flex items-center justify-between py-2">
    <div className="space-y-0.5">
      <p className="text-sm font-bold text-text-primary">{label}</p>
      {desc && <p className="text-xs text-text-secondary">{desc}</p>}
    </div>
    <button 
      onClick={onChange}
      className={`w-11 h-6 rounded-full relative transition-colors duration-200 ease-in-out focus:outline-none ${enabled ? 'bg-indigo-600' : 'bg-glass'}`}
    >
      <motion.div 
        animate={{ x: enabled ? 22 : 2 }}
        initial={false}
        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
      />
    </button>
  </div>
);
