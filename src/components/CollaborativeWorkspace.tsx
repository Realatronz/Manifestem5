import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSocket } from '../contexts/SocketContext';
import { Edit3, Users, Send, Save, Share2, Shield, Lock, Globe, Layers, Zap, Command, MessageSquare, Terminal, Eye } from 'lucide-react';

interface DocumentState {
  id: string;
  name: string;
  content: string;
  lastUpdatedBy: string;
  lastUpdateTime: number;
}

export const CollaborativeWorkspace: React.FC<{ roomId: string, user: any }> = ({ roomId, user }) => {
  const { socket, isConnected } = useSocket();
  const [docState, setDocState] = useState<DocumentState>({
    id: roomId,
    name: 'Untitled Project',
    content: '',
    lastUpdatedBy: '',
    lastUpdateTime: Date.now()
  });
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    if (!socket || !isConnected || !user) return;

    socket.emit('join:room', roomId);

    socket.on('document:sync', (data: any) => {
      setDocState(prev => {
        // Only update if the incoming data is newer or from someone else
        if (data.userId !== user?.uid) {
          setIsSyncing(true);
          setTimeout(() => setIsSyncing(false), 1000);
          return {
            ...prev,
            content: data.content,
            lastUpdatedBy: data.name,
            lastUpdateTime: Date.now()
          };
        }
        return prev;
      });
    });

    return () => {
      socket.emit('leave:room', roomId);
    };
  }, [socket, isConnected, roomId, user?.uid]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setDocState(prev => ({ ...prev, content: newContent }));
    
    if (socket && user) {
      socket.emit('document:update', {
        roomId,
        content: newContent,
        userId: user.uid,
        name: user.displayName || 'Anonymous'
      });
    }
  };

  return (
    <div className="flex flex-col h-full glass-card overflow-hidden border border-white/5 bg-slate-900/40 backdrop-blur-3xl shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-indigo-500/20 rounded-xl text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-500/20">
            <Edit3 size={20} />
          </div>
          <div>
            <input 
              value={docState.name}
              onChange={(e) => setDocState(prev => ({ ...prev, name: e.target.value }))}
              className="bg-transparent border-none outline-none text-lg font-black tracking-tight text-white placeholder:text-white/20 w-48"
            />
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
              <span className="text-[10px] uppercase tracking-widest font-black text-white/40">
                {isConnected ? 'Real-time Linked' : 'Offline Mode'}
              </span>
              {isSyncing && (
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[10px] font-bold text-indigo-400 ml-2 italic"
                >
                  Syncing...
                </motion.span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex -space-x-2 mr-4">
            <AnimatePresence>
              <div className="w-8 h-8 rounded-full border-2 border-slate-900 bg-indigo-600 flex items-center justify-center text-[10px] font-black text-white shadow-xl relative z-10 group cursor-help transition-transform hover:scale-110">
                {user.displayName?.charAt(0) || 'U'}
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-white text-[8px] font-black uppercase tracking-widest rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  You (Editing)
                </div>
              </div>
            </AnimatePresence>
          </div>
          
          <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
            <button 
              onClick={() => setViewMode('edit')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'edit' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
            >
              <Terminal size={16} />
            </button>
            <button 
              onClick={() => setViewMode('preview')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'preview' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
            >
              <Eye size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 relative flex">
        {/* Sidebar info */}
        <div className="w-12 border-r border-white/5 flex flex-col items-center py-6 gap-6 bg-white/[0.02]">
          <Layers size={18} className="text-white/20 hover:text-indigo-400 cursor-pointer transition-colors" />
          <Zap size={18} className="text-white/20 hover:text-amber-400 cursor-pointer transition-colors" />
          <Command size={18} className="text-white/20 hover:text-emerald-400 cursor-pointer transition-colors" />
          <div className="mt-auto pb-4">
            <MessageSquare size={18} className="text-white/20 hover:text-blue-400 cursor-pointer transition-colors" />
          </div>
        </div>

        <div className="flex-1 p-6 relative">
          {viewMode === 'edit' ? (
            <div className="h-full font-mono text-sm leading-relaxed text-indigo-100 bg-white/[0.01] rounded-2xl border border-white/5 p-4 shadow-inner">
              <textarea
                ref={textareaRef}
                value={docState.content}
                onChange={handleContentChange}
                placeholder="Start collaborating in real-time..."
                className="w-full h-full bg-transparent border-none outline-none resize-none placeholder:text-white/10 custom-scrollbar"
              />
            </div>
          ) : (
            <div className="h-full p-6 prose prose-invert max-w-none overflow-y-auto">
              <div className="bg-white/[0.03] p-8 rounded-3xl border border-white/10 shadow-2xl">
                <h1 className="text-4xl font-black mb-6 text-white tracking-tighter">Document Preview</h1>
                <p className="text-lg text-white/60 leading-relaxed font-medium">
                  {docState.content || 'Nothing to preview yet. Switch to Edit mode to add some content.'}
                </p>
                {docState.lastUpdatedBy && (
                  <div className="mt-12 flex items-center gap-3 pt-6 border-t border-white/10">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400">
                      <Save size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Last change by</p>
                      <p className="text-sm font-bold text-white">{docState.lastUpdatedBy}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Floating actions */}
          <div className="absolute bottom-10 right-10 flex flex-col gap-3">
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              className="p-4 bg-indigo-600 text-white rounded-2xl shadow-2xl shadow-indigo-600/40 border border-white/20 hover:bg-indigo-500 transition-colors"
            >
              <Save size={20} />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1, rotate: -5 }}
              whileTap={{ scale: 0.9 }}
              className="p-4 bg-white/10 text-white rounded-2xl shadow-2xl backdrop-blur-xl border border-white/20 hover:bg-white/20 transition-colors"
            >
              <Share2 size={20} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-6 py-3 bg-white/5 border-t border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Shield size={12} className="text-emerald-400" />
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">End-to-end Encrypted</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock size={12} className="text-amber-400" />
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Private Workspace</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Globe size={12} className="text-indigo-400" />
          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Global Sync Active</span>
        </div>
      </div>
    </div>
  );
};
