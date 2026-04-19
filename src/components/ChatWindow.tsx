import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Hash, User, MoreVertical, Search, Sparkles, Trash2, MessageSquare, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SkeletonLoader } from './SkeletonLoader';
import { SplitText } from './SplitText';
import { db, collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc, serverTimestamp, handleFirestoreError, OperationType, setDoc } from '../firebase';
import { useAuth } from '../FirebaseProvider';
import { NotificationService } from '../services/NotificationService';
import { format, isToday, isYesterday, isSameDay, subDays } from 'date-fns';

interface ChatProps {
  userRole: 'guest' | 'member' | 'admin';
  allUsers: {id: string, name: string, handle: string, avatar: string}[];
  initialTargetUser?: {id: string, name: string, handle: string, avatar: string} | null;
}

interface Message {
  id: string;
  author: string;
  authorId: string;
  initials: string;
  time: string;
  date?: Date;
  content: string;
  isMe: boolean;
  status?: 'online' | 'offline';
}

const getDayLabel = (date: Date) => {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (date > subDays(new Date(), 7)) {
    return format(date, 'EEEE');
  }
  return format(date, 'MMMM d, yyyy');
};

const getConversationId = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join('_');
};

export const ChatWindow = ({ userRole, allUsers, initialTargetUser }: ChatProps) => {
  const { user, userProfile } = useAuth();
  const [message, setMessage] = useState('');
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{id: string, name: string, handle: string, avatar: string} | null>(initialTargetUser || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOtherUserTyping]);

  useEffect(() => {
    if (initialTargetUser) {
      setSelectedUser(initialTargetUser);
    }
  }, [initialTargetUser]);

  // Listen for typing status
  useEffect(() => {
    if (!user || !selectedUser) {
      setIsOtherUserTyping(false);
      return;
    }

    const conversationId = getConversationId(user.uid, selectedUser.id);
    const conversationDocRef = doc(db, 'direct_messages', conversationId);

    const unsubscribe = onSnapshot(conversationDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const typingStatus = data.typing || {};
        setIsOtherUserTyping(!!typingStatus[selectedUser.id]);
      } else {
        setIsOtherUserTyping(false);
      }
    }, (error) => {
      console.error("Error listening to typing status:", error);
    });

    return () => unsubscribe();
  }, [user?.uid, selectedUser?.id]);

  // Update current user's typing status with debounce
  useEffect(() => {
    if (!user || !selectedUser) return;

    const conversationId = getConversationId(user.uid, selectedUser.id);
    const conversationDocRef = doc(db, 'direct_messages', conversationId);

    const updateTyping = async (isTyping: boolean) => {
      try {
        await setDoc(conversationDocRef, {
          typing: { [user.uid]: isTyping }
        }, { merge: true });
      } catch (err) {
        // Silently fail for typing updates
      }
    };

    if (message.trim()) {
      updateTyping(true);
      const timeoutId = setTimeout(() => {
        updateTyping(false);
      }, 3000);
      return () => {
        clearTimeout(timeoutId);
      };
    } else {
      updateTyping(false);
    }
  }, [message, user?.uid, selectedUser?.id]);

  useEffect(() => {
    if (!user || !selectedUser) {
      setMessages([]);
      return;
    }

    const conversationId = getConversationId(user.uid, selectedUser.id);
    const path = `direct_messages/${conversationId}/messages`;
    const q = query(collection(db, path), orderBy('createdAt', 'asc'));

    setLoading(true);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => {
        const data = doc.data();
        const date = data.createdAt?.toDate();
        return {
          id: doc.id,
          ...data,
          date: date,
          isMe: data.authorId === user?.uid,
          time: date ? format(date, 'h:mm a') : 'Just now'
        } as Message;
      });
      setMessages(messagesData);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user?.uid, selectedUser?.id]);

  const handleSendMessage = async () => {
    if (!message.trim() || !user || !selectedUser) return;
    
    const conversationId = getConversationId(user.uid, selectedUser.id);
    const path = `direct_messages/${conversationId}/messages`;
    const messageContent = message.trim();
    setMessage('');

    // Clear typing status immediately
    setDoc(doc(db, 'direct_messages', conversationId), {
      typing: { [user.uid]: false }
    }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, conversationId));

    try {
      await addDoc(collection(db, path), {
        author: userProfile?.name || user.displayName || 'Anonymous',
        authorId: user.uid,
        initials: (userProfile?.name || user.displayName || 'A').split(' ').map(n => n[0]).join('').toUpperCase(),
        content: messageContent,
        createdAt: serverTimestamp(),
        status: 'online'
      });

      // Trigger Notification
      NotificationService.createNotification(selectedUser.id, {
        type: 'message',
        from: {
          id: user.uid,
          name: userProfile?.name || user.displayName || 'Someone',
          avatar: userProfile?.avatar || user.photoURL || ''
        },
        content: messageContent
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const deleteMessage = async (id: string) => {
    if (!selectedUser || !user) return;
    const conversationId = getConversationId(user.uid, selectedUser.id);
    const path = `direct_messages/${conversationId}/messages/${id}`;
    try {
      await deleteDoc(doc(db, 'direct_messages', conversationId, 'messages', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const filteredUsers = allUsers.filter(u => 
    u.id !== user?.uid && 
    (u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     u.handle.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex h-full glass rounded-[2.5rem] overflow-hidden border border-white/10">
      {/* Sidebar */}
      <div className="hidden lg:flex flex-col w-64 border-r border-white/10 bg-white/2">
        <div className="p-6 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Search users..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 px-2">Conversations</h4>
            <div className="space-y-1">
              {filteredUsers.map(u => (
                <button 
                  key={u.id} 
                  onClick={() => setSelectedUser(u)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${selectedUser?.id === u.id ? 'bg-indigo-600/20 text-white border border-indigo-500/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10">
                      <img src={u.avatar} alt={u.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="font-bold truncate w-full">{u.name}</span>
                    <span className="text-[10px] text-slate-500 truncate w-full">{u.handle}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedUser ? (
          <>
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10">
                  <img src={selectedUser.avatar} alt={selectedUser.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </div>
                <div>
                  <SplitText text={selectedUser.name} className="font-bold text-sm" />
                  <div className="flex flex-col">
                    <p className="text-xs text-slate-500">{selectedUser.handle}</p>
                  </div>
                </div>
              </div>
              <button className="p-2 text-slate-400 hover:text-white transition-colors">
                <MoreVertical size={20} />
              </button>
            </div>

            <div className="flex-1 px-6 pt-6 pb-2 overflow-y-auto space-y-6">
              <AnimatePresence initial={false}>
                {loading ? (
                  <SkeletonLoader type="message" count={6} />
                ) : (
                  <>
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                          <MessageSquare size={32} />
                        </div>
                        <p className="text-sm">No messages yet. Start the conversation!</p>
                      </div>
                    )}
                    {messages.map((msg, idx, allMsgs) => {
                  const prevMsg = idx > 0 ? allMsgs[idx - 1] : null;
                  const showDayStamp = !prevMsg || (msg.date && prevMsg.date && !isSameDay(msg.date, prevMsg.date));

                  return (
                    <React.Fragment key={msg.id}>
                      {showDayStamp && msg.date && (
                        <div className="flex justify-center my-4">
                          <div className="bg-slate-800/80 backdrop-blur-md px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 border border-white/5">
                            {getDayLabel(msg.date)}
                          </div>
                        </div>
                      )}
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`flex items-start gap-4 group ${msg.isMe ? 'flex-row-reverse' : ''}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center font-bold ${msg.isMe ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-indigo-400'}`}>
                          {msg.initials}
                        </div>
                        <div className={`flex-1 space-y-1 ${msg.isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                          {!msg.isMe && (
                            <span className="font-bold text-sm ml-2">{msg.author}</span>
                          )}
                          <div className={`relative group/msg ${msg.isMe ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-none' : 'bg-white/5 text-slate-300 rounded-2xl rounded-tl-none'} px-4 py-2.5 max-w-[80%]`}>
                            <div className="relative min-w-[60px] pb-1">
                              <p className="text-sm leading-relaxed break-words pr-14">
                                {msg.content}
                              </p>
                              
                              <div className="absolute -bottom-1 right-0 flex items-center gap-1 opacity-60 whitespace-nowrap">
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${msg.isMe ? 'text-indigo-100' : 'text-slate-400'}`}>
                                  {msg.time}
                                </span>
                                {msg.isMe && <Check size={10} className="text-indigo-300" />}
                              </div>
                            </div>

                            {(userRole === 'admin' || msg.isMe) && (
                              <div className={`absolute top-0 ${msg.isMe ? '-left-8' : '-right-8'} opacity-0 group-hover/msg:opacity-100 transition-opacity`}>
                                <button 
                                  onClick={() => deleteMessage(msg.id)}
                                  className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    </React.Fragment>
                  );
                })}
              </>
            )}
            {isOtherUserTyping && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-4"
                  >
                    <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center bg-slate-800 border border-white/10 text-indigo-400 shadow-lg animate-pulse">
                      <User size={18} />
                    </div>
                    <div className="bg-white/5 text-slate-300 px-4 py-2 rounded-2xl rounded-tl-none border border-white/5 shadow-lg flex gap-1.5 items-center">
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0 }} className="w-1 h-1 rounded-full bg-indigo-400" />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="w-1 h-1 rounded-full bg-indigo-400" />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="w-1 h-1 rounded-full bg-indigo-400" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 sm:p-6">
              <div className="glass rounded-2xl p-1.5 sm:p-2 flex items-center gap-1 sm:gap-2">
                <button className="p-2 text-slate-400 hover:text-white transition-colors">
                  <Paperclip size={18} className="sm:w-5 sm:h-5" />
                </button>
                <input 
                  type="text" 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={`Message ${selectedUser.name}...`} 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 placeholder:text-slate-500"
                />
                <button 
                  onClick={handleSendMessage}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-xl transition-colors"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-6">
            <div className="w-24 h-24 rounded-[2rem] bg-indigo-600/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20 shadow-2xl">
              <MessageSquare size={48} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black tracking-tight">Your Messages</h3>
              <p className="text-slate-500 max-w-xs mx-auto">Select a user from the sidebar to start a real-time conversation.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
