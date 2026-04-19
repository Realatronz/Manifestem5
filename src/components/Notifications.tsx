import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SplitText } from './SplitText';
import { Bell, Heart, MessageCircle, UserPlus, Star, Zap, Trash2, CheckCircle2 } from 'lucide-react';
import { Notification } from '../services/NotificationService';

import { SkeletonLoader } from './SkeletonLoader';

interface NotificationsProps {
  notifications: Notification[];
  loading?: boolean;
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}

export const Notifications: React.FC<NotificationsProps> = ({ 
  notifications, 
  loading = false,
  onMarkAllAsRead, 
  onMarkAsRead, 
  onDelete 
}) => {
  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'like': return <Heart size={18} className="text-pink-500 fill-pink-500" />;
      case 'reply': return <MessageCircle size={18} className="text-indigo-500" />;
      case 'follow': return <UserPlus size={18} className="text-blue-500" />;
      case 'mention': return <Zap size={18} className="text-yellow-500 fill-yellow-500" />;
      case 'message': return <MessageCircle size={18} className="text-emerald-500" />;
      default: return <Bell size={18} />;
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-6 pb-20"
    >
      <div className="flex items-center justify-between px-4">
        <SplitText text="Notifications" className="text-2xl font-black tracking-tight" />
        {notifications.some(n => !n.read) && (
          <button 
            onClick={onMarkAllAsRead}
            className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-widest transition-colors"
          >
            <CheckCircle2 size={14} />
            Mark all as read
          </button>
        )}
      </div>

      <div className="space-y-1">
        {loading ? (
          <SkeletonLoader type="notification" count={8} />
        ) : (
          <AnimatePresence mode="popLayout">
            {notifications.map((notification) => (
              <motion.div
                key={notification.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                whileHover={{ backgroundColor: 'var(--glass-bg)' }}
                onClick={() => !notification.read && onMarkAsRead(notification.id)}
                className={`group flex gap-4 p-4 transition-colors cursor-pointer border-b border-subtle relative ${!notification.read ? 'bg-indigo-500/5' : ''}`}
              >
                <div className="flex-shrink-0 mt-1">
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    {notification.from && (
                      <img 
                        src={notification.from.avatar} 
                        alt={notification.from.name} 
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full border border-glass-border shadow-sm"
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-sm text-text-primary leading-tight">
                        <span className="font-bold mr-1">{notification.from.name}</span>
                        {notification.type === 'like' && 'liked your post'}
                        {notification.type === 'reply' && 'replied to your post'}
                        {notification.type === 'repost' && 'reposted your post'}
                        {notification.type === 'mention' && 'mentioned you in a post'}
                        {notification.type === 'follow' && 'started following you'}
                        {notification.type === 'message' && 'sent you a message'}
                      </p>
                      {notification.content && (
                        <p className="text-xs text-text-secondary line-clamp-1 mt-0.5 italic">
                          "{notification.content}"
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                    {formatTimestamp(notification.createdAt)}
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  {!notification.read && (
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  )}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(notification.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-2 text-text-secondary hover:text-red-400 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {!loading && notifications.length === 0 && (
        <div className="py-20 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-glass flex items-center justify-center mx-auto text-text-secondary">
            <Bell size={32} />
          </div>
          <div className="space-y-1">
            <SplitText text="No notifications yet" className="text-lg font-bold text-text-primary" />
            <p className="text-text-secondary text-sm">When you get mentioned or someone interacts with your posts, they'll show up here.</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};
