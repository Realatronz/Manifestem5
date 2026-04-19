import React from 'react';
import { Search, User, Sparkles, GraduationCap, Home, Bell, Compass } from 'lucide-react';
import { motion } from 'motion/react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (value: string) => void;
  onProfileClick?: () => void;
  userRole: 'guest' | 'member' | 'admin';
}

export const BottomNav = React.memo(({ 
  activeTab, 
  setActiveTab, 
  onProfileClick, 
  userRole
}: BottomNavProps) => {
  const items = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'search', icon: activeTab === 'search' ? Search : Compass, label: 'Discover' },
    { id: 'groups', icon: GraduationCap, label: 'Academy' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-glass-border px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex justify-around items-center z-50">
      {items.map((item) => {
        return (
          <motion.button
            key={item.id}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              if (item.id === 'profile' && onProfileClick) {
                onProfileClick();
              } else {
                setActiveTab(item.id);
              }
            }}
            className={`relative flex flex-col items-center gap-1 transition-all ${
              activeTab === item.id ? 'text-indigo-500 scale-110' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {activeTab === item.id && (
              <motion.div
                layoutId="bottom-nav-indicator"
                className="absolute -bottom-1 w-4 h-0.5 bg-indigo-500 rounded-full"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <item.icon size={20} />
            <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
          </motion.button>
        );
      })}
    </nav>
  );
});
