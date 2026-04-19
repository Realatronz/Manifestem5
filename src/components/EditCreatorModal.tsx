import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { X, Sparkles, Camera, Github, Twitter, Instagram, Globe, MapPin, Target } from 'lucide-react';
import { SplitText } from './SplitText';
import { INDIA_STATES } from '../constants/indiaData';

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
  category: string;
  isCreated: boolean;
  location?: string;
  state?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  hourlyRate?: number;
}

interface EditCreatorModalProps {
  profile: CreatorProfileData;
  onClose: () => void;
  onSave: (data: CreatorProfileData) => void;
}

export function EditCreatorModal({ profile, onClose, onSave }: EditCreatorModalProps) {
  const [formData, setFormData] = useState<CreatorProfileData>({ ...profile });
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const availableSkills = [
    'Video Editing', 'Storytelling', 'Graphics Design', 'Performance Arts', 
    'Public Speaking', 'Digital Marketing', 'Cinematography', 'Copywriting', 
    'Animation', 'Podcast Hosting', 'Software Dev', 'AI & Automation'
  ];

  const toggleSkill = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill) 
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData(prev => ({ ...prev, [type]: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleDetectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }));
        },
        (error) => {
          console.error("Error detecting location:", error);
        }
      );
    }
  };

  const creatorCategories = [
    'Comedy', 'Gaming', 'Tech', 'Education', 'Vlogging', 'Fashion', 
    'Beauty', 'Fitness', 'Food', 'Finance', 'Motivation', 'Music', 'Arts', 'News',
    'Executive Coach', 'Life Coach', 'Business Mentor', 'Career Mentor',
    'Video Editor', 'Motion Graphics', 'App Developer', 'Web Developer',
    'UI/UX Designer', 'SEO Specialist', 'Content Strategist', 'Social Media Manager',
    'Chef', 'Personal Chef', 'Bakery Expert'
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-bg-primary border border-subtle w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-subtle flex items-center justify-between bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white">
              <Sparkles size={20} />
            </div>
            <SplitText text="Creator Profile" className="text-xl font-black tracking-tight text-text-primary" />
          </div>
          <button onClick={onClose} className="p-2 hover:bg-glass rounded-full transition-colors text-text-primary">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="space-y-4">
            <div className="relative h-32 bg-glass rounded-2xl overflow-hidden group">
              {formData.cover ? (
                <img src={formData.cover} alt="Cover" referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-60" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-purple-900" />
              )}
              <button 
                onClick={() => coverInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera size={24} className="text-white" />
              </button>
              <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'cover')} />
            </div>

            <div className="flex items-center gap-6 -mt-12 px-4 relative z-10">
              <div className="relative group">
                <div className="w-24 h-24 rounded-3xl border-4 border-bg-primary overflow-hidden bg-glass shadow-xl">
                  <img src={formData.avatar} alt="Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </div>
                <button 
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera size={20} className="text-white" />
                </button>
                <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'avatar')} />
              </div>
              <div className="pt-8 flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Creator Name</label>
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-glass border border-subtle rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500 transition-colors"
                      placeholder="e.g. Alex Rivera"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Handle</label>
                    <input 
                      type="text" 
                      value={formData.handle}
                      onChange={(e) => setFormData(prev => ({ ...prev, handle: e.target.value }))}
                      className="w-full bg-glass border border-subtle rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500 transition-colors"
                      placeholder="@alex_creations"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Creative Bio</label>
            <textarea 
              value={formData.bio}
              onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
              className="w-full bg-glass border border-subtle rounded-2xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-indigo-500 transition-colors h-24 resize-none"
              placeholder="Tell the world about your creative journey..."
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Core Skills</label>
            <div className="flex flex-wrap gap-2">
              {availableSkills.map(skill => (
                <button
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                    formData.skills.includes(skill)
                      ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/20'
                      : 'bg-glass border-subtle text-text-secondary hover:bg-glass/80'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Creator Category / Service</label>
            <select 
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full bg-glass border border-subtle rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors text-sm text-text-primary"
            >
              <option value="General" className="bg-bg-primary">General</option>
              {creatorCategories.map(cat => (
                <option key={cat} value={cat} className="bg-bg-primary">{cat}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Hourly Rate (₹/hr)</label>
            <div className="relative group/input">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500 font-bold">
                ₹
              </div>
              <input 
                type="number" 
                value={formData.hourlyRate || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, hourlyRate: Number(e.target.value) }))}
                className="w-full bg-glass border border-subtle rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary focus:outline-none focus:border-indigo-500 transition-all"
                placeholder="500"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-subtle">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MapPin size={16} className="text-indigo-500" />
              Service Location
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">State</label>
                <select 
                  value={formData.state || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value, district: '' }))}
                  className="w-full bg-glass border border-subtle rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors text-sm text-text-primary"
                >
                  <option value="" className="bg-bg-primary">Select State</option>
                  {INDIA_STATES.map(s => (
                    <option key={s.name} value={s.name} className="bg-bg-primary">{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">District</label>
                <select 
                  value={formData.district || ''}
                  disabled={!formData.state}
                  onChange={(e) => setFormData(prev => ({ ...prev, district: e.target.value }))}
                  className="w-full bg-glass border border-subtle rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors text-sm text-text-primary disabled:opacity-50"
                >
                  <option value="" className="bg-bg-primary">Select District</option>
                  {formData.state && INDIA_STATES.find(s => s.name === formData.state)?.districts.map(d => (
                    <option key={d} value={d} className="bg-bg-primary">{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">Location / Address</label>
              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary">
                  <MapPin size={16} />
                </div>
                <input 
                  type="text" 
                  value={formData.location || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full bg-glass border border-subtle rounded-xl pl-11 pr-4 py-3 text-sm text-text-primary focus:outline-none focus:border-indigo-500 transition-all"
                  placeholder="e.g. MG Road, Bengaluru"
                />
              </div>
            </div>

            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">Precise Location (GPS)</p>
                  <p className="text-[10px] text-slate-500">Enable "Near Me" filtering for local users</p>
                </div>
                <button 
                  onClick={handleDetectLocation}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl text-[10px] font-bold transition-all border border-indigo-500/30"
                >
                  <Target size={14} />
                  Detect GPS
                </button>
              </div>
              
              {formData.latitude && formData.longitude && (
                <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Coordinates pinned: {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">Github</label>
              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within/input:text-indigo-500 transition-colors">
                  <Github size={16} />
                </div>
                <input 
                  type="text" 
                  value={formData.links.github || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, links: { ...prev.links, github: e.target.value } }))}
                  className="w-full bg-glass border border-subtle rounded-xl pl-11 pr-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-indigo-500 transition-all"
                  placeholder="Username"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">Twitter</label>
              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within/input:text-indigo-500 transition-colors">
                  <Twitter size={16} />
                </div>
                <input 
                  type="text" 
                  value={formData.links.twitter || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, links: { ...prev.links, twitter: e.target.value } }))}
                  className="w-full bg-glass border border-subtle rounded-xl pl-11 pr-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-indigo-500 transition-all"
                  placeholder="Username"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">Instagram</label>
              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within/input:text-indigo-500 transition-colors">
                  <Instagram size={16} />
                </div>
                <input 
                  type="text" 
                  value={formData.links.instagram || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, links: { ...prev.links, instagram: e.target.value } }))}
                  className="w-full bg-glass border border-subtle rounded-xl pl-11 pr-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-indigo-500 transition-all"
                  placeholder="Username"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">Website</label>
              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within/input:text-indigo-500 transition-colors">
                  <Globe size={16} />
                </div>
                <input 
                  type="text" 
                  value={formData.links.website || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, links: { ...prev.links, website: e.target.value } }))}
                  className="w-full bg-glass border border-subtle rounded-xl pl-11 pr-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-indigo-500 transition-all"
                  placeholder="https://your-portfolio.com"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-subtle bg-bg-primary/50 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-glass hover:bg-glass/80 text-text-primary font-bold transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(formData)}
            className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-500/20"
          >
            Save Profile
          </button>
        </div>
      </motion.div>
    </div>
  );
}
