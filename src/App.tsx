import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useAuth } from './FirebaseProvider';
import { db, doc, getDoc, updateDoc, increment, handleFirestoreError, OperationType, collection, query, where, onSnapshot } from './firebase';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { RippleButton } from './components/RippleButton';
import { SplitText } from './components/SplitText';
import { SkeletonLoader } from './components/SkeletonLoader';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Search, User, MessageSquare, Menu, X, Sparkles, Briefcase, ShoppingBag, Camera, MapPin, Link as LinkIcon, Calendar as CalendarIcon, Plus, Trash2, Check, Mail, Info, Shield, Settings as SettingsIcon, Palette, Code, Video, Music, Globe, Github, Twitter, Instagram, ExternalLink, ArrowLeft, LogOut, CheckCircle2, SlidersHorizontal, Navigation, Filter, Trophy, Home } from 'lucide-react';
import confetti from 'canvas-confetti';
import { INDIA_STATES } from './constants/indiaData';

import { messaging, getToken, onMessage } from './firebase';
import { NotificationService, Notification as AppNotification, NotificationType } from './services/NotificationService';
import { SocketProvider, useSocket } from './contexts/SocketContext';
import { CollaborativeWorkspace } from './components/CollaborativeWorkspace';

import type { Post } from './components/PostFeed';

// Lazy load heavy components
const ChatWindow = lazy(() => import('./components/ChatWindow').then(m => ({ default: m.ChatWindow })));
const PostFeed = lazy(() => import('./components/PostFeed').then(m => ({ default: m.PostFeed })));
const Groups = lazy(() => import('./components/Groups').then(m => ({ default: m.Groups })));
const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const Notifications = lazy(() => import('./components/Notifications').then(m => ({ default: m.Notifications })));
const EditCreatorModal = lazy(() => import('./components/EditCreatorModal').then(m => ({ default: m.EditCreatorModal })));
const EditBusinessModal = lazy(() => import('./components/EditBusinessModal').then(m => ({ default: m.EditBusinessModal })));
const EditProfileModal = lazy(() => import('./components/EditProfileModal').then(m => ({ default: m.EditProfileModal })));
const AuthScreen = lazy(() => import('./components/AuthScreen').then(m => ({ default: m.AuthScreen })));
const ConfirmationModal = lazy(() => import('./components/ConfirmationModal').then(m => ({ default: m.ConfirmationModal })));

import { PWAInstallPrompt } from './components/PWAInstallPrompt';

type UserRole = 'guest' | 'member' | 'admin';

const INITIAL_POSTS: any[] = [
  {
    id: 'system-guidance-001',
    author: {
      id: 'system-official',
      name: 'mark1 official',
      handle: 'mark1',
      avatar: 'https://picsum.photos/seed/mark1/150/150',
      isAdmin: true
    },
    content: 'welcome to mark1! 🚀 connect with other creators, share your thoughts, and track your resonance. use the "follow" button next to names to build your network!',
    timestamp: new Date().toISOString(),
    stats: { replies: 0, reposts: 0, likes: 5, views: 100 }
  }
];

interface ProfileData {
  id?: string;
  name: string;
  handle: string;
  bio: string;
  location: string;
  website: string;
  avatar: string;
  cover: string | null;
  followersCount?: number;
  followingCount?: number;
}

interface BusinessProfileData {
  id: string;
  name: string;
  bio: string;
  email: string;
  website: string;
  description: string;
  logo: string;
  cover: string | null;
  ownerName: string;
  isCreated: boolean;
  category?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  state?: string;
  district?: string;
}

interface CreatorProfileData {
  id: string;
  name: string;
  handle: string;
  bio: string;
  skills: string[];
  avatar: string;
  cover: string | null;
  links: {
    github?: string;
    twitter?: string;
    instagram?: string;
    website?: string;
  };
  category?: string;
  isCreated: boolean;
  location?: string;
  state?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  hourlyRate?: number;
}

const SEARCH_SAMPLE_DATA = [
  'Comedy Roasting',
  'Gaming & Esports',
  'Tech Unboxing',
  'Street Food Vlogs',
  'Stock Market India',
  'UPSC Preparation',
  'Bollywood Dance',
  'Yoga & Wellness',
  'Travel Vlogs',
  'Digital Marketing',
  'Photography',
  'Private Chef',
  'Hire Developers'
];

const filterSearchSuggestions = (value: string) => {
  if (!value.trim()) return [];
  return SEARCH_SAMPLE_DATA.filter(item =>
    item.toLowerCase().includes(value.toLowerCase())
  ).slice(0, 5);
};

const CREATOR_CATEGORIES = [
  'All', 'Comedy', 'Gaming', 'Tech', 'Education', 
  'Vlogging', 'Fashion', 'Beauty', 'Fitness', 
  'Food', 'Finance', 'Motivation', 'Music', 'Arts', 'News',
  'Executive Coach', 'Life Coach', 'Business Mentor', 'Career Mentor',
  'Video Editor', 'Motion Graphics', 'App Developer', 'Web Developer',
  'UI/UX Designer', 'SEO Specialist', 'Content Strategist', 'Social Media Manager',
  'Chef', 'Personal Chef', 'Bakery Expert'
];

export default function App() {
  const { user, userProfile, loading, login, logout, updateUserProfile } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <AuthScreen />
      </Suspense>
    );
  }

  return (
    <SocketProvider user={user}>
      <AppContent 
        user={user}
        userProfile={userProfile}
        loading={loading}
        updateUserProfile={updateUserProfile}
      />
    </SocketProvider>
  );
}

