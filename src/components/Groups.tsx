import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, Plus, Search, Globe, Lock, Shield, MoreHorizontal, MessageSquare, UserPlus, UserMinus, ArrowLeft, MessageCircle, Settings, X, Filter, ChevronDown, Trash2, AlertTriangle, Image as ImageIcon, Camera, Check, Users } from 'lucide-react';
import { GroupChat } from './GroupChat';
import { useAuth } from '../FirebaseProvider';
import { db, collection, addDoc, onSnapshot, query, orderBy, limit, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, handleFirestoreError, OperationType, collectionGroup, where } from '../firebase';

interface GroupMember {
  id: string;
  name: string;
  handle: string;
  role: 'member' | 'admin';
  avatar: string;
  status?: 'online' | 'offline';
}

import { RippleButton } from './RippleButton';
import { SplitText } from './SplitText';
import { ConfirmationModal } from './ConfirmationModal';
import { SkeletonLoader } from './SkeletonLoader';

interface Group {
  id: string;
  name: string;
  description: string;
  members: number;
  privacy: 'public' | 'private' | 'closed';
  coverImage: string;
  badge?: string;
  isJoined: boolean;
  category: string;
  ownerHandle: string;
  membersList: GroupMember[];
  rules?: string;
  hasUnreadMessages?: boolean;
}

interface GroupsProps {
  userRole: 'guest' | 'member' | 'admin';
  registerBackHandler?: (handler: () => boolean) => () => void;
  allUsers?: {id: string, name: string, handle: string, avatar: string}[];
}

