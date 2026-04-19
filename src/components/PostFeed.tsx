import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SkeletonLoader } from './SkeletonLoader';
import { SplitText } from './SplitText';
import { 
  MessageCircle, 
  MessageSquare,
  Handshake, 
  Lightbulb, 
  Share, 
  Image as ImageIcon, 
  Smile, 
  Vote,
  BarChart2,
  Calendar,
  MoreHorizontal,
  MoreVertical,
  Trash2,
  Plus,
  Mic,
  MicOff,
  GraduationCap,
  Square,
  Play,
  Pause,
  X,
  Send,
  CheckCircle2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Users,
  User,
  Link as LinkIcon,
  Layers,
  Eye
} from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';
import { useAuth, UserProfile } from '../FirebaseProvider';
import { useSocket } from '../contexts/SocketContext';
import { 
  db, 
  auth, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  serverTimestamp, 
  increment,
  arrayUnion,
  arrayRemove,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import Cropper, { Area as CropArea } from 'react-easy-crop';

import { NotificationService, NotificationType } from '../services/NotificationService';
import { renderTextWithMentions } from '../lib/mentionUtils';
import { MentionList } from './MentionList';

const PostPresence = ({ postId }: { postId: string }) => {
  const { socket } = useSocket();
  const [viewingCount, setViewingCount] = useState(0);

  useEffect(() => {
    if (!socket) return;

    socket.emit('join:room', `post:${postId}`);

    const handleRoomSync = (data: any) => {
      if (data.roomId === `post:${postId}`) {
        setViewingCount(data.userCount);
      }
    };

    socket.on('room:sync', handleRoomSync);

    return () => {
      socket.emit('leave:room', `post:${postId}`);
      socket.off('room:sync', handleRoomSync);
    };
  }, [socket, postId]);

  if (viewingCount <= 1) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/10 rounded-full border border-indigo-500/20">
      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
      <span className="text-[10px] font-bold text-indigo-400">
        {viewingCount} viewing
      </span>
    </div>
  );
};

