import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { X, Camera } from 'lucide-react';
import { SplitText } from './SplitText';

interface ProfileData {
  name: string;
  handle: string;
  bio: string;
  location: string;
  website: string;
  avatar: string;
  cover: string | null;
}

interface EditProfileModalProps {
  profile: ProfileData;
  onClose: () => void;
  onSave: (data: ProfileData) => void;
}

export function EditProfileModal({ profile, onClose, onSave }: EditProfileModalProps) {
  const [formData, setFormData] = useState<ProfileData>({ ...profile });
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const resizeImage = (base64Str: string, maxWidth = 800, maxHeight = 800): Promise<string> => {
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
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const resized = await resizeImage(base64, type === 'avatar' ? 400 : 1200, type === 'avatar' ? 400 : 400);
        setFormData(prev => ({ ...prev, [type]: resized }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6 bg-black/60 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-bg-primary border border-subtle w-full max-w-xl rounded-3xl overflow-hidden flex flex-col max-h-full shadow-2xl"
      >
        <div className="px-6 py-4 flex items-center justify-between border-b border-subtle">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2 hover:bg-glass rounded-full transition-colors text-text-primary">
              <X size={20} />
            </button>
            <SplitText text="Edit Profile" className="text-xl font-bold text-text-primary" />
          </div>
          <button 
            onClick={() => onSave(formData)}
            className="bg-text-primary text-bg-primary px-6 py-1.5 rounded-full font-bold hover:opacity-80 transition-colors"
          >
            Save
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-0">
          <div className="relative h-40 bg-glass group">
            {formData.cover ? (
              <img src={formData.cover} alt="Cover" referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-60" />
            ) : (
              <div className="w-full h-full bg-glass" />
            )}
            <div className="absolute inset-0 flex items-center justify-center gap-4">
              <button 
                onClick={() => coverInputRef.current?.click()}
                className="p-3 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
              >
                <Camera size={20} />
              </button>
              {formData.cover && (
                <button 
                  onClick={() => setFormData(prev => ({ ...prev, cover: null }))}
                  className="p-3 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
                >
                  <X size={20} />
                </button>
              )}
            </div>
            <input 
              type="file" 
              ref={coverInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={(e) => handleImageUpload(e, 'cover')} 
            />
          </div>

          <div className="px-6 -mt-12 relative z-10 mb-6">
            <div className="relative inline-block group">
              <div className="w-24 h-24 rounded-full border-4 border-bg-primary overflow-hidden bg-glass">
                <img src={formData.avatar} alt="Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-60" />
              </div>
              <button 
                onClick={() => avatarInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 rounded-full text-white transition-colors"
              >
                <Camera size={20} />
              </button>
              <input 
                type="file" 
                ref={avatarInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => handleImageUpload(e, 'avatar')} 
              />
            </div>
          </div>

          <div className="px-6 pb-8 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-widest ml-1">Name</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-glass border border-subtle rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="Name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-widest ml-1">Handle</label>
              <input 
                type="text" 
                value={formData.handle}
                onChange={(e) => setFormData(prev => ({ ...prev, handle: e.target.value }))}
                className="w-full bg-glass border border-subtle rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="@handle"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-widest ml-1">Bio</label>
              <textarea 
                value={formData.bio}
                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                className="w-full bg-glass border border-subtle rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-indigo-500 transition-colors min-h-[100px] resize-none"
                placeholder="Bio"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-widest ml-1">Location</label>
              <input 
                type="text" 
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="w-full bg-glass border border-subtle rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="Location"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-widest ml-1">Website</label>
              <input 
                type="text" 
                value={formData.website}
                onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                className="w-full bg-glass border border-subtle rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="Website"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