const AppContent = ({ user, userProfile, loading, updateUserProfile }: any) => {
  const { isConnected, presenceList, socket } = useSocket();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeTab, setActiveTab] = useState('home');
  const [hasNotification, setHasNotification] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  // Listen for real-time notifications via Socket
  useEffect(() => {
    if (!socket) return;

    socket.on('notification:receive', (data: any) => {
      // If the notification is for this user, we might want to show a toast or highlight the bell
      // For now, we update the hasNotification state
      console.log('Real-time notification received in AppContent:', data);
      setHasNotification(true);
      setIsAnimating(true);
    });

    return () => {
      socket.off('notification:receive');
    };
  }, [socket]);

  // Trigger notification periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (!hasNotification && !isAnimating) {
        setHasNotification(true);
        setIsAnimating(true);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [hasNotification, isAnimating]);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Request notification permission if logged in
    if (user) {
      const requestNotificationPermission = async () => {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            console.log('Notification permission granted.');
            const m = await messaging();
            if (m) {
              // Note: Replace with actual VAPID key from Firebase Console
              const token = await getToken(m, { vapidKey: 'BIsWw_Y6Z-Q_W_Z-Q_W_Z-Q_W_Z-Q_W_Z-Q_W_Z-Q_W_Z-Q_W_Z-Q_W_Z-Q_W_Z-Q_W_Z-Q_W_Z-Q' });
              if (token) {
                await NotificationService.saveFCMToken(user.uid, token);
              }
            }
          }
        } catch (error) {
          console.error('Error requesting notification permission:', error);
        }
      };
      requestNotificationPermission();

      // Listen for foreground messages
      const setupMessaging = async () => {
        const m = await messaging();
        if (m) {
          onMessage(m, (payload) => {
            console.log('Foreground message received:', payload);
            setHasNotification(true);
            setIsAnimating(true);
          });
        }
      };
      setupMessaging();

      // Subscribe to in-app notifications
      const unsubscribe = NotificationService.subscribeToNotifications(user.uid, (newNotifications) => {
        setNotifications(newNotifications);
        setNotificationsLoading(false);
        const unread = newNotifications.some(n => !n.read);
        if (unread) {
          setHasNotification(true);
          setIsAnimating(true);
        }
      });

      return () => {
        unsubscribe();
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user]);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    if (user && isFirstLoad) {
      const timer = setTimeout(() => setIsFirstLoad(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const [allCreators, setAllCreators] = useState<CreatorProfileData[]>([]);
  const [allBusinesses, setAllBusinesses] = useState<BusinessProfileData[]>([]);
  const [allUsers, setAllUsers] = useState<{id: string, name: string, handle: string, avatar: string}[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  // Real-time creators and businesses from Firestore
  useEffect(() => {
    if (loading || !user) return;
    
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      
      setAllCreators(users.filter(u => u.isCreator));
      setAllBusinesses(users.filter(u => u.isBusiness));
      setAllUsers(users.filter(u => u.handle).map(u => ({
        id: u.id,
        name: u.name,
        handle: u.handle,
        avatar: u.avatar,
        location: u.location || '',
        state: u.state || '',
        district: u.district || '',
        isCreator: u.isCreator || false,
        isBusiness: u.isBusiness || false,
        category: u.category || ''
      })));
      setUsersLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setUsersLoading(false);
    });
    return () => unsubscribe();
  }, [loading, user?.uid]);

  const [isBusinessModalOpen, setIsBusinessModalOpen] = useState(false);
  const [isCreatorModalOpen, setIsCreatorModalOpen] = useState(false);

  useEffect(() => {
    if (userProfile && userProfile.onboardingCompleted === false) {
      // Auto-complete onboarding if it was somehow false
      updateUserProfile({ onboardingCompleted: true });
    }
  }, [userProfile]);
  const [viewingBusiness, setViewingBusiness] = useState<BusinessProfileData | null>(null);
  const [viewingUser, setViewingUser] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState('Posts');
  const [activeChatUser, setActiveChatUser] = useState<{id: string, name: string, handle: string, avatar: string} | null>(null);
  const [backHandlers, setBackHandlers] = useState<(() => boolean)[]>([]);
  const [backIndicatorOpacity, setBackIndicatorOpacity] = useState(0);
  const [backIndicatorX, setBackIndicatorX] = useState(0);
  
  const [userRole, setUserRole] = useState<UserRole>('guest');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);

  const [searchFilterRole, setSearchFilterRole] = useState<'all' | 'creator' | 'business' | 'people'>('all');
  const [searchFilterCategory, setSearchFilterCategory] = useState('All');
  const [searchFilterState, setSearchFilterState] = useState('All');
  const [searchFilterDistrict, setSearchFilterDistrict] = useState('All');
  const [isSearchFilterOpen, setIsSearchFilterOpen] = useState(false);

  const [unfollowConfirmation, setUnfollowConfirmation] = useState<string | null>(null);

  const toggleFollowCreator = async (creatorId: string) => {
    if (!userProfile || !user) return;
    
    const currentFollowed = userProfile.followedCreatorIds || [];
    if (currentFollowed.includes(creatorId)) {
      setUnfollowConfirmation(creatorId);
    } else {
      try {
        await updateUserProfile({
          followedCreatorIds: [...currentFollowed, creatorId],
          followingCount: increment(1)
        });
        
        // Update the creator's follower count
        await updateDoc(doc(db, 'users', creatorId), {
          followersCount: increment(1)
        });

        // Trigger Notification
        const notification = {
          type: 'follow' as NotificationType,
          from: {
            id: user.uid,
            name: userProfile.name || user.displayName || 'Someone',
            avatar: userProfile.avatar || user.photoURL || ''
          }
        };

        NotificationService.createNotification(creatorId, notification);
        
        if (socket) {
          socket.emit('notification:send', {
            targetUserId: creatorId,
            notification
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${creatorId}`);
      }
    }
  };

  const confirmUnfollow = async () => {
    if (unfollowConfirmation && userProfile && user) {
      const currentFollowed = userProfile.followedCreatorIds || [];
      try {
        await updateUserProfile({
          followedCreatorIds: currentFollowed.filter(id => id !== unfollowConfirmation),
          followingCount: increment(-1)
        });
        
        // Update the creator's follower count
        await updateDoc(doc(db, 'users', unfollowConfirmation), {
          followersCount: increment(-1)
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${unfollowConfirmation}`);
      }
      setUnfollowConfirmation(null);
    }
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSearchSuggestions(filterSearchSuggestions(value));
    setSelectedSearchIndex(-1);
    setShowSearchSuggestions(true);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSearchSuggestions) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSearchIndex(prev => 
        prev < searchSuggestions.length - 1 ? prev + 1 : prev
      );
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSearchIndex(prev => prev > -1 ? prev - 1 : prev);
    }
    else if (e.key === 'Enter' && selectedSearchIndex > -1) {
      setSearchQuery(searchSuggestions[selectedSearchIndex]);
      setShowSearchSuggestions(false);
    }
    else if (e.key === 'Escape') {
      setShowSearchSuggestions(false);
    }
  };

  const handleSearchSuggestionClick = useCallback((suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSearchSuggestions(false);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.search-container')) {
        setShowSearchSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [businessProfile, setBusinessProfile] = useState<BusinessProfileData>({
    id: 'my-business',
    name: '',
    bio: '',
    email: '',
    website: '',
    description: '',
    logo: 'https://picsum.photos/seed/business/200/200',
    cover: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80',
    ownerName: 'Alex Rivera',
    isCreated: false,
    category: 'General',
    location: '',
    state: '',
    district: '',
    latitude: undefined,
    longitude: undefined
  });

  const [businessSearchQuery, setBusinessSearchQuery] = useState('');
  const [selectedBusinessCategory, setSelectedBusinessCategory] = useState('All');
  const [selectedBusinessLocation, setSelectedBusinessLocation] = useState('All');
  const [selectedBusinessState, setSelectedBusinessState] = useState('All');
  const [selectedBusinessDistrict, setSelectedBusinessDistrict] = useState('All');
  const [isNearMeActive, setIsNearMeActive] = useState(false);
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const [businessSortBy, setBusinessSortBy] = useState<'newest' | 'name' | 'distance'>('newest');
  const [isBusinessFilterOpen, setIsBusinessFilterOpen] = useState(false);

  const [creatorProfile, setCreatorProfile] = useState<CreatorProfileData>({
    id: 'my-creator',
    name: '',
    handle: '',
    bio: '',
    skills: [],
    avatar: 'https://i.pravatar.cc/150?u=alex',
    cover: null,
    links: {},
    isCreated: false,
    category: 'General',
    location: '',
    state: '',
    district: '',
    latitude: undefined,
    longitude: undefined,
    hourlyRate: 0
  });

  const [creatorSearchQuery, setCreatorSearchQuery] = useState('');
  const [selectedCreatorCategory, setSelectedCreatorCategory] = useState('All');
  const [creatorCategorySearch, setCreatorCategorySearch] = useState('');
  const [selectedCreatorSkill, setSelectedCreatorSkill] = useState('All');
  const [selectedCreatorState, setSelectedCreatorState] = useState('All');
  const [selectedCreatorDistrict, setSelectedCreatorDistrict] = useState('All');
  const [isCreatorNearMeActive, setIsCreatorNearMeActive] = useState(false);
  const [creatorSortBy, setCreatorSortBy] = useState<'newest' | 'name' | 'distance'>('newest');
  const [isCreatorFilterOpen, setIsCreatorFilterOpen] = useState(false);

  // Pending filter states for "Apply" button
  const [pendingCreatorCategory, setPendingCreatorCategory] = useState('All');
  const [pendingCreatorSkill, setPendingCreatorSkill] = useState('All');
  const [pendingCreatorState, setPendingCreatorState] = useState('All');
  const [pendingCreatorDistrict, setPendingCreatorDistrict] = useState('All');
  const [pendingCreatorSortBy, setPendingCreatorSortBy] = useState<'newest' | 'name' | 'distance'>('newest');
  const [pendingIsCreatorNearMeActive, setPendingIsCreatorNearMeActive] = useState(false);

  const applyCreatorFilters = () => {
    setSelectedCreatorCategory(pendingCreatorCategory);
    setSelectedCreatorSkill(pendingCreatorSkill);
    setSelectedCreatorState(pendingCreatorState);
    setSelectedCreatorDistrict(pendingCreatorDistrict);
    setCreatorSortBy(pendingCreatorSortBy);
    setIsCreatorNearMeActive(pendingIsCreatorNearMeActive);
    setIsCreatorFilterOpen(false);
  };

  const filteredCreatorCategories = useMemo(() => {
    return CREATOR_CATEGORIES.filter(cat => 
      cat.toLowerCase().includes(creatorCategorySearch.toLowerCase())
    );
  }, [creatorCategorySearch]);

  const allSkills = useMemo(() => {
    const skills = new Set<string>();
    allCreators.forEach(creator => {
      if (creator.skills) {
        creator.skills.forEach(skill => skills.add(skill));
      }
    });
    return ['All', ...Array.from(skills).sort()];
  }, [allCreators]);

  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [previousTab, setPreviousTab] = useState('home');

  useEffect(() => {
    if ((isNearMeActive || isCreatorNearMeActive) && !userCoords) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          if (isNearMeActive) setBusinessSortBy('distance');
          if (isCreatorNearMeActive) setCreatorSortBy('distance');
        },
        (error) => {
          console.error("Error getting location:", error);
          if (isNearMeActive) setIsNearMeActive(false);
          if (isCreatorNearMeActive) setIsCreatorNearMeActive(false);
        }
      );
    }
  }, [isNearMeActive, isCreatorNearMeActive, userCoords]);

  const deg2rad = (deg: number) => deg * (Math.PI / 180);

  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  const handleUpdateProfile = useCallback(async (newData: ProfileData) => {
    await updateUserProfile(newData);
    setIsEditModalOpen(false);
  }, [updateUserProfile]);

  const handleUpdateBusinessProfile = useCallback(async (newData: BusinessProfileData) => {
    const updatedProfile = { ...newData, isCreated: true, isBusiness: true };
    setBusinessProfile(updatedProfile);
    
    try {
      await updateUserProfile(updatedProfile);
      setIsBusinessModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user?.uid}`);
    }
  }, [user, updateUserProfile]);

  const handleUpdateCreatorProfile = useCallback(async (newData: CreatorProfileData) => {
    const updatedProfile = { ...newData, isCreated: true, isCreator: true };
    setCreatorProfile(updatedProfile);
    
    try {
      await updateUserProfile(updatedProfile);
      setIsCreatorModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user?.uid}`);
    }
  }, [user, updateUserProfile]);

  const handleViewBusiness = useCallback((biz: BusinessProfileData) => {
    setViewingBusiness(biz);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleViewProfile = useCallback(async (user: any) => {
    // If it's a simple user object from a post, try to fetch the full profile from Firestore
    if (user.id) {
      setProfileLoading(true);
      setActiveTab('profile'); // Switch tab immediately so user sees skeleton
      try {
        const userDoc = await getDoc(doc(db, 'users', user.id));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setViewingUser({
            id: user.id,
            name: data.name || user.name,
            handle: data.handle || user.handle,
            avatar: data.avatar || user.avatar,
            bio: data.bio || `This is the official profile of ${data.name || user.name}. Building the future of digital experiences.`,
            location: data.location || 'Global',
            website: data.website || 'mark1.business',
            cover: data.cover || `https://picsum.photos/seed/${data.handle || user.handle}/1200/400`,
            followersCount: data.followersCount || 0,
            followingCount: data.followingCount || 0
          });
        } else {
          // Fallback if doc doesn't exist
          setViewingUser({
            id: user.id,
            name: user.name,
            handle: user.handle,
            avatar: user.avatar,
            bio: `This is the official profile of ${user.name}. Building the future of digital experiences.`,
            location: 'Global',
            website: 'mark1.business',
            cover: `https://picsum.photos/seed/${user.handle}/1200/400`,
            followersCount: 0,
            followingCount: 0
          });
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      } finally {
        setProfileLoading(false);
      }
    }
    setActiveProfileTab('Posts');
  }, []);

  const handleViewPostDetails = useCallback((post: Post) => {
    setSelectedPost(post);
    setPreviousTab(activeTab);
    setActiveTab('post-details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  const handleStartChat = useCallback((targetUser: {id: string, name: string, handle: string, avatar: string}) => {
    setActiveChatUser(targetUser);
    setActiveTab('chat');
  }, []);

  const handlePostDeleted = useCallback((postId: string) => {
    if (activeTab === 'post-details' && selectedPost?.id === postId) {
      setActiveTab(previousTab || 'home');
      setSelectedPost(null);
    }
  }, [activeTab, selectedPost, previousTab]);

  const registerBackHandler = useCallback((handler: () => boolean) => {
    setBackHandlers(prev => [...prev, handler]);
    return () => setBackHandlers(prev => prev.filter(h => h !== handler));
  }, []);

  const handleGlobalBack = useCallback(() => {
    for (let i = backHandlers.length - 1; i >= 0; i--) {
      if (backHandlers[i]()) return;
    }

    if (isEditModalOpen) {
      setIsEditModalOpen(false);
      return;
    }
    if (isBusinessModalOpen) {
      setIsBusinessModalOpen(false);
      return;
    }
    if (isCreatorModalOpen) {
      setIsCreatorModalOpen(false);
      return;
    }

    if (viewingBusiness) {
      setViewingBusiness(null);
      return;
    }

    if (viewingUser) {
      setViewingUser(null);
      return;
    }

    if (activeTab === 'post-details') {
      setActiveTab(previousTab);
      setSelectedPost(null);
      return;
    }

    if (activeTab !== 'home') {
      setActiveTab('home');
    }
  }, [backHandlers, isEditModalOpen, isBusinessModalOpen, isCreatorModalOpen, viewingUser, activeTab]);

  const filteredCreators = useMemo(() => allCreators.filter(creator => {
    const matchesQuery = searchQuery === '' || 
      creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      creator.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      creator.bio.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (creator.skills && creator.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())));
    
    const matchesCategory = searchFilterCategory === 'All' || 
      (creator.category && creator.category.toLowerCase() === searchFilterCategory.toLowerCase()) ||
      (creator.skills && creator.skills.some(s => s.toLowerCase() === searchFilterCategory.toLowerCase()));
      
    let matchesLocation = true;
    if (searchFilterDistrict !== 'All') {
      matchesLocation = creator.district === searchFilterDistrict || creator.location?.toLowerCase().includes(searchFilterDistrict.toLowerCase()) || false;
    } else if (searchFilterState !== 'All') {
      matchesLocation = creator.state === searchFilterState || creator.location?.toLowerCase().includes(searchFilterState.toLowerCase()) || false;
    }

    return matchesQuery && matchesCategory && matchesLocation && (searchFilterRole === 'all' || searchFilterRole === 'creator');
  }), [allCreators, searchQuery, searchFilterCategory, searchFilterRole, searchFilterState, searchFilterDistrict]);

  const filteredBusinesses = useMemo(() => allBusinesses.filter(biz => {
    const matchesQuery = searchQuery === '' || 
      biz.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      biz.bio.toLowerCase().includes(searchQuery.toLowerCase()) ||
      biz.description.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesCategory = searchFilterCategory === 'All' || 
      (biz.category && biz.category.toLowerCase() === searchFilterCategory.toLowerCase());
      
    let matchesLocation = true;
    if (searchFilterDistrict !== 'All') {
      matchesLocation = biz.district === searchFilterDistrict || biz.location?.toLowerCase().includes(searchFilterDistrict.toLowerCase()) || false;
    } else if (searchFilterState !== 'All') {
      matchesLocation = biz.state === searchFilterState || biz.location?.toLowerCase().includes(searchFilterState.toLowerCase()) || false;
    }

    return matchesQuery && matchesCategory && matchesLocation && (searchFilterRole === 'all' || searchFilterRole === 'business');
  }), [allBusinesses, searchQuery, searchFilterCategory, searchFilterRole, searchFilterState, searchFilterDistrict]);

  const filteredUsers = useMemo(() => allUsers.filter(u => {
    const matchesQuery = searchQuery === '' || 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.handle.toLowerCase().includes(searchQuery.toLowerCase());
    
    // People category matching is harder as it's not well defined, but we can match against their bio or category if they have one
    const matchesCategory = searchFilterCategory === 'All';

    let matchesLocation = true;
    if (searchFilterDistrict !== 'All') {
      matchesLocation = (u as any).district === searchFilterDistrict || (u as any).location?.toLowerCase().includes(searchFilterDistrict.toLowerCase()) || false;
    } else if (searchFilterState !== 'All') {
      matchesLocation = (u as any).state === searchFilterState || (u as any).location?.toLowerCase().includes(searchFilterState.toLowerCase()) || false;
    }
      
    return matchesQuery && matchesCategory && matchesLocation && (searchFilterRole === 'all' || searchFilterRole === 'people');
  }), [allUsers, searchQuery, searchFilterRole, searchFilterCategory, searchFilterState, searchFilterDistrict]);

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="max-w-5xl mx-auto">
              <PostFeed 
                userRole={userRole} 
                userProfile={userProfile}
                onViewProfile={handleViewProfile} 
                handleStartChat={handleStartChat}
                onViewPostDetails={handleViewPostDetails}
                posts={posts}
                setPosts={setPosts}
                onPostDeleted={handlePostDeleted}
                allUsers={allUsers}
                enableClickToView={true}
                enableHoldToView={false}
              />
            </div>
          </motion.div>
        );
      case 'rank':
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 px-4"
          >
            <div className="relative">
              <motion.div 
                animate={{ 
                  rotate: [0, -10, 10, -10, 10, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="w-32 h-32 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-[2.5rem] flex items-center justify-center text-indigo-400 shadow-2xl shadow-indigo-500/10 border border-indigo-500/20"
              >
                <Trophy size={64} />
              </motion.div>
              <div className="absolute -top-2 -right-2 px-3 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">New</div>
            </div>
            
            <div className="space-y-3">
              <SplitText text="Your Rank is Coming Soon" className="text-4xl font-black text-text-primary tracking-tighter" />
              <p className="text-text-secondary max-w-md mx-auto text-lg font-medium leading-relaxed">
                We're building a comprehensive ranking system to track your achievements, seasonal stats, and global standing.
              </p>
            </div>
            
            <button 
              onClick={() => setActiveTab('home')}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-indigo-600/20 flex items-center gap-2"
            >
              <Home size={18} />
              Back to Feed
            </button>
          </motion.div>
        );
      case 'business':
        if (viewingBusiness) {
          return (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto pb-20 px-4"
            >
              <div className="flex items-center gap-4 mb-8">
                <button 
                  onClick={() => setViewingBusiness(null)}
                  className="p-3 glass hover:bg-white/10 rounded-2xl text-white transition-all border border-white/5"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Business Registry</span>
                  <h2 className="text-2xl font-black text-white italic font-sans tracking-tight">Profile View</h2>
                </div>
              </div>

              <div className="relative group mb-12">
                <div className="h-48 md:h-72 bg-slate-950/20 glass border border-white/10 overflow-hidden rounded-[2.5rem] relative shadow-2xl backdrop-blur-3xl">
                  {viewingBusiness.cover ? (
                    <img src={viewingBusiness.cover} alt="Cover" referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-[2000ms]" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-950/40 via-slate-900/40 to-purple-950/40" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
                  
                  <div className="absolute bottom-6 left-8 right-8 flex items-end justify-between gap-6">
                    <div className="flex items-center gap-6">
                      <div className="w-24 h-24 md:w-32 md:h-32 rounded-[2rem] border-4 border-slate-950/80 overflow-hidden bg-slate-900 shadow-[0_0_40px_rgba(0,0,0,0.6)] relative z-10 transition-transform duration-500 group-hover:scale-105">
                        <img src={viewingBusiness.logo} alt="Logo" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      </div>
                      <div className="space-y-1 mb-2">
                        <div className="flex items-center gap-3">
                          <h1 className="text-2xl md:text-5xl font-black text-white italic font-sans tracking-tighter">{viewingBusiness.name}</h1>
                          <div className="bg-indigo-500 text-white p-1.5 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.5)] border border-white/20">
                            <CheckCircle2 size={16} fill="white" className="text-indigo-500" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="px-3 py-1 glass rounded-lg text-[10px] font-black uppercase tracking-widest text-indigo-400 border border-indigo-500/20">
                            {viewingBusiness.category}
                          </div>
                          {viewingBusiness.location && (
                            <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 italic bg-white/5 px-2 py-1 rounded-lg">
                              <MapPin size={10} />
                              {viewingBusiness.location}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <div className="glass-card !p-8 border border-white/5 space-y-6">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                      <h3 className="text-lg font-black text-white uppercase tracking-widest">Business Charter</h3>
                    </div>
                    <p className="text-lg text-slate-300 leading-relaxed font-medium italic opacity-90">
                      "{viewingBusiness.bio}"
                    </p>
                    <div className="space-y-4 pt-4 text-slate-400 leading-loose text-sm font-sans">
                      <p className="whitespace-pre-wrap">{viewingBusiness.description}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="glass-card !p-6 border border-white/5 flex flex-col items-center text-center space-y-3 group hover:border-indigo-500/20 transition-all">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                        <Mail size={24} />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Official Communication</span>
                        <p className="text-white font-bold">{viewingBusiness.email}</p>
                      </div>
                    </div>
                    {viewingBusiness.website && (
                      <a 
                        href={viewingBusiness.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="glass-card !p-6 border border-white/5 flex flex-col items-center text-center space-y-3 group hover:border-indigo-500/20 transition-all"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                          <ExternalLink size={24} />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Digital Hub</span>
                          <p className="text-white font-bold truncate max-w-full">{viewingBusiness.website.replace(/^https?:\/\//, '')}</p>
                        </div>
                      </a>
                    )}
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="glass-card !p-6 border border-white/5 space-y-6">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">Leadership</h3>
                    </div>
                    <div className="flex items-center gap-4 group">
                      <div className="w-14 h-14 rounded-2xl border-2 border-slate-900 overflow-hidden bg-slate-900 group-hover:scale-105 transition-transform">
                        <div className="w-full h-full flex items-center justify-center bg-indigo-500/20 text-indigo-400 text-xl font-black">
                          {viewingBusiness.ownerName.charAt(0)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-white font-black tracking-tight">{viewingBusiness.ownerName}</h4>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Founder & CEO</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleStartChat({
                        id: viewingBusiness.id,
                        name: viewingBusiness.ownerName,
                        handle: viewingBusiness.name,
                        avatar: ''
                      })}
                      className="w-full py-4 glass bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all border border-indigo-500/20 shadow-xl"
                    >
                      Connect with Founder
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        }

        return (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-5xl mx-auto pb-20 space-y-12"
          >
            {/* My Business Section */}
            <section className="space-y-6">
              <div className="flex items-center justify-between px-4">
                <SplitText text="My Business" />
                {!businessProfile.isCreated && (
                  <RippleButton 
                    onClick={() => setIsBusinessModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm"
                  >
                    <Plus size={18} />
                    Create Business
                  </RippleButton>
                )}
              </div>
              
              {businessProfile.isCreated ? (
                <div className="relative group">
                  <div className="h-44 md:h-60 bg-slate-950/20 glass border border-white/10 overflow-hidden rounded-[2.5rem] relative shadow-2xl backdrop-blur-3xl">
                    {businessProfile.cover ? (
                      <img src={businessProfile.cover} alt="Cover" referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-1000" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-950/40 via-slate-900/40 to-purple-950/40" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
                    
                    <div className="absolute bottom-6 left-8 right-8 flex items-end justify-between gap-6">
                      <div className="flex items-center gap-6">
                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl border-4 border-slate-950/80 overflow-hidden bg-slate-900 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                          <img src={businessProfile.logo} alt="Logo" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <SplitText text={businessProfile.name} className="text-xl md:text-3xl font-black text-white italic font-sans" />
                            <div className="bg-indigo-500 text-white p-1 rounded-full shadow-lg shadow-indigo-500/30">
                              <Check size={12} strokeWidth={4} />
                            </div>
                          </div>
                          <p className="text-text-secondary text-sm font-medium italic opacity-80">"{businessProfile.bio}"</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setIsBusinessModalOpen(true)}
                        className="p-3 glass hover:bg-white/10 rounded-2xl text-white transition-all border border-white/5 shadow-xl hover:-translate-y-1"
                      >
                        <SettingsIcon size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-[2rem] border-2 border-dashed border-subtle bg-glass flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-glass flex items-center justify-center text-text-secondary">
                    <Briefcase size={32} />
                  </div>
                  <div className="space-y-1">
                    <SplitText text="No Business Profile Yet" className="text-lg font-bold" />
                    <p className="text-text-secondary text-sm max-w-xs">Create your profile to join the business directory and connect with others.</p>
                  </div>
                </div>
              )}
            </section>

            {/* Business Directory */}
            <section className="space-y-6">
              <div className="px-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <SplitText text="Business Directory" />
                    <p className="text-sm text-text-secondary">Discover and connect with top businesses in the ecosystem.</p>
                  </div>
                </div>

                {/* Search and Filters - X.com Style */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 w-full">
                    <div className="relative group flex-1">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-indigo-500 transition-colors">
                        <Search size={18} />
                      </div>
                      <input 
                        type="text" 
                        placeholder="Search businesses..." 
                        value={businessSearchQuery}
                        onChange={(e) => setBusinessSearchQuery(e.target.value)}
                        className="w-full bg-slate-900/50 border border-subtle rounded-full py-3 pl-12 pr-12 text-base focus:outline-none focus:bg-slate-900 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-text-secondary text-text-primary"
                      />
                      {businessSearchQuery && (
                        <button 
                          onClick={() => setBusinessSearchQuery('')}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-glass rounded-full text-text-secondary transition-colors"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsBusinessFilterOpen(!isBusinessFilterOpen)}
                      className={`p-3 rounded-2xl border transition-all ${
                        isBusinessFilterOpen 
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20' 
                          : 'bg-glass border-subtle text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <SlidersHorizontal size={20} />
                    </motion.button>
                  </div>

                  <AnimatePresence>
                    {isBusinessFilterOpen && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="glass-card border border-white/5 shadow-3xl !p-8 space-y-8 backdrop-blur-3xl animate-fadeIn mt-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Global Search Matrix</h4>
                            <button
                              onClick={() => {
                                setIsNearMeActive(!isNearMeActive);
                                if (!isNearMeActive) setBusinessSortBy('distance');
                              }}
                              className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                isNearMeActive 
                                  ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.2)]' 
                                  : 'glass border-white/5 text-slate-400 hover:text-white'
                              }`}
                            >
                              <Navigation size={14} className={isNearMeActive ? 'animate-pulse' : ''} />
                              Analyze Proximity
                            </button>
                          </div>

                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary ml-1">Select State</label>
                                <select 
                                  value={selectedBusinessState}
                                  onChange={(e) => {
                                    setSelectedBusinessState(e.target.value);
                                    setSelectedBusinessDistrict('All');
                                  }}
                                  className="w-full bg-slate-900/50 border border-subtle rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-indigo-500"
                                >
                                  <option value="All">All States</option>
                                  {INDIA_STATES.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                                </select>
                              </div>

                              <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary ml-1">Select District</label>
                                <select 
                                  disabled={selectedBusinessState === 'All'}
                                  value={selectedBusinessDistrict}
                                  onChange={(e) => setSelectedBusinessDistrict(e.target.value)}
                                  className="w-full bg-slate-900/50 border border-subtle rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                                >
                                  <option value="All">All Districts</option>
                                  {INDIA_STATES.find(s => s.name === selectedBusinessState)?.districts.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary ml-1">Popular Cities</label>
                            <div className="flex flex-wrap gap-2">
                              {['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Remote'].map((loc) => (
                                <button
                                  key={loc}
                                  onClick={() => setSelectedBusinessLocation(loc)}
                                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                                    selectedBusinessLocation === loc
                                      ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50'
                                      : 'bg-slate-900/40 border-subtle text-text-secondary hover:text-text-primary'
                                  }`}
                                >
                                  {loc}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary ml-1">Industry Category</label>
                            <div className="flex flex-wrap gap-2">
                              {['All', 'IT & Software', 'E-commerce & Retail', 'Education & EdTech', 'Healthcare', 'Finance & FinTech', 'Agriculture & AgriTech', 'Food & Beverages', 'Manufacturing', 'Logistics & Supply Chain', 'Real Estate', 'Media & Entertainment', 'Automotive', 'Textile & Fashion', 'Design', 'Development', 'AI & Robotics', 'Marketing & AdTech', 'Consulting'].map((cat) => (
                                <button
                                  key={cat}
                                  onClick={() => setSelectedBusinessCategory(cat)}
                                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                                    selectedBusinessCategory === cat
                                      ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50'
                                      : 'bg-slate-900/40 border-subtle text-text-secondary hover:text-text-primary'
                                  }`}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary ml-1">Sort By</label>
                            <div className="flex gap-2">
                              {[
                                { id: 'newest', label: 'Newest First' },
                                { id: 'name', label: 'Alphabetical' },
                                { id: 'distance', label: 'Nearest' }
                              ].map((sort) => (
                                <button
                                  key={sort.id}
                                  onClick={() => setBusinessSortBy(sort.id as any)}
                                  disabled={sort.id === 'distance' && !userCoords}
                                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                                    businessSortBy === sort.id
                                      ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50'
                                      : 'bg-slate-900/40 border-subtle text-text-secondary hover:text-text-primary'
                                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                                >
                                  {sort.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-subtle">
                            <button 
                              onClick={() => {
                                setSelectedBusinessCategory('All');
                                setSelectedBusinessLocation('All');
                                setSelectedBusinessState('All');
                                setSelectedBusinessDistrict('All');
                                setIsNearMeActive(false);
                                setBusinessSortBy('newest');
                                setBusinessSearchQuery('');
                              }}
                              className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-widest"
                            >
                              Reset All Filters
                            </button>
                            <p className="text-[10px] text-text-secondary font-medium">
                              Filtering by {selectedBusinessCategory} in {selectedBusinessState !== 'All' ? `${selectedBusinessDistrict !== 'All' ? selectedBusinessDistrict + ', ' : ''}${selectedBusinessState}` : selectedBusinessLocation}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!isBusinessFilterOpen && (
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
                      {['All', 'Near Me', 'IT & Software', 'E-commerce & Retail', 'Education & EdTech', 'Healthcare', 'Finance & FinTech', 'Agriculture & AgriTech', 'Food & Beverages', 'Manufacturing', 'Logistics & Supply Chain', 'Real Estate', 'Media & Entertainment', 'Automotive', 'Textile & Fashion', 'Design', 'Development', 'AI & Robotics', 'Marketing & AdTech', 'Consulting'].map((cat) => (
                        <button
                          key={cat}
                          onClick={() => {
                            if (cat === 'Near Me') {
                              setIsNearMeActive(!isNearMeActive);
                              if (!isNearMeActive) setSelectedBusinessCategory('All');
                            } else {
                              setSelectedBusinessCategory(cat);
                              // Keep Near Me persistent if we want to combine, but user usually wants to browse a category NEAR THEM
                            }
                          }}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                            (cat === 'Near Me' ? isNearMeActive : selectedBusinessCategory === cat)
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                              : 'bg-glass border-glass-border text-text-secondary hover:bg-slate-900/40 hover:text-text-primary'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-2">
                {usersLoading ? (
                  <SkeletonLoader type="group" count={6} />
                ) : (() => {
                  const filtered = allBusinesses.filter(biz => {
                    const matchesSearch = biz.name.toLowerCase().includes(businessSearchQuery.toLowerCase()) || 
                                        biz.bio.toLowerCase().includes(businessSearchQuery.toLowerCase()) ||
                                        biz.description.toLowerCase().includes(businessSearchQuery.toLowerCase());
                    const matchesCategory = selectedBusinessCategory === 'All' || biz.category === selectedBusinessCategory;
                    
                    let matchesLocation = true;
                    if (isNearMeActive && userCoords && biz.latitude && biz.longitude) {
                      const dist = calculateDistance(userCoords.lat, userCoords.lng, biz.latitude, biz.longitude);
                      if (dist > 50) matchesLocation = false;
                    } else if (selectedBusinessDistrict !== 'All') {
                      matchesLocation = biz.district === selectedBusinessDistrict || biz.location?.toLowerCase().includes(selectedBusinessDistrict.toLowerCase()) || false;
                    } else if (selectedBusinessState !== 'All') {
                      matchesLocation = biz.state === selectedBusinessState || biz.location?.toLowerCase().includes(selectedBusinessState.toLowerCase()) || false;
                    } else if (selectedBusinessLocation !== 'All') {
                      matchesLocation = biz.location?.toLowerCase().includes(selectedBusinessLocation.toLowerCase()) || false;
                    }
                    
                    return matchesSearch && matchesCategory && matchesLocation;
                  }).sort((a, b) => {
                    if (businessSortBy === 'distance' && userCoords && a.latitude && a.longitude && b.latitude && b.longitude) {
                      const distA = calculateDistance(userCoords.lat, userCoords.lng, a.latitude, a.longitude);
                      const distB = calculateDistance(userCoords.lat, userCoords.lng, b.latitude, b.longitude);
                      return distA - distB;
                    }
                    if (businessSortBy === 'name') {
                      return a.name.localeCompare(b.name);
                    }
                    return 0; // Natural (newest)
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="col-span-full py-20 flex flex-col items-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-[2rem] bg-slate-900/50 border border-subtle flex items-center justify-center text-slate-500">
                          <Search size={40} />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-xl font-bold text-white">No businesses found</h3>
                          <p className="text-slate-500 max-w-xs mx-auto">
                            {businessSearchQuery || selectedBusinessCategory !== 'All' || selectedBusinessLocation !== 'All' || selectedBusinessState !== 'All' || isNearMeActive
                            ? "We couldn't find any businesses matching your current filters."
                            : "There are no businesses in the directory yet. Be the first to join!"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {(businessSearchQuery || selectedBusinessCategory !== 'All' || selectedBusinessLocation !== 'All' || selectedBusinessState !== 'All' || isNearMeActive) ? (
                          <button 
                            onClick={() => {
                              setBusinessSearchQuery('');
                              setSelectedBusinessCategory('All');
                              setSelectedBusinessLocation('All');
                              setSelectedBusinessState('All');
                              setSelectedBusinessDistrict('All');
                              setIsNearMeActive(false);
                              setBusinessSortBy('newest');
                            }}
                              className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-sm transition-all border border-white/10"
                            >
                              Clear all filters
                            </button>
                          ) : (
                            <button 
                              onClick={() => setIsBusinessModalOpen(true)}
                              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20"
                            >
                              Create Business
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return filtered.map((biz, idx) => (
                    <motion.div 
                      key={`${biz.id}-${idx}`}
                      whileHover={{ y: -6 }}
                      className="group relative"
                      onClick={() => handleViewBusiness(biz)}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-[2.5rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className="relative glass-card !p-0 overflow-hidden border border-white/5 bg-slate-950/20 backdrop-blur-3xl hover:border-indigo-500/20 shadow-xl transition-all duration-500 rounded-[2.5rem]">
                        <div className="h-28 bg-slate-900 absolute inset-x-0 top-0 overflow-hidden z-0">
                          {biz.cover ? (
                            <img src={biz.cover} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-50 group-hover:scale-125 transition-transform duration-1000" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-indigo-900/40 via-slate-900/40 to-slate-950/40" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                          
                          <div className="absolute top-4 right-4 z-10">
                            <div className="glass backdrop-blur-xl border border-white/10 p-2 rounded-xl text-white shadow-xl">
                              <Shield size={14} className="text-indigo-400" />
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-6 pt-20 relative z-10 flex flex-col h-full">
                          <div className="w-20 h-20 rounded-2xl border-4 border-slate-950 overflow-hidden bg-slate-900 mb-4 shadow-[0_0_20px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-transform duration-500">
                            <img src={biz.logo} alt={biz.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          </div>
                          
                          <div className="space-y-4 flex-1">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <h4 className="font-black text-white text-lg tracking-tight font-sans italic">{biz.name.toLowerCase()}</h4>
                                <div className="bg-indigo-500/20 text-indigo-400 p-0.5 rounded-full border border-indigo-500/20">
                                  <Check size={10} strokeWidth={4} />
                                </div>
                              </div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest line-clamp-1">{biz.bio}</p>
                              
                              {biz.location && (
                                <div className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-black uppercase tracking-widest pt-1">
                                  <MapPin size={12} className="text-indigo-500" />
                                  <span className="opacity-80">{biz.location}</span>
                                </div>
                              )}
                            </div>
                            
                            <p className="text-[11px] text-slate-400/80 font-medium line-clamp-2 leading-relaxed h-8 italic">
                              "{biz.description}"
                            </p>
                            
                            <div className="flex items-center justify-between pt-5 border-t border-white/5 mt-auto">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full glass border border-white/10 flex items-center justify-center text-[10px] font-black text-white">
                                  {biz.ownerName.charAt(0)}
                                </div>
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{biz.ownerName}</span>
                              </div>
                              <div className="px-3 py-1 glass rounded-lg text-[8px] font-black uppercase tracking-widest text-indigo-400 border border-indigo-500/20">
                                {biz.category}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ));
                })()}
              </div>
            </section>
          </motion.div>
        );
      case 'creators':
        return (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-5xl mx-auto pb-20 space-y-12"
          >
            {/* My Creator Profile Section */}
            <section className="space-y-6">
              <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                    <Sparkles size={20} />
                  </div>
                  <SplitText text="My Creator Profile" />
                </div>
                {!creatorProfile.isCreated && (
                  <button 
                    onClick={() => setIsCreatorModalOpen(true)}
                    className="bg-white text-black px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm hover:bg-slate-200"
                  >
                    <Plus size={18} />
                    Create Profile
                  </button>
                )}
              </div>
              
              {creatorProfile.isCreated ? (
                <div className="relative group">
                  <div className="h-48 md:h-64 bg-slate-950/20 glass border border-white/10 overflow-hidden rounded-[2.5rem] relative shadow-2xl backdrop-blur-3xl">
                    {creatorProfile.cover ? (
                      <img src={creatorProfile.cover} alt="Cover" referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-1000" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-900/40 via-slate-900/40 to-purple-900/40" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
                    
                    <div className="absolute bottom-8 left-8 right-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                      <div className="flex items-center gap-6">
                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-[2.5rem] border-4 border-slate-950 overflow-hidden bg-slate-900 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                          <img src={creatorProfile.avatar} alt="Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <SplitText text={creatorProfile.name} className="text-2xl md:text-3xl font-black text-text-primary tracking-tight font-sans italic" />
                            <span className="px-3 py-1.5 rounded-full glass-morphism backdrop-blur-xl border border-white/20 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">Creator</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {creatorProfile.skills.map(skill => (
                              <span key={skill} className="px-3 py-1 rounded-lg glass border border-white/10 text-white font-sans italic text-[10px] font-bold shadow-sm">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setIsCreatorModalOpen(true)}
                          className="px-6 py-3 glass hover:bg-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 border border-white/5 shadow-xl hover:-translate-y-1"
                        >
                          <SettingsIcon size={18} />
                          Manage Realm
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 rounded-[2.5rem] border-2 border-dashed border-subtle bg-gradient-to-br from-indigo-500/5 to-purple-500/5 flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                    <Palette size={40} />
                  </div>
                  <div className="space-y-2">
                    <SplitText text="Showcase Your Creativity" className="text-2xl font-bold" />
                    <p className="text-text-secondary max-w-sm">Build a professional creator profile to highlight your skills in arts, programming, and content creation.</p>
                  </div>
                  <RippleButton 
                    onClick={() => setIsCreatorModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/20"
                  >
                    Get Started
                  </RippleButton>
                </div>
              )}
            </section>

            {/* Creator Directory */}
            <section className="space-y-8">
              <div className="px-4 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <SplitText text="Creator Directory" />
                    <p className="text-sm text-slate-500">Discover talented individuals across the creative spectrum.</p>
                  </div>
                </div>

                {/* Search and Filters */}
                <div className="flex flex-col gap-4">
                  {usersLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                      <SkeletonLoader type="group" count={6} />
                    </div>
                  ) : (
                    <>
                      {/* Search and Filters */}
                      <div className="flex items-center gap-3">
                        <div className="relative group flex-1 max-w-2xl">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors">
                            <Search size={18} />
                          </div>
                          <input 
                            type="text" 
                            placeholder="Search creators by name, handle, or bio..." 
                            value={creatorSearchQuery}
                            onChange={(e) => setCreatorSearchQuery(e.target.value)}
                            className="w-full bg-slate-900/50 border border-subtle rounded-full py-3 pl-12 pr-12 text-base focus:outline-none focus:bg-slate-900 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-text-secondary"
                          />
                          {creatorSearchQuery && (
                            <button 
                              onClick={() => setCreatorSearchQuery('')}
                              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-glass rounded-full text-text-secondary transition-colors"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                        <button 
                          onClick={() => {
                            if (!isCreatorFilterOpen) {
                              setPendingCreatorCategory(selectedCreatorCategory);
                              setPendingCreatorSkill(selectedCreatorSkill);
                              setPendingCreatorState(selectedCreatorState);
                              setPendingCreatorDistrict(selectedCreatorDistrict);
                              setPendingCreatorSortBy(creatorSortBy);
                              setPendingIsCreatorNearMeActive(isCreatorNearMeActive);
                            }
                            setIsCreatorFilterOpen(!isCreatorFilterOpen);
                          }}
                          className={`p-3 rounded-full border transition-all ${
                            isCreatorFilterOpen || selectedCreatorState !== 'All' || selectedCreatorDistrict !== 'All' || isCreatorNearMeActive || selectedCreatorCategory !== 'All' || selectedCreatorSkill !== 'All'
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' 
                              : 'bg-slate-900/50 border-subtle text-slate-400 hover:text-white hover:bg-slate-900'
                          }`}
                        >
                          <Filter size={18} />
                        </button>
                      </div>

                      <AnimatePresence>
                        {isCreatorFilterOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="glass-card border border-white/5 shadow-3xl !p-8 space-y-8 backdrop-blur-3xl animate-fadeIn">
                              {/* Category Filter */}
                              <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Search Categories</label>
                                  <div className="relative group/cat-search w-full sm:w-72">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/cat-search:text-indigo-500 transition-colors">
                                      <Search size={14} />
                                    </div>
                                    <input 
                                      type="text"
                                      placeholder="E.g. Chef, Developer..."
                                      value={creatorCategorySearch}
                                      onChange={(e) => setCreatorCategorySearch(e.target.value)}
                                      className="w-full glass-input rounded-xl py-2.5 pl-11 pr-11 text-xs transition-all text-white placeholder:text-slate-600 border-white/5 focus:border-indigo-500/30"
                                    />
                                    {creatorCategorySearch && (
                                      <button 
                                        onClick={() => setCreatorCategorySearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/10 rounded-full text-slate-500 hover:text-white transition-colors"
                                      >
                                        <X size={14} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2 scrollbar-hide py-1">
                                  {filteredCreatorCategories.map((cat) => (
                                    <button
                                      key={cat}
                                      onClick={() => setPendingCreatorCategory(cat)}
                                      className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${
                                        pendingCreatorCategory === cat
                                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]'
                                          : 'glass border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                                      }`}
                                    >
                                      {cat}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Skills Filter */}
                              {allSkills.length > 1 && (
                                <div className="space-y-3 pt-4 border-t border-white/5">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Skills</label>
                                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto no-scrollbar p-1">
                                    <button
                                      onClick={() => setPendingCreatorSkill('All')}
                                      className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border whitespace-nowrap ${
                                        pendingCreatorSkill === 'All'
                                          ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20'
                                          : 'bg-slate-950 border-subtle text-text-secondary hover:bg-slate-900'
                                      }`}
                                    >
                                      All Skills
                                    </button>
                                    {allSkills.map((skill) => (
                                      <button
                                        key={skill}
                                        onClick={() => setPendingCreatorSkill(skill)}
                                        className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border whitespace-nowrap ${
                                          pendingCreatorSkill === skill
                                            ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20'
                                            : 'bg-slate-950 border-subtle text-text-secondary hover:bg-slate-900'
                                        }`}
                                      >
                                        {skill}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="pt-4 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 text-center block">State</label>
                                  <select 
                                    value={pendingCreatorState}
                                    onChange={(e) => {
                                      setPendingCreatorState(e.target.value);
                                      setPendingCreatorDistrict('All');
                                    }}
                                    className="w-full bg-slate-950 border border-subtle rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                  >
                                    <option value="All">All of India</option>
                                    {INDIA_STATES.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 text-center block">District</label>
                                  <select 
                                    value={pendingCreatorDistrict}
                                    disabled={pendingCreatorState === 'All'}
                                    onChange={(e) => setPendingCreatorDistrict(e.target.value)}
                                    className="w-full bg-slate-950 border border-subtle rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                                  >
                                    <option value="All">All Districts</option>
                                    {pendingCreatorState !== 'All' && INDIA_STATES.find(s => s.name === pendingCreatorState)?.districts.map(d => (
                                      <option key={d} value={d}>{d}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 text-center block">Sort By</label>
                                  <div className="flex gap-1 p-1 bg-slate-950 rounded-xl border border-subtle">
                                    {[
                                      { id: 'newest', label: 'Newest' },
                                      { id: 'name', label: 'Name' },
                                      { id: 'distance', label: 'Nearest' }
                                    ].map(sort => (
                                      <button
                                        key={sort.id}
                                        onClick={() => setPendingCreatorSortBy(sort.id as any)}
                                        className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                                          pendingCreatorSortBy === sort.id ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                      >
                                        {sort.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col md:flex-row items-center gap-4 pt-4 border-t border-white/5">
                                <button
                                  onClick={() => setPendingIsCreatorNearMeActive(!pendingIsCreatorNearMeActive)}
                                  className={`px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border flex items-center gap-2 w-full md:w-auto justify-center ${
                                    pendingIsCreatorNearMeActive 
                                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                                      : 'bg-slate-950 border-subtle text-text-secondary hover:bg-slate-900/40'
                                  }`}
                                >
                                  <MapPin size={14} />
                                  Near Me Filter: {pendingIsCreatorNearMeActive ? 'ON' : 'OFF'}
                                </button>
                                
                                <div className="flex-1" />

                                <div className="flex items-center gap-3 w-full md:w-auto">
                                  <button
                                    onClick={() => setIsCreatorFilterOpen(false)}
                                    className="flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={applyCreatorFilters}
                                    className="flex-1 md:flex-none px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                                  >
                                    <Check size={14} />
                                    Apply Filters
                                  </button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-2">
                        {(() => {
                          const filtered = allCreators.filter(creator => {
                            const matchesSearch = creator.name.toLowerCase().includes(creatorSearchQuery.toLowerCase()) || 
                                                creator.handle.toLowerCase().includes(creatorSearchQuery.toLowerCase()) ||
                                                creator.bio.toLowerCase().includes(creatorSearchQuery.toLowerCase());
                            const matchesCategory = selectedCreatorCategory === 'All' || creator.category === selectedCreatorCategory;
                            const matchesSkill = selectedCreatorSkill === 'All' || (creator.skills && creator.skills.includes(selectedCreatorSkill));
                            
                            const matchesState = selectedCreatorState === 'All' || creator.state === selectedCreatorState;
                            const matchesDistrict = selectedCreatorDistrict === 'All' || creator.district === selectedCreatorDistrict;
                            
                            let proximityMatch = true;
                            if (isCreatorNearMeActive && userCoords && creator.latitude && creator.longitude) {
                              const dist = calculateDistance(userCoords.lat, userCoords.lng, creator.latitude, creator.longitude);
                              proximityMatch = dist <= 50; // 50km
                            } else if (isCreatorNearMeActive && !userCoords) {
                              proximityMatch = false; // Waiting for coords
                            }

                            return matchesSearch && matchesCategory && matchesSkill && matchesState && matchesDistrict && proximityMatch;
                          });

                          // Sorting
                          const sorted = [...filtered].sort((a, b) => {
                            if (creatorSortBy === 'name') return a.name.localeCompare(b.name);
                            if (creatorSortBy === 'distance' && userCoords) {
                              const distA = a.latitude && a.longitude ? calculateDistance(userCoords.lat, userCoords.lng, a.latitude, a.longitude) : Infinity;
                              const distB = b.latitude && b.longitude ? calculateDistance(userCoords.lat, userCoords.lng, b.latitude, b.longitude) : Infinity;
                              return distA - distB;
                            }
                            // Default newest
                            return (b.id || '').localeCompare(a.id || '');
                          });

                          if (sorted.length === 0) {
                            return (
                              <div className="col-span-full py-20 flex flex-col items-center text-center space-y-6">
                                <div className="w-20 h-20 rounded-[2rem] bg-slate-900/50 border border-subtle flex items-center justify-center text-slate-500">
                                  <Search size={40} />
                                </div>
                                <div className="space-y-2">
                                  <h3 className="text-xl font-bold text-white">No creators found</h3>
                                  <p className="text-slate-500 max-w-xs mx-auto">
                                    {creatorSearchQuery || selectedCreatorCategory !== 'All' || selectedCreatorState !== 'All' || isCreatorNearMeActive
                                      ? "We couldn't find any creators matching your current filters."
                                      : "There are no creators in the directory yet. Be the first to join!"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  {(creatorSearchQuery || selectedCreatorCategory !== 'All' || selectedCreatorSkill !== 'All' || selectedCreatorState !== 'All' || isCreatorNearMeActive) ? (
                                    <button 
                                      onClick={() => {
                                        setCreatorSearchQuery('');
                                        setSelectedCreatorCategory('All');
                                        setSelectedCreatorSkill('All');
                                        setSelectedCreatorState('All');
                                        setSelectedCreatorDistrict('All');
                                        setIsCreatorNearMeActive(false);
                                      }}
                                      className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-sm transition-all border border-white/10"
                                    >
                                      Clear all filters
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={() => setIsCreatorModalOpen(true)}
                                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20"
                                    >
                                      Create Profile
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          return sorted.map((creator, idx) => (
                            <motion.div 
                              key={`${creator.id}-${idx}`}
                              whileHover={{ y: -8 }}
                              className="group relative"
                              onClick={() => handleViewProfile(creator)}
                            >
                              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/30 to-purple-500/30 rounded-[2.5rem] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                              <div className="relative glass-card !p-0 overflow-hidden border border-white/5 bg-slate-950/20 backdrop-blur-3xl hover:border-indigo-500/20 shadow-2xl transition-all duration-500 rounded-[2.5rem]">
                                <div className="h-32 bg-slate-900 absolute inset-x-0 top-0 overflow-hidden z-0">
                                  {creator.cover ? (
                                    <img src={creator.cover} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-60 group-hover:scale-125 transition-transform duration-1000" />
                                  ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-indigo-950/40 via-slate-900/40 to-purple-950/40" />
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                                </div>
                                
                                <div className="p-6 pt-24 relative z-10 flex flex-col h-full">
                                  <div className="flex items-end justify-between mb-4">
                                    <div className="w-24 h-24 rounded-[1.75rem] border-4 border-slate-950/80 overflow-hidden bg-slate-900 shadow-[0_0_30px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-transform duration-500">
                                      <img src={creator.avatar} alt={creator.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="pb-1">
                                      <motion.button 
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleFollowCreator(creator.id);
                                        }}
                                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                          (userProfile?.followedCreatorIds || []).includes(creator.id)
                                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                            : 'bg-white text-black hover:bg-slate-200 shadow-xl'
                                        }`}
                                      >
                                        {(userProfile?.followedCreatorIds || []).includes(creator.id) ? 'Following' : 'Follow'}
                                      </motion.button>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-4 flex-1">
                                    <div className="space-y-1.5">
                                      <div className="flex flex-col">
                                        <h4 className="font-black text-white text-xl tracking-tight leading-tight italic font-sans">{creator.name.toLowerCase()}</h4>
                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest opacity-80">{creator.handle}</span>
                                      </div>
                                      <p className="text-[11px] text-slate-400 font-medium line-clamp-2 leading-relaxed h-8 italic">
                                        "{creator.bio}"
                                      </p>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-1.5">
                                      {creator.skills.slice(0, 3).map(skill => (
                                        <span key={skill} className="px-2.5 py-1 rounded-lg glass border border-white/10 text-white text-[9px] font-black uppercase tracking-widest hover:border-white/20 transition-colors">
                                          {skill}
                                        </span>
                                      ))}
                                      {creator.skills.length > 3 && (
                                        <span className="px-2.5 py-1 rounded-lg glass border border-white/5 text-slate-500 text-[9px] font-black">
                                          +{creator.skills.length - 3}
                                        </span>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center justify-between pt-5 border-t border-white/5 mt-auto">
                                      <div className="flex items-center gap-4">
                                        {creator.links.github && (
                                          <a href={creator.links.github} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                            <Github size={16} className="text-slate-500 hover:text-indigo-400 transition-colors" />
                                          </a>
                                        )}
                                        {creator.links.twitter && (
                                          <a href={creator.links.twitter} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                            <Twitter size={16} className="text-slate-500 hover:text-indigo-400 transition-colors" />
                                          </a>
                                        )}
                                        {creator.links.instagram && (
                                          <a href={creator.links.instagram} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                            <Instagram size={16} className="text-slate-500 hover:text-indigo-400 transition-colors" />
                                          </a>
                                        )}
                                      </div>
                                      <div className="px-2 py-0.5 glass rounded text-[8px] font-black uppercase tracking-widest text-slate-400 border border-white/5">
                                        {creator.category}
                                      </div>
                                    </div>
         
                                    {creator.hourlyRate && creator.hourlyRate > 0 && (
                                      <div className="pt-4 flex items-center justify-between border-t border-white/5 mt-2">
                                        <div className="flex flex-col">
                                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rate</span>
                                          <span className="text-xs font-black text-emerald-400">₹{creator.hourlyRate}/hr</span>
                                        </div>
                                        <motion.button
                                          whileHover={{ scale: 1.05 }}
                                          whileTap={{ scale: 0.95 }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleStartChat({
                                              id: creator.id,
                                              name: creator.name,
                                              handle: creator.handle,
                                              avatar: creator.avatar
                                            });
                                          }}
                                          className="px-5 py-1.5 glass bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-emerald-500/20 shadow-xl flex items-center gap-2"
                                        >
                                          <ShoppingBag size={14} />
                                          Hire
                                        </motion.button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ));
                        })()}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>
          </motion.div>
        );
      case 'settings':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full"
          >
            <Settings 
              userRole={userRole} 
              registerBackHandler={registerBackHandler} 
              onEditProfile={() => setIsEditModalOpen(true)}
            />
          </motion.div>
        );
      case 'post-details':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-full max-w-none pb-20"
          >
            <div className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-3xl border-b border-white/10 px-3 py-3 flex items-center gap-6">
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  setActiveTab(previousTab);
                  setSelectedPost(null);
                }}
                className="p-2 hover:bg-white/10 rounded-full text-text-primary transition-all"
              >
                <ArrowLeft size={20} />
              </motion.button>
              <h2 className="text-xl font-bold text-text-primary tracking-tight">Post</h2>
            </div>
            {selectedPost && (
              <div className="px-0">
                <PostFeed 
                  userRole={userRole} 
                  userProfile={userProfile}
                  onViewProfile={handleViewProfile} 
                  handleStartChat={handleStartChat}
                  singlePostId={selectedPost.id}
                  posts={posts}
                  setPosts={setPosts}
                  onPostDeleted={handlePostDeleted}
                  enableClickToView={true}
                  enableHoldToView={false}
                />
              </div>
            )}
          </motion.div>
        );
      case 'search':
        const trendingTopics = [
          { tag: 'BGMI', posts: '12.5k', category: 'Gaming' },
          { tag: 'IPL2024', posts: '45k', category: 'Sports' },
          { tag: 'StreetFood', posts: '8.2k', category: 'Food' },
          { tag: 'StockMarketIndia', posts: '15k', category: 'Finance' },
          { tag: 'UPSCPrep', posts: '22k', category: 'Education' }
        ];

        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8 pb-24"
          >
            <div className="glass-card !p-8 space-y-6">
              <div className="space-y-2">
                <SplitText text="Discover" className="text-3xl font-black tracking-tight text-primary" />
                <p className="text-text-secondary">Find people, academies, and business opportunities.</p>
              </div>
              
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="relative search-container flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={handleSearchInputChange}
                      onKeyDown={handleSearchKeyDown}
                      onFocus={() => setShowSearchSuggestions(true)}
                      placeholder="Search by name, handle, or keywords..." 
                      className="w-full bg-white/5 border border-subtle rounded-2xl py-4 pl-12 pr-4 text-lg focus:outline-none focus:border-indigo-500 transition-all text-text-primary"
                    />

                    {/* Suggestions Dropdown */}
                    <AnimatePresence>
                      {showSearchSuggestions && searchSuggestions.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute w-full mt-2 bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-50"
                        >
                          {searchSuggestions.map((suggestion, index) => {
                            const matchStart = suggestion.toLowerCase().indexOf(searchQuery.toLowerCase());
                            const matchEnd = matchStart + searchQuery.length;
                            
                            return (
                              <button
                                key={`${suggestion}-${index}`}
                                onClick={() => handleSearchSuggestionClick(suggestion)}
                                onMouseEnter={() => setSelectedSearchIndex(index)}
                                className={`w-full px-6 py-4 text-left transition-all duration-200 flex items-center gap-3
                                  ${index === selectedSearchIndex ? 'bg-indigo-500/20 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}
                                `}
                              >
                                <Search size={16} className="text-slate-500" />
                                <span className="text-sm font-medium">
                                  {matchStart > 0 && suggestion.slice(0, matchStart)}
                                  <span className="text-indigo-400 font-bold">
                                    {suggestion.slice(matchStart, matchEnd)}
                                  </span>
                                  {suggestion.slice(matchEnd)}
                                </span>
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsSearchFilterOpen(!isSearchFilterOpen)}
                    className={`p-4 rounded-2xl border transition-all ${
                      isSearchFilterOpen || searchFilterRole !== 'all' || searchFilterCategory !== 'All' || searchFilterState !== 'All' || searchFilterDistrict !== 'All'
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                        : 'bg-white/5 border-subtle text-text-secondary hover:text-text-primary hover:bg-white/10'
                    }`}
                  >
                    <Filter size={24} />
                  </motion.button>
                </div>

                {/* Advanced Filter Panel */}
                <AnimatePresence>
                  {isSearchFilterOpen && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-white/5 border border-indigo-500/20 rounded-2xl p-6 space-y-6 mt-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          {/* Role Filter */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary ml-1">Role</label>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: 'all', label: 'All' },
                                { id: 'people', label: 'People' },
                                { id: 'creator', label: 'Creators' },
                                { id: 'business', label: 'Businesses' }
                              ].map(role => (
                                <button
                                  key={role.id}
                                  onClick={() => setSearchFilterRole(role.id as any)}
                                  className={`py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${
                                    searchFilterRole === role.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-subtle text-text-secondary hover:bg-slate-900'
                                  }`}
                                >
                                  {role.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Category Filter */}
                          <div className="space-y-2 lg:col-span-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary ml-1">Category</label>
                            <select 
                              value={searchFilterCategory}
                              onChange={(e) => setSearchFilterCategory(e.target.value)}
                              className="w-full bg-slate-950 border border-subtle rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                            >
                              <option value="All">All Categories</option>
                              {CREATOR_CATEGORIES.filter(c => c !== 'All').map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>

                          {/* State Filter */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary ml-1">State</label>
                            <select 
                              value={searchFilterState}
                              onChange={(e) => {
                                setSearchFilterState(e.target.value);
                                setSearchFilterDistrict('All');
                              }}
                              className="w-full bg-slate-950 border border-subtle rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                            >
                              <option value="All">All Regions</option>
                              {INDIA_STATES.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                            </select>
                          </div>

                          {/* District Filter */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary ml-1">District</label>
                            <select 
                              value={searchFilterDistrict}
                              disabled={searchFilterState === 'All'}
                              onChange={(e) => setSearchFilterDistrict(e.target.value)}
                              className="w-full bg-slate-950 border border-subtle rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="All">All Districts</option>
                              {searchFilterState !== 'All' && INDIA_STATES.find(s => s.name === searchFilterState)?.districts.map(d => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                          <p className="text-[10px] text-slate-500 font-medium">
                            {filteredCreators.length + filteredBusinesses.length + filteredUsers.length} Results Matching
                          </p>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => {
                                setSearchFilterRole('all');
                                setSearchFilterCategory('All');
                                setSearchFilterState('All');
                                setSearchFilterDistrict('All');
                              }}
                              className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                            >
                              Reset
                            </button>
                            <button 
                              onClick={() => setIsSearchFilterOpen(false)}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {!searchQuery && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <section className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 px-4">Trending for you</h3>
                    <div className="glass-card divide-y divide-white/5 !p-0 overflow-hidden">
                      {trendingTopics.map((topic) => (
                        <button 
                          key={topic.tag}
                          onClick={() => setSearchQuery(topic.tag)}
                          className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left group"
                        >
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{topic.category} · Trending</p>
                            <p className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors">#{topic.tag}</p>
                            <p className="text-xs text-slate-500">{topic.posts} posts</p>
                          </div>
                          <Sparkles size={16} className="text-slate-600 group-hover:text-indigo-500 transition-colors" />
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 px-4">Suggested Creators</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {allCreators.slice(0, 4).map(creator => (
                        <motion.div 
                          key={creator.id}
                          whileHover={{ y: -4 }}
                          onClick={() => handleViewProfile(creator)}
                          className="glass-card flex items-center gap-4 cursor-pointer hover:border-indigo-500/30 transition-all"
                        >
                          <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10">
                            <img src={creator.avatar} alt={creator.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-white text-sm">{creator.name.toLowerCase()}</h4>
                            <p className="text-[10px] text-indigo-400 font-medium">{creator.handle}</p>
                          </div>
                          <Plus size={16} className="text-slate-500" />
                        </motion.div>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="space-y-8">
                  <section className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 px-4">Who to follow</h3>
                    <div className="glass-card space-y-4">
                      {allCreators.slice(4, 7).map(creator => (
                        <div key={creator.id} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img src={creator.avatar} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded-lg object-cover" />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white truncate">{creator.name.toLowerCase()}</p>
                              <p className="text-[10px] text-slate-500 truncate">{creator.handle}</p>
                            </div>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFollowCreator(creator.id);
                            }}
                            className="px-3 py-1 bg-white text-black text-[10px] font-bold rounded-full hover:bg-slate-200 transition-colors"
                          >
                            Follow
                          </button>
                        </div>
                      ))}
                      <button className="w-full pt-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors text-left">
                        Show more
                      </button>
                    </div>
                  </section>
                </div>
              </div>
            )}

            {/* Results */}
            {searchQuery && (
              <div className="space-y-6">
              {(filteredCreators.length > 0 || filteredBusinesses.length > 0 || filteredUsers.length > 0) ? (
                <>
                  {filteredUsers.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">People ({filteredUsers.length})</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredUsers.map((u, idx) => (
                          <motion.div 
                            key={`${u.id}-${idx}`}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={() => handleViewProfile(u as any)}
                            className="glass-card group cursor-pointer hover:border-indigo-500/50 transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10">
                                <img src={u.avatar} alt={u.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-white truncate">{u.name}</h4>
                                <p className="text-xs text-indigo-400 font-medium">{u.handle}</p>
                              </div>
                              <div className="p-2 bg-white/5 text-slate-500 rounded-lg">
                                <User size={16} />
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredCreators.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Creators ({filteredCreators.length})</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredCreators.map((creator, idx) => (
                          <motion.div 
                            key={`${creator.id}-${idx}`}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={() => handleViewProfile(creator)}
                            className="glass-card group cursor-pointer hover:border-indigo-500/50 transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10">
                                <img src={creator.avatar} alt={creator.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-white">{creator.name.toLowerCase()}</h4>
                                <p className="text-xs text-indigo-400 font-medium">{creator.handle}</p>
                              </div>
                              <motion.button 
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFollowCreator(creator.id);
                                }}
                                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                                  (userProfile?.followedCreatorIds || []).includes(creator.id)
                                    ? 'bg-white/10 text-white border border-white/20'
                                    : 'bg-white text-black hover:bg-slate-200'
                                }`}
                              >
                                {(userProfile?.followedCreatorIds || []).includes(creator.id) ? 'Following' : 'Follow'}
                              </motion.button>
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {creator.links.github && (
                                  <a href={creator.links.github} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                    <Github size={12} className="text-slate-500 hover:text-white transition-colors" />
                                  </a>
                                )}
                                {creator.links.twitter && (
                                  <a href={creator.links.twitter} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                    <Twitter size={12} className="text-slate-500 hover:text-white transition-colors" />
                                  </a>
                                )}
                                {creator.links.instagram && (
                                  <a href={creator.links.instagram} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                    <Instagram size={12} className="text-slate-500 hover:text-white transition-colors" />
                                  </a>
                                )}
                              </div>
                              {creator.links.website && (
                                <a 
                                  href={creator.links.website} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[10px] font-bold text-slate-500 hover:text-indigo-400 transition-colors"
                                >
                                  Website
                                </a>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredBusinesses.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Businesses ({filteredBusinesses.length})</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredBusinesses.map((biz, idx) => (
                          <motion.div 
                            key={`${biz.id}-${idx}`}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="glass-card group cursor-pointer hover:border-indigo-500/50 transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10">
                                <img src={biz.logo} alt={biz.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-white">{biz.name.toLowerCase()}</h4>
                                <p className="text-xs text-slate-500 font-medium truncate">{biz.bio}</p>
                              </div>
                              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                                <Briefcase size={16} />
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500">
                    <Search size={32} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold">No results found</h3>
                    <p className="text-slate-500 text-sm">Try adjusting your filters or search query.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setSearchQuery('');
                      setSearchFilterRole('all');
                      setSearchFilterCategory('All');
                      setSearchFilterState('All');
                      setSearchFilterDistrict('All');
                    }}
                    className="text-indigo-400 font-bold text-sm hover:underline"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      );
    case 'profile':
        if (profileLoading) {
          return (
            <div className="max-w-3xl mx-auto">
              <SkeletonLoader type="profile" />
              <div className="px-4 md:px-8 space-y-6">
                <SkeletonLoader type="post" count={3} />
              </div>
            </div>
          );
        }

        const displayProfile = viewingUser || userProfile || {
          name: 'New User',
          handle: '@user',
          bio: '',
          location: '',
          website: '',
          avatar: 'https://i.pravatar.cc/150?u=user',
          cover: null
        };
        const isOwnProfile = !viewingUser || (userProfile && viewingUser.handle === userProfile.handle);

        return (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full pb-20"
          >
            {/* Header / Cover Photo */}
            <div className="relative">
              <div className="h-48 md:h-64 bg-slate-900 border-b border-white/10 overflow-hidden rounded-t-[2.5rem] relative group">
                {displayProfile.cover ? (
                  <img 
                    src={displayProfile.cover} 
                    alt="Cover" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                    <Sparkles className="text-white/10 w-20 h-20" />
                  </div>
                )}
                {!isOwnProfile && (
                  <button 
                    onClick={() => setViewingUser(null)}
                    className="absolute top-4 left-4 p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-all z-10"
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
              </div>
              
              {/* Profile Info Section */}
              <div className="px-4 md:px-8 relative">
                <div className="flex justify-between items-end -mt-12 md:-mt-16 mb-4">
                  <div className="relative group">
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-slate-950 overflow-hidden bg-slate-900 shadow-2xl">
                      <img 
                        src={displayProfile.avatar} 
                        alt={displayProfile.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <SplitText text={displayProfile.name.toLowerCase()} className="text-3xl md:text-5xl font-black tracking-tighter text-text-primary leading-none" />
                      {displayProfile.isAdmin && (
                        <CheckCircle2 size={24} className="text-indigo-500 fill-indigo-500/10 flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-indigo-400/80 font-bold text-base md:text-lg tracking-tight lowercase">{displayProfile.handle}</p>
                  </div>

                  <p className="text-slate-200 text-sm md:text-base leading-relaxed max-w-xl whitespace-pre-wrap">
                    {displayProfile.bio}
                  </p>

                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-slate-500 text-sm">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={16} />
                      <span>{displayProfile.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <LinkIcon size={16} />
                      <a href={`https://${displayProfile.website}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">{displayProfile.website}</a>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon size={16} />
                      <span>Joined March 2024</span>
                    </div>
                  </div>

                  <div className="flex gap-6 pt-4">
                    <button className="hover:underline flex items-center gap-1.5 group">
                      <span className="font-black text-white">{displayProfile.followingCount || 0}</span>
                      <span className="text-slate-500 text-sm font-medium group-hover:text-slate-400 transition-colors">Following</span>
                    </button>
                    <button className="hover:underline flex items-center gap-1.5 group">
                      <span className="font-black text-white">{displayProfile.followersCount || 0}</span>
                      <span className="text-slate-500 text-sm font-medium group-hover:text-slate-400 transition-colors">Followers</span>
                    </button>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="flex flex-wrap gap-3 pt-6">
                    {isOwnProfile ? (
                      <>
                        <motion.button 
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setIsEditModalOpen(true)}
                          className="flex-1 md:flex-none px-6 py-3 rounded-2xl border border-white/20 font-bold hover:bg-white/5 transition-all text-sm md:text-base whitespace-nowrap flex items-center justify-center gap-2"
                        >
                          Edit profile
                        </motion.button>
                        <motion.button 
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setActiveTab('chat')}
                          className="flex-1 md:flex-none px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all text-sm md:text-base flex items-center gap-2 shadow-lg shadow-indigo-600/20 whitespace-nowrap justify-center"
                        >
                          <MessageSquare size={18} />
                          Messages
                        </motion.button>
                      </>
                    ) : (
                      <div className="flex items-center gap-3 w-full md:w-auto">
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => displayProfile.id && handleStartChat({
                            id: displayProfile.id,
                            name: displayProfile.name,
                            handle: displayProfile.handle,
                            avatar: displayProfile.avatar
                          })}
                          className="p-3.5 rounded-2xl border border-white/20 hover:bg-white/5 transition-all text-indigo-400 flex items-center justify-center"
                        >
                          <MessageSquare size={20} />
                        </motion.button>
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="p-3.5 rounded-2xl border border-white/20 hover:bg-white/5 transition-all text-slate-400 flex items-center justify-center"
                        >
                          <Bell size={20} />
                        </motion.button>
                        <motion.button 
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => displayProfile.id && toggleFollowCreator(displayProfile.id)}
                          className={`flex-1 md:flex-none px-8 py-3 rounded-2xl font-bold transition-all text-sm md:text-base whitespace-nowrap ${
                            displayProfile.id && (userProfile?.followedCreatorIds || []).includes(displayProfile.id)
                              ? 'bg-transparent text-white border border-white/20 hover:bg-white/5'
                              : 'bg-white text-black hover:bg-slate-200'
                          }`}
                        >
                          {displayProfile.id && (userProfile?.followedCreatorIds || []).includes(displayProfile.id) ? 'Following' : 'Follow'}
                        </motion.button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Profile Tabs */}
              <div className="mt-8 border-b border-white/10 flex items-center overflow-x-auto no-scrollbar">
                {['Posts', 'Replies', 'Media', 'Inspiration'].map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => setActiveProfileTab(tab)}
                    className={`px-6 py-4 text-sm font-black transition-all relative whitespace-nowrap ${
                      activeProfileTab === tab ? 'text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <span className="relative z-10">{tab}</span>
                    {activeProfileTab === tab && (
                      <motion.div 
                        layoutId="activeProfileTab"
                        className="absolute bottom-0 left-6 right-6 h-1 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Profile Feed */}
              <div className="mt-4">
                <PostFeed 
                  userRole={userRole} 
                  userProfile={userProfile}
                  filterHandle={displayProfile.handle}
                  onViewProfile={handleViewProfile}
                  handleStartChat={handleStartChat}
                  onViewPostDetails={handleViewPostDetails}
                  posts={posts}
                  setPosts={setPosts}
                  onPostDeleted={handlePostDeleted}
                  allUsers={allUsers}
                  viewMode={
                    activeProfileTab === 'Posts' ? 'posts' :
                    activeProfileTab === 'Media' ? 'media' :
                    activeProfileTab === 'Inspiration' ? 'inspiration' :
                    'replies'
                  }
                  enableClickToView={activeProfileTab === 'Media' || activeProfileTab === 'Inspiration'}
                  enableHoldToView={activeProfileTab === 'Media' || activeProfileTab === 'Inspiration'}
                />
              </div>
            </div>
          </motion.div>
        );
      case 'chat':
        return <ChatWindow userRole={userRole} allUsers={allUsers} initialTargetUser={activeChatUser} />;
      case 'notifications':
        return (
          <Notifications 
            notifications={notifications} 
            loading={notificationsLoading}
            onMarkAllAsRead={() => user && NotificationService.markAllAsRead(user.uid, notifications)}
            onMarkAsRead={(id) => user && NotificationService.markAsRead(user.uid, id)}
            onDelete={(id) => user && NotificationService.deleteNotification(user.uid, id)}
          />
        );
      case 'groups':
        return <Groups userRole={userRole} registerBackHandler={registerBackHandler} allUsers={allUsers} />;
      case 'workspace':
        return <CollaborativeWorkspace roomId="shared-main-doc" user={user} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
            <div className="w-20 h-20 rounded-3xl glass flex items-center justify-center text-slate-500">
              <Search size={40} />
            </div>
            <SplitText text="Coming Soon" className="text-2xl font-bold" />
            <p className="text-slate-400 max-w-md">We're working hard to bring the {activeTab} module to life. Stay tuned for updates!</p>
          </div>
        );
    }
  };

  const onProfileClick = useCallback(() => {
    setViewingUser(null);
    setActiveProfileTab('Posts');
    setActiveTab('profile');
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-h-screen bg-slate-950 text-text-primary"
    >
      {isFirstLoad && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10002] pointer-events-none flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-600/20">
              <Sparkles className="text-white w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-widest">Welcome Back</h2>
          </motion.div>
        </motion.div>
      )}
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        setIsCollapsed={setIsSidebarCollapsed} 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onProfileClick={onProfileClick}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
        userRole={userRole}
        setUserRole={setUserRole}
      />
      
      <main 
        className="flex-1 overflow-x-hidden pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8 relative"
      >
        {/* Slide to back gesture area */}
        <motion.div 
          className="fixed inset-y-0 left-0 w-10 z-[100] cursor-w-resize flex items-center justify-center pointer-events-auto"
          onPan={(e, info) => {
            if (info.offset.x > 0) {
              setBackIndicatorOpacity(Math.min(info.offset.x / 100, 0.8));
              setBackIndicatorX(Math.min(info.offset.x / 2, 40));
            }
          }}
          onPanEnd={(e, info) => {
            setBackIndicatorOpacity(0);
            setBackIndicatorX(0);
            if (info.offset.x > 80 && info.velocity.x > 100) {
              handleGlobalBack();
            }
          }}
        >
          <motion.div
            animate={{ opacity: backIndicatorOpacity, x: backIndicatorX }}
            className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white border border-white/20 shadow-2xl"
          >
            <ArrowLeft size={24} />
          </motion.div>
        </motion.div>

        {/* Persistent Global Header */}
        {!['post-details', 'profile', 'chat'].includes(activeTab) && (
          <header className="sticky top-0 z-40 glass border-b border-white/10 px-4 md:px-6 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 mb-4 md:mb-8 mx-2 sm:mx-6 mt-2 rounded-2xl shadow-xl shadow-black/20">
            <div className="w-full flex items-center justify-between gap-4 md:gap-6">
            <div className="flex items-center gap-3 md:gap-4">
              <button 
                onClick={() => setIsMobileSidebarOpen(true)}
                className="md:hidden p-2 glass-button rounded-xl text-slate-400 hover:text-white"
              >
                <Menu size={20} />
              </button>
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="hidden md:block p-2 glass-button rounded-xl text-slate-400 hover:text-white"
              >
                <Menu size={20} />
              </button>
              <div className="flex items-center gap-2">
                <motion.div 
                  className="w-10 h-10 flex items-center justify-center p-2 glass rounded-xl"
                  whileHover={{ rotate: 5, scale: 1.1 }}
                >
                  <img src="/logo.svg" alt="Logo" className="w-full h-full object-contain" />
                </motion.div>
                <h1 className="text-lg md:text-xl font-black tracking-tight text-text-primary font-sans italic">
                  MARK<span className="text-indigo-500 not-italic">1</span>
                </h1>
              </div>
              
              <div className="relative hidden lg:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="text" 
                  placeholder="Universal search..." 
                  className="glass-input md:w-64 lg:w-80"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              <div className="flex items-center gap-2">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab('chat')}
                  className="glass-button !p-2 rounded-xl text-slate-400 hover:text-indigo-400 transition-all relative group"
                >
                  <MessageSquare size={20} className="transition-transform group-hover:scale-110" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.button>
                
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setActiveTab('notifications');
                    setHasNotification(false);
                    setIsAnimating(false);
                  }}
                  className={`glass-button !p-2 rounded-xl transition-all relative group ${hasNotification ? 'text-indigo-400 border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 'text-slate-400 hover:text-white'}`}
                >
                  <div className={isAnimating ? 'animate-zigzag' : ''}>
                    <Bell size={20} className="transition-transform group-hover:scale-110" />
                  </div>
                  {hasNotification && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-slate-950 animate-bounce" />
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        </header>
      )}

        <div className="w-full px-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.02, y: -10 }}
              transition={{ 
                duration: 0.3, 
                ease: [0.23, 1, 0.32, 1] 
              }}
            >
              <Suspense fallback={
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                {renderContent()}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <BottomNav 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onProfileClick={onProfileClick}
        userRole={userRole} 
      />

      <PWAInstallPrompt />

      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[10001] bg-amber-500 text-black py-1 px-4 text-center text-xs font-bold flex items-center justify-center gap-2 shadow-lg"
          >
            <Globe size={14} className="animate-pulse" />
            You are currently offline. Some features may be limited.
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <ConfirmationModal
          isOpen={!!unfollowConfirmation}
          onClose={() => setUnfollowConfirmation(null)}
          onConfirm={confirmUnfollow}
          title="Unfollow Creator?"
          message={`Are you sure you want to unfollow ${
            allCreators.find(c => c.id === unfollowConfirmation)?.name || 
            (viewingUser?.id === unfollowConfirmation ? viewingUser.name : 'this creator')
          }? You won't see their updates in your inspiration feed.`}
          confirmText="Unfollow"
          isDangerous={true}
        />

        <AnimatePresence>
          {isEditModalOpen && userProfile && (
            <EditProfileModal 
              profile={userProfile} 
              onClose={() => setIsEditModalOpen(false)} 
              onSave={handleUpdateProfile} 
            />
          )}
          {isBusinessModalOpen && (
            <EditBusinessModal 
              profile={businessProfile} 
              onClose={() => setIsBusinessModalOpen(false)} 
              onSave={handleUpdateBusinessProfile} 
            />
          )}
          {isCreatorModalOpen && (
            <EditCreatorModal 
              profile={creatorProfile} 
              onClose={() => setIsCreatorModalOpen(false)} 
              onSave={handleUpdateCreatorProfile} 
            />
          )}
        </AnimatePresence>
      </Suspense>
    </motion.div>
  );
};