const formatTimeAgo = (date: any) => {
  if (!date) return 'now';
  
  let d: Date;
  if (typeof date === 'string') {
    if (date === 'just now' || date === 'now') return 'now';
    d = new Date(date);
    if (isNaN(d.getTime())) return date;
  } else if (date instanceof Date) {
    d = date;
  } else if (date && typeof date === 'object' && 'toDate' in date) {
    // Handle Firestore Timestamp
    d = date.toDate();
  } else if (date && typeof date === 'object' && 'seconds' in date) {
    // Handle Firestore Timestamp-like object
    d = new Date(date.seconds * 1000);
  } else {
    return 'now';
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  
  if (diffInSeconds < 5) return 'now';
  if (diffInSeconds < 60) return `${diffInSeconds}s`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
  
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatFullTimestamp = (date: any) => {
  if (!date) return 'now';
  
  let d: Date;
  if (typeof date === 'string') {
    if (date === 'just now' || date === 'now') return 'now';
    d = new Date(date);
    if (isNaN(d.getTime())) return date;
  } else if (date instanceof Date) {
    d = date;
  } else if (date && typeof date === 'object' && 'toDate' in date) {
    d = date.toDate();
  } else if (date && typeof date === 'object' && 'seconds' in date) {
    d = new Date(date.seconds * 1000);
  } else {
    return 'now';
  }

  return d.toLocaleString(undefined, {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const ZoomableImage = ({ src, alt, onZoomChange }: { src: string, alt: string, onZoomChange?: (zoomed: boolean) => void }) => {
  const [scale, setScale] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Reset zoom when image changes
  useEffect(() => {
    setScale(1);
    setIsZoomed(false);
    onZoomChange?.(false);
  }, [src]);

  const handleDoubleTap = () => {
    const newZoomed = scale <= 1;
    if (!newZoomed) {
      setScale(1);
      setIsZoomed(false);
      onZoomChange?.(false);
    } else {
      setScale(3);
      setIsZoomed(true);
      onZoomChange?.(true);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.01;
      const newScale = Math.min(Math.max(1, scale + delta), 5);
      setScale(newScale);
      const newZoomed = newScale > 1;
      setIsZoomed(newZoomed);
      onZoomChange?.(newZoomed);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-hidden touch-none"
      onWheel={handleWheel}
      onDoubleClick={handleDoubleTap}
    >
      <motion.div
        drag={isZoomed}
        dragConstraints={containerRef}
        dragElastic={0.1}
        animate={{ scale }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative cursor-grab active:cursor-grabbing"
      >
        <img 
          src={src} 
          alt={alt} 
          className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl pointer-events-none select-none"
          referrerPolicy="no-referrer"
        />
      </motion.div>
    </div>
  );
};

export interface Reply {
  id: string;
  author: string;
  avatar?: string;
  authorId?: string;
  content: string;
  timestamp: string | any;
  isAdmin?: boolean;
  replies?: Reply[];
  isOptimistic?: boolean;
}

export interface Poll {
  options: {
    text: string;
    votes: string[]; // Array of user IDs
  }[];
  expiresAt: string; // ISO date string
}

export interface Post {
  id: string;
  author: {
    id?: string;
    name: string;
    handle: string;
    avatar: string;
    isAdmin?: boolean;
  };
  content: string;
  image?: string;
  images?: string[];
  voiceNote?: string;
  poll?: Poll;
  timestamp: string;
  stats: {
    replies: number;
    reposts: number;
    likes: number;
    views: number;
    liveViews?: number;
  };
  isLiked?: boolean;
  isReposted?: boolean;
  replies?: Reply[];
  isOptimistic?: boolean;
}

interface PostFeedProps {
  userRole?: 'guest' | 'member' | 'admin';
  userProfile?: UserProfile | null;
  onViewProfile?: (user: Post['author']) => void;
  handleStartChat?: (user: {id: string, name: string, handle: string, avatar: string}) => void;
  onViewPostDetails?: (post: Post) => void;
  filterHandle?: string;
  singlePostId?: string;
  viewMode?: 'posts' | 'media' | 'replies' | 'inspiration';
  posts?: Post[];
  setPosts?: React.Dispatch<React.SetStateAction<Post[]>>;
  onPostDeleted?: (postId: string) => void;
  allUsers?: {id: string, name: string, handle: string, avatar: string}[];
  enableClickToView?: boolean;
  enableHoldToView?: boolean;
}

const FormattedContent = ({ content, className = "", onMentionClick }: { content: string, className?: string, onMentionClick?: (handle: string) => void }) => {
  if (!content) return null;
  const parts = content.split(/(#\w+)/g);
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('#')) {
          return (
            <span key={index} className="text-indigo-400 font-bold hover:underline cursor-pointer">
              {part}
            </span>
          );
        }
        return renderTextWithMentions(part, onMentionClick, `part-${index}`);
      })}
    </span>
  );
};

interface ReplyItemProps {
  key?: string | number;
  reply: Reply;
  post: Post;
  userRole?: string;
  currentUserId?: string;
  activeReplyMenu: string | null;
  setActiveReplyMenu: (id: string | null) => void;
  deleteReply: (postId: string, replyId: string) => void;
  replyingToReplyId: string | null;
  setReplyingToReplyId: (id: string | null) => void;
  replyContent: string;
  setReplyContent: (content: string) => void;
  handleReply: (postId: string, parentReplyId?: string) => void;
  updateReply: (postId: string, replyId: string, content: string) => void;
  userProfile?: UserProfile | null;
  hideNested?: boolean;
  allUsers?: {id: string, name: string, handle: string, avatar: string}[];
  depth?: number;
}

const ReplyItem = ({ 
  reply, 
  post, 
  userRole, 
  currentUserId,
  activeReplyMenu, 
  setActiveReplyMenu, 
  deleteReply, 
  replyingToReplyId, 
  setReplyingToReplyId, 
  replyContent, 
  setReplyContent, 
  handleReply,
  updateReply,
  userProfile,
  hideNested,
  allUsers = [],
  depth = 0
}: ReplyItemProps) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.content);
  
  // Mention logic for reply
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentions, setShowMentions] = useState(false);

  const handleReplyChange = (val: string) => {
    if (isEditing) {
      setEditContent(val);
    } else {
      setReplyContent(val);
    }
    const lastWord = val.split(' ').pop() || '';
    if (lastWord.startsWith('@')) {
      setMentionSearch(lastWord.substring(1));
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const handleMentionSelect = (user: { handle: string }) => {
    if (isEditing) {
      const words = editContent.split(' ');
      words.pop();
      setEditContent([...words, `@${user.handle} `].join(' '));
    } else {
      const words = replyContent.split(' ');
      words.pop();
      setReplyContent([...words, `@${user.handle} `].join(' '));
    }
    setShowMentions(false);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== reply.content) {
      updateReply(post.id, reply.id, editContent);
    }
    setIsEditing(false);
  };

  return (
    <div className={`space-y-1 group/reply relative ${(reply as any).isOptimistic ? 'opacity-60 pointer-events-none' : ''} ${depth > 0 ? 'bg-white/5 p-2 rounded-xl mt-1.5' : 'py-1'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <div className={`${depth > 0 ? 'w-6 h-6' : 'w-7 h-7'} rounded-full bg-glass flex-shrink-0 overflow-hidden border border-glass-border`}>
            {reply.avatar ? (
              <img src={reply.avatar} alt={reply.author} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-indigo-500/20 text-indigo-400">
                <User size={depth > 0 ? 10 : 12} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-xs md:text-sm text-text-primary lowercase tracking-tight">{reply.author.toLowerCase()}</span>
              {reply.isAdmin && (
                <span className="bg-indigo-500/10 text-indigo-500 text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Admin</span>
              )}
              <span className="text-text-secondary text-[10px] md:text-xs">· {formatTimeAgo(reply.timestamp as any)}</span>
            </div>
            {isEditing ? (
              <div className="space-y-2 py-1 mt-1" onClick={(e) => e.stopPropagation()}>
                <textarea
                  autoFocus
                  value={editContent}
                  onChange={(e) => handleReplyChange(e.target.value)}
                  className="w-full bg-glass border border-glass-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none text-xs md:text-sm resize-none min-h-[80px] text-text-primary transition-all shadow-inner"
                />
                <AnimatePresence>
                  {showMentions && (
                    <MentionList 
                      users={allUsers} 
                      searchQuery={mentionSearch} 
                      onSelect={handleMentionSelect} 
                      onClose={() => setShowMentions(false)} 
                    />
                  )}
                </AnimatePresence>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1 rounded-full text-[10px] font-bold text-text-secondary hover:bg-glass transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={!editContent.trim() || editContent === reply.content}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1 rounded-full text-[10px] font-bold transition-all shadow-sm"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <FormattedContent content={reply.content} className={`${depth > 0 ? 'text-xs' : 'text-sm'} text-text-primary leading-relaxed block mt-0.5`} />
            )}
          </div>
        </div>
        
        <div className="relative flex-shrink-0">
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              setActiveReplyMenu(activeReplyMenu === reply.id ? null : reply.id); 
            }}
            className={`p-1.5 transition-all rounded-lg hover:bg-glass ${activeReplyMenu === reply.id ? 'text-indigo-500 opacity-100' : 'text-text-secondary opacity-0 group-hover/reply:opacity-100'}`}
          >
            <MoreVertical size={14} />
          </button>

          <AnimatePresence>
                          {activeReplyMenu === reply.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-10" 
                                onClick={(e) => { e.stopPropagation(); setActiveReplyMenu(null); }} 
                              />
                                      <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                        className="absolute right-0 mt-1 w-40 glass-card !p-1 z-20 shadow-2xl border border-glass-border"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {reply.author === userProfile?.name && (
                                          <button
                                            onClick={() => {
                                              setIsEditing(true);
                                              setEditContent(reply.content);
                                              setActiveReplyMenu(null);
                                            }}
                                            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-text-primary hover:bg-glass rounded-md transition-colors"
                                          >
                                            <Edit2 size={14} />
                                            <span>Edit Reply</span>
                                          </button>
                                        )}
                                        {(userRole === 'admin' || (userProfile && reply.author === userProfile.name)) && (
                                          <button
                                            onClick={() => {
                                              deleteReply(post.id, reply.id);
                                              setActiveReplyMenu(null);
                                            }}
                                            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                                          >
                                            <Trash2 size={14} />
                                            <span>Delete Reply</span>
                                          </button>
                                        )}
                                        <button
                                          onClick={() => setActiveReplyMenu(null)}
                                          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-text-secondary hover:bg-glass rounded-md transition-colors"
                                        >
                                          <X size={14} />
                                          <span>Cancel</span>
                                        </button>
                                      </motion.div>
                            </>
                          )}
          </AnimatePresence>
        </div>
      </div>
      
      <div className="flex items-center gap-4 pt-1 ml-9">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setReplyingToReplyId(replyingToReplyId === reply.id ? null : reply.id);
            setReplyContent('');
          }}
          className="text-xs font-bold text-text-secondary hover:text-indigo-400 transition-colors flex items-center gap-1"
        >
          <MessageCircle size={12} />
        </button>
      </div>

      <AnimatePresence>
        {replyingToReplyId === reply.id && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden pt-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-glass flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <textarea
                  autoFocus
                  value={replyContent}
                  onChange={(e) => handleReplyChange(e.target.value)}
                  placeholder={`Reply to ${reply.author}`}
                  className="w-full bg-glass border border-glass-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none text-xs resize-none min-h-[60px] placeholder:text-text-secondary transition-all"
                />
                <AnimatePresence>
                  {showMentions && (
                    <MentionList 
                      users={allUsers} 
                      searchQuery={mentionSearch} 
                      onSelect={handleMentionSelect} 
                      onClose={() => setShowMentions(false)} 
                    />
                  )}
                </AnimatePresence>
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex justify-end"
                >
                  <button
                    onMouseDown={() => setIsPressed(true)}
                    onMouseUp={() => setIsPressed(false)}
                    onMouseLeave={() => setIsPressed(false)}
                    onTouchStart={() => setIsPressed(true)}
                    onTouchEnd={() => setIsPressed(false)}
                    onClick={() => handleReply(post.id, reply.id)}
                    disabled={!replyContent.trim()}
                    className={`relative bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1 rounded-full text-[10px] font-bold transition-all duration-150 ease-in-out ${isPressed ? 'transform scale-x-95 scale-y-[0.85]' : 'transform scale-100'}`}
                  >
                    <div className={`absolute inset-0 rounded-full transition-all duration-150 ${isPressed ? 'bg-black/10' : 'bg-white/10'}`} />
                    <span className="relative">Post Reply</span>
                  </button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {reply.replies && reply.replies.length > 0 && !hideNested && (
        <div className={`mt-2 space-y-2 ${depth < 3 ? 'pl-4 border-l border-indigo-500/20' : 'pl-2'}`}>
          {reply.replies.map((nestedReply) => (
            <ReplyItem 
              key={nestedReply.id}
              reply={nestedReply}
              post={post}
              userRole={userRole}
              currentUserId={currentUserId}
              activeReplyMenu={activeReplyMenu}
              setActiveReplyMenu={setActiveReplyMenu}
              deleteReply={deleteReply}
              replyingToReplyId={replyingToReplyId}
              setReplyingToReplyId={setReplyingToReplyId}
              replyContent={replyContent}
              setReplyContent={setReplyContent}
              handleReply={handleReply}
              updateReply={updateReply}
              userProfile={userProfile}
              allUsers={allUsers}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Custom hook for intersection observer
function useIntersectionObserver(options = {}) {
  const elementRef = React.useRef(null);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    if (!elementRef.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        // Once visible, we can stop observing to keep it visible
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.1, ...options });

    observer.observe(elementRef.current);

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current);
      }
    };
  }, [options]);

  return [elementRef, isVisible] as const;
}

function RevealWrapper({ children, className = "" }: { children: React.ReactNode, className?: string, key?: React.Key }) {
  const [ref, isVisible] = useIntersectionObserver();
  
  return (
    <div
      ref={ref}
      className={`
        transform transition-all duration-700 ease-out
        ${isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-10'
        }
        ${className}
      `}
    >
      {children}
    </div>
  );
}

const LikeBurst = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    {[...Array(8)].map((_, i) => (
      <motion.div
        key={i}
        initial={{ scale: 0, opacity: 1 }}
        animate={{ 
          scale: [0, 1, 0.5], 
          opacity: [1, 1, 0],
          x: Math.cos((i * 45 * Math.PI) / 180) * 35,
          y: Math.sin((i * 45 * Math.PI) / 180) * 35
        }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="absolute w-1 h-3 bg-amber-400 rounded-full"
        style={{ rotate: `${i * 45}deg` }}
      />
    ))}
  </div>
);

export const INITIAL_POSTS: Post[] = [];


const PostMedia = ({ images, onImageClick, onHoldImage }: { images: string[], onImageClick?: (index: number) => void, onHoldImage?: (img: string | null) => void }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Record<number, boolean>>({});
  const count = images.length;
  
  if (count === 0) return null;

  const handleImageLoad = (index: number) => {
    setLoadedImages(prev => ({ ...prev, [index]: true }));
  };

  if (count === 1) {
    return (
      <div 
        onMouseDown={() => onHoldImage?.(images[0])}
        onMouseUp={() => onHoldImage?.(null)}
        onMouseLeave={() => onHoldImage?.(null)}
        onTouchStart={() => onHoldImage?.(images[0])}
        onTouchEnd={() => onHoldImage?.(null)}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => { 
          if (onImageClick) {
            e.stopPropagation(); 
            onImageClick(0); 
          }
        }}
        className={`mt-1 overflow-hidden ${onImageClick ? 'cursor-zoom-in' : 'cursor-default'} group relative aspect-[4/5] bg-glass select-none`}
      >
        {!loadedImages[0] && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        )}
        <img 
          src={images[0]} 
          alt="Post" 
          className={`w-full h-full object-cover hover:scale-[1.02] transition-all duration-700 ${loadedImages[0] ? 'opacity-100' : 'opacity-0'}`}
          referrerPolicy="no-referrer"
          onLoad={() => handleImageLoad(0)}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </div>
    );
  }

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 500 : -500,
      opacity: 0,
      scale: 0.9
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 500 : -500,
      opacity: 0,
      scale: 0.9
    })
  };

  const swipeConfidenceThreshold = 1000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  const paginate = (newDirection: number) => {
    const nextIndex = currentIndex + newDirection;
    if (nextIndex >= 0 && nextIndex < count) {
      setDirection(newDirection);
      setCurrentIndex(nextIndex);
    }
  };

  return (
    <div className="mt-2 relative overflow-hidden aspect-[4/5] bg-glass group/carousel shadow-xl">
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
            scale: { duration: 0.2 }
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(e, { offset, velocity }) => {
            const swipe = swipePower(offset.x, velocity.x);

            if (swipe < -swipeConfidenceThreshold && currentIndex < count - 1) {
              paginate(1);
            } else if (swipe > swipeConfidenceThreshold && currentIndex > 0) {
              paginate(-1);
            }
          }}
          onMouseDown={() => onHoldImage?.(images[currentIndex])}
          onMouseUp={() => onHoldImage?.(null)}
          onMouseLeave={() => onHoldImage?.(null)}
          onTouchStart={() => onHoldImage?.(images[currentIndex])}
          onTouchEnd={() => onHoldImage?.(null)}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => { 
            if (onImageClick) {
              e.stopPropagation(); 
              onImageClick(currentIndex); 
            }
          }}
          className={`absolute inset-0 ${onImageClick ? 'cursor-zoom-in' : 'cursor-default'} select-none`}
        >
          <img 
            src={images[currentIndex]} 
            alt={`Post media ${currentIndex + 1}`} 
            className={`w-full h-full object-cover select-none transition-opacity duration-300 ${loadedImages[currentIndex] ? 'opacity-100' : 'opacity-0'}`}
            referrerPolicy="no-referrer"
            onLoad={() => handleImageLoad(currentIndex)}
            loading="lazy"
          />
          {!loadedImages[currentIndex] && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      <div className="absolute inset-0 flex items-center justify-between p-2 opacity-40 md:opacity-0 group-hover/carousel:opacity-100 transition-opacity pointer-events-none z-10">
        <button
          onClick={(e) => { e.stopPropagation(); paginate(-1); }}
          className={`p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all pointer-events-auto backdrop-blur-sm ${currentIndex === 0 ? 'invisible' : 'visible'}`}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); paginate(1); }}
          className={`p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all pointer-events-auto backdrop-blur-sm ${currentIndex === count - 1 ? 'invisible' : 'visible'}`}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Multiple Images Indicator Icon */}
      {count > 1 && (
        <div className="absolute top-3 left-3 p-1.5 rounded-lg bg-black/50 backdrop-blur-sm text-white/80 z-10">
          <Layers size={14} />
        </div>
      )}

      {/* Indicators */}
      {count > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 p-1.5 rounded-full bg-black/20 backdrop-blur-md z-10">
          {images.map((_, idx) => (
            <button
              key={`indicator-${idx}`}
              onClick={(e) => { e.stopPropagation(); setDirection(idx > currentIndex ? 1 : -1); setCurrentIndex(idx); }}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                idx === currentIndex ? 'bg-white w-3' : 'bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      )}

      {/* Counter */}
      {count > 1 && (
        <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-[10px] font-bold text-white z-10">
          {currentIndex + 1} / {count}
        </div>
      )}
    </div>
  );
};

// World-class view counting hook
const useViewTracker = (postId: string, onVisible: (id: string) => void) => {
  const [hasBeenViewed, setHasBeenViewed] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (hasBeenViewed || !elementRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            // Start dwell timer
            if (!timerRef.current) {
              timerRef.current = setTimeout(() => {
                onVisible(postId);
                setHasBeenViewed(true);
                observer.disconnect();
              }, 1000); // 1 second dwell time
            }
          } else {
            // Reset timer if they scroll away too fast
            if (timerRef.current) {
              clearTimeout(timerRef.current);
              timerRef.current = null;
            }
          }
        });
      },
      { threshold: [0, 0.5, 1.0] }
    );

    observer.observe(elementRef.current);

    return () => {
      observer.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [postId, onVisible, hasBeenViewed]);

  return elementRef;
};

// Helper component for view tracking
const PostItemWrapper = ({ postId, onVisible, children }: any) => {
  const viewRef = useViewTracker(postId, onVisible);
  return <div ref={viewRef}>{children}</div>;
};

const VoiceNotePlayer = ({ src }: { src: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Simulated waveform data - generated once per component instance
  const waveformBars = useMemo(() => 
    Array.from({ length: 35 }, () => ({
      height: Math.random() * 60 + 20, // 20% to 80%
      speed: 0.6 + Math.random() * 0.8,
      delay: Math.random() * 0.5
    })), 
  []);

  useEffect(() => {
    // Legacy blob URLs are dead on refresh. Proactively catch them.
    if (src.startsWith('blob:')) {
      setHasError(true);
    }
  }, [src]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current && !hasError) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(err => {
          console.error("Playback failed:", err);
          setHasError(true);
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const dur = audioRef.current.duration;
      if (!isNaN(dur) && dur > 0) {
        setCurrentTime(current);
        setProgress((current / dur) * 100);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setHasError(false);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  const handleError = () => {
    console.error("Audio source error for:", src);
    setHasError(true);
    setIsPlaying(false);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current && duration) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const clickedProgress = x / rect.width;
      audioRef.current.currentTime = clickedProgress * duration;
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-glass border border-glass-border rounded-3xl w-full group/player transition-all hover:bg-slate-900/40" onClick={(e) => e.stopPropagation()}>
      {!hasError && (
        <audio 
          ref={audioRef} 
          src={src} 
          onTimeUpdate={handleTimeUpdate} 
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onError={handleError}
          className="hidden"
        />
      )}
      
      <button 
        onClick={togglePlay}
        disabled={hasError}
        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-all duration-300 flex-shrink-0 shadow-xl ${
          hasError 
            ? 'bg-slate-700 cursor-not-allowed opacity-50' 
            : isPlaying 
              ? 'bg-indigo-600 shadow-indigo-500/40 scale-105 rotate-3' 
              : 'bg-indigo-500 hover:bg-indigo-400 shadow-indigo-500/20 hover:scale-110 hover:-rotate-3'
        }`}
      >
        {hasError ? <MicOff size={20} /> : (isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />)}
      </button>

      <div className="flex-1 space-y-2.5">
        {/* Waveform Visualizer */}
        <div className="flex items-center gap-[3px] h-10 px-1 relative">
          {waveformBars.map((bar, i) => {
            const isPlayed = (i / waveformBars.length) * 100 < progress;
            return (
              <motion.div
                key={i}
                className={`flex-1 rounded-full transition-colors duration-300 ${
                  hasError 
                    ? 'bg-slate-700' 
                    : isPlayed 
                      ? 'bg-indigo-400' 
                      : 'bg-glass'
                }`}
                initial={{ height: `${bar.height}%` }}
                animate={isPlaying ? {
                  height: [`${bar.height}%`, `${Math.min(100, bar.height * 1.5)}%`, `${bar.height * 0.5}%`, `${bar.height}%`],
                } : { height: `${bar.height}%` }}
                transition={isPlaying ? {
                  duration: bar.speed,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: bar.delay
                } : { duration: 0.3 }}
              />
            );
          })}
          
          {/* Invisible Progress Slider Overlay */}
          <div 
            className="absolute inset-0 cursor-pointer z-10"
            onClick={!hasError ? handleProgressClick : undefined}
          />
        </div>

        <div className="flex justify-between items-center text-[10px] font-black text-text-secondary uppercase tracking-widest px-1">
          <div className="flex items-center gap-2">
            <span className={isPlaying ? 'text-indigo-400 animate-pulse' : ''}>
              {hasError ? 'Legacy' : formatTime(currentTime)}
            </span>
            {!hasError && isPlaying && (
              <motion.div 
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-1 h-1 bg-indigo-500 rounded-full"
              />
            )}
          </div>
          <span>{hasError ? 'Audio Expired' : formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

const PostAnalyticsModal = ({ 
  isOpen, 
  onClose, 
  post 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  post: Post | null;
}) => {
  if (!post) return null;

  // Mock data for the chart
  const data = [
    { time: '00:00', views: Math.floor(post.stats.views * 0.1) },
    { time: '04:00', views: Math.floor(post.stats.views * 0.15) },
    { time: '08:00', views: Math.floor(post.stats.views * 0.4) },
    { time: '12:00', views: Math.floor(post.stats.views * 0.7) },
    { time: '16:00', views: Math.floor(post.stats.views * 0.85) },
    { time: '20:00', views: post.stats.views },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl glass-card !p-0 overflow-hidden shadow-2xl border border-subtle"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-subtle flex items-center justify-between bg-glass">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-500">
                  <BarChart2 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight text-text-primary">Post Analytics</h3>
                  <p className="text-text-secondary text-xs font-bold uppercase tracking-widest">Real-time performance</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-glass rounded-full transition-colors text-text-secondary"
              >
                <X size={20} />
              </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-px bg-subtle border-y border-subtle">
              <div className="p-6 bg-bg-primary/50">
                <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1">Total Views</p>
                <p className="text-2xl font-black text-text-primary">{post.stats.views.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-1 text-emerald-500 text-[10px] font-bold">
                  <ChevronRight size={10} className="-rotate-90" />
                  <span>+12% vs last hour</span>
                </div>
              </div>
              <div className="p-6 bg-bg-primary/50">
                <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1">Live Viewers</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-black text-text-primary">{post.stats.liveViews || 0}</p>
                  <motion.div 
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)]" 
                  />
                </div>
                <p className="text-text-secondary text-[10px] font-bold mt-1">Active right now</p>
              </div>
              <div className="p-6 bg-bg-primary/50">
                <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1">Engagement Rate</p>
                <p className="text-2xl font-black text-text-primary">4.2%</p>
                <p className="text-text-secondary text-[10px] font-bold mt-1">High performance</p>
              </div>
            </div>

            {/* Chart */}
            <div className="p-8 h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                    dy={10}
                  />
                  <YAxis 
                    hide 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-primary)', 
                      border: '1px solid var(--glass-border)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                    itemStyle={{ color: '#6366f1' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="views" 
                    stroke="#6366f1" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorViews)" 
                    animationDuration={2000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Footer */}
            <div className="p-4 bg-glass border-t border-subtle text-center">
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em]">Data updates every 3 seconds • Powered by Real-time Engine</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const PollDisplay = ({ poll, postId, onVote, currentUserId }: { poll: Poll, postId: string, onVote: (postId: string, optionIndex: number) => void, currentUserId?: string }) => {
  const totalVotes = poll.options.reduce((acc, opt) => acc + opt.votes.length, 0);
  const hasVoted = poll.options.some(opt => opt.votes.includes(currentUserId || ''));
  const isExpired = new Date(poll.expiresAt) < new Date();

  return (
    <div className="mt-4 space-y-3 px-4" onClick={(e) => e.stopPropagation()}>
      <div className="space-y-2">
        {poll.options.map((option, index) => {
          const percentage = totalVotes === 0 ? 0 : Math.round((option.votes.length / totalVotes) * 100);
          const isSelected = option.votes.includes(currentUserId || '');

          return (
            <button
              key={`${option.text}-${index}`}
              disabled={isExpired}
              onClick={() => onVote(postId, index)}
              className="relative w-full h-10 md:h-12 rounded-xl overflow-hidden border border-subtle group transition-all disabled:cursor-default"
            >
              {/* Progress Bar */}
              {(hasVoted || isExpired) && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  className={`absolute inset-y-0 left-0 ${isSelected ? 'bg-indigo-500/20' : 'bg-glass'}`}
                />
              )}
              
              <div className="absolute inset-0 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${isSelected ? 'text-indigo-500' : 'text-text-primary'}`}>
                    {option.text}
                  </span>
                  {isSelected && <CheckCircle2 size={14} className="text-indigo-500" />}
                </div>
                {(hasVoted || isExpired) && (
                  <span className="text-xs font-black text-text-secondary uppercase tracking-widest">
                    {percentage}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[10px] font-black text-text-secondary uppercase tracking-widest">
        <span>{totalVotes.toLocaleString()} votes</span>
        <span>{isExpired ? 'Final results' : `Ends ${new Date(poll.expiresAt).toLocaleDateString()}`}</span>
      </div>
    </div>
  );
};

export const PostFeed = React.memo(({ 
  userRole, 
  userProfile,
  onViewProfile, 
  handleStartChat,
  onViewPostDetails, 
  filterHandle, 
  singlePostId, 
  viewMode = 'posts',
  posts: externalPosts,
  setPosts: setExternalPosts,
  onPostDeleted,
  allUsers = [],
  enableClickToView = false,
  enableHoldToView = true
}: PostFeedProps) => {
  const { socket } = useSocket();
  const [viewedPostsInSession] = useState(new Set<string>());

  const handlePostView = useCallback(async (postId: string) => {
    // Disabled to prevent hitting Firestore write quota limits
    /*
    if (viewedPostsInSession.has(postId)) return;
    
    viewedPostsInSession.add(postId);
    
    try {
      await updateDoc(doc(db, 'posts', postId), {
        'stats.views': increment(1)
      });
    } catch (error) {
      // Silently fail for views to not disrupt UX, but log correctly
      handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}`);
    }
    */
  }, [viewedPostsInSession]);

  const [postContent, setPostContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isPollActive, setIsPollActive] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollDuration, setPollDuration] = useState(24); // hours
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyingToReplyId, setReplyingToReplyId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [activeReplyMenu, setActiveReplyMenu] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [showShareToast, setShowShareToast] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfettiAnimating, setIsConfettiAnimating] = useState(false);
  const [isReplyPressed, setIsReplyPressed] = useState(false);
  const [isPostPressed, setIsPostPressed] = useState(false);
  const [viewingGallery, setViewingGallery] = useState<{ images: string[], index: number } | null>(null);
  const [heldImage, setHeldImage] = useState<string | null>(null);
  const [galleryDirection, setGalleryDirection] = useState(0);
  const [isGalleryZoomed, setIsGalleryZoomed] = useState(false);

  const swipeConfidenceThreshold = 1000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };
  
  // Cropping states
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  const [viewingAnalyticsPostId, setViewingAnalyticsPostId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [sharingPost, setSharingPost] = useState<Post | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editVoiceNote, setEditVoiceNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'post' | 'reply', postId: string, replyId?: string } | null>(null);
  const [confirmSave, setConfirmSave] = useState<{ postId: string } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState<boolean>(false);
  const [editPoll, setEditPoll] = useState<Poll | null>(null);

  // Mention states
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionType, setMentionType] = useState<'main' | 'reply' | 'edit'>('main');

  const handleInputChange = (val: string, type: 'main' | 'reply' | 'edit' = 'main') => {
    if (type === 'main') setPostContent(val);
    else if (type === 'reply') setReplyContent(val);
    else setEditContent(val);

    const lastWord = val.split(' ').pop() || '';
    if (lastWord.startsWith('@')) {
      setMentionSearch(lastWord.substring(1));
      setShowMentions(true);
      setMentionType(type);
    } else {
      setShowMentions(false);
    }
  };

  const handleMentionSelect = (mentionUser: { handle: string }) => {
    if (mentionType === 'main') {
      const words = postContent.split(' ');
      words.pop();
      setPostContent([...words, `@${mentionUser.handle} `].join(' '));
    } else if (mentionType === 'reply') {
      const words = replyContent.split(' ');
      words.pop();
      setReplyContent([...words, `@${mentionUser.handle} `].join(' '));
    } else {
      const words = editContent.split(' ');
      words.pop();
      setEditContent([...words, `@${mentionUser.handle} `].join(' '));
    }
    setShowMentions(false);
  };

  const handleMentionClick = (handle: string) => {
    const mentionedUser = allUsers.find(u => u.handle === handle || u.handle === `@${handle}`);
    if (mentionedUser && onViewProfile) {
      onViewProfile({
        id: mentionedUser.id,
        name: mentionedUser.name,
        handle: mentionedUser.handle,
        avatar: mentionedUser.avatar
      });
    }
  };

  const formatViews = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const postButtonRef = useRef<HTMLButtonElement>(null);
  
  const { user, loading, updateUserProfile } = useAuth();
  const [internalPosts, setInternalPosts] = useState<Post[]>(INITIAL_POSTS);
  
  // Real-time view analytics simulation - REMOVED for real Firestore
  useEffect(() => {
    if (loading || !user) return;
    
    const path = 'posts';
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate?.() || data.timestamp || null
        };
      }) as any[];
      
      if (setExternalPosts) {
        setExternalPosts(postsData);
      } else {
        setInternalPosts(postsData);
      }
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    
    return () => unsubscribe();
  }, [loading, user?.uid, setExternalPosts]);

  const posts = externalPosts || internalPosts;
  const setPosts = setExternalPosts || setInternalPosts;
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputEditRef = React.useRef<HTMLInputElement>(null);

  const createParticle = (x: number, y: number, color: string) => {
    const particle = document.createElement('div');
    particle.style.position = 'fixed';
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    
    // Confetti shapes: some squares, some rectangles, some circles
    const size = Math.random() * 8 + 6;
    const shapeType = Math.random();
    
    particle.style.width = size + 'px';
    if (shapeType > 0.6) {
      // Circle
      particle.style.height = size + 'px';
      particle.style.borderRadius = '50%';
    } else if (shapeType > 0.3) {
      // Square
      particle.style.height = size + 'px';
      particle.style.borderRadius = '2px';
    } else {
      // Rectangle
      particle.style.height = (size * 0.6) + 'px';
      particle.style.borderRadius = '1px';
    }
    
    particle.style.backgroundColor = color;
    particle.style.transform = `rotate(${Math.random() * 360}deg)`;
    particle.style.pointerEvents = 'none';
    particle.style.zIndex = '9999';
    document.body.appendChild(particle);
    return particle;
  };

  const animateParticle = (particle: HTMLDivElement, angle: number, velocity: number) => {
    let posX = parseFloat(particle.style.left);
    let posY = parseFloat(particle.style.top);
    let velocityX = Math.cos(angle) * velocity;
    let velocityY = Math.sin(angle) * velocity;
    let rotation = Math.random() * 360;
    let rotationSpeed = (Math.random() - 0.5) * 20;
    let opacity = 1;
    let gravity = 0.2;
    let flutter = Math.random() * 0.2;
    let flutterSpeed = Math.random() * 0.1;
    let time = 0;

    const animate = () => {
      time += 0.1;
      velocityY += gravity;
      // Add some air resistance/flutter
      velocityX *= 0.99;
      
      const currentPosX = posX + velocityX + Math.sin(time + posY * 0.1) * (flutter * 10);
      const currentPosY = posY + velocityY;
      
      posX += velocityX;
      posY += velocityY;
      rotation += rotationSpeed;
      opacity -= 0.012;

      particle.style.left = currentPosX + 'px';
      particle.style.top = currentPosY + 'px';
      particle.style.transform = `rotate(${rotation}deg)`;
      particle.style.opacity = opacity.toString();

      if (opacity > 0 && posY < window.innerHeight + 100) {
        requestAnimationFrame(animate);
      } else {
        particle.remove();
      }
    };
    requestAnimationFrame(animate);
  };

  const createConfetti = () => {
    if (!postButtonRef.current || isConfettiAnimating) return;
    setIsConfettiAnimating(true);

    const rect = postButtonRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#8B5CF6', '#F59E0B'];
    
    for (let i = 0; i < 35; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const angle = (Math.PI * 2 * i) / 35 + (Math.random() * 0.5);
      const velocity = 5 + Math.random() * 4;
      const particle = createParticle(centerX, centerY, color);
      animateParticle(particle, angle, velocity);
    }

    setTimeout(() => setIsConfettiAnimating(false), 2000);
  };

  const createFloatingBulb = (x: number, y: number) => {
    const bulb = document.createElement('div');
    bulb.innerHTML = '💡';
    bulb.className = 'absolute pointer-events-none text-xl';
    bulb.style.left = `${x}px`;
    bulb.style.top = `${y}px`;
    bulb.style.zIndex = '9999';
    document.body.appendChild(bulb);
    return bulb;
  };

  const animateFloatingBulb = (bulb: HTMLDivElement) => {
    const startX = parseFloat(bulb.style.left);
    const startY = parseFloat(bulb.style.top);
    const endX = startX + (Math.random() * 100 - 50);
    const endY = startY - 100 - Math.random() * 100;
    const rotation = -30 + Math.random() * 60;
    const duration = 1000 + Math.random() * 500;
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
      const easedProgress = easeOut(progress);
      
      const currentX = startX + (endX - startX) * easedProgress;
      const currentY = startY + (endY - startY) * easedProgress;
      
      const wave = Math.sin(progress * Math.PI * 2) * 10;
      
      bulb.style.left = `${currentX + wave}px`;
      bulb.style.top = `${currentY}px`;
      bulb.style.opacity = (1 - easedProgress).toString();
      bulb.style.transform = `
        scale(${1 - easedProgress * 0.5})
        rotate(${rotation * easedProgress}deg)
      `;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        bulb.remove();
      }
    };
    
    requestAnimationFrame(animate);
  };

  const handleVote = async (postId: string, optionIndex: number) => {
    if (!user) return;
    const post = posts.find(p => p.id === postId);
    if (!post || !post.poll) return;

    // Check if poll is expired
    if (new Date(post.poll.expiresAt) < new Date()) return;

    const votedOptionIndex = post.poll.options.findIndex(opt => opt.votes.includes(user.uid));
    
    // Calculate new options
    const nextOptions = post.poll.options.map((opt, idx) => {
      // Remove user from all options first
      const cleanVotes = opt.votes.filter(id => id !== user.uid);
      
      // If this is the clicked option AND it wasn't the one they already voted for, add them
      // This handles both new votes and switching votes.
      // If they click the SAME option, votedOptionIndex === optionIndex, so we don't add them back (unvote).
      if (idx === optionIndex && votedOptionIndex !== optionIndex) {
        return { ...opt, votes: [...cleanVotes, user.uid] };
      }
      return { ...opt, votes: cleanVotes };
    });

    // Optimistic Update
    const updateLocal = (prevPosts: Post[]) => prevPosts.map(p => {
      if (p.id === postId && p.poll) {
        return {
          ...p,
          poll: { ...p.poll, options: nextOptions }
        };
      }
      return p;
    });

    if (setExternalPosts) setExternalPosts(updateLocal);
    else setInternalPosts(updateLocal);

    try {
      await updateDoc(doc(db, 'posts', postId), {
        'poll.options': nextOptions
      });
    } catch (error) {
      // Revert on error
      const revertLocal = (prevPosts: Post[]) => prevPosts.map(p => {
        if (p.id === postId && p.poll) {
          return {
            ...p,
            poll: { ...p.poll, options: post.poll!.options }
          };
        }
        return p;
      });
      if (setExternalPosts) setExternalPosts(revertLocal);
      else setInternalPosts(revertLocal);
      
      handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}`);
    }
  };

  const handleToggleFollow = async (e: React.MouseEvent, authorId: string | undefined, authorHandle?: string) => {
    e.stopPropagation();
    
    // Resolve the ID if missing but handle is present
    let resolvedAuthorId = authorId;
    if (!resolvedAuthorId && authorHandle) {
      const foundUser = allUsers.find(u => u.handle === authorHandle || u.handle === `@${authorHandle}`);
      if (foundUser) resolvedAuthorId = foundUser.id;
    }

    if (!user || !userProfile || !resolvedAuthorId || resolvedAuthorId === 'unknown' || resolvedAuthorId === user.uid) {
      console.warn("Cannot follow: invalid user mapping", { user: !!user, profile: !!userProfile, resolvedAuthorId });
      return;
    }

    const followedIds = userProfile.followedCreatorIds || [];
    const isFollowing = followedIds.includes(resolvedAuthorId);
    const userRef = doc(db, 'users', user.uid);
    const authorRef = doc(db, 'users', resolvedAuthorId);

    // Optimistic Update for userProfile
    if (updateUserProfile) {
      updateUserProfile({
        followedCreatorIds: isFollowing 
          ? followedIds.filter(id => id !== resolvedAuthorId)
          : [...followedIds, resolvedAuthorId],
        followingCount: (userProfile.followingCount || 0) + (isFollowing ? -1 : 1)
      });
    }

    try {
      if (isFollowing) {
        await updateDoc(userRef, {
          followedCreatorIds: arrayRemove(resolvedAuthorId),
          followingCount: increment(-1)
        });
        
        // Only update author count if it's not self
        if (resolvedAuthorId !== user.uid) {
          try {
            await updateDoc(authorRef, {
              followersCount: increment(-1)
            });
          } catch (err) {
            console.warn("Could not update author followers count (author doc might not exist)", err);
          }
        }
      } else {
        await updateDoc(userRef, {
          followedCreatorIds: arrayUnion(resolvedAuthorId),
          followingCount: increment(1)
        });
        
        // Only update author count if it's not self
        if (resolvedAuthorId !== user.uid) {
          try {
            await updateDoc(authorRef, {
              followersCount: increment(1)
            });
          } catch (err) {
            console.warn("Could not update author followers count (author doc might not exist)", err);
          }
        }

        // Add notification
        try {
          await addDoc(collection(db, `users/${resolvedAuthorId}/notifications`), {
            type: 'follow',
            from: {
              id: user.uid,
              name: userProfile.name,
              handle: userProfile.handle,
              avatar: userProfile.avatar
            },
            read: false,
            createdAt: serverTimestamp()
          });
        } catch (err) {
          console.warn("Could not create follow notification", err);
        }
      }
    } catch (error) {
      // Revert optimistic update
      if (updateUserProfile) {
        updateUserProfile({
          followedCreatorIds: followedIds,
          followingCount: userProfile.followingCount || 0
        });
      }
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleLikeClick = (e: React.MouseEvent, postId: string, isLiked: boolean) => {
    e.stopPropagation();
    toggleLike(postId);

    if (!isLiked) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      for (let i = 0; i < 8; i++) {
        const offsetX = -10 + Math.random() * 20;
        const offsetY = -10 + Math.random() * 20;
        const bulb = createFloatingBulb(centerX + offsetX, centerY + offsetY);
        animateFloatingBulb(bulb);
      }
    }
  };

  useEffect(() => {
    // Check microphone permission status
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
        if (result.state === 'denied') {
          setMicError("Microphone access is blocked. Please enable it in your browser settings or open the app in a new tab.");
        }
        result.onchange = () => {
          if (result.state === 'denied') {
            setMicError("Microphone access is blocked. Please enable it in your browser settings or open the app in a new tab.");
          } else {
            setMicError(null);
          }
        };
      }).catch(err => {
        console.warn("Permissions API not fully supported for microphone check:", err);
      });
    }

    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const startRecording = async () => {
    setMicError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone access is not supported in this browser or environment.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setAudioBlob(base64data);
        };
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes("Permission denied") || errorMessage.includes("NotAllowedError")) {
        setMicError("Microphone permission was denied. Please allow access in your browser settings. If you are in the preview, try opening the app in a new tab.");
      } else if (errorMessage.includes("NotFoundError") || errorMessage.includes("DevicesNotFoundError")) {
        setMicError("No microphone was found. Please connect a microphone and try again.");
      } else {
        setMicError("Could not access microphone. Please ensure your device is connected and try again.");
      }
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  };

  const resizeImage = (base64Str: string, maxWidth = 1000, maxHeight = 1000): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6)); // Compress to 60% quality to stay well under 1MB
      };
    });
  };

  const [croppingIndex, setCroppingIndex] = useState<number | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileList = Array.from(files) as File[];
      fileList.forEach(file => {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result as string;
          const resized = await resizeImage(base64);
          setSelectedImages(prev => [...prev, resized].slice(0, 4));
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const openCropper = (img: string, index: number) => {
    setImageToCrop(img);
    setCroppingIndex(index);
    setIsCropping(true);
  };

  const getCroppedImg = async (imageSrc: string, pixelCrop: CropArea): Promise<string> => {
    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve) => (image.onload = resolve));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2d context');

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const handleCropComplete = useCallback((_area: CropArea, pixels: CropArea) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const saveCroppedImage = async () => {
    if (imageToCrop && croppedAreaPixels) {
      try {
        const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
        const resized = await resizeImage(croppedImage);
        
        if (croppingIndex !== null) {
          setSelectedImages(prev => {
            const next = [...prev];
            next[croppingIndex] = resized;
            return next;
          });
          setCroppingIndex(null);
        } else {
          setSelectedImages(prev => [...prev, resized].slice(0, 4));
        }
        
        setIsCropping(false);
        setImageToCrop(null);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handlePost = async () => {
    if (!postContent.trim() && selectedImages.length === 0 && !audioBlob && !isPollActive) return;
    
    // Validate poll if active
    if (isPollActive) {
      const validOptions = pollOptions.filter(opt => opt.trim() !== '');
      if (validOptions.length < 2) {
        setMicError("Poll must have at least 2 options");
        return;
      }
    }

    createConfetti();
    const path = 'posts';
    
    // Prepare data
    const pollData = isPollActive ? {
      options: pollOptions.filter(opt => opt.trim() !== '').map(opt => ({ text: opt, votes: [] })),
      expiresAt: new Date(Date.now() + pollDuration * 60 * 60 * 1000).toISOString()
    } : null;

    const newPostData: any = {
      author: {
        id: auth.currentUser?.uid || 'anonymous',
        name: userProfile?.name || auth.currentUser?.displayName || 'Alex Rivera',
        handle: userProfile?.handle || auth.currentUser?.email?.split('@')[0] || '@alex_rivera',
        avatar: userProfile?.avatar || auth.currentUser?.photoURL || 'https://i.pravatar.cc/150?u=alex',
        isAdmin: userRole === 'admin'
      },
      content: postContent,
      images: selectedImages.length > 0 ? selectedImages : [],
      voiceNote: audioBlob || null,
      poll: pollData,
      timestamp: new Date(), // Local timestamp for optimistic UI
      stats: {
        replies: 0,
        reposts: 0,
        likes: 0,
        views: 0,
        liveViews: 1
      },
      isOptimistic: true // Flag to identify optimistic posts
    };

    // Optimistic Update
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticPost = { ...newPostData, id: tempId, timestamp: 'just now' };
    
    const updatePosts = (prev: Post[]) => [optimisticPost, ...prev];
    if (setExternalPosts) setExternalPosts(updatePosts);
    else setInternalPosts(updatePosts);

    // Clear inputs immediately
    setPostContent('');
    setSelectedImages([]);
    setAudioBlob(null);
    setIsPollActive(false);
    setPollOptions(['', '']);

    try {
      // Use serverTimestamp for the actual database write
      const dbData = { ...newPostData, timestamp: serverTimestamp() };
      delete dbData.isOptimistic;
      
      await addDoc(collection(db, path), dbData);
    } catch (error) {
      // Revert optimistic update on error
      const revertPosts = (prev: Post[]) => prev.filter(p => p.id !== tempId);
      if (setExternalPosts) setExternalPosts(revertPosts);
      else setInternalPosts(revertPosts);
      
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleUpdatePost = async (postId: string) => {
    const path = `posts/${postId}`;
    const originalPost = posts.find(p => p.id === postId);
    if (!originalPost) return;

    // Validation
    if (!editContent.trim() && editImages.length === 0 && !editVoiceNote && !editPoll) {
      setMicError("Post cannot be empty");
      return;
    }

    if (editPoll) {
      const validOptions = editPoll.options.filter(opt => opt.text.trim() !== '');
      if (validOptions.length < 2) {
        setMicError("Poll must have at least 2 options");
        return;
      }
    }

    // Optimistic Update
    const updateLocal = (prevPosts: Post[]) => prevPosts.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          content: editContent,
          images: editImages.length > 0 ? editImages : [],
          voiceNote: editVoiceNote || null,
          poll: editPoll ? {
            ...editPoll,
            options: editPoll.options.filter(opt => opt.text.trim() !== '').map(opt => ({
              ...opt,
              text: opt.text.trim()
            }))
          } : null
        };
      }
      return p;
    });

    if (setExternalPosts) setExternalPosts(updateLocal);
    else setInternalPosts(updateLocal);

    // Clear editing state
    setEditingPostId(null);
    setConfirmSave(null);

    try {
      const postRef = doc(db, 'posts', postId);
      const updateData: any = {
        content: editContent,
        images: editImages.length > 0 ? editImages : [],
        voiceNote: editVoiceNote || null,
        poll: editPoll ? {
          ...editPoll,
          options: editPoll.options.filter(opt => opt.text.trim() !== '').map(opt => ({
            ...opt,
            text: opt.text.trim()
          }))
        } : null
      };

      await updateDoc(postRef, updateData);
      
      setEditContent('');
      setEditImages([]);
      setEditVoiceNote(null);
      setEditPoll(null);
    } catch (error: any) {
      // Revert on error
      const revertLocal = (prevPosts: Post[]) => prevPosts.map(p => {
        if (p.id === postId) {
          return originalPost;
        }
        return p;
      });
      if (setExternalPosts) setExternalPosts(revertLocal);
      else setInternalPosts(revertLocal);
      
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleEditImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileList = Array.from(files) as File[];
      
      fileList.forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          try {
            const resized = await resizeImage(base64);
            setEditImages(prev => [...prev, resized].slice(0, 4)); // Limit to 4 images
          } catch (err) {
            console.error("Error resizing image:", err);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const startEditRecording = async () => {
    setMicError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone access is not supported in this browser or environment.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setEditVoiceNote(base64data);
        };
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes("Permission denied") || errorMessage.includes("NotAllowedError")) {
        setMicError("Microphone permission was denied. Please allow access in your browser settings. If you are in the preview, try opening the app in a new tab.");
      } else if (errorMessage.includes("NotFoundError") || errorMessage.includes("DevicesNotFoundError")) {
        setMicError("No microphone was found. Please connect a microphone and try again.");
      } else {
        setMicError("Could not access microphone. Please ensure your device is connected and try again.");
      }
      setIsRecording(false);
    }
  };

  const startEditing = (post: Post) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
    setEditImages(post.images || (post.image ? [post.image] : []));
    setEditVoiceNote(post.voiceNote || null);
    setEditPoll(post.poll ? JSON.parse(JSON.stringify(post.poll)) : null);
    setActiveMenu(null);
  };

  const handleReply = async (postId: string, parentReplyId?: string) => {
    if (!replyContent.trim()) return;

    const path = `posts/${postId}`;
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const newReply: Reply = {
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      author: userProfile?.name || user?.displayName || 'Anonymous',
      avatar: userProfile?.avatar || user?.photoURL || '',
      authorId: user?.uid,
      content: replyContent,
      timestamp: new Date().toISOString(),
      isAdmin: userRole === 'admin',
      replies: [],
      isOptimistic: true
    };

    // Optimistic Update
    const updateLocalReplies = (prevPosts: Post[]) => prevPosts.map(p => {
      if (p.id === postId) {
        let updatedReplies = [...(p.replies || [])];
        if (parentReplyId) {
          const addNestedReply = (replies: Reply[]): Reply[] => {
            return replies.map(r => {
              if (r.id === parentReplyId) {
                return { ...r, replies: [...(r.replies || []), newReply] };
              }
              if (r.replies && r.replies.length > 0) {
                return { ...r, replies: addNestedReply(r.replies) };
              }
              return r;
            });
          };
          updatedReplies = addNestedReply(updatedReplies);
        } else {
          updatedReplies.push(newReply);
        }
        return {
          ...p,
          replies: updatedReplies,
          stats: { ...p.stats, replies: p.stats.replies + 1 }
        };
      }
      return p;
    });

    if (setExternalPosts) setExternalPosts(updateLocalReplies);
    else setInternalPosts(updateLocalReplies);

    // Clear inputs immediately
    const savedReplyContent = replyContent;
    setReplyContent('');
    setReplyingTo(null);
    setReplyingToReplyId(null);

    try {
      const postRef = doc(db, 'posts', postId);
      
      // We need the latest server state for the actual update to avoid overwriting other replies
      // but for simplicity in this demo, we use the local state minus optimistic flags
      const cleanReplies = (replies: Reply[]): Reply[] => {
        return replies.filter(r => !r.isOptimistic).map(r => ({
          ...r,
          replies: r.replies ? cleanReplies(r.replies) : []
        }));
      };

      const dbReply = { ...newReply };
      delete dbReply.isOptimistic;

      let dbReplies = cleanReplies(post.replies || []);
      if (parentReplyId) {
        const addNestedReply = (replies: Reply[]): Reply[] => {
          return replies.map(r => {
            if (r.id === parentReplyId) {
              return { ...r, replies: [...(r.replies || []), dbReply] };
            }
            if (r.replies && r.replies.length > 0) {
              return { ...r, replies: addNestedReply(r.replies) };
            }
            return r;
          });
        };
        dbReplies = addNestedReply(dbReplies);
      } else {
        dbReplies.push(dbReply);
      }

      await updateDoc(postRef, {
        replies: dbReplies,
        'stats.replies': increment(1)
      });

      // Trigger Notification
      if (post.author.id !== user?.uid) {
        const notification = {
          type: 'reply' as NotificationType,
          from: {
            id: user?.uid || '',
            name: userProfile?.name || user?.displayName || 'Someone',
            avatar: userProfile?.avatar || user?.photoURL || ''
          },
          postId: postId,
          content: savedReplyContent
        };
        NotificationService.createNotification(post.author.id, notification);

        if (socket) {
          socket.emit('notification:send', {
            targetUserId: post.author.id,
            notification
          });
        }
      }
    } catch (error) {
      // Revert optimistic update
      const revertLocalReplies = (prevPosts: Post[]) => prevPosts.map(p => {
        if (p.id === postId) {
          const removeOptimistic = (replies: Reply[]): Reply[] => {
            return replies.filter(r => r.id !== newReply.id).map(r => ({
              ...r,
              replies: r.replies ? removeOptimistic(r.replies) : []
            }));
          };
          return {
            ...p,
            replies: removeOptimistic(p.replies || []),
            stats: { ...p.stats, replies: p.stats.replies - 1 }
          };
        }
        return p;
      });
      
      if (setExternalPosts) setExternalPosts(revertLocalReplies);
      else setInternalPosts(revertLocalReplies);
      
      setReplyContent(savedReplyContent);
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const toggleLike = async (postId: string) => {
    const path = `posts/${postId}`;
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const isLiked = !post.isLiked;
    
    // Optimistic Update
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          isLiked,
          stats: {
            ...p.stats,
            likes: p.stats.likes + (isLiked ? 1 : -1)
          }
        };
      }
      return p;
    }));

    try {
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        'stats.likes': increment(isLiked ? 1 : -1),
        isLiked: isLiked
      });

      // Trigger Notification
      if (isLiked && post.author.id !== user?.uid) {
        const notification = {
          type: 'like' as NotificationType,
          from: {
            id: user?.uid || '',
            name: userProfile?.name || user?.displayName || 'Someone',
            avatar: userProfile?.avatar || user?.photoURL || ''
          },
          postId: postId
        };
        NotificationService.createNotification(post.author.id, notification);

        if (socket) {
          socket.emit('notification:send', {
            targetUserId: post.author.id,
            notification
          });
        }
      }
    } catch (error: any) {
      // Revert on error
      if (!error.message?.includes('No document to update')) {
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              isLiked: !isLiked,
              stats: {
                ...p.stats,
                likes: p.stats.likes + (isLiked ? -1 : 1)
              }
            };
          }
          return p;
        }));
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
  };

  const toggleRepost = async (postId: string) => {
    const path = `posts/${postId}`;
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const isReposted = !post.isReposted;
    
    // Optimistic Update
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          isReposted,
          stats: {
            ...p.stats,
            reposts: p.stats.reposts + (isReposted ? 1 : -1)
          }
        };
      }
      return p;
    }));

    try {
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        'stats.reposts': increment(isReposted ? 1 : -1),
        isReposted: isReposted
      });

      // Trigger Notification
      if (isReposted && post.author.id !== user?.uid) {
        NotificationService.createNotification(post.author.id, {
          type: 'repost',
          from: {
            id: user?.uid || '',
            name: userProfile?.name || user?.displayName || 'Someone',
            avatar: userProfile?.avatar || user?.photoURL || ''
          },
          postId: postId
        });
      }
    } catch (error: any) {
      // Revert on error
      if (!error.message?.includes('No document to update')) {
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              isReposted: !isReposted,
              stats: {
                ...p.stats,
                reposts: p.stats.reposts + (isReposted ? -1 : 1)
              }
            };
          }
          return p;
        }));
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
  };

  const deletePost = async (postId: string) => {
    const path = `posts/${postId}`;
    const postToDelete = posts.find(p => p.id === postId);
    if (!postToDelete) return;

    // Optimistic Update
    const updatePosts = (prev: Post[]) => prev.filter(p => p.id !== postId);
    if (setExternalPosts) setExternalPosts(updatePosts);
    else setInternalPosts(updatePosts);

    try {
      await deleteDoc(doc(db, 'posts', postId));
      setActiveMenu(null);
      if (onPostDeleted) {
        onPostDeleted(postId);
      }
    } catch (error) {
      // Revert on error
      const revertPosts = (prev: Post[]) => [postToDelete, ...prev].sort((a, b) => {
        // Simple sort by ID or timestamp if available to restore order
        return 0; 
      });
      if (setExternalPosts) setExternalPosts(revertPosts);
      else setInternalPosts(revertPosts);
      
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const deleteReply = async (postId: string, replyId: string) => {
    const path = `posts/${postId}`;
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    // Optimistic Update
    const removeNestedReply = (replies: Reply[]): Reply[] => {
      return replies.filter(r => r.id !== replyId).map(r => ({
        ...r,
        replies: r.replies ? removeNestedReply(r.replies) : []
      }));
    };

    const originalReplies = [...(post.replies || [])];
    const updatedReplies = removeNestedReply(originalReplies);
    const deletedCount = originalReplies.length - updatedReplies.length;

    const updateLocal = (prevPosts: Post[]) => prevPosts.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          replies: updatedReplies,
          stats: { ...p.stats, replies: Math.max(0, p.stats.replies - (deletedCount || 1)) }
        };
      }
      return p;
    });

    if (setExternalPosts) setExternalPosts(updateLocal);
    else setInternalPosts(updateLocal);

    try {
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        replies: updatedReplies,
        'stats.replies': increment(-(deletedCount || 1))
      });
    } catch (error) {
      // Revert on error
      const revertLocal = (prevPosts: Post[]) => prevPosts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            replies: originalReplies,
            stats: { ...p.stats, replies: p.stats.replies + (deletedCount || 1) }
          };
        }
        return p;
      });
      if (setExternalPosts) setExternalPosts(revertLocal);
      else setInternalPosts(revertLocal);
      
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const updateReply = async (postId: string, replyId: string, newContent: string) => {
    const path = `posts/${postId}`;
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const updateNestedReply = (replies: Reply[]): Reply[] => {
      return replies.map(r => {
        if (r.id === replyId) {
          return { ...r, content: newContent };
        }
        return {
          ...r,
          replies: r.replies ? updateNestedReply(r.replies) : []
        };
      });
    };

    const originalReplies = [...(post.replies || [])];
    const updatedReplies = updateNestedReply(originalReplies);

    const updateLocal = (prevPosts: Post[]) => prevPosts.map(p => {
      if (p.id === postId) {
        return { ...p, replies: updatedReplies };
      }
      return p;
    });

    if (setExternalPosts) setExternalPosts(updateLocal);
    else setInternalPosts(updateLocal);

    try {
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        replies: updatedReplies
      });
    } catch (error) {
      // Revert on error
      const revertLocal = (prevPosts: Post[]) => prevPosts.map(p => {
        if (p.id === postId) {
          return { ...p, replies: originalReplies };
        }
        return p;
      });
      if (setExternalPosts) setExternalPosts(revertLocal);
      else setInternalPosts(revertLocal);
      
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'post') {
      deletePost(confirmDelete.postId);
    } else if (confirmDelete.type === 'reply' && confirmDelete.replyId) {
      deleteReply(confirmDelete.postId, confirmDelete.replyId);
    }
    setConfirmDelete(null);
  };

  const handleShare = (post: Post) => {
    setSharingPost(post);
  };

  const shareToSocial = (platform: string, post: Post) => {
    const shareUrl = `${window.location.origin}/post/${post.id}`;
    const shareText = `Check out this post on Mark 1: "${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : ''}"`;
    
    let url = '';
    switch (platform) {
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case 'whatsapp':
        url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
        break;
      case 'email':
        url = `mailto:?subject=${encodeURIComponent('Check out this post on Mark 1')}&body=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`;
        break;
      case 'sms':
        url = `sms:?body=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
        break;
    }

    if (url) {
      window.open(url, '_blank');
      setSharingPost(null);
    }
  };

  const copyToClipboard = (postId: string) => {
    const shareUrl = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShowShareToast(postId);
      setTimeout(() => setShowShareToast(null), 2000);
      setSharingPost(null);
    });
  };

  const filteredPosts = posts.filter(post => {
    if (singlePostId) return post.id === singlePostId;
    
    const matchesHandle = filterHandle ? post.author.handle === filterHandle : true;
    if (!matchesHandle) return false;

    if (viewMode === 'media') return !!post.image || (post.images && post.images.length > 0);
    if (viewMode === 'inspiration') return !!post.isLiked;
    // For 'replies', we could filter for posts that are replies, but our data structure doesn't easily support that yet.
    // For now, we'll just show all posts for 'posts' and 'replies'.
    return true;
  });

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto">
      {/* Create Post */}
      {!filterHandle && !singlePostId && (
        <div className="mx-4 glass-card border border-white/5 !p-6 space-y-6 overflow-hidden backdrop-blur-3xl shadow-3xl">
          <div className="flex gap-4 md:gap-6 min-w-0">
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <img 
                  src={userProfile?.avatar || auth.currentUser?.photoURL || "https://i.pravatar.cc/150?u=alex"} 
                  alt="My Avatar" 
                  className="w-12 h-12 md:w-14 md:h-14 rounded-[1.5rem] border-2 border-slate-950 shadow-2xl relative z-10"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 animate-pulse" />
              </div>
            </div>
            <div className="flex-1 space-y-4 min-w-0">
              <textarea
                value={postContent}
                onChange={(e) => handleInputChange(e.target.value, 'main')}
                placeholder="Share your resonance..."
                className="w-full bg-transparent border-none focus:ring-0 text-lg md:text-xl resize-none min-h-[100px] placeholder:text-slate-600 text-left text-text-primary font-sans italic tracking-tight"
              />
              <AnimatePresence>
                {showMentions && mentionType === 'main' && (
                  <MentionList 
                    users={allUsers} 
                    searchQuery={mentionSearch} 
                    onSelect={handleMentionSelect} 
                    onClose={() => setShowMentions(false)} 
                  />
                )}
              </AnimatePresence>

            {/* Media Previews */}
            <AnimatePresence>
              {selectedImages.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide w-full max-w-full"
                >
                  {selectedImages.map((img, index) => (
                    <div key={`${img}-${index}`} className="relative flex-shrink-0 w-32 md:w-40 aspect-square rounded-xl overflow-hidden border border-subtle group/preview">
                      <img src={img} alt={`Selected ${index}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      
                      {/* Crop Button - Visible on Hover (Desktop) */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openCropper(img, index);
                          }}
                          className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-all backdrop-blur-md pointer-events-auto"
                          title="Crop Image"
                        >
                          <Layers size={16} />
                        </button>
                      </div>

                      {/* Remove Button - Always Visible for Mobile/Desktop */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedImages(prev => prev.filter((_, i) => i !== index));
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white border border-white/20 transition-all backdrop-blur-sm z-10"
                        title="Remove Image"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}

              {audioBlob && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex items-center gap-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl"
                >
                  <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                    <Mic size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Voice Note</p>
                    <audio src={audioBlob} controls className="h-8 w-full mt-1" />
                  </div>
                  <button 
                    onClick={() => setAudioBlob(null)}
                    className="p-1.5 hover:bg-glass rounded-full text-text-secondary transition-colors"
                  >
                    <X size={16} />
                  </button>
                </motion.div>
              )}

              {isRecording && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl"
                >
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-bold text-red-500">Recording...</span>
                  <button 
                    onClick={stopRecording}
                    className="ml-auto px-4 py-1 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs font-bold transition-colors"
                  >
                    Stop
                  </button>
                </motion.div>
              )}

              {micError && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl"
                >
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 flex-shrink-0">
                    <X size={16} />
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <p className="text-xs font-medium text-red-500">{micError}</p>
                    {micError.includes("new tab") && (
                      <button 
                        onClick={() => window.open(window.location.href, '_blank')}
                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors text-left uppercase tracking-wider"
                      >
                        Open in New Tab ↗
                      </button>
                    )}
                  </div>
                  <button 
                    onClick={() => setMicError(null)}
                    className="p-1.5 hover:bg-glass rounded-full text-text-secondary transition-colors"
                  >
                    <X size={16} />
                  </button>
                </motion.div>
              )}

              {isPollActive && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="p-4 bg-glass border border-subtle rounded-2xl space-y-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest">Poll Options</h4>
                    <button 
                      onClick={() => setIsPollActive(false)}
                      className="p-1 hover:bg-glass rounded-full text-text-secondary"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {pollOptions.map((option, index) => (
                      <div key={`poll-opt-${index}`} className="flex gap-2">
                        <input 
                          type="text"
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...pollOptions];
                            newOptions[index] = e.target.value;
                            setPollOptions(newOptions);
                          }}
                          placeholder={`Option ${index + 1}`}
                          className="flex-1 bg-bg-primary border border-subtle rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none transition-all text-text-primary placeholder:text-text-secondary"
                        />
                        {pollOptions.length > 2 && (
                          <button 
                            onClick={() => setPollOptions(prev => prev.filter((_, i) => i !== index))}
                            className="p-2 text-text-secondary hover:text-red-500"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    {pollOptions.length < 4 && (
                      <button 
                        onClick={() => setPollOptions(prev => [...prev, ''])}
                        className="w-full py-2 border border-dashed border-subtle rounded-xl text-xs font-bold text-text-secondary hover:border-indigo-500/50 hover:text-indigo-500 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus size={14} />
                        Add Option
                      </button>
                    )}
                  </div>

                  <div className="pt-2 border-t border-subtle">
                    <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest block mb-2">Poll Duration</label>
                    <select 
                      value={pollDuration}
                      onChange={(e) => setPollDuration(parseInt(e.target.value))}
                      className="w-full bg-bg-primary border border-subtle rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer text-text-primary"
                    >
                      <option value={1} className="bg-bg-primary">1 Hour</option>
                      <option value={6} className="bg-bg-primary">6 Hours</option>
                      <option value={24} className="bg-bg-primary">24 Hours</option>
                      <option value={72} className="bg-bg-primary">3 Days</option>
                      <option value={168} className="bg-bg-primary">7 Days</option>
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between pt-2 border-t border-subtle">
              <div className="flex items-center gap-1 text-indigo-500">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                />
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 hover:bg-glass rounded-full transition-colors"
                >
                  <ImageIcon size={18} />
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`p-2 rounded-full transition-colors ${isRecording ? 'text-red-500 bg-red-500/10' : 'hover:bg-glass'}`}
                >
                  {isRecording ? <Square size={18} /> : <Mic size={18} />}
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsPollActive(!isPollActive)}
                  className={`p-2 rounded-full transition-colors ${isPollActive ? 'text-indigo-500 bg-indigo-500/10' : 'hover:bg-glass'}`}
                >
                  <motion.div
                    animate={isPollActive ? { rotate: [0, -10, 10, 0] } : {}}
                    transition={{ duration: 0.5 }}
                  >
                    <Vote size={18} />
                  </motion.div>
                </motion.button>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                ref={postButtonRef}
                onClick={handlePost}
                disabled={(!postContent.trim() && selectedImages.length === 0 && !audioBlob) || isConfettiAnimating}
                className={`relative bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white px-4 md:px-6 py-1.5 md:py-2 rounded-full font-bold transition-all duration-150 ease-in-out text-sm md:text-base min-w-[80px] flex items-center justify-center`}
              >
                <div className={`absolute inset-0 rounded-full transition-all duration-150 bg-white/10`} />
                <span className="relative">{isConfettiAnimating ? '🎉' : 'Post'}</span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    )}

      {/* Image Lightbox */}
      {/* Analytics Modal */}
      <PostAnalyticsModal 
        isOpen={!!viewingAnalyticsPostId}
        onClose={() => setViewingAnalyticsPostId(null)}
        post={posts.find(p => p.id === viewingAnalyticsPostId) || null}
      />

      <AnimatePresence>
        {viewingGallery && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center transition-colors"
          >
            {/* Header / Actions */}
            <div className="absolute top-0 inset-x-0 p-6 flex items-center justify-between z-10 bg-gradient-to-b from-black/60 to-transparent">
              <div className="text-white font-bold text-sm">
                {viewingGallery.index + 1} / {viewingGallery.images.length}
              </div>
              <button
                className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all shadow-xl"
                onClick={() => setViewingGallery(null)}
              >
                <X size={24} />
              </button>
            </div>

            {/* Gallery Image with Swipe logic repeated for simple gallery */}
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
               <AnimatePresence initial={false} custom={galleryDirection}>
                <motion.div
                  key={viewingGallery.index}
                  custom={galleryDirection}
                  variants={{
                    enter: (dir: number) => ({ x: dir > 0 ? 1000 : -1000, opacity: 0, scale: 0.8 }),
                    center: { zIndex: 1, x: 0, opacity: 1, scale: 1 },
                    exit: (dir: number) => ({ zIndex: 0, x: dir < 0 ? 1000 : -1000, opacity: 0, scale: 0.8 })
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  onAnimationStart={() => setIsGalleryZoomed(false)}
                  transition={{
                    x: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 },
                    scale: { duration: 0.3 }
                  }}
                  drag={!isGalleryZoomed ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={1}
                  onDragEnd={(e, { offset, velocity }) => {
                    if (isGalleryZoomed) return;
                    const swipe = swipePower(offset.x, velocity.x);
                    if (swipe < -swipeConfidenceThreshold && viewingGallery.index < viewingGallery.images.length - 1) {
                      setGalleryDirection(1);
                      setViewingGallery(prev => prev ? { ...prev, index: prev.index + 1 } : null);
                    } else if (swipe > swipeConfidenceThreshold && viewingGallery.index > 0) {
                      setGalleryDirection(-1);
                      setViewingGallery(prev => prev ? { ...prev, index: prev.index - 1 } : null);
                    }
                  }}
                  className="absolute inset-0 flex items-center justify-center p-4 md:p-10 select-none"
                >
                  <ZoomableImage 
                    src={viewingGallery.images[viewingGallery.index]} 
                    alt="Full view" 
                    onZoomChange={setIsGalleryZoomed}
                  />
                </motion.div>
               </AnimatePresence>

               {/* Fullscreen Navigation Arrows */}
               {viewingGallery.images.length > 1 && (
                 <>
                   <button
                     onClick={() => {
                       if (viewingGallery.index > 0) {
                         setGalleryDirection(-1);
                         setViewingGallery(prev => prev ? { ...prev, index: prev.index - 1 } : null);
                       }
                     }}
                     className={`absolute left-6 p-4 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all z-20 backdrop-blur-md ${viewingGallery.index === 0 || isGalleryZoomed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                   >
                     <ChevronLeft size={32} />
                   </button>
                   <button
                     onClick={() => {
                       if (viewingGallery.index < viewingGallery.images.length - 1) {
                         setGalleryDirection(1);
                         setViewingGallery(prev => prev ? { ...prev, index: prev.index + 1 } : null);
                       }
                     }}
                     className={`absolute right-6 p-4 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all z-20 backdrop-blur-md ${viewingGallery.index === viewingGallery.images.length - 1 || isGalleryZoomed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                   >
                     <ChevronRight size={32} />
                   </button>
                 </>
               )}
            </div>
            
            {/* Indicators for Fullscreen */}
            {viewingGallery.images.length > 1 && (
              <div className="absolute bottom-8 flex gap-2 z-10">
                {viewingGallery.images.map((_, idx) => (
                  <button
                    key={`gal-ind-${idx}`}
                    onClick={() => {
                      setGalleryDirection(idx > (viewingGallery?.index || 0) ? 1 : -1);
                      setViewingGallery(prev => prev ? { ...prev, index: idx } : null);
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === viewingGallery.index ? 'bg-indigo-500 w-6' : 'bg-white/30 hover:bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hold to View Peek */}
      <AnimatePresence>
        {heldImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative flex flex-col items-center gap-4"
            >
              <img 
                src={heldImage} 
                alt="Peek" 
                className="max-w-[90vw] max-h-[70vh] object-contain rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-glass-border"
                referrerPolicy="no-referrer"
              />
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="px-6 py-2 bg-glass backdrop-blur-xl border border-glass-border rounded-full text-text-primary text-xs font-black uppercase tracking-[0.2em]"
              >
                Release to close
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feed */}
    {isLoading ? (
      <div className="space-y-4">
        <SkeletonLoader count={3} />
      </div>
    ) : viewMode === 'media' ? (
      <div className="grid grid-cols-3 gap-1 p-1">
        {filteredPosts.flatMap((post, pIdx) => 
          (post.images || (post.image ? [post.image] : [])).map((img, idx) => (
            <RevealWrapper key={`${post.id}-${pIdx}-${idx}`}>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ 
                  opacity: 1,
                  scale: heldImage === img ? 0.95 : 1,
                }}
                whileHover={{ scale: 1.02 }}
                onMouseDown={() => enableHoldToView && setHeldImage(img)}
                onMouseUp={() => setHeldImage(null)}
                onMouseLeave={() => setHeldImage(null)}
                onTouchStart={() => enableHoldToView && setHeldImage(img)}
                onTouchEnd={() => setHeldImage(null)}
                onContextMenu={(e) => enableHoldToView && e.preventDefault()}
                onClick={(e) => {
                  if (!heldImage) {
                    const postImages = (post.images && post.images.length > 0) ? post.images : (post.image ? [post.image] : []);
                    setViewingGallery({ images: postImages, index: idx });
                  }
                }}
                className="aspect-square relative group cursor-pointer overflow-hidden rounded-lg transition-all duration-300 select-none"
              >
                <img 
                  src={img} 
                  alt="" 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="flex items-center gap-4 text-white font-bold text-sm">
                    <div className="flex items-center gap-1">
                      <Lightbulb size={16} /> {post.stats.likes}
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle size={16} /> {post.stats.replies}
                    </div>
                  </div>
                </div>
              </motion.div>
            </RevealWrapper>
          ))
        )}
        {filteredPosts.length === 0 && (
          <div className="col-span-3 py-20 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-glass flex items-center justify-center mx-auto text-text-secondary">
              <ImageIcon size={32} />
            </div>
            <div className="space-y-1">
              <SplitText text="No media yet" className="text-xl font-bold text-text-primary" />
              <p className="text-text-secondary text-sm">When they post photos or videos, they'll show up here.</p>
            </div>
          </div>
        )}
      </div>
    ) : (
      <div className="divide-y divide-subtle border-t border-subtle">
        <AnimatePresence initial={false}>
          {filteredPosts.map((post, idx) => {
            const hasMedia = (post.images && post.images.length > 0) || !!post.image || !!post.voiceNote || !!post.poll;
            
            return (
              <PostItemWrapper key={`${post.id}-${idx}`} postId={post.id} onVisible={handlePostView}>
                <RevealWrapper>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: (post as any).isOptimistic ? 0.6 : 1 }}
                    onClick={() => !singlePostId && onViewPostDetails?.(post)}
                    className={`mx-0 mb-px transition-all duration-500 group ${!singlePostId ? 'cursor-pointer hover:bg-white/5 bg-slate-950/10 glass-card !p-0' : 'bg-slate-950/40 backdrop-blur-3xl border-b border-white/5'} ${(post as any).isOptimistic ? 'pointer-events-none' : ''}`}
                  >
                <div className={`space-y-2 ${singlePostId ? 'py-1' : 'py-5'}`}>
                  {/* Header */}
                  <div className={`flex items-center justify-between ${singlePostId ? 'px-3 mt-0 mb-3' : 'px-4 mt-2'}`}>
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <motion.img 
                        whileHover={{ scale: 1.05 }}
                        src={post.author.avatar} 
                        alt={post.author.name} 
                        className={`${singlePostId ? 'w-12 h-12' : 'w-10 h-10'} rounded-full border border-white/10 flex-shrink-0 hover:opacity-80 transition-all shadow-xl`}
                        referrerPolicy="no-referrer"
                        onClick={(e) => { e.stopPropagation(); onViewProfile?.(post.author); }}
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        {singlePostId ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 flex-row flex-wrap">
                              <span 
                                className="text-xl font-black hover:underline cursor-pointer text-text-primary tracking-tighter min-w-0"
                                onClick={(e) => { e.stopPropagation(); onViewProfile?.(post.author); }}
                              >
                                {post.author.name.toLowerCase()}
                              </span>
                              {post.author.isAdmin && (
                                <CheckCircle2 size={18} className="text-indigo-500 fill-indigo-500/10 flex-shrink-0" />
                              )}
                              {post.author.id !== user?.uid && (
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className="text-text-secondary opacity-30 font-bold">·</span>
                                  <button 
                                    onClick={(e) => handleToggleFollow(e, post.author.id, post.author.handle)}
                                    className={`text-[15px] font-bold transition-all hover:opacity-70 ${
                                      userProfile?.followedCreatorIds?.includes(post.author.id || '')
                                        ? 'text-text-secondary' 
                                        : 'text-indigo-500'
                                    }`}
                                  >
                                    {userProfile?.followedCreatorIds?.includes(post.author.id || '') ? 'Following' : 'Follow'}
                                  </button>
                                </div>
                              )}
                            </div>
                            <span className="text-indigo-400/70 text-[14px] font-bold truncate lowercase">
                              {post.author.handle}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0 flex-row flex-wrap">
                              <span 
                                className="text-[18px] font-black hover:underline cursor-pointer text-text-primary tracking-tight min-w-0"
                                onClick={(e) => { e.stopPropagation(); onViewProfile?.(post.author); }}
                              >
                                {post.author.name.toLowerCase()}
                              </span>
                              {post.author.isAdmin && (
                                <CheckCircle2 size={16} className="text-indigo-500 fill-indigo-500/10 flex-shrink-0" />
                              )}
                              {post.author.id !== user?.uid && (
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className="text-text-secondary opacity-30 font-bold">·</span>
                                  <button 
                                    onClick={(e) => handleToggleFollow(e, post.author.id, post.author.handle)}
                                    className={`text-[14px] font-bold transition-all hover:opacity-70 ${
                                      userProfile?.followedCreatorIds?.includes(post.author.id || '')
                                        ? 'text-text-secondary' 
                                        : 'text-indigo-500'
                                    }`}
                                  >
                                    {userProfile?.followedCreatorIds?.includes(post.author.id || '') ? 'Following' : 'Follow'}
                                  </button>
                                </div>
                              )}
                              <PostPresence postId={post.id} />
                            </div>
                            <div className="flex items-center gap-1.5 text-text-secondary text-[11px] font-bold min-w-0 tracking-wider opacity-70">
                              <span className="truncate text-indigo-400/80 lowercase">{post.author.handle}</span>
                              <span className="text-text-secondary/30">·</span>
                              <span className="whitespace-nowrap">
                                {formatTimeAgo(post.timestamp as any)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 ml-2">
                      <div className="relative">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setActiveMenu(activeMenu === post.id ? null : post.id); 
                          }}
                          className={`p-2 transition-colors rounded-full hover:bg-slate-900/50 hover:text-indigo-400 ${activeMenu === post.id ? 'text-indigo-400 bg-slate-900/50' : 'text-text-secondary'}`}
                        >
                          <MoreVertical size={18} />
                        </button>

                        <AnimatePresence>
                          {activeMenu === post.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-10" 
                                onClick={(e) => { e.stopPropagation(); setActiveMenu(null); }} 
                              />
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                className="absolute right-0 mt-2 w-48 glass-card !p-1 z-20 shadow-2xl border border-subtle"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {(post.author.id === user?.uid || (userProfile && post.author.handle === userProfile.handle) || userRole === 'admin') && (
                                  <>
                                    <button
                                      onClick={() => startEditing(post)}
                                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-secondary hover:bg-glass rounded-lg transition-colors"
                                    >
                                      <Edit2 size={16} />
                                      <span>Edit Post</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setConfirmDelete({ type: 'post', postId: post.id });
                                        setActiveMenu(null);
                                      }}
                                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                      <Trash2 size={16} />
                                      <span>Delete Post</span>
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => setActiveMenu(null)}
                                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-secondary hover:bg-glass rounded-lg transition-colors"
                                >
                                  <X size={16} />
                                  <span>Cancel</span>
                                </button>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  {editingPostId === post.id ? (
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className="mx-4 space-y-4 bg-glass p-4 rounded-2xl border border-subtle"
                    >
                      <textarea
                        autoFocus
                        value={editContent}
                        onChange={(e) => handleInputChange(e.target.value, 'edit')}
                        className="w-full bg-transparent border-none focus:ring-0 text-text-primary resize-none min-h-[100px] text-sm md:text-base"
                        placeholder="Edit your post..."
                      />
                      <AnimatePresence>
                        {showMentions && mentionType === 'edit' && (
                          <MentionList 
                            users={allUsers} 
                            searchQuery={mentionSearch} 
                            onSelect={handleMentionSelect} 
                            onClose={() => setShowMentions(false)} 
                          />
                        )}
                      </AnimatePresence>
                      
                      {/* Edit Images Preview */}
                      <AnimatePresence>
                        {editImages.length > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex flex-wrap gap-2"
                          >
                            {editImages.map((img, idx) => (
                              <div key={`${img}-${idx}`} className="relative w-20 h-20 rounded-xl overflow-hidden group">
                                <img src={img} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                <button 
                                  onClick={() => setEditImages(prev => prev.filter((_, i) => i !== idx))}
                                  className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Edit Voice Note Preview */}
                      <AnimatePresence>
                        {editVoiceNote && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="relative group mb-4"
                          >
                            <VoiceNotePlayer src={editVoiceNote} />
                            <button 
                              onClick={() => setEditVoiceNote(null)}
                              className="absolute -top-2 -right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors z-10"
                            >
                              <X size={12} />
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Edit Poll Preview */}
                      <AnimatePresence>
                        {editPoll && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="p-4 bg-bg-primary/50 border border-subtle rounded-2xl space-y-3 mb-4"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest">Edit Poll Options</h4>
                              <button 
                                onClick={() => setEditPoll(null)}
                                className="p-1 hover:bg-glass rounded-full text-text-secondary"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            
                            <div className="space-y-2">
                              {editPoll.options.map((option, index) => (
                                <div key={`edit-poll-opt-${index}`} className="flex gap-2">
                                  <input 
                                    type="text"
                                    value={option.text}
                                    onChange={(e) => {
                                      const newOptions = [...editPoll.options];
                                      newOptions[index] = { ...newOptions[index], text: e.target.value };
                                      setEditPoll({ ...editPoll, options: newOptions });
                                    }}
                                    placeholder={`Option ${index + 1}`}
                                    className="flex-1 bg-bg-primary border border-subtle rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none transition-all text-text-primary placeholder:text-text-secondary"
                                  />
                                  {editPoll.options.length > 2 && (
                                    <button 
                                      onClick={() => {
                                        const newOptions = editPoll.options.filter((_, i) => i !== index);
                                        setEditPoll({ ...editPoll, options: newOptions });
                                      }}
                                      className="p-2 text-text-secondary hover:text-red-500"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              ))}
                              {editPoll.options.length < 4 && (
                                <button 
                                  onClick={() => {
                                    const newOptions = [...editPoll.options, { text: '', votes: [] }];
                                    setEditPoll({ ...editPoll, options: newOptions });
                                  }}
                                  className="w-full py-2 border border-dashed border-subtle rounded-xl text-xs font-bold text-text-secondary hover:border-indigo-500/50 hover:text-indigo-500 transition-all flex items-center justify-center gap-2"
                                >
                                  <Plus size={14} />
                                  Add Option
                                </button>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex items-center justify-between pt-2 border-t border-subtle">
                        <div className="flex items-center gap-1 text-indigo-500">
                          <input 
                            type="file" 
                            ref={fileInputEditRef} 
                            className="hidden" 
                            accept="image/*"
                            multiple
                            onChange={handleEditImageSelect}
                          />
                          <motion.button 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => fileInputEditRef.current?.click()}
                            className="p-2 hover:bg-glass rounded-full transition-colors"
                            title="Add Images"
                          >
                            <ImageIcon size={18} />
                          </motion.button>
                          <motion.button 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={isRecording ? stopRecording : startEditRecording}
                            className={`p-2 rounded-full transition-colors ${isRecording ? 'text-red-500 bg-red-500/10' : 'hover:bg-glass'}`}
                            title="Record Voice Note"
                          >
                            {isRecording ? <Square size={18} /> : <Mic size={18} />}
                          </motion.button>
                          <motion.button 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                              if (!editPoll) {
                                setEditPoll({
                                  options: [{ text: '', votes: [] }, { text: '', votes: [] }],
                                  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                                });
                              } else {
                                setEditPoll(null);
                              }
                            }}
                            className={`p-2 rounded-full transition-colors ${editPoll ? 'text-indigo-500 bg-indigo-500/10' : 'hover:bg-glass'}`}
                            title="Add Poll"
                          >
                            <Vote size={18} />
                          </motion.button>
                        </div>
                        <div className="flex items-center gap-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              // Deep check for changes
                              const hasChanged = editContent !== post.content || 
                                               JSON.stringify(editImages) !== JSON.stringify(post.images || (post.image ? [post.image] : [])) ||
                                               editVoiceNote !== (post.voiceNote || null) ||
                                               JSON.stringify(editPoll) !== JSON.stringify(post.poll || null);
                              
                              if (hasChanged) {
                                setConfirmDiscard(true);
                              } else {
                                setEditingPostId(null);
                              }
                            }}
                            className="px-4 py-1.5 rounded-full font-bold text-text-secondary hover:text-text-primary transition-colors text-sm"
                          >
                            Cancel
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => { e.stopPropagation(); setConfirmSave({ postId: post.id }); }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-1.5 rounded-full font-bold transition-all text-sm"
                          >
                            Save
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Post Content */}
                      <div className={`${singlePostId ? 'px-4 py-3' : 'px-6 py-2'}`}>
                        <FormattedContent 
                          content={post.content} 
                          className={`${singlePostId ? 'text-[19px] md:text-[21px] leading-snug' : 'text-[16px] leading-relaxed'} font-medium text-text-primary whitespace-pre-wrap block tracking-tight font-sans opacity-[0.98]`} 
                          onMentionClick={handleMentionClick}
                        />
                      </div>

                      {/* Post Media */}
                      {post.poll && (
                        <PollDisplay 
                          poll={post.poll} 
                          postId={post.id} 
                          onVote={handleVote} 
                          currentUserId={user?.uid} 
                        />
                      )}
                      <PostMedia 
                        images={post.images?.length ? post.images : (post.image ? [post.image] : [])} 
                        onImageClick={enableClickToView ? (index) => setViewingGallery({ images: post.images?.length ? post.images : (post.image ? [post.image] : []), index }) : undefined} 
                        onHoldImage={enableHoldToView ? (img) => setHeldImage(img) : undefined}
                      />

                      {/* Voice Note */}
                      {post.voiceNote && (
                        <div className="mt-2 px-4">
                          <VoiceNotePlayer src={post.voiceNote} />
                        </div>
                      )}

                      {/* Stats & Timestamp (Single Post) */}
                      <div className="px-4 space-y-3">
                        {singlePostId && (
                          <div className="text-text-secondary text-[14px] pt-3 border-t border-white/10 flex items-center gap-1.5 opacity-80">
                            <span>{formatFullTimestamp(post.timestamp as any)}</span>
                            <span>·</span>
                            <span className="text-text-primary font-bold">{formatViews(post.stats.views)}</span>
                            <span>Views</span>
                          </div>
                        )}

                        {singlePostId && (
                          <div className="py-3 border-y border-white/10 flex items-center gap-5 text-[14px] px-3">
                            <button className="hover:underline flex items-center gap-1.5 group">
                              <span className="text-text-primary font-bold group-hover:text-indigo-400 transition-colors">{post.stats.reposts}</span> 
                              <span className="text-text-secondary group-hover:text-indigo-300 transition-colors uppercase tracking-tight">Supports</span>
                            </button>
                            <button className="hover:underline flex items-center gap-1.5 group">
                              <span className="text-text-primary font-bold group-hover:text-amber-400 transition-colors">{post.stats.likes}</span> 
                              <span className="text-text-secondary group-hover:text-amber-300 transition-colors uppercase tracking-tight">Likes</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className={`flex items-center justify-around translate-y-0 text-text-secondary ${singlePostId ? 'px-4 border-b border-white/5 py-2' : 'px-6 pb-2 w-full'}`}>
                        <motion.button 
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          transition={{ type: "spring", stiffness: 500, damping: 15 }}
                          onClick={(e) => { e.stopPropagation(); setReplyingTo(replyingTo === post.id ? null : post.id); }}
                          className={`relative transition-all duration-300 group/btn ${replyingTo === post.id ? 'text-indigo-400' : 'text-slate-500 hover:text-indigo-400'}`}
                        >
                          <div className="flex items-center relative gap-2">
                            <motion.div 
                              className={`p-3 rounded-2xl transition-all duration-500 ease-out border border-transparent ${replyingTo === post.id ? 'glass border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 'group-hover/btn:bg-white/5'}`}
                            >
                              <MessageCircle 
                                size={20} 
                                className={`transition-all duration-300 ${replyingTo === post.id ? 'drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]' : ''}`}
                              />
                            </motion.div>

                            {/* Tooltip Above Icon */}
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover/btn:opacity-100 group-hover/btn:-top-10 transition-all duration-500 ease-out text-[9px] font-black uppercase tracking-[0.2em] bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-3 py-1 rounded-full shadow-[0_8px_20px_rgba(99,102,241,0.4)] z-20 backdrop-blur-md border border-white/10 whitespace-nowrap">
                              Reply
                            </span>

                            {post.stats.replies >= 0 && (
                              <span className={`text-xs ml-0.5 font-bold transition-colors duration-300 ${replyingTo === post.id ? 'text-indigo-400' : 'text-slate-500'}`}>
                                {post.stats.replies}
                              </span>
                            )}
                          </div>
                        </motion.button>

                        <motion.button 
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          transition={{ type: "spring", stiffness: 500, damping: 15 }}
                          className="relative transition-all duration-300 group/btn text-text-secondary hover:text-emerald-500"
                        >
                          <div className="flex items-center relative">
                            <motion.div 
                              className="p-2.5 rounded-full transition-all duration-500 ease-out group-hover/btn:bg-emerald-500/15"
                            >
                              <Eye 
                                size={19} 
                                className="transition-all duration-300 group-hover/btn:drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                              />
                            </motion.div>

                            {/* Tooltip Above Icon */}
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover/btn:opacity-100 group-hover/btn:-top-10 transition-all duration-500 ease-out text-[9px] font-black uppercase tracking-[0.2em] bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-3 py-1 rounded-full shadow-[0_8px_20px_rgba(16,185,129,0.4)] z-20 backdrop-blur-md border border-white/10 whitespace-nowrap">
                              Views
                            </span>

                            {post.stats.views >= 0 && (
                              <span className="text-xs ml-1 font-bold transition-colors duration-300 opacity-70 group-hover/btn:opacity-100">
                                {formatViews(post.stats.views)}
                              </span>
                            )}
                          </div>
                        </motion.button>

                        <motion.button 
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          transition={{ type: "spring", stiffness: 500, damping: 15 }}
                          onClick={(e) => { e.stopPropagation(); toggleRepost(post.id); }}
                          className={`relative transition-all duration-300 group/btn ${
                            post.isReposted ? 'text-violet-500' : 'text-text-secondary hover:text-violet-500'
                          }`}
                        >
                          <div className="flex items-center relative">
                            <motion.div 
                              animate={post.isReposted ? { 
                                scale: [1, 1.3, 1],
                                rotate: [0, -10, 10, 0]
                              } : {}}
                              whileHover={{ 
                                rotate: [0, -10, 10, -10, 0],
                                transition: { duration: 0.5, ease: "easeInOut" }
                              }}
                              className={`p-2.5 rounded-full transition-all duration-500 ease-out ${
                                post.isReposted ? 'bg-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.3)]' : 'group-hover/btn:bg-violet-500/15'
                              }`}
                            >
                              <Handshake 
                                size={19} 
                                className={`transition-all duration-300 ${
                                  post.isReposted ? 'drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]' : 'group-hover/btn:drop-shadow-[0_0_10px_rgba(139,92,246,0.5)]'
                                }`} 
                              />
                            </motion.div>
                            
                            {/* World-Class Tooltip Above Icon - Pops up on hover and hold */}
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover/btn:opacity-100 group-hover/btn:-top-10 group-active/btn:opacity-100 group-active/btn:-top-12 group-active/btn:scale-125 transition-all duration-500 ease-out text-[9px] font-black uppercase tracking-[0.2em] bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-3 py-1 rounded-full shadow-[0_10px_25px_rgba(139,92,246,0.5)] z-20 backdrop-blur-md border border-white/20 whitespace-nowrap">
                              Support
                            </span>

                            {post.stats.reposts >= 0 && (
                              <span className={`text-xs ml-1 font-bold transition-colors duration-300 ${post.isReposted ? 'text-violet-400' : 'opacity-70 group-hover/btn:opacity-100'}`}>
                                {post.stats.reposts}
                              </span>
                            )}
                          </div>
                        </motion.button>

                        <motion.button 
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          transition={{ type: "spring", stiffness: 500, damping: 15 }}
                          onClick={(e) => handleLikeClick(e, post.id, !!post.isLiked)}
                          className={`relative transition-all duration-300 group/btn ${
                            post.isLiked ? 'text-amber-400' : 'text-text-secondary hover:text-amber-400'
                          }`}
                        >
                          <div className="flex items-center relative">
                            <AnimatePresence>
                              {post.isLiked && <LikeBurst key="burst" />}
                            </AnimatePresence>
                            <motion.div 
                              animate={post.isLiked ? { 
                                scale: [1, 1.4, 1],
                                rotate: [0, 15, -15, 0]
                              } : {}}
                              whileHover={{ 
                                scale: 1.1,
                                transition: { duration: 0.2 }
                              }}
                              className={`p-2.5 rounded-full transition-all duration-500 ease-out ${
                                post.isLiked 
                                  ? 'bg-amber-400/20 shadow-[0_0_20px_rgba(251,191,36,0.3)]' 
                                  : 'group-hover/btn:bg-amber-400/15'
                              }`}
                            >
                              <Lightbulb 
                                size={19} 
                                className={`transition-all duration-300 ${
                                  post.isLiked 
                                    ? 'fill-amber-400 stroke-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]' 
                                    : 'stroke-current group-hover/btn:drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]'
                                }`} 
                              />
                            </motion.div>

                            {/* Premium Tooltip Above Icon */}
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover/btn:opacity-100 group-hover/btn:-top-10 transition-all duration-500 ease-out text-[9px] font-black uppercase tracking-[0.2em] bg-gradient-to-r from-amber-400 to-yellow-500 text-black px-3 py-1 rounded-full shadow-[0_8px_20px_rgba(251,191,36,0.4)] z-20 backdrop-blur-md border border-white/10 whitespace-nowrap">
                              Inspire
                            </span>

                            {post.stats.likes >= 0 && (
                              <span className={`text-xs ml-1 font-bold transition-colors duration-300 ${post.isLiked ? 'text-amber-400' : 'opacity-70 group-hover/btn:opacity-100'}`}>
                                {post.stats.likes}
                              </span>
                            )}
                          </div>
                        </motion.button>

                        <motion.button 
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          transition={{ type: "spring", stiffness: 500, damping: 15 }}
                          onClick={(e) => { e.stopPropagation(); handleShare(post); }}
                          className="relative transition-all duration-300 group/btn text-text-secondary hover:text-indigo-400"
                        >
                          <div className="flex items-center relative">
                            <motion.div 
                              whileHover={{ 
                                rotate: [0, -10, 10, -10, 0],
                                transition: { duration: 0.4 }
                              }}
                              className="p-2.5 group-hover/btn:bg-indigo-400/15 rounded-full transition-all duration-500 ease-out"
                            >
                              <Share 
                                size={19} 
                                className="transition-all duration-300 group-hover/btn:drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
                              />
                            </motion.div>

                            {/* Tooltip Above Icon */}
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover/btn:opacity-100 group-hover/btn:-top-10 transition-all duration-500 ease-out text-[9px] font-black uppercase tracking-[0.2em] bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-3 py-1 rounded-full shadow-[0_8px_20px_rgba(99,102,241,0.4)] z-20 backdrop-blur-md border border-white/10 whitespace-nowrap">
                              Share
                            </span>
                          </div>
                        </motion.button>
                      </div>

                      <div className={`px-4 ${singlePostId ? 'space-y-4' : 'space-y-1'}`}>
                        {!singlePostId && (
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold transition-colors duration-300 ${post.isLiked ? 'text-amber-400' : 'text-text-primary'}`}>
                              {post.stats.likes.toLocaleString()} likes
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Reply Input */}
                  <AnimatePresence>
                    {(replyingTo === post.id || singlePostId) && (
                      <motion.div
                        initial={singlePostId ? { opacity: 1 } : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className={`overflow-hidden pt-2 px-4 ${singlePostId ? 'border-t border-white/5 mt-2' : ''}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-full bg-glass flex-shrink-0" />
                          <div className="flex-1 space-y-3">
                            <textarea
                              autoFocus={!singlePostId}
                              value={replyContent}
                              onChange={(e) => handleInputChange(e.target.value, 'reply')}
                              placeholder="Post your reply"
                              className="w-full bg-glass border border-subtle rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none text-sm resize-none min-h-[100px] placeholder:text-text-secondary transition-all text-text-primary"
                            />
                            <AnimatePresence>
                              {showMentions && mentionType === 'reply' && (
                                <MentionList 
                                  users={allUsers} 
                                  searchQuery={mentionSearch} 
                                  onSelect={handleMentionSelect} 
                                  onClose={() => setShowMentions(false)} 
                                />
                              )}
                            </AnimatePresence>
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.1 }}
                              className="flex justify-end"
                            >
                              <button
                                onMouseDown={() => setIsReplyPressed(true)}
                                onMouseUp={() => setIsReplyPressed(false)}
                                onMouseLeave={() => setIsReplyPressed(false)}
                                onTouchStart={() => setIsReplyPressed(true)}
                                onTouchEnd={() => setIsReplyPressed(false)}
                                onClick={() => handleReply(post.id)}
                                disabled={!replyContent.trim()}
                                className={`relative bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-2 rounded-full text-sm font-bold transition-all duration-150 ease-in-out ${isReplyPressed ? 'transform scale-x-95 scale-y-[0.85]' : 'transform scale-100'}`}
                              >
                                <div className={`absolute inset-0 rounded-full transition-all duration-150 ${isReplyPressed ? 'bg-black/10' : 'bg-white/10'}`} />
                                <span className="relative">Post Reply</span>
                              </button>
                            </motion.div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Replies List */}
                  {post.replies && post.replies.length > 0 && (
                    <div className={`mt-3 space-y-3 ${singlePostId ? 'px-3 border-t border-subtle pt-4 pb-8' : 'px-4 pl-12 border-l border-subtle'}`}>
                      {(singlePostId ? post.replies : post.replies.slice(0, 2)).map((reply) => (
                        <ReplyItem 
                          key={reply.id}
                          reply={reply}
                          post={post}
                          userRole={userRole}
                          currentUserId={user?.uid}
                          activeReplyMenu={activeReplyMenu}
                          setActiveReplyMenu={setActiveReplyMenu}
                          deleteReply={(postId, replyId) => setConfirmDelete({ type: 'reply', postId, replyId })}
                          replyingToReplyId={replyingToReplyId}
                          setReplyingToReplyId={setReplyingToReplyId}
                          replyContent={replyContent}
                          setReplyContent={setReplyContent}
                          handleReply={handleReply}
                          updateReply={updateReply}
                          userProfile={userProfile}
                          hideNested={!singlePostId}
                          depth={0}
                        />
                      ))}
                      {!singlePostId && (post.replies.length > 2 || post.stats.replies > post.replies.slice(0, 2).length) && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewPostDetails?.(post);
                          }}
                          className="text-xs font-bold text-indigo-500 hover:text-indigo-400 transition-colors pl-12 pt-2"
                        >
                          View all {post.stats.replies} comments
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </RevealWrapper>
          </PostItemWrapper>
        )})}
        </AnimatePresence>
      <ConfirmationModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
        title={confirmDelete?.type === 'post' ? "Delete Post?" : "Delete Reply?"}
        message={confirmDelete?.type === 'post' 
          ? "This post will be permanently removed from your feed. This action cannot be undone." 
          : "This reply will be permanently removed. This action cannot be undone."}
        confirmText="Delete"
        cancelText="Cancel"
      />
      <ConfirmationModal
        isOpen={!!confirmSave}
        onClose={() => setConfirmSave(null)}
        onConfirm={() => confirmSave && handleUpdatePost(confirmSave.postId)}
        title="Save Changes?"
        message="Are you sure you want to save these changes to your post?"
        confirmText="Save"
        cancelText="Cancel"
      />

      <ConfirmationModal
        isOpen={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setEditingPostId(null);
          setEditContent('');
          setEditImages([]);
          setEditVoiceNote(null);
        }}
        title="Discard Changes?"
        message="Are you sure you want to discard your changes? This action cannot be undone."
        confirmText="Discard"
        cancelText="Keep Editing"
        variant="danger"
      />

      {/* Image Cropper Modal */}
      <AnimatePresence>
        {isCropping && imageToCrop && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-xl flex flex-col"
          >
            <div className="p-4 flex items-center justify-between border-b border-white/10">
              <button 
                onClick={() => setIsCropping(false)}
                className="p-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                <X size={24} />
              </button>
              <h2 className="text-text-primary font-black uppercase tracking-widest">Crop Image</h2>
              <button 
                onClick={saveCroppedImage}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-bold transition-all"
              >
                Apply
              </button>
            </div>
            
            <div className="relative flex-1 bg-black">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={4 / 3}
                onCropChange={setCrop}
                onCropComplete={handleCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            
            <div className="p-8 bg-bg-primary/50 border-t border-white/10">
              <div className="max-w-md mx-auto space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-black text-text-secondary uppercase tracking-widest">Zoom</span>
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 accent-indigo-500"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Sheet */}
      <AnimatePresence>
        {sharingPost && (
          <div className="fixed inset-0 z-[10000] flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSharingPost(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-xl bg-bg-primary rounded-t-[2.5rem] p-8 pb-12 shadow-2xl border-t border-subtle"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-glass rounded-full mx-auto mb-8" />
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-text-primary">Share</h3>
                  <p className="text-text-secondary text-sm">Your identity stays private when you share outside of Mark 1.</p>
                </div>

                {/* Social Row */}
                <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-2">
                  {[
                    { label: 'X', icon: Send, color: 'bg-black', platform: 'twitter' },
                    { label: 'WhatsApp', icon: MessageCircle, color: 'bg-emerald-500', platform: 'whatsapp' },
                    { label: 'Facebook', icon: Send, color: 'bg-blue-600', platform: 'facebook' },
                    { label: 'SMS', icon: MessageCircle, color: 'bg-blue-500', platform: 'sms' },
                    { label: 'Email', icon: Send, color: 'bg-slate-700', platform: 'email' },
                  ].map((item, idx) => (
                    <button 
                      key={`social-${item.label}`} 
                      onClick={() => shareToSocial(item.platform, sharingPost)}
                      className="flex flex-col items-center gap-3 group/item"
                    >
                      <div className={`w-14 h-14 rounded-full ${item.color} flex items-center justify-center shadow-lg group-hover/item:scale-110 transition-transform`}>
                        <item.icon size={24} className="text-white" />
                      </div>
                      <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">{item.label}</span>
                    </button>
                  ))}
                </div>

                <div className="h-px bg-subtle" />

                {/* Action Row */}
                <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-2">
                  {[
                    { label: 'Academy', icon: GraduationCap, action: () => {} },
                    { label: 'Profile', icon: User, action: () => {} },
                    { label: 'Copy Link', icon: LinkIcon, action: () => copyToClipboard(sharingPost.id) },
                    { label: 'Save', icon: CheckCircle2, action: () => {} },
                  ].map((item, idx) => (
                    <button 
                      key={`action-${item.label}`} 
                      onClick={item.action}
                      className="flex flex-col items-center gap-3 group/item"
                    >
                      <div className="w-14 h-14 rounded-full bg-glass border border-subtle flex items-center justify-center text-text-primary group-hover/item:bg-glass transition-all">
                        <item.icon size={24} />
                      </div>
                      <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest whitespace-nowrap">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    )}
  </div>
);
});
