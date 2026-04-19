import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Briefcase, 
  ShoppingBag, 
  LogOut,
  ChevronLeft, 
  ChevronRight,
  Home,
  Settings,
  MoreVertical,
  Palette,
  Trophy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../FirebaseProvider';
import { useTheme } from '../ThemeContext';
import { ConfirmationModal } from './ConfirmationModal';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
  activeTab: string;
  setActiveTab: (value: string) => void;
  onProfileClick?: () => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (value: boolean) => void;
  userRole: 'guest' | 'member' | 'admin';
  setUserRole: (role: 'guest' | 'member' | 'admin') => void;
}

export const Sidebar = React.memo(({ 
  isCollapsed, 
  setIsCollapsed, 
  activeTab, 
  setActiveTab,
  onProfileClick,
  isMobileOpen,
  setIsMobileOpen,
  userRole,
  setUserRole
}: SidebarProps) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'rank', icon: Trophy, label: 'Your rank' },
    { id: 'business', icon: Briefcase, label: 'Business' },
    { id: 'creators', icon: Sparkles, label: 'Creators' },
    { id: 'shop', icon: ShoppingBag, label: 'Shop' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  const filteredNavItems = navItems.filter(item => {
    const navItem = item as any;
    return !navItem.role || navItem.role === userRole;
  });

  const handleLogout = async () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    try {
      await logout();
      setUserRole('guest');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            onClick={() => setIsMobileOpen?.(false)}
            className="fixed inset-0 bg-slate-950/20 backdrop-blur-md z-[60] md:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ 
          width: isCollapsed ? 80 : 280,
          x: isMobileOpen ? 0 : (typeof window !== 'undefined' && window.innerWidth < 768 ? -280 : 0)
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`fixed md:sticky top-0 left-0 h-screen glass border-r border-white/10 z-[70] flex flex-col md:translate-x-0 overflow-hidden pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-2xl`}
      >
        {/* Logo Section */}
        <div className="h-24 flex items-center px-6 border-b border-white/5">
          <AnimatePresence mode="wait">
            {!isCollapsed || isMobileOpen ? (
              <motion.div 
                key="full-logo"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-3 group cursor-pointer"
              >
                <div 
                  className="w-12 h-12 flex items-center justify-center p-2.5 glass-morphism rounded-2xl"
                >
                  <img src="/logo.svg" alt="Mark 1 Logo" className="w-full h-full object-contain" />
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-2xl tracking-tighter text-primary font-sans italic">
                    MARK<span className="text-indigo-500 not-italic">1</span>
                  </span>
                  <span className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-500 leading-none ml-0.5">Academy</span>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="collapsed-logo"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="w-12 h-12 flex items-center justify-center mx-auto p-2 glass-morphism rounded-2xl"
                whileHover={{ rotate: 5 }}
              >
                <img src="/logo.svg" alt="Mark 1 Logo" className="w-full h-full object-contain" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = activeTab === item.id;
            const navItem = item as any;
            return (
              <motion.button
                key={item.id}
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileOpen?.(false);
                }}
                className={`w-full group relative flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]' 
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5 border border-transparent'
                } ${isCollapsed && !isMobileOpen ? 'justify-center px-0' : ''}`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-bar"
                    className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <div className={`relative z-10 ${navItem.isAnimating ? 'animate-zigzag' : ''}`}>
                  <item.icon size={22} className={`transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]' : ''}`} />
                  {navItem.hasBadge && (
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-950" />
                  )}
                </div>
                {(!isCollapsed || isMobileOpen) && (
                  <span className={`relative z-10 font-bold text-sm tracking-tight transition-colors duration-300 ${isActive ? 'text-indigo-400' : 'text-text-secondary group-hover:text-text-primary'}`}>
                    {item.label}
                  </span>
                )}
                
                {/* Tooltip for collapsed state */}
                {isCollapsed && !isMobileOpen && (
                  <div className="absolute left-full ml-4 px-2 py-1 bg-bg-primary text-text-primary text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[80] border border-glass-border shadow-xl">
                    {item.label}
                  </div>
                )}
              </motion.button>
            );
          })}
        </nav>

        <div className="p-4 mt-auto">
          <motion.button 
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onProfileClick?.()}
            className={`w-full p-2.5 rounded-2xl glass border border-white/10 flex items-center gap-3 hover:bg-white/10 transition-all shadow-lg ${isCollapsed && !isMobileOpen ? 'justify-center border-none shadow-none bg-transparent hover:bg-white/5' : ''}`}
          >
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/20 bg-glass shadow-inner">
                <img 
                  src={user?.photoURL || "https://i.pravatar.cc/150?u=alex"} 
                  alt="User" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-black text-text-primary truncate font-sans tracking-tight">{user?.displayName || 'Alex Rivera'}</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 bg-indigo-500 rounded-full" />
                  <p className="text-[9px] text-indigo-400 font-black uppercase tracking-widest truncate">{userRole === 'admin' ? 'Admin' : 'Pro Member'}</p>
                </div>
              </div>
            )}
            {(!isCollapsed || isMobileOpen) && (
              <div className="p-1 text-slate-500">
                <MoreVertical size={14} />
              </div>
            )}
          </motion.button>
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-4 border-t border-white/5 space-y-1">
          <motion.button
            whileHover={{ scale: 1.02, x: 4 }}
            whileTap={{ scale: 0.98 }}
            onClick={toggleTheme}
            className={`w-full group flex items-center gap-4 px-3 py-2.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all ${isCollapsed && !isMobileOpen ? 'justify-center px-0' : ''}`}
            title="Cycle Themes"
          >
            <div className={`p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400`}>
              <Palette size={18} />
            </div>
            {(!isCollapsed || isMobileOpen) && <span className="font-bold text-[10px] uppercase tracking-[0.2em]">Appearance</span>}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, x: 4 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogout}
            className={`w-full group flex items-center gap-4 px-3 py-2.5 rounded-xl text-red-400/80 hover:text-red-400 hover:bg-red-500/5 transition-all ${isCollapsed && !isMobileOpen ? 'justify-center px-0' : ''}`}
          >
            <div className="p-1.5 rounded-lg bg-red-500/10">
              <LogOut size={18} className="transition-transform group-hover:-translate-x-1" />
            </div>
            {(!isCollapsed || isMobileOpen) && <span className="font-bold text-xs uppercase tracking-widest">Log Out</span>}
          </motion.button>

          <div className="flex items-center gap-1">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden md:flex flex-1 items-center justify-center py-2 text-text-secondary hover:text-text-primary hover:bg-glass rounded-lg transition-all"
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </motion.button>
            {isMobileOpen && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsMobileOpen?.(false)}
                className="md:hidden flex-1 flex items-center justify-center py-2 text-text-secondary hover:text-text-primary hover:bg-glass rounded-lg transition-all"
              >
                <ChevronLeft size={18} />
              </motion.button>
            )}
          </div>
        </div>
      </motion.aside>

      <ConfirmationModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={confirmLogout}
        title="Log Out?"
        message="Are you sure you want to log out of your account? You will need to sign in again to access your feed."
        confirmText="Log Out"
        cancelText="Stay"
        variant="warning"
      />
    </>
  );
});
