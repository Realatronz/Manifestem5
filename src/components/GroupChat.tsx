import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SplitText } from './SplitText';
import { Send, Paperclip, Smile, MoreVertical, Trash2, User, Users, Image as ImageIcon, X, Search, Reply, Edit2, Check, CornerDownRight, Pin, PinOff, Plus, ChevronDown } from 'lucide-react';
import { useAuth } from '../FirebaseProvider';
import { db, collection, addDoc, onSnapshot, query, orderBy, limit, doc, deleteDoc, updateDoc, serverTimestamp, handleFirestoreError, OperationType } from '../firebase';
import { ConfirmationModal } from './ConfirmationModal';
import { format, isToday, isYesterday, isSameDay, subDays } from 'date-fns';

import { renderTextWithMentions } from '../lib/mentionUtils';
import { MentionList } from './MentionList';

interface Message {
  id: string;
  author: string;
  authorId: string;
  initials: string;
  time: string;
  date?: Date;
  content?: string;
  image?: string;
  isMe: boolean;
  status?: 'online' | 'offline';
  replyTo?: string;
  replyContent?: string;
  reactions?: { [emoji: string]: string[] }; // emoji -> list of userIds
  isEdited?: boolean;
  isPinned?: boolean;
}

const getDayLabel = (date: Date) => {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (date > subDays(new Date(), 7)) {
    return format(date, 'EEEE');
  }
  return format(date, 'MMMM d, yyyy');
};

interface GroupChatProps {
  groupId: string;
  groupName: string;
  userRole: 'guest' | 'member' | 'admin';
  allUsers?: {id: string, name: string, handle: string, avatar: string}[];
}

