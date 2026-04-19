import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface User {
  id: string;
  name: string;
  handle: string;
  avatar: string;
}

interface MentionListProps {
  users: User[];
  onSelect: (user: User) => void;
  onClose: () => void;
  searchQuery: string;
}

export const MentionList: React.FC<MentionListProps> = ({ users, onSelect, onClose, searchQuery }) => {
  const filteredUsers = users.filter(u => 
    u.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5);

  if (filteredUsers.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="absolute bottom-full left-0 mb-2 w-64 bg-bg-primary/95 backdrop-blur-xl border border-subtle rounded-2xl shadow-2xl overflow-hidden z-[100]"
    >
      <div className="p-2 border-b border-subtle bg-glass">
        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest px-2">Mention User</span>
      </div>
      <div className="max-h-64 overflow-y-auto scrollbar-hide p-1">
        {filteredUsers.map((user) => (
          <button
            key={user.id}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(user);
            }}
            className="w-full flex items-center gap-3 p-2 hover:bg-glass rounded-xl transition-all group text-left"
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-subtle flex-shrink-0">
              <img src={user.avatar} alt={user.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-text-primary truncate group-hover:text-indigo-400 transition-colors">{user.name}</span>
              <span className="text-[10px] text-text-secondary font-medium truncate">@{user.handle}</span>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
};