export const Groups = React.memo(({ userRole, registerBackHandler, allUsers = [] }: GroupsProps) => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const activeGroup = groups.find(g => g.id === activeGroupId) || null;
  const [activeTab, setActiveTab] = useState<'chat' | 'members' | 'settings'>('chat');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [appliedCategory, setAppliedCategory] = useState('All');
  const [selectedPrivacy, setSelectedPrivacy] = useState('All');
  const [appliedPrivacy, setAppliedPrivacy] = useState('All');
  const [selectedMemberRange, setSelectedMemberRange] = useState('All');
  const [appliedMemberRange, setAppliedMemberRange] = useState('All');

  const handleApplyFilters = () => {
    setAppliedSearchQuery(searchQuery);
    setAppliedCategory(selectedCategory);
    setAppliedPrivacy(selectedPrivacy);
    setAppliedMemberRange(selectedMemberRange);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedPrivacy('All');
    setSelectedMemberRange('All');
    setAppliedSearchQuery('');
    setAppliedCategory('All');
    setAppliedPrivacy('All');
    setAppliedMemberRange('All');
  };
  
  const [showLeaveConfirm, setShowLeaveConfirm] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ id: string, name: string } | null>(null);
  const [memberActionConfirm, setMemberActionConfirm] = useState<{
    type: 'remove' | 'demote' | 'promote';
    groupId: string;
    memberId: string;
    memberName: string;
  } | null>(null);

  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    privacy: 'public' as 'public' | 'private' | 'closed',
    category: 'General',
    sport: '',
    rules: '',
    coverImage: '',
    badge: ''
  });

  const [editGroupData, setEditGroupData] = useState({
    name: '',
    description: '',
    coverImage: '',
    badge: '',
    privacy: 'public' as 'public' | 'private' | 'closed',
    rules: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [isPending, setIsPending] = useState<string[]>([]);

  const [showVisualMenu, setShowVisualMenu] = useState(false);
  const isCurrentUserAdmin = userRole === 'admin' || activeGroup?.membersList?.find(m => m.id === user?.uid)?.role === 'admin';

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const editFileInputRef = React.useRef<HTMLInputElement>(null);

  // Real-time groups listener
  useEffect(() => {
    if (authLoading || !user) return;
    
    const q = query(collection(db, 'academies'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const groupsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          isJoined: data.membersList?.some((m: any) => m.id === user?.uid) || false
        } as Group;
      });
      setGroups(groupsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'academies');
    });

    return () => unsubscribe();
  }, [authLoading, user?.uid]);

  // Listen for join requests if admin
  useEffect(() => {
    if (!activeGroupId || !isCurrentUserAdmin) {
      setJoinRequests([]);
      return;
    }

    const q = query(collection(db, 'academies', activeGroupId, 'joinRequests'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setJoinRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `academies/${activeGroupId}/joinRequests`);
    });

    return () => unsubscribe();
  }, [activeGroupId, isCurrentUserAdmin]);

  // Check pending status for current user
  useEffect(() => {
    if (!user) {
      setIsPending([]);
      return;
    }
    
    // Use collectionGroup for much better performance than individual listeners
    const q = query(
      collectionGroup(db, 'joinRequests'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pendingGroupIds = snapshot.docs.map(doc => {
        // The parent of the joinRequest document is the group document
        return doc.ref.parent.parent?.id;
      }).filter(Boolean) as string[];
      
      setIsPending(pendingGroupIds);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'group_join_requests');
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleCoverImageChange = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'create' | 'edit' | 'direct' = 'direct') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        if (mode === 'edit') {
          setEditGroupData(prev => ({ ...prev, coverImage: base64String }));
        } else if (mode === 'create') {
          setNewGroup(prev => ({ ...prev, coverImage: base64String }));
        } else if (activeGroupId) {
          try {
            const groupRef = doc(db, 'academies', activeGroupId);
            await updateDoc(groupRef, { coverImage: base64String });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `academies/${activeGroupId}`);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBadgeChange = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'create' | 'edit' | 'direct' = 'direct') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        if (mode === 'edit') {
          setEditGroupData(prev => ({ ...prev, badge: base64String }));
        } else if (mode === 'create') {
          setNewGroup(prev => ({ ...prev, badge: base64String }));
        } else if (activeGroupId) {
          try {
            const groupRef = doc(db, 'academies', activeGroupId);
            await updateDoc(groupRef, { badge: base64String });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `academies/${activeGroupId}`);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const POPULAR_SPORTS = [
    'Cricket', 'Football (Soccer)', 'Kabaddi', 'Field Hockey', 'Badminton', 
    'Tennis', 'Basketball', 'Rugby', 'Cycling', 'Table Tennis', 'Athletics'
  ];

  React.useEffect(() => {
    if (activeGroupId && registerBackHandler) {
      const unregister = registerBackHandler(() => {
        setActiveGroupId(null);
        return true;
      });
      return unregister;
    }
  }, [activeGroupId, registerBackHandler]);

  React.useEffect(() => {
    if (activeGroup && activeTab === 'settings') {
      setEditGroupData({
        name: activeGroup.name,
        description: activeGroup.description,
        coverImage: activeGroup.coverImage,
        badge: activeGroup.badge || '',
        privacy: activeGroup.privacy,
        rules: activeGroup.rules || ''
      });
    }
  }, [activeGroup?.id, activeTab]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile) return;

    setIsSaving(true);
    try {
      const finalCategory = (newGroup.category === 'Academy' || newGroup.category === 'Sports Clubs') && newGroup.sport
        ? `${newGroup.category}: ${newGroup.sport}`
        : newGroup.category;

      const groupData = {
        name: newGroup.name,
        description: newGroup.description,
        members: 1,
        privacy: newGroup.privacy,
        coverImage: newGroup.coverImage || `https://picsum.photos/seed/${newGroup.name}/800/400`,
        badge: newGroup.badge || `https://picsum.photos/seed/${newGroup.name}_badge/400/400`,
        category: finalCategory,
        rules: newGroup.rules,
        ownerHandle: userProfile.handle,
        ownerId: user.uid,
        adminIds: [user.uid],
        createdAt: serverTimestamp(),
        membersList: [
          { 
            id: user.uid, 
            name: userProfile.name, 
            handle: userProfile.handle, 
            role: 'admin', 
            avatar: userProfile.avatar, 
            status: 'online' 
          }
        ]
      };

      await addDoc(collection(db, 'academies'), groupData);
      setShowCreateModal(false);
      setNewGroup({ name: '', description: '', privacy: 'public', category: 'General', sport: '', rules: '' });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'academies');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroupId || !editGroupData.name || !user) return;

    setIsSaving(true);
    try {
      const groupRef = doc(db, 'academies', activeGroupId);
      await updateDoc(groupRef, {
        name: editGroupData.name,
        description: editGroupData.description,
        coverImage: editGroupData.coverImage || activeGroup?.coverImage,
        badge: editGroupData.badge || activeGroup?.badge || '',
        privacy: editGroupData.privacy,
        rules: editGroupData.rules
      });
      setShowEditModal(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `academies/${activeGroupId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = () => {
    if (!activeGroup) return;
    setEditGroupData({
      name: activeGroup.name,
      description: activeGroup.description,
      coverImage: activeGroup.coverImage,
      privacy: activeGroup.privacy,
      rules: activeGroup.rules || ''
    });
    setShowEditModal(true);
  };

  const toggleJoinGroup = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group || !user || !userProfile) return;

    if (group.isJoined) {
      setShowLeaveConfirm(groupId);
      return;
    }

    if (group.privacy === 'closed') {
      // Cannot join closed groups
      return;
    }

    if (group.privacy === 'private') {
      // Request to join
      if (isPending.includes(groupId)) {
        // Cancel request
        try {
          await deleteDoc(doc(db, 'academies', groupId, 'joinRequests', user.uid));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `academies/${groupId}/joinRequests/${user.uid}`);
        }
      } else {
        // Send request
        try {
          // Use setDoc with user.uid as the document ID for easy checking
          await setDoc(doc(db, 'academies', groupId, 'joinRequests', user.uid), {
            userId: user.uid,
            academyId: groupId,
            academyOwnerId: group.ownerId,
            userName: userProfile.name,
            userHandle: userProfile.handle,
            userAvatar: userProfile.avatar,
            timestamp: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `academies/${groupId}/joinRequests`);
        }
      }
      return;
    }

    performJoinLeave(groupId, true);
  };

  const handleApproveRequest = async (requestId: string, requestData: any) => {
    if (!activeGroupId || !activeGroup) return;
    
    try {
      const groupRef = doc(db, 'academies', activeGroupId);
      const newMembersList = [...activeGroup.membersList, {
        id: requestData.userId,
        name: requestData.userName,
        handle: requestData.userHandle,
        role: 'member' as const,
        avatar: requestData.userAvatar,
        status: 'offline' as const
      }];

      await updateDoc(groupRef, {
        members: activeGroup.members + 1,
        membersList: newMembersList
      });

      await deleteDoc(doc(db, 'academies', activeGroupId, 'joinRequests', requestId));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `academies/${activeGroupId}`);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!activeGroupId) return;
    try {
      await deleteDoc(doc(db, 'academies', activeGroupId, 'joinRequests', requestId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `academies/${activeGroupId}/joinRequests/${requestId}`);
    }
  };

  const performJoinLeave = async (groupId: string, isJoining: boolean) => {
    if (!user || !userProfile) return;

    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) return;

      const groupRef = doc(db, 'academies', groupId);
      let newMembersList = [...group.membersList];
      
      if (isJoining) {
        newMembersList.push({
          id: user.uid,
          name: userProfile.name,
          handle: userProfile.handle,
          role: 'member',
          avatar: userProfile.avatar,
          status: 'online'
        });
      } else {
        newMembersList = newMembersList.filter(m => m.id !== user.uid);
      }

      await updateDoc(groupRef, {
        members: isJoining ? group.members + 1 : Math.max(0, group.members - 1),
        membersList: newMembersList
      });

      if (!isJoining && groupId === activeGroupId) {
        setActiveGroupId(null);
      }
      
      setShowLeaveConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `academies/${groupId}`);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!user) return;
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'academies', groupId));
      setActiveGroupId(null);
      setShowDeleteConfirm(null);
      setShowEditModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `academies/${groupId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const promoteToAdmin = async (groupId: string, memberId: string) => {
    if (!user) return;
    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) return;

      const groupRef = doc(db, 'academies', groupId);
      const newMembersList = group.membersList.map(m => 
        m.id === memberId ? { ...m, role: 'admin' as const } : m
      );
      const newAdminIds = Array.from(new Set([...(group.adminIds || []), memberId]));

      await updateDoc(groupRef, { 
        membersList: newMembersList,
        adminIds: newAdminIds
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `academies/${groupId}`);
    }
  };

  const demoteFromAdmin = async (groupId: string, memberId: string) => {
    if (!user) return;
    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) return;

      const groupRef = doc(db, 'academies', groupId);
      const newMembersList = group.membersList.map(m => 
        m.id === memberId ? { ...m, role: 'member' as const } : m
      );
      const newAdminIds = (group.adminIds || []).filter((id: string) => id !== memberId);

      await updateDoc(groupRef, { 
        membersList: newMembersList,
        adminIds: newAdminIds
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `academies/${groupId}`);
    }
  };

  const removeMember = async (groupId: string, memberId: string) => {
    if (!user) return;
    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) return;

      const groupRef = doc(db, 'academies', groupId);
      const newMembersList = group.membersList.filter(m => m.id !== memberId);

      await updateDoc(groupRef, {
        members: Math.max(0, group.members - 1),
        membersList: newMembersList
      });

      if (memberId === user.uid && groupId === activeGroupId) {
        setActiveGroupId(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `academies/${groupId}`);
    }
  };

  const categories = useMemo(() => ['All', ...Array.from(new Set(groups.map(g => g.category)))], [groups]);
  const privacyOptions = ['All', 'Public', 'Private', 'Closed'];
  const memberRanges = ['All', '< 100', '100-1000', '> 1000'];

  const filteredGroups = useMemo(() => groups.filter(g => {
    const matchesSearch = g.name.toLowerCase().includes(appliedSearchQuery.toLowerCase()) ||
                         g.category.toLowerCase().includes(appliedSearchQuery.toLowerCase());
    const matchesCategory = appliedCategory === 'All' || g.category === appliedCategory;
    const matchesPrivacy = appliedPrivacy === 'All' || g.privacy === appliedPrivacy.toLowerCase();
    
    let matchesMembers = true;
    if (appliedMemberRange === '< 100') matchesMembers = g.members < 100;
    else if (appliedMemberRange === '100-1000') matchesMembers = g.members >= 100 && g.members <= 1000;
    else if (appliedMemberRange === '> 1000') matchesMembers = g.members > 1000;

    return matchesSearch && matchesCategory && matchesPrivacy && matchesMembers;
  }), [groups, appliedSearchQuery, appliedCategory, appliedPrivacy, appliedMemberRange]);

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchSuggestions = useMemo(() => {
    if (!searchQuery || !isSearchFocused) return [];
    return groups
      .filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .slice(0, 5);
  }, [groups, searchQuery, isSearchFocused]);

  return (
    <>
      {activeGroup ? (
        <motion.div 
          key="group-details"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`${activeTab === 'chat' ? 'pb-0 space-y-4' : 'pb-20 space-y-6'}`}
        >        <button 
          onClick={() => setActiveGroupId(null)}
          className="group flex items-center gap-4 text-text-secondary hover:text-text-primary transition-all mb-10"
        >
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-900/50 border border-white/5 group-hover:border-indigo-500/30 group-hover:bg-indigo-500/5 transition-all shadow-lg backdrop-blur-md">
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </div>
          <div className="flex flex-col">
            <span className="font-black uppercase tracking-[0.3em] text-[9px] text-indigo-400/80 mb-0.5">Navigation</span>
            <span className="font-bold text-sm tracking-tight">Back to Groups</span>
          </div>
        </button>

        <div className="relative h-56 md:h-80 rounded-[2rem] overflow-hidden border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] group/hero transition-all duration-700 ease-out">
          <motion.img 
            initial={{ scale: 1.1, filter: 'blur(10px)' }}
            animate={{ scale: 1, filter: 'blur(0px)' }}
            whileHover={{ scale: 1.03 }}
            transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
            src={activeGroup.coverImage} 
            alt={activeGroup.name} 
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-1000" 
          />
          
          {isCurrentUserAdmin && (
            <div className="absolute bottom-4 right-4 z-40">
              <div className="relative">
                <button 
                  onClick={() => setShowVisualMenu(!showVisualMenu)}
                  className="w-10 h-10 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md flex items-center justify-center transition-all hover:scale-110 active:scale-95 border border-white/10"
                  title="Edit Visuals"
                >
                  <Camera size={18} className="opacity-80" />
                </button>

                <AnimatePresence>
                  {showVisualMenu && (
                    <>
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowVisualMenu(false)}
                        className="fixed inset-0 z-40"
                      />
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10, x: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10, x: 10 }}
                        className="absolute bottom-full right-0 mb-3 w-48 bg-slate-900/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl"
                      >
                        <div className="p-1.5 space-y-1">
                          <button 
                            onClick={() => {
                              setShowVisualMenu(false);
                              fileInputRef.current?.click();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-text-primary hover:bg-white/5 rounded-xl transition-all text-left group/item"
                          >
                            <ImageIcon size={14} className="text-indigo-400" />
                            <span>Change Cover</span>
                          </button>
                          <button 
                            onClick={() => {
                              setShowVisualMenu(false);
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.onchange = (e: any) => handleBadgeChange(e, 'direct');
                              input.click();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-text-primary hover:bg-white/5 rounded-xl transition-all text-left group/item"
                          >
                            <Shield size={14} className="text-purple-400" />
                            <span>Update Badge</span>
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={(e) => handleCoverImageChange(e)}
          />
        </div>

        <div className="relative z-30 px-4 md:px-8 flex flex-col md:flex-row md:items-end justify-between gap-6 -mt-14 pb-8 border-b border-subtle">
          <div className="flex flex-col md:flex-row md:items-end gap-6">
            {/* Academy Badge */}
            <div className="relative group/badge shrink-0">
              <div className="w-28 h-28 md:w-36 md:h-36 rounded-[2rem] bg-slate-900 border-4 border-slate-950 overflow-hidden shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] transition-all duration-500 group-hover/badge:scale-[1.05] group-hover/badge:rotate-1">
                <img 
                  src={activeGroup.badge || `https://picsum.photos/seed/${activeGroup.id}/400/400`} 
                  alt={activeGroup.name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            <div className="space-y-4 mb-1">
              <div className="flex items-center gap-4">
                <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-text-primary leading-none">
                  {activeGroup.name}
                </h1>
                <div className="p-2 bg-glass rounded-2xl border border-subtle backdrop-blur-md">
                  {activeGroup.privacy === 'public' ? (
                    <Globe size={18} className="text-indigo-400" />
                  ) : (
                    <Lock size={18} className="text-amber-400" />
                  )}
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/10 text-[10px] font-black uppercase tracking-widest">
                  <GraduationCap size={14} />
                  {activeGroup.category}
                </span>
                
                <div className="h-8 w-px bg-white/5 hidden md:block" />

                <div className="flex items-center gap-6">
                  {/* Quick Insights */}
                  <div className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                      {activeGroup.privacy === 'public' ? <Globe size={14} /> : activeGroup.privacy === 'private' ? <Lock size={14} /> : <Shield size={14} />}
                    </div>
                    <div>
                      <p className="text-[7px] font-black uppercase tracking-[0.2em] text-text-secondary">Privacy</p>
                      <p className="text-[10px] font-bold text-text-primary capitalize">{activeGroup.privacy}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                      <Users size={14} />
                    </div>
                    <div>
                      <p className="text-[7px] font-black uppercase tracking-[0.2em] text-text-secondary">Members</p>
                      <p className="text-[10px] font-bold text-text-primary">{activeGroup.members.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {/* Academy Rules - Simplified */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 md:px-8"
          >
            <div className="flex gap-4 p-4 rounded-3xl bg-slate-900/40 border border-subtle">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20 shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div className="space-y-1">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-text-secondary">Academy Rules</p>
                <p className="text-[11px] text-text-secondary font-medium leading-relaxed max-w-2xl">
                  {activeGroup.rules || "Be respectful, stay active, and share your passion with the academy."}
                </p>
              </div>
            </div>
          </motion.div>

          <div className={`${activeTab === 'chat' ? 'space-y-4' : 'space-y-6'}`}>
            {/* Tab Switcher - Modern Segmented Style */}
            <div className="flex items-center p-1 bg-glass rounded-2xl w-full sm:w-fit border border-subtle overflow-x-auto scrollbar-hide">
              {[
                { id: 'chat', label: 'Chat', icon: MessageCircle },
                { id: 'members', label: 'Members', icon: GraduationCap },
                ...(activeGroup.isJoined ? [{ id: 'settings', label: 'Settings', icon: Settings }] : [])
              ].map((tab) => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`relative flex items-center gap-2 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl group ${
                    activeTab === tab.id 
                      ? 'text-white bg-indigo-600 shadow-lg shadow-indigo-600/20' 
                      : 'text-text-secondary hover:text-text-primary hover:bg-glass'
                  }`}
                >
                  <tab.icon size={14} className={`transition-transform duration-300 ${activeTab === tab.id ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'chat' ? (
                <motion.div 
                  key="chat"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full"
                >
                  <GroupChat 
                    groupId={activeGroup.id} 
                    groupName={activeGroup.name} 
                    userRole={userRole} 
                    allUsers={allUsers}
                  />
                </motion.div>
              ) : activeTab === 'members' ? (
                <motion.div 
                  key="members"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="glass-card !p-6 space-y-6 rounded-[2rem] border-subtle bg-slate-900/20 backdrop-blur-3xl"
                >
                  <div className="flex items-center justify-between border-b border-subtle pb-4">
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-text-primary">Academy Members</h3>
                      <p className="text-[10px] text-text-secondary font-bold uppercase tracking-[0.2em] mt-1">Manage and view participants</p>
                    </div>
                    <div className="px-4 py-2 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                      <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">{activeGroup.membersList.length} Total</span>
                    </div>
                  </div>

                  {isCurrentUserAdmin && joinRequests.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 ml-1">Join Requests ({joinRequests.length})</h4>
                      <div className="grid grid-cols-1 gap-3">
                        {joinRequests.map((request) => (
                          <div key={request.id} className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                            <div className="flex items-center gap-3">
                              <img src={request.userAvatar} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded-xl object-cover" />
                              <div>
                                <p className="text-sm font-bold text-text-primary">{request.userName}</p>
                                <p className="text-[10px] text-slate-500">{request.userHandle}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleApproveRequest(request.id, request)}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                              >
                                Approve
                              </button>
                              <button 
                                onClick={() => handleRejectRequest(request.id)}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 gap-3">
                    {activeGroup.membersList.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 rounded-2xl bg-glass border border-subtle hover:border-glass-border hover:bg-slate-900/40 transition-all group/member">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-xl overflow-hidden border border-glass-border shadow-lg">
                              <img src={member.avatar} alt={member.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            </div>
                            <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-[3px] border-slate-950 ${member.status === 'online' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-slate-600'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-black text-text-primary">{member.name}</p>
                              {member.role === 'admin' && (
                                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-[8px] font-black uppercase tracking-widest rounded-full border border-indigo-500/30">
                                  Admin
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">{member.handle}</p>
                          </div>
                        </div>

                        {isCurrentUserAdmin && member.id !== user?.uid && (
                          <div className="flex items-center gap-2 opacity-0 group-hover/member:opacity-100 transition-opacity">
                            {member.role !== 'admin' ? (
                              <button 
                                onClick={() => setMemberActionConfirm({
                                  type: 'promote',
                                  groupId: activeGroup.id,
                                  memberId: member.id,
                                  memberName: member.name
                                })}
                                className="px-3 py-1.5 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                              >
                                Promote
                              </button>
                            ) : (
                              <button 
                                onClick={() => setMemberActionConfirm({
                                  type: 'demote',
                                  groupId: activeGroup.id,
                                  memberId: member.id,
                                  memberName: member.name
                                })}
                                className="px-3 py-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                              >
                                Demote
                              </button>
                            )}
                            <button 
                              onClick={() => setMemberActionConfirm({
                                type: 'remove',
                                groupId: activeGroup.id,
                                memberId: member.id,
                                memberName: member.name
                              })}
                              className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="settings"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="glass-card !p-6 space-y-6 rounded-[2rem] border-subtle bg-slate-900/20 backdrop-blur-3xl"
                >
                  <div className="flex items-center justify-between border-b border-subtle pb-4">
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-text-primary">{isCurrentUserAdmin ? "Academy Settings" : "Academy Options"}</h3>
                      <p className="text-[9px] text-text-secondary font-bold uppercase tracking-[0.2em] mt-0.5">Configure your academy experience</p>
                    </div>
                    <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                      <Settings size={20} />
                    </div>
                  </div>

                  {isCurrentUserAdmin ? (
                    <form 
                      onSubmit={handleEditGroup} 
                      className="space-y-6"
                    >
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">Academy Name</label>
                            <div className="relative group">
                              <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-indigo-500 transition-colors" size={16} />
                              <input 
                                required
                                type="text" 
                                value={editGroupData.name}
                                onChange={(e) => setEditGroupData({ ...editGroupData, name: e.target.value })}
                                className="w-full bg-glass border border-subtle rounded-xl py-2 pl-11 pr-4 focus:outline-none focus:border-indigo-500/50 focus:bg-slate-900/40 transition-all text-sm font-bold text-text-primary placeholder:text-slate-600"
                                placeholder="Academy name..."
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">Privacy Setting</label>
                            <div className="flex items-center gap-1 p-1 bg-glass border border-subtle rounded-xl">
                              {[
                                { id: 'public', label: 'Public', icon: Globe },
                                { id: 'private', label: 'Private', icon: Lock },
                                { id: 'closed', label: 'Closed', icon: Shield }
                              ].map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => setEditGroupData({ ...editGroupData, privacy: opt.id as any })}
                                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${
                                    editGroupData.privacy === opt.id 
                                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                                      : 'text-text-secondary hover:text-text-primary hover:bg-glass'
                                  }`}
                                >
                                  <opt.icon size={10} />
                                  <span>{opt.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">About the Academy</label>
                          <textarea 
                            required
                            value={editGroupData.description}
                            onChange={(e) => setEditGroupData({ ...editGroupData, description: e.target.value })}
                            className="w-full bg-glass border border-subtle rounded-2xl py-3 px-4 h-16 focus:outline-none focus:border-indigo-500/50 focus:bg-slate-900/40 transition-all resize-none text-sm font-medium text-text-secondary leading-relaxed placeholder:text-slate-600"
                            placeholder="Describe your academy's mission..."
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">Academy Rules</label>
                          <textarea 
                            value={editGroupData.rules}
                            onChange={(e) => setEditGroupData({ ...editGroupData, rules: e.target.value })}
                            className="w-full bg-glass border border-subtle rounded-2xl py-3 px-4 h-16 focus:outline-none focus:border-indigo-500/50 focus:bg-slate-900/40 transition-all resize-none text-sm font-medium text-text-secondary leading-relaxed placeholder:text-slate-600"
                            placeholder="Set the rules for your academy..."
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                          <RippleButton 
                            type="submit"
                            disabled={isSaving}
                            className={`flex-[2] py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl flex items-center justify-center gap-2 ${
                              saveSuccess 
                                ? 'bg-green-600 text-white shadow-green-600/20' 
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                            }`}
                          >
                            {isSaving ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : saveSuccess ? (
                              <>
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><Check size={16} /></motion.div>
                                <span>Changes Saved</span>
                              </>
                            ) : (
                              <>
                                <Check size={16} strokeWidth={3} />
                                <span>Save Changes</span>
                              </>
                            )}
                          </RippleButton>
                          
                          <button
                            type="button"
                            onClick={() => activeGroup && setShowDeleteConfirm({ id: activeGroup.id, name: activeGroup.name })}
                            className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border border-red-500/20 flex items-center justify-center gap-2"
                          >
                            <Trash2 size={16} />
                            <span>Delete</span>
                          </button>
                        </div>

                        <div className="pt-4 border-t border-subtle">
                          <button
                            type="button"
                            onClick={() => setShowLeaveConfirm(activeGroup.id)}
                            className="w-full bg-glass hover:bg-slate-900/40 text-text-secondary py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border border-subtle flex items-center justify-center gap-2 group"
                          >
                            <UserMinus size={16} className="group-hover:text-red-400 transition-colors" />
                            <span>Leave Academy</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-6 rounded-2xl bg-glass border border-subtle space-y-4">
                        <div className="space-y-1">
                          <h4 className="text-lg font-black tracking-tight text-text-primary">Leave Academy</h4>
                          <p className="text-xs text-text-secondary leading-relaxed">You will no longer be able to participate in this group's chat or see member-only content.</p>
                        </div>
                        <button
                          onClick={() => setShowLeaveConfirm(activeGroup.id)}
                          className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all border border-red-500/20 flex items-center justify-center gap-2"
                        >
                          <UserMinus size={16} />
                          <span>Leave Group</span>
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    ) : (
      <motion.div 
        key="groups-list"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8 pb-20"
      >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-subtle pb-8">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tight text-text-primary">Academy</h1>
          <p className="text-text-secondary text-sm font-medium">Discover and join academies that share your passion.</p>
        </div>
        <RippleButton 
          onClick={() => setShowCreateModal(true)}
          className="bg-text-primary text-bg-primary hover:bg-slate-200 px-8 py-3 rounded-full font-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/5"
        >
          <Plus size={20} strokeWidth={3} />
          <span>Create Academy</span>
        </RippleButton>
      </div>

      <div className="flex flex-col gap-6">
        {/* Search Bar - X.com Style */}
        <div className="relative group max-w-2xl z-30">
          <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isSearchFocused ? 'text-indigo-500' : 'text-text-secondary'}`}>
            <Search size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Search academy..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
            className="w-full bg-glass backdrop-blur-xl border border-subtle rounded-full py-3 pl-12 pr-32 text-base focus:outline-none focus:bg-bg-primary focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600 text-text-primary"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setAppliedSearchQuery('');
                }}
                className="p-2 hover:bg-glass rounded-full text-text-secondary transition-colors"
              >
                <X size={16} />
              </button>
            )}
            <button 
              onClick={handleApplyFilters}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20"
            >
              Search
            </button>
          </div>

          {/* Search Suggestions Dropdown */}
          <AnimatePresence>
            {isSearchFocused && searchSuggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-glass backdrop-blur-2xl border border-glass-border rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-2">
                  <p className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-text-secondary">Suggestions</p>
                  {searchSuggestions.map(g => (
                    <button
                      key={g.id}
                      onClick={() => {
                        setSearchQuery(g.name);
                        setIsSearchFocused(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-glass transition-colors text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-glass-border">
                        <img src={g.coverImage} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate group-hover:text-indigo-400 transition-colors text-text-primary">{g.name}</p>
                        <p className="text-[10px] text-text-secondary font-medium">{g.category} · {g.members.toLocaleString()} members</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tabs - X.com Style */}
        <div className="flex items-center justify-between border-b border-subtle">
          <div className="flex items-center overflow-x-auto no-scrollbar -mb-px">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setAppliedCategory(cat);
                }}
                className={`px-6 py-4 text-sm font-bold whitespace-nowrap transition-all relative ${
                  appliedCategory === cat
                    ? 'text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-glass'
                }`}
              >
                {cat}
                {appliedCategory === cat && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 rounded-full"
                  />
                )}
              </button>
            ))}
          </div>
          
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
              showFilters 
                ? 'text-indigo-400 bg-indigo-500/10' 
                : 'text-text-secondary hover:text-text-primary hover:bg-glass'
            }`}
          >
            <Filter size={16} />
            <span>Filters</span>
            <motion.div
              animate={{ rotate: showFilters ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <ChevronDown size={14} />
            </motion.div>
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="overflow-hidden"
            >
              <div className="glass-card !p-6 border border-subtle shadow-2xl mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Filter size={14} />
                      <label className="text-[10px] font-black uppercase tracking-widest">Category</label>
                    </div>
                    <div className="relative group">
                      <select 
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full bg-glass border border-subtle rounded-xl px-4 py-3 text-sm appearance-none focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer hover:bg-slate-900/40 text-text-primary"
                      >
                        {categories.map(cat => <option key={cat} value={cat} className="bg-bg-primary">{cat}</option>)}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Globe size={14} />
                      <label className="text-[10px] font-black uppercase tracking-widest">Privacy</label>
                    </div>
                    <div className="relative group">
                      <select 
                        value={selectedPrivacy}
                        onChange={(e) => setSelectedPrivacy(e.target.value)}
                        className="w-full bg-glass border border-subtle rounded-xl px-4 py-3 text-sm appearance-none focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer hover:bg-slate-900/40 text-text-primary"
                      >
                        {privacyOptions.map(opt => <option key={opt} value={opt} className="bg-bg-primary">{opt}</option>)}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <GraduationCap size={14} />
                      <label className="text-[10px] font-black uppercase tracking-widest">Academy Size</label>
                    </div>
                    <div className="relative group">
                      <select 
                        value={selectedMemberRange}
                        onChange={(e) => setSelectedMemberRange(e.target.value)}
                        className="w-full bg-glass border border-subtle rounded-xl px-4 py-2.5 text-sm appearance-none focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer hover:bg-slate-900/40 text-text-primary"
                      >
                        {memberRanges.map(range => <option key={range} value={range} className="bg-bg-primary">{range}</option>)}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </div>

                  <div className="flex flex-col justify-end gap-2">
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleApplyFilters}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/20 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                    >
                      <Search size={16} />
                      <span>Apply Filters</span>
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleClearFilters}
                      className="w-full bg-glass hover:bg-slate-900/40 border border-subtle rounded-xl px-4 py-2.5 text-sm font-bold text-text-secondary transition-all flex items-center justify-center gap-2"
                    >
                      <X size={16} />
                      <span>Clear All</span>
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonLoader type="group" count={6} />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-6 glass-card border-dashed border-subtle">
          <div className="w-20 h-20 rounded-full bg-glass flex items-center justify-center text-text-secondary">
            <GraduationCap size={40} />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-xl font-black text-text-primary">No Academies Found</h3>
            <p className="text-text-secondary text-sm max-w-xs mx-auto">Be the first to create an academy or try a different search term.</p>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-600/20 uppercase tracking-widest text-xs"
          >
            Create Academy
          </button>
        </div>
      ) : (
        <motion.div 
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredGroups.map((group, idx) => (
            <motion.div 
              key={`${group.id}-${idx}`}
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 }
              }}
              whileHover={{ y: -4 }}
              onClick={() => {
                const updatedGroup = { ...group, hasUnreadMessages: false };
                setGroups(prev => prev.map(g => g.id === group.id ? updatedGroup : g));
                setActiveGroupId(group.id);
                setActiveTab('chat');
              }}
              className="group cursor-pointer glass-card !p-0 overflow-hidden flex flex-col h-full border border-white/5 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500"
            >
              <div className="h-32 relative overflow-hidden">
                <img 
                  src={group.coverImage} 
                  alt={group.name} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1.5 glass-morphism backdrop-blur-xl text-white text-[9px] font-black rounded-full uppercase tracking-[0.2em] border border-white/20">
                    {group.category}
                  </span>
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between gap-5 relative">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-black tracking-tight text-text-primary truncate font-sans group-hover:text-indigo-400 transition-colors">
                        {group.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex -space-x-1.5">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="w-5 h-5 rounded-full border-2 border-slate-900 overflow-hidden bg-slate-800">
                              <img src={`https://i.pravatar.cc/100?u=${group.id}-${i}`} alt="member" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                        <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest pl-1">{group.members.toLocaleString()} Members</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {group.hasUnreadMessages && (
                        <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.8)] animate-pulse" />
                      )}
                      
                      <div className="glass p-1.5 rounded-lg border border-white/10 group-hover:border-indigo-500/30 transition-colors">
                        {group.privacy === 'public' ? <Globe size={12} className="text-slate-400" /> : <Lock size={12} className="text-amber-400" />}
                      </div>
                    </div>
                  </div>
                  <p className="text-text-secondary text-[11px] leading-relaxed line-clamp-2 font-medium italic opacity-80">
                    "{group.description}"
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                      group.privacy === 'public' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {group.privacy}
                    </div>
                  </div>
                  
                  {!group.isJoined ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleJoinGroup(group.id);
                      }}
                      className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl ${
                        group.privacy === 'closed'
                          ? 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'
                          : isPending.includes(group.id)
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20 shadow-amber-500/10'
                          : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/30 hover:-translate-y-0.5'
                      }`}
                      disabled={group.privacy === 'closed'}
                    >
                      {group.privacy === 'closed' ? 'Closed' : isPending.includes(group.id) ? 'Pending' : group.privacy === 'private' ? 'Request Access' : 'Join Now'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Active Member</span>
                      <div className="p-1 glass rounded-lg border border-indigo-500/20">
                        <Check size={12} className="text-indigo-500" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Create Academy Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg glass-card !p-6 space-y-4 rounded-[2rem] border-subtle bg-slate-900/40 backdrop-blur-3xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                    <Plus size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-text-primary">Create Academy</h2>
                    <p className="text-[9px] text-text-secondary font-bold uppercase tracking-widest">Start a new learning hub</p>
                  </div>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-glass rounded-xl text-text-secondary hover:text-text-primary transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateGroup} className="space-y-5">
                  <div className="space-y-5">
                    {/* Cover & Badge Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">Academy Cover</label>
                        <div 
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = (e: any) => handleCoverImageChange(e, 'create');
                            input.click();
                          }}
                          className="relative h-24 rounded-2xl overflow-hidden border border-white/5 group/cover cursor-pointer bg-white/5 hover:border-indigo-500/50 transition-all shadow-inner"
                        >
                          {newGroup.coverImage ? (
                            <img src={newGroup.coverImage} alt="Cover" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-text-secondary">
                              <Camera size={20} />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Add Cover</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                            <Plus size={20} className="text-white" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">Academy Badge</label>
                        <div 
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = (e: any) => handleBadgeChange(e, 'create');
                            input.click();
                          }}
                          className="relative h-24 rounded-2xl overflow-hidden border border-white/5 group/badge cursor-pointer bg-white/5 hover:border-indigo-500/50 transition-all flex items-center justify-center shadow-inner"
                        >
                          {newGroup.badge ? (
                            <img src={newGroup.badge} alt="Badge" className="w-16 h-16 object-cover rounded-xl shadow-2xl" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-text-secondary">
                              <Camera size={20} />
                              <span className="text-[10px] font-bold uppercase tracking-widest text-center">Add Badge</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/badge:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                            <Plus size={20} className="text-white" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">Academy Name</label>
                        <div className="relative group">
                          <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-indigo-500 transition-colors" size={16} />
                          <input 
                            required
                            type="text" 
                            placeholder="e.g. Creative Developers"
                            value={newGroup.name}
                            onChange={(e) => setNewGroup({...newGroup, name: e.target.value})}
                            className="w-full bg-glass border border-subtle rounded-xl py-2 pl-11 pr-4 text-sm font-bold text-text-primary focus:outline-none focus:border-indigo-500/50 focus:bg-slate-900/40 transition-all placeholder:text-slate-600"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">Category</label>
                        <div className="relative group">
                          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-indigo-500 transition-colors" size={16} />
                          <select 
                            value={newGroup.category}
                            onChange={(e) => setNewGroup({...newGroup, category: e.target.value, sport: ''})}
                            className="w-full bg-glass border border-subtle rounded-xl py-2 pl-11 pr-10 text-sm font-bold text-text-primary focus:outline-none focus:border-indigo-500/50 focus:bg-slate-900/40 transition-all appearance-none cursor-pointer"
                          >
                            <option value="General" className="bg-slate-900">General</option>
                            <option value="Design" className="bg-slate-900">Design</option>
                            <option value="Development" className="bg-slate-900">Development</option>
                            <option value="Business" className="bg-slate-900">Business</option>
                            <option value="AI" className="bg-slate-900">AI</option>
                            <option value="Sports Clubs" className="bg-slate-900">Sports Clubs</option>
                            <option value="Academy" className="bg-slate-900">Academy</option>
                          </select>
                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none group-hover:text-indigo-400 transition-colors" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">About the Academy</label>
                      <textarea 
                        required
                        placeholder="What is this academy about? Share your vision..."
                        value={newGroup.description}
                        onChange={(e) => setNewGroup({...newGroup, description: e.target.value})}
                        className="w-full bg-glass border border-subtle rounded-2xl py-3 px-4 h-20 text-sm font-medium text-text-secondary focus:outline-none focus:border-indigo-500/50 focus:bg-slate-900/40 transition-all resize-none leading-relaxed placeholder:text-slate-600"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">Privacy Setting</label>
                      <div className="flex items-center gap-1 p-1 bg-glass border border-subtle rounded-xl">
                        {[
                          { id: 'public', label: 'Public', icon: Globe },
                          { id: 'private', label: 'Private', icon: Lock },
                          { id: 'closed', label: 'Closed', icon: Shield }
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setNewGroup({...newGroup, privacy: opt.id as any})}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${
                              newGroup.privacy === opt.id 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                                : 'text-text-secondary hover:text-text-primary hover:bg-glass'
                            }`}
                          >
                            <opt.icon size={10} />
                            <span>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Academy Rules - Full Width */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">Academy Rules</label>
                      <textarea 
                        placeholder="Set the rules for your academy..."
                        value={newGroup.rules}
                        onChange={(e) => setNewGroup({...newGroup, rules: e.target.value})}
                        className="w-full bg-glass border border-subtle rounded-2xl py-3 px-4 h-20 text-sm font-medium text-text-secondary focus:outline-none focus:border-indigo-500/50 focus:bg-slate-900/40 transition-all resize-none leading-relaxed placeholder:text-slate-600"
                      />
                    </div>

                    {/* Sport Selection (Conditional) */}
                    <AnimatePresence mode="wait">
                      {(newGroup.category === 'Academy' || newGroup.category === 'Sports Clubs') && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-2"
                        >
                          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">Select Sport</label>
                          <div className="relative group">
                            <select 
                              required
                              value={newGroup.sport}
                              onChange={(e) => setNewGroup({...newGroup, sport: e.target.value})}
                              className="w-full bg-glass border border-subtle rounded-xl py-3 px-4 text-sm font-bold text-text-primary focus:outline-none focus:border-indigo-500/50 focus:bg-slate-900/40 transition-all appearance-none cursor-pointer"
                            >
                              <option value="" disabled className="bg-slate-900">Choose a sport...</option>
                              {POPULAR_SPORTS.map(sport => (
                                <option key={sport} value={sport} className="bg-slate-900">{sport}</option>
                              ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none group-hover:text-indigo-400 transition-colors" />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="pt-2">
                    <RippleButton 
                      type="submit"
                      disabled={isSaving}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-indigo-600/30"
                    >
                      {isSaving ? "Creating..." : "Create Academy"}
                    </RippleButton>
                  </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Academy Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg glass-card !p-6 space-y-4 rounded-[2rem] border-subtle bg-slate-900/40 backdrop-blur-3xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                    <Settings size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-text-primary">Edit Academy</h2>
                    <p className="text-[9px] text-text-secondary font-bold uppercase tracking-widest">Update your academy details</p>
                  </div>
                </div>
                <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-glass rounded-xl text-text-secondary hover:text-text-primary transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleEditGroup} className="space-y-5">
                <div className="space-y-5">
                  {/* Cover Image Edit */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">Academy Cover</label>
                    <div 
                      onClick={() => {
                        const url = prompt('Enter cover image URL:', editGroupData.coverImage);
                        if (url) setEditGroupData({...editGroupData, coverImage: url});
                      }}
                      className="relative h-24 rounded-2xl overflow-hidden border border-subtle group/cover cursor-pointer bg-glass hover:border-indigo-500/50 transition-all"
                    >
                      <img src={editGroupData.coverImage} alt="Cover" className="w-full h-full object-cover transition-transform duration-500 group-hover/cover:scale-105" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera size={20} className="text-white" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">Academy Name</label>
                      <div className="relative group">
                        <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-indigo-500 transition-colors" size={16} />
                        <input 
                          required
                          type="text" 
                          placeholder="e.g. Creative Developers"
                          value={editGroupData.name}
                          onChange={(e) => setEditGroupData({...editGroupData, name: e.target.value})}
                          className="w-full bg-glass border border-subtle rounded-xl py-2 pl-11 pr-4 text-sm font-bold text-text-primary focus:outline-none focus:border-indigo-500/50 focus:bg-slate-900/40 transition-all placeholder:text-slate-600"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">Privacy Setting</label>
                      <div className="flex items-center gap-1 p-1 bg-glass border border-subtle rounded-xl">
                        {[
                          { id: 'public', label: 'Public', icon: Globe },
                          { id: 'private', label: 'Private', icon: Lock },
                          { id: 'closed', label: 'Closed', icon: Shield }
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setEditGroupData({...editGroupData, privacy: opt.id as any})}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${
                              editGroupData.privacy === opt.id 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                                : 'text-text-secondary hover:text-text-primary hover:bg-glass'
                            }`}
                          >
                            <opt.icon size={10} />
                            <span>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">About the Academy</label>
                    <textarea 
                      required
                      placeholder="What is this academy about? Share your vision..."
                      value={editGroupData.description}
                      onChange={(e) => setEditGroupData({...editGroupData, description: e.target.value})}
                      className="w-full bg-glass border border-subtle rounded-2xl py-3 px-4 h-20 text-sm font-medium text-text-secondary focus:outline-none focus:border-indigo-500/50 focus:bg-slate-900/40 transition-all resize-none leading-relaxed placeholder:text-slate-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary ml-1">Academy Rules</label>
                    <textarea 
                      placeholder="Set the rules for your academy..."
                      value={editGroupData.rules}
                      onChange={(e) => setEditGroupData({...editGroupData, rules: e.target.value})}
                      className="w-full bg-glass border border-subtle rounded-2xl py-3 px-4 h-20 text-sm font-medium text-text-secondary focus:outline-none focus:border-indigo-500/50 focus:bg-slate-900/40 transition-all resize-none leading-relaxed placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <RippleButton 
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-indigo-600/30"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </RippleButton>
                  
                  <button
                    type="button"
                    onClick={() => activeGroup && setShowDeleteConfirm({ id: activeGroup.id, name: activeGroup.name })}
                    className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all border border-red-500/20 flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    <span>Delete Academy</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
    )}
    {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={!!showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(null)}
        onConfirm={() => {
          if (showLeaveConfirm) {
            performJoinLeave(showLeaveConfirm, false);
          }
        }}
        title="Leave Academy?"
        message="Are you sure you want to leave this academy? You will no longer be able to participate in the chat or see member-only updates."
        confirmText="Leave Academy"
        variant="warning"
      />

      <ConfirmationModal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={() => {
          if (showDeleteConfirm) {
            handleDeleteGroup(showDeleteConfirm.id);
          }
        }}
        title={`Delete "${showDeleteConfirm?.name}"?`}
        message={`WARNING: This academy and all its data will be DELETED PERMANENTLY. This action is irreversible. All chat history, member records, and settings for "${showDeleteConfirm?.name}" will be lost forever.`}
        confirmText="Delete Permanently"
        variant="danger"
      />

      <ConfirmationModal 
        isOpen={memberActionConfirm !== null}
        onClose={() => setMemberActionConfirm(null)}
        onConfirm={() => {
          if (memberActionConfirm) {
            if (memberActionConfirm.type === 'remove') {
              removeMember(memberActionConfirm.groupId, memberActionConfirm.memberId);
            } else if (memberActionConfirm.type === 'promote') {
              promoteToAdmin(memberActionConfirm.groupId, memberActionConfirm.memberId);
            } else {
              demoteFromAdmin(memberActionConfirm.groupId, memberActionConfirm.memberId);
            }
            setMemberActionConfirm(null);
          }
        }}
        title={
          memberActionConfirm?.type === 'remove' ? "Remove Member" : 
          memberActionConfirm?.type === 'promote' ? "Promote to Admin" : 
          "Demote Admin"
        }
        message={
          memberActionConfirm?.type === 'remove' 
            ? `Are you sure you want to remove ${memberActionConfirm?.memberName} from the academy?`
            : memberActionConfirm?.type === 'promote'
            ? `Are you sure you want to promote ${memberActionConfirm?.memberName} to admin? They will have full control over academy settings and members.`
            : `Are you sure you want to remove admin privileges from ${memberActionConfirm?.memberName}?`
        }
        confirmText={
          memberActionConfirm?.type === 'remove' ? "Remove" : 
          memberActionConfirm?.type === 'promote' ? "Promote" : 
          "Demote"
        }
        variant={
          memberActionConfirm?.type === 'remove' ? "danger" : 
          memberActionConfirm?.type === 'promote' ? "info" : 
          "warning"
        }
      />
    </>
  );
});