export const GroupChat = React.memo(({ groupId, groupName, userRole, allUsers = [] }: GroupChatProps) => {
  const { user, userProfile } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  
  // New States
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editContent, setEditContent] = useState('');
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  
  // Fetch group members to know who is admin
  useEffect(() => {
    if (!groupId) return;
    const unsubscribe = onSnapshot(doc(db, 'academies', groupId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setGroupMembers(data.membersList || []);
        setOwnerId(data.ownerId || null);
      }
    });
    return () => unsubscribe();
  }, [groupId]);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [messageToConfirmEdit, setMessageToConfirmEdit] = useState<{ id: string, content: string } | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [allGroups, setAllGroups] = useState<{id: string, name: string}[]>([]);
  
  // Search States
  const [showSearch, setShowSearch] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [currentSearchResultIndex, setCurrentSearchResultIndex] = useState(-1);
  
  // Mention States
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionType, setMentionType] = useState<'main' | 'edit'>('main');
  const [typingUsers, setTypingUsers] = useState<{[userId: string]: {name: string, isSending: boolean}}>({});
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [isPinnedExpanded, setIsPinnedExpanded] = useState(false);
  
  const isEffectiveAdmin = userRole === 'admin' || 
                           groupMembers.find(m => m.id === user?.uid)?.role === 'admin' ||
                           (ownerId && user?.uid === ownerId) ||
                           (user?.email === "realatronz@gmail.com");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const EMOJIS = ['❤️', '🔥', '😂', '🙌', '✨', '🚀', '💯', '👍', '😎', '👋', '🎉', '💡', '🤔', '👀', '💪', '🌈'];
  
  const handleLongPressStart = (msg: Message) => {
    longPressTimer.current = setTimeout(() => {
      setActiveMessageMenu(msg.id);
      if (window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };
  
  // Fetch all academies for forwarding
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'academies'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllGroups(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    });
    return () => unsubscribe();
  }, []);

  const handleForwardMessage = async (targetGroupId: string) => {
    if (!forwardingMessage || !user || !userProfile) return;

    try {
      await addDoc(collection(db, 'academies', targetGroupId, 'messages'), {
        author: userProfile.name,
        authorId: user.uid,
        initials: userProfile.name.split(' ').map(n => n[0]).join('').toUpperCase(),
        content: forwardingMessage.content || null,
        image: forwardingMessage.image || null,
        createdAt: serverTimestamp(),
        status: 'online',
        reactions: {}
      });
      setShowForwardModal(false);
      setForwardingMessage(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `academies/${targetGroupId}/messages`);
    }
  };

  // Cleanup typing status on unmount
  useEffect(() => {
    return () => {
      if (user?.uid && groupId) {
        updateTypingStatus(false, false);
      }
    };
  }, [groupId, user?.uid]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real-time messages listener
  useEffect(() => {
    if (!groupId || !user) return;

    const q = query(
      collection(db, 'academies', groupId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => {
        const data = doc.data();
        const date = data.createdAt?.toDate();
        return {
          id: doc.id,
          ...data,
          isMe: data.authorId === user?.uid,
          date: date,
          time: date ? format(date, 'h:mm a') : 'Just now'
        } as Message;
      }).reverse();
      setMessages(messagesData);
      
      // Clear optimistic messages that have been delivered
      if (user?.uid) {
        setOptimisticMessages(prev => prev.filter(optMsg => 
          !messagesData.some(m => m.authorId === user.uid && m.content === optMsg.content)
        ));
      }
      
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `academies/${groupId}/messages`);
    });

    return () => unsubscribe();
  }, [groupId, user?.uid]);

  // Listen for typing status
  useEffect(() => {
    if (!groupId || !user) return;
    const groupRef = doc(db, 'academies', groupId);
    const unsubscribe = onSnapshot(groupRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const typing = data.typing || {};
        const now = Date.now();
        const activeTyping: {[userId: string]: {name: string, isSending: boolean}} = {};
        
        Object.entries(typing).forEach(([uid, info]: [string, any]) => {
          if (uid !== user?.uid && info && info.timestamp > now - 5000) {
            activeTyping[uid] = {
              name: info.name,
              isSending: !!info.isSending
            };
          }
        });
        setTypingUsers(activeTyping);
      }
    });
    return () => unsubscribe();
  }, [groupId, user?.uid]);

  const updateTypingStatus = async (isTyping: boolean, isSending: boolean = false) => {
    if (!user || !userProfile || !groupId) return;
    const groupRef = doc(db, 'academies', groupId);
    try {
      await updateDoc(groupRef, {
        [`typing.${user.uid}`]: (isTyping || isSending) ? {
          name: userProfile.name,
          timestamp: Date.now(),
          isSending
        } : null
      });
    } catch (error) {
      // Ignore typing errors
    }
  };

  useEffect(() => {
    if (chatSearchQuery.trim() === '') {
      setSearchResults([]);
      setCurrentSearchResultIndex(-1);
      return;
    }

    const filtered = messages.filter(msg => 
      msg.content?.toLowerCase().includes(chatSearchQuery.toLowerCase())
    );
    setSearchResults(filtered);
    setCurrentSearchResultIndex(filtered.length > 0 ? filtered.length - 1 : -1);
  }, [chatSearchQuery, messages]);

  const scrollToMessage = (messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a brief highlight effect
      element.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-4', 'ring-offset-black');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-4', 'ring-offset-black');
      }, 2000);
    }
  };

  const navigateSearch = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;
    
    let newIndex = currentSearchResultIndex;
    if (direction === 'next') {
      newIndex = (currentSearchResultIndex + 1) % searchResults.length;
    } else {
      newIndex = (currentSearchResultIndex - 1 + searchResults.length) % searchResults.length;
    }
    
    setCurrentSearchResultIndex(newIndex);
    scrollToMessage(searchResults[newIndex].id);
  };

  const handleSendMessage = async (media?: { image?: string }) => {
    if ((!message.trim() && !media) || !user || !userProfile) return;
    
    const messageContent = message.trim();
    const replyData = replyingTo ? {
      replyTo: replyingTo.author,
      replyContent: replyingTo.content || 'Image'
    } : {};

    // Create optimistic message
    const tempId = `opt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newMessage: Message = {
      id: tempId,
      author: userProfile.name,
      authorId: user.uid,
      initials: userProfile.name.split(' ').map(n => n[0]).join('').toUpperCase(),
      content: messageContent || undefined,
      ...media,
      ...replyData,
      time: 'Just now',
      isMe: true,
      reactions: {}
    };

    // Show instantly for sender
    setOptimisticMessages(prev => [...prev, newMessage]);

    setMessage('');
    setSelectedImage(null);
    setShowEmojiPicker(false);
    setReplyingTo(null);

    // Show "texting..." for others during the delay
    updateTypingStatus(true, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    // Artificial delay to show typing indicator to others (Anxiety Engine)
    setTimeout(async () => {
      try {
        await addDoc(collection(db, 'academies', groupId, 'messages'), {
          author: userProfile.name,
          authorId: user.uid,
          initials: userProfile.name.split(' ').map(n => n[0]).join('').toUpperCase(),
          content: messageContent || null,
          ...media,
          ...replyData,
          createdAt: serverTimestamp(),
          status: 'online',
          reactions: {}
        });
        // Clear optimistic message on success
        setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `academies/${groupId}/messages`);
        setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
      } finally {
        updateTypingStatus(false, false);
      }
    }, 3000);
  };

  const handleEditMessage = async () => {
    if (!messageToConfirmEdit || !groupId) return;
    
    try {
      await updateDoc(doc(db, 'academies', groupId, 'messages', messageToConfirmEdit.id), {
        content: messageToConfirmEdit.content,
        isEdited: true
      });
      setEditingMessage(null);
      setEditContent('');
      setMessageToConfirmEdit(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `academies/${groupId}/messages/${messageToConfirmEdit.id}`);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    const reactions = { ...(msg.reactions || {}) };
    const userReactions = reactions[emoji] || [];
    
    if (userReactions.includes(user.uid)) {
      reactions[emoji] = userReactions.filter(id => id !== user.uid);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...userReactions, user.uid];
    }

    try {
      await updateDoc(doc(db, 'academies', groupId, 'messages', messageId), { reactions });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `academies/${groupId}/messages/${messageId}`);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const deleteMessage = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'academies', groupId, 'messages', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `academies/${groupId}/messages/${id}`);
    }
  };

  const handlePinMessage = async (messageId: string, currentPinnedStatus: boolean) => {
    if (!isEffectiveAdmin) return;
    
    try {
      await updateDoc(doc(db, 'academies', groupId, 'messages', messageId), {
        isPinned: !currentPinnedStatus
      });
      setActiveMessageMenu(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `academies/${groupId}/messages/${messageId}`);
    }
  };

  const handleInputChange = (val: string, type: 'main' | 'edit' = 'main') => {
    if (type === 'main') {
      setMessage(val);
      
      // Update typing status
      if (val.trim()) {
        updateTypingStatus(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          updateTypingStatus(false);
        }, 3000);
      } else {
        updateTypingStatus(false);
      }
    } else {
      setEditContent(val);
    }

    const lastChar = val[val.length - 1];
    const lastWord = val.split(' ').pop() || '';

    if (lastWord.startsWith('@')) {
      setMentionSearch(lastWord.substring(1));
      setShowMentions(true);
      setMentionType(type);
    } else {
      setShowMentions(false);
    }
  };

  const handleMentionSelect = (user: { handle: string }) => {
    if (mentionType === 'main') {
      const words = message.split(' ');
      words.pop();
      setMessage([...words, `@${user.handle} `].join(' '));
    } else {
      const words = editContent.split(' ');
      words.pop();
      setEditContent([...words, `@${user.handle} `].join(' '));
    }
    setShowMentions(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-40px)] sm:h-[800px] bg-slate-950/20 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl relative">
      <div className="flex-shrink-0 px-4 md:px-6 py-3 glass border-b border-white/5 shadow-2xl z-20 mx-2 sm:mx-6 mt-2 rounded-2xl relative">
        <AnimatePresence mode="wait">
          {activeMessageMenu ? (
            <motion.div 
              key="selection-header"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setActiveMessageMenu(null)}
                  className="p-2 glass-button rounded-xl text-text-secondary hover:text-text-primary transition-colors"
                >
                  <X size={20} />
                </button>
                <div className="flex flex-col">
                  <h3 className="font-black text-sm tracking-tight text-white">Message Options</h3>
                  <p className="text-[9px] text-indigo-400 font-black uppercase tracking-widest">Selected</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {/* Reply */}
                <button 
                  onClick={() => {
                    const msg = messages.find(m => m.id === activeMessageMenu);
                    if (msg) setReplyingTo(msg);
                    setActiveMessageMenu(null);
                  }}
                  className="p-2.5 glass-button rounded-xl text-indigo-400 transition-colors"
                  title="Reply"
                >
                  <Reply size={20} />
                </button>

                {/* Edit (own message only) */}
                {messages.find(m => m.id === activeMessageMenu)?.isMe && (
                  <button 
                    onClick={() => {
                      const msg = messages.find(m => m.id === activeMessageMenu);
                      if (msg) {
                        setEditingMessage(msg);
                        setEditContent(msg.content || '');
                      }
                      setActiveMessageMenu(null);
                    }}
                    className="p-2.5 glass-button rounded-xl text-slate-400 hover:text-white transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={20} />
                  </button>
                )}
                
                {/* Forward */}
                <button 
                  onClick={() => {
                    const msg = messages.find(m => m.id === activeMessageMenu);
                    if (msg) setForwardingMessage(msg);
                    setShowForwardModal(true);
                    setActiveMessageMenu(null);
                  }}
                  className="p-2.5 glass-button rounded-xl text-slate-400 hover:text-white transition-colors"
                  title="Forward"
                >
                  <CornerDownRight size={20} />
                </button>

                {/* Delete (own message OR admin) */}
                {(messages.find(m => m.id === activeMessageMenu)?.isMe || isEffectiveAdmin) && (
                  <button 
                    onClick={() => setActiveMessageMenu(null)}
                    className="p-2.5 glass-button rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={20} />
                  </button>
                )}

                {/* Pin (admin only) */}
                {isEffectiveAdmin && (
                  <button 
                    onClick={() => {
                      const msg = messages.find(m => m.id === activeMessageMenu);
                      if (msg) handlePinMessage(msg.id, !!msg.isPinned);
                    }}
                    className="p-2.5 glass-button rounded-xl text-indigo-400 transition-colors"
                    title={messages.find(m => m.id === activeMessageMenu)?.isPinned ? "Unpin" : "Pin"}
                  >
                    {messages.find(m => m.id === activeMessageMenu)?.isPinned ? <PinOff size={20} /> : <Pin size={20} />}
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="normal-header"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-3">
                <div className="relative group">
                  <div className="w-11 h-11 rounded-2xl glass-morphism flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform duration-500">
                    <Users size={20} />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-950 shadow-[0_0_10px_rgba(34,197,94,0.6)]">
                    <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-30" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <h3 className="font-black text-sm tracking-tight text-white font-sans italic">{groupName}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] text-emerald-400 font-black uppercase tracking-widest">active now</span>
                    <span className="text-slate-700 text-[10px] font-bold">•</span>
                    <span className="text-slate-500 text-[9px] font-black uppercase tracking-widest">{messages.length} messages</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowSearch(!showSearch);
                    if (showSearch) {
                      setChatSearchQuery('');
                    }
                  }}
                  className={`w-10 h-10 glass-button rounded-xl transition-all ${showSearch ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]' : 'text-slate-400'}`}
                >
                  <Search size={18} />
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 glass-button rounded-xl text-slate-400"
                >
                  <MoreVertical size={18} />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Search Bar - Expandable */}
      <AnimatePresence>
        {showSearch && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-glass border-b border-subtle"
            >
              <div className="px-6 py-3 flex items-center gap-4">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input 
                    type="text"
                    autoFocus
                    placeholder="Search messages..."
                    value={chatSearchQuery}
                    onChange={(e) => setChatSearchQuery(e.target.value)}
                    className="w-full bg-glass border border-subtle rounded-xl py-2 pl-9 pr-4 text-xs text-text-primary focus:outline-none focus:border-indigo-500/50 transition-all"
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest">
                      {currentSearchResultIndex + 1} of {searchResults.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => navigateSearch('prev')}
                        className="p-1.5 hover:bg-glass rounded-lg text-text-secondary hover:text-text-primary transition-colors"
                      >
                        <CornerDownRight size={14} className="rotate-180" />
                      </button>
                      <button 
                        onClick={() => navigateSearch('next')}
                        className="p-1.5 hover:bg-glass rounded-lg text-text-secondary hover:text-text-primary transition-colors"
                      >
                        <CornerDownRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
                <button 
                  onClick={() => {
                    setShowSearch(false);
                    setChatSearchQuery('');
                  }}
                  className="p-2 text-text-secondary hover:text-text-primary transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Pinned Messages - Revised Section */}
      <AnimatePresence>
        {messages.some(m => m.isPinned) && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-slate-900 border-b border-white/5 relative z-30"
          >
            <div 
              onClick={() => setIsPinnedExpanded(!isPinnedExpanded)}
              className="px-6 py-2 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Pin size={12} className="text-indigo-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
                  {messages.filter(m => m.isPinned).length} Pinned {messages.filter(m => m.isPinned).length === 1 ? 'Message' : 'Messages'}
                </span>
              </div>
              <motion.div
                animate={{ rotate: isPinnedExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown size={14} className="text-slate-500" />
              </motion.div>
            </div>
            
            <AnimatePresence>
              {isPinnedExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-6 pb-3 space-y-2 max-h-[250px] overflow-y-auto scrollbar-hide"
                >
                  {messages.filter(m => m.isPinned).map(pinnedMsg => (
                    <div
                      key={pinnedMsg.id}
                      className="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all"
                    >
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => scrollToMessage(pinnedMsg.id)}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{pinnedMsg.author}</span>
                          <span className="text-[9px] text-slate-500 font-bold">{pinnedMsg.time}</span>
                        </div>
                        <p className="text-xs text-text-secondary truncate">{pinnedMsg.content || 'Image'}</p>
                      </div>
                      {isEffectiveAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePinMessage(pinnedMsg.id, true);
                            }}
                            className="p-2 text-slate-500 hover:text-indigo-400 transition-colors"
                            title="Unpin"
                          >
                            <PinOff size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMessageToDelete(pinnedMsg.id);
                            }}
                            className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                            title="Delete Message"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            
            {!isPinnedExpanded && (
              <div className="px-6 pb-2">
                <div 
                  onClick={() => scrollToMessage(messages.find(m => m.isPinned)?.id || '')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/5 rounded-xl text-[10px] text-text-secondary truncate cursor-pointer hover:bg-white/10 transition-colors"
                >
                   <span className="font-black text-indigo-400/70 uppercase tracking-widest">{messages.find(m => m.isPinned)?.author}:</span>
                   <span className="truncate">{messages.find(m => m.isPinned)?.content || 'Image'}</span>
                   <span className="ml-auto text-[8px] opacity-50">{messages.find(m => m.isPinned)?.time}</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area - WhatsApp Style Bubbles */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-6 pb-0 scrollbar-hide flex flex-col z-10 relative">
        <div className="flex-1" />
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {[...messages, ...optimisticMessages].map((msg, idx, allMsgs) => {
              const prevMsg = idx > 0 ? allMsgs[idx - 1] : null;
              const showDayStamp = !prevMsg || (msg.date && prevMsg.date && !isSameDay(msg.date, prevMsg.date));

              return (
                <React.Fragment key={`${msg.id}-${idx}`}>
                  {showDayStamp && msg.date && (
                    <div className="flex justify-center my-4">
                      <div className="bg-slate-800/80 backdrop-blur-md px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 border border-white/5">
                        {getDayLabel(msg.date)}
                      </div>
                    </div>
                  )}
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ 
                      type: "spring", 
                      damping: 25, 
                      stiffness: 200
                    }}
                    className={`flex items-end gap-2 ${msg.isMe ? 'flex-row-reverse' : ''} group mb-2`}
                    id={`msg-${msg.id}`}
                  >
                    {!msg.isMe && (
                      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-black text-[10px] bg-slate-800 border border-white/10 text-indigo-400 shadow-lg mb-1">
                        {msg.initials}
                      </div>
                    )}
                    <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] space-y-1 ${msg.isMe ? 'items-end' : 'items-start'}`}>
                      {!msg.isMe && (
                        <div className="flex items-center gap-1.5 ml-2 mb-0.5">
                          <span className="text-[10px] font-black text-indigo-400/80 uppercase tracking-widest">{msg.author}</span>
                          {/* We need to know if this specific message author is an admin of the group */}
                          {groupMembers.find(m => m.id === msg.authorId || m.name === msg.author)?.role === 'admin' && (
                            <span className="bg-indigo-500/20 text-indigo-400 text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest border border-indigo-500/20">Admin</span>
                          )}
                        </div>
                      )}
                      
                      {msg.replyTo && (
                        <div className={`flex items-center gap-2 px-3 py-2 bg-slate-900/60 rounded-t-xl border-l-4 border-indigo-500/50 text-[10px] text-text-secondary max-w-full truncate mb-[-8px] relative z-0 ${msg.isMe ? 'mr-1' : 'ml-1'}`}>
                          <div className="flex flex-col overflow-hidden">
                            <span className="font-black text-indigo-400/70 uppercase tracking-wider text-[8px]">Replying to {msg.replyTo}</span>
                            <span className="truncate opacity-50 italic">{msg.replyContent}</span>
                          </div>
                        </div>
                      )}

                      <div className="relative group/msg">
                        {editingMessage?.id === msg.id ? (
                          <div className="flex flex-col gap-2 min-w-[200px] bg-slate-900/80 p-3 rounded-2xl border border-indigo-500/30 relative">
                            <AnimatePresence>
                              {showMentions && mentionType === 'edit' && (
                                <MentionList 
                                  users={allUsers} 
                                  onSelect={handleMentionSelect} 
                                  onClose={() => setShowMentions(false)} 
                                  searchQuery={mentionSearch} 
                                />
                              )}
                            </AnimatePresence>
                            <textarea
                              value={editContent}
                              onChange={(e) => handleInputChange(e.target.value, 'edit')}
                              className="w-full bg-transparent border-none p-0 text-sm text-text-primary focus:ring-0 resize-none"
                              rows={2}
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setEditingMessage(null)} className="px-3 py-1 text-[10px] font-bold text-text-secondary">Cancel</button>
                              <button onClick={() => setMessageToConfirmEdit({ id: msg.id, content: editContent })} className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg">Save</button>
                            </div>
                          </div>
                        ) : (
                          <div className="relative">
                            {/* Bubble Tail */}
                            <div className={`absolute top-0 w-4 h-4 overflow-hidden ${msg.isMe ? '-right-2' : '-left-2'}`}>
                              <div className={`w-4 h-4 transform rotate-45 ${msg.isMe ? 'bg-indigo-600' : 'bg-slate-800 border-l border-t border-white/5'}`} />
                            </div>

                            <div 
                              onMouseDown={() => handleLongPressStart(msg)}
                              onMouseUp={handleLongPressEnd}
                              onMouseLeave={handleLongPressEnd}
                              onTouchStart={() => handleLongPressStart(msg)}
                              onTouchEnd={handleLongPressEnd}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setActiveMessageMenu(msg.id);
                              }}
                              className={`px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed shadow-lg relative cursor-pointer select-none transition-all duration-300 ${
                              msg.isMe 
                                ? 'bg-indigo-600/90 backdrop-blur-md text-white rounded-tr-none' 
                                : 'bg-white/5 backdrop-blur-md text-text-primary rounded-tl-none border border-white/10'
                            } ${activeMessageMenu === msg.id ? 'ring-2 ring-indigo-400 ring-offset-4 ring-offset-slate-950 scale-[1.02]' : ''}`}>
                              {msg.image && (
                                <div className="mb-2 rounded-lg overflow-hidden border border-white/10">
                                  <img src={msg.image} alt="Upload" className="max-w-full" referrerPolicy="no-referrer" />
                                </div>
                              )}
                              <div className="flex flex-col min-w-[60px]">
                                <div className="relative pb-1">
                                  <p className="font-medium text-[14px] leading-relaxed break-words pr-14">
                                    {renderTextWithMentions(msg.content || '')}
                                  </p>
                                  <div className="absolute -bottom-1 right-0 flex items-center gap-1 opacity-60 whitespace-nowrap">
                                    {msg.isPinned && <Pin size={8} className="text-indigo-300" />}
                                    {msg.isEdited && <span className="text-[7px] font-black uppercase tracking-tighter">Edited</span>}
                                    <span className={`text-[9px] font-bold uppercase tracking-wider ${msg.isMe ? 'text-indigo-100' : 'text-slate-400'}`}>
                                      {msg.time}
                                    </span>
                                    {msg.isMe && <Check size={10} className="text-indigo-300" />}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Reactions Display */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className={`absolute -bottom-3 ${msg.isMe ? 'right-0' : 'left-0'} flex flex-wrap gap-1 z-20`}>
                            {Object.entries(msg.reactions).map(([emoji, users]) => (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(msg.id, emoji)}
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border backdrop-blur-md transition-all ${
                                  (users as string[]).includes(user?.uid || '')
                                    ? 'bg-indigo-500/40 border-indigo-500/50 text-white'
                                    : 'bg-slate-900/90 border-white/10 text-slate-300'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="font-bold">{(users as string[]).length}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Long Press Options Menu (WhatsApp Style) */}
                        <AnimatePresence>
                          {activeMessageMenu === msg.id && (
                            <>
                              {/* Backdrop to close menu */}
                              <div 
                                className="fixed inset-0 z-[100]" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMessageMenu(null);
                                }}
                              />
                              <motion.div
                                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                className={`absolute bottom-full mb-3 ${msg.isMe ? 'right-0' : 'left-0'} p-1 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] flex flex-col gap-0.5 z-[110] ring-1 ring-white/5`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {/* Quick Reactions */}
                                <div className="flex items-center justify-between gap-0.5 px-2 py-1">
                                  <div className="flex items-center gap-0.5">
                                    {['👍', '❤️', '😂', '😲', '😢', '🙏', '🔥'].map(emoji => (
                                      <motion.button
                                        key={emoji}
                                        whileHover={{ scale: 1.4, y: -5 }}
                                        whileTap={{ scale: 0.8 }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleReaction(msg.id, emoji);
                                          setActiveMessageMenu(null);
                                        }}
                                        className="p-1 px-1.5 text-xl flex-shrink-0 transition-all duration-200"
                                      >
                                        {emoji}
                                      </motion.button>
                                    ))}
                                  </div>
                                  <motion.button
                                    whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowEmojiPicker(true);
                                      setReactionPickerMessageId(msg.id);
                                    }}
                                    className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-white transition-colors"
                                  >
                                    <Plus size={16} />
                                  </motion.button>
                                </div>

                                {/* Action Buttons removed, placed in Top Header */}
                              </motion.div>
                            </>
                          )}
                            </AnimatePresence>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </React.Fragment>
            );
          })}
          {Object.entries(typingUsers).length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-end gap-2 mb-0"
            >
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-slate-800 border border-white/10 text-indigo-400 shadow-lg animate-pulse">
                <User size={12} />
              </div>
              <div className="bg-slate-800 text-text-secondary px-4 py-2 rounded-2xl rounded-bl-none border border-white/5 shadow-lg flex gap-1.5 items-center">
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0 }} className="w-1 h-1 rounded-full bg-indigo-400" />
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="w-1 h-1 rounded-full bg-indigo-400" />
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="w-1 h-1 rounded-full bg-indigo-400" />
                <span className="ml-1 text-[9px] font-black uppercase tracking-widest opacity-60">typing...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>
    </div>

    {/* Input Area - Glassmorphic */}
      <div className="p-2 sm:px-6 sm:pb-6 sm:pt-2 glass border-t border-white/5 z-10 mx-2 sm:mx-6 mb-2 rounded-2xl shadow-2xl">
        <AnimatePresence>
          {selectedImage && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="max-w-5xl mx-auto w-full mb-2"
            >
              <div className="relative inline-block group">
                <img 
                  src={selectedImage} 
                  alt="Preview" 
                  className="w-24 h-24 object-cover rounded-xl border border-white/10"
                  referrerPolicy="no-referrer"
                />
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-center gap-3 max-w-5xl mx-auto w-full">
          <div className="flex-1 min-w-0 flex items-center gap-2 sm:gap-4 bg-white/5 border border-white/10 rounded-2xl px-3 sm:px-4 h-11 sm:h-14 focus-within:border-indigo-500/50 transition-all relative backdrop-blur-xl">
            <AnimatePresence>
              {showMentions && mentionType === 'main' && (
                <MentionList 
                  users={allUsers} 
                  onSelect={handleMentionSelect} 
                  onClose={() => setShowMentions(false)} 
                  searchQuery={mentionSearch} 
                />
              )}
            </AnimatePresence>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleImageSelect}
            />
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-400 hover:text-indigo-400 transition-colors"
            >
              <Paperclip size={18} />
            </motion.button>
            
            <input 
              type="text" 
              value={message}
              onChange={(e) => handleInputChange(e.target.value, 'main')}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(selectedImage ? { image: selectedImage } : undefined)}
              placeholder="Type a message..." 
              className="flex-1 min-w-0 bg-transparent border-none focus:ring-0 text-[14px] py-2 placeholder:text-slate-500 text-text-primary"
            />
            
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2 transition-colors ${showEmojiPicker ? 'text-indigo-400' : 'text-slate-400 hover:text-indigo-400'}`}
            >
              <Smile size={18} />
            </motion.button>
          </div>
          
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSendMessage(selectedImage ? { image: selectedImage } : undefined)}
            disabled={!message.trim() && !selectedImage}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-indigo-600/20 flex-shrink-0"
          >
            <Send size={18} />
          </motion.button>
        </div>
      </div>
      <ConfirmationModal 
        isOpen={!!messageToDelete}
        onClose={() => setMessageToDelete(null)}
        onConfirm={() => {
          if (messageToDelete) {
            deleteMessage(messageToDelete);
            setMessageToDelete(null);
          }
        }}
        title="Delete Message?"
        message="This action cannot be undone. The message will be removed for everyone."
        confirmText="Delete"
        variant="danger"
      />

      <ConfirmationModal 
        isOpen={!!messageToConfirmEdit}
        onClose={() => setMessageToConfirmEdit(null)}
        onConfirm={handleEditMessage}
        title="Save Changes?"
        message="Are you sure you want to update this message?"
        confirmText="Save"
        variant="info"
      />

      {/* Forward Message Modal */}
      <AnimatePresence>
        {showForwardModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForwardModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass-card !p-6 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <CornerDownRight size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight">Forward Message</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Select an academy to share with</p>
                  </div>
                </div>
                <button onClick={() => setShowForwardModal(false)} className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 scrollbar-hide">
                {allGroups.filter(g => g.id !== groupId).map(group => (
                  <button
                    key={group.id}
                    onClick={() => handleForwardMessage(group.id)}
                    className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-indigo-400 transition-colors">
                        <Users size={16} />
                      </div>
                      <span className="text-sm font-bold text-white">{group.name}</span>
                    </div>
                    <div className="px-3 py-1 bg-indigo-500/10 rounded-full text-[9px] font-black text-indigo-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                      Forward
                    </div>
                  </button>
                ))}
                {allGroups.length <= 1 && (
                  <div className="text-center py-8 text-slate-500 text-sm font-medium italic">
                    No other academies available to forward to.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});
