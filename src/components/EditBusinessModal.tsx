import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { X, Camera, MapPin, Target, GraduationCap } from 'lucide-react';
import { SplitText } from './SplitText';
import { RippleButton } from './RippleButton';
import { INDIA_STATES } from '../constants/indiaData';

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
  category: string;
  isCreated: boolean;
  location?: string;
  latitude?: number;
  longitude?: number;
  state?: string;
  district?: string;
}

interface EditBusinessModalProps {
  profile: BusinessProfileData;
  onClose: () => void;
  onSave: (data: BusinessProfileData) => void;
}

export function EditBusinessModal({ profile, onClose, onSave }: EditBusinessModalProps) {
  const [formData, setFormData] = useState<BusinessProfileData>({ ...profile });
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'cover') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, [type]: reader.result as string }));
      };
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
          // In a real app, we'd reverse geocode here to get a string address
        },
        (error) => {
          console.error("Error detecting location:", error);
        }
      );
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
            <SplitText text={profile.isCreated ? 'Edit Business' : 'Create Business'} className="text-xl font-bold text-text-primary" />
          </div>
          <RippleButton 
            onClick={() => onSave(formData)}
            className="bg-text-primary text-bg-primary px-6 py-1.5 rounded-full font-bold hover:opacity-80 transition-colors"
          >
            {profile.isCreated ? 'Save' : 'Create'}
          </RippleButton>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="relative h-32 bg-glass group rounded-2xl overflow-hidden">
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

          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-3xl bg-glass border border-subtle overflow-hidden">
                <img src={formData.logo} alt="Logo" referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-60" />
              </div>
              <button 
                onClick={() => logoInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 rounded-3xl text-white transition-colors"
              >
                <Camera size={24} />
              </button>
              <input 
                type="file" 
                ref={logoInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => handleImageUpload(e, 'logo')} 
              />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-text-primary">Business Logo</p>
              <p className="text-xs text-text-secondary">Recommended: 400x400px</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-widest ml-1">Business Name</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-glass border border-subtle rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="e.g. Mark 1 Solutions"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-widest ml-1">Short Bio</label>
              <input 
                type="text" 
                value={formData.bio}
                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                className="w-full bg-glass border border-subtle rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="A brief tagline for your business"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-widest ml-1">Contact Email</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full bg-glass border border-subtle rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="contact@business.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-widest ml-1">Website URL</label>
              <input 
                type="text" 
                value={formData.website}
                onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                className="w-full bg-glass border border-subtle rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="www.business.com"
              />
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-widest ml-1">Business Location</label>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-text-secondary uppercase tracking-widest ml-1">State</label>
                  <select 
                    value={formData.state || ''}
                    onChange={(e) => {
                      const state = e.target.value;
                      setFormData(prev => ({ 
                        ...prev, 
                        state, 
                        district: '', 
                        location: state ? `${state}, India` : prev.location 
                      }));
                    }}
                    className="w-full bg-glass border border-subtle rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="">Select State</option>
                    {INDIA_STATES.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] text-text-secondary uppercase tracking-widest ml-1">District</label>
                  <select 
                    disabled={!formData.state}
                    value={formData.district || ''}
                    onChange={(e) => {
                      const district = e.target.value;
                      setFormData(prev => ({ 
                        ...prev, 
                        district, 
                        location: `${district}, ${formData.state}, India` 
                      }));
                    }}
                    className="w-full bg-glass border border-subtle rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                  >
                    <option value="">Select District</option>
                    {INDIA_STATES.find(s => s.name === formData.state)?.districts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="relative group">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-indigo-500 transition-colors" size={16} />
                <input 
                  type="text" 
                  value={formData.location || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full bg-glass border border-subtle rounded-xl pl-12 pr-12 py-3 text-text-primary focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="Street address or custom location"
                />
                <button 
                  type="button"
                  onClick={handleDetectLocation}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-300 transition-colors"
                  title="Detect GPS Coordinates"
                >
                  <Target size={18} className={formData.latitude ? "text-emerald-400" : ""} />
                </button>
              </div>
              
              {formData.latitude && (
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest ml-1 animate-pulse">
                  GPS Coordinates Fixed: {formData.latitude.toFixed(4)}, {formData.longitude?.toFixed(4)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-widest ml-1">Business Description</label>
              <textarea 
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full bg-glass border border-subtle rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-indigo-500 transition-colors min-h-[120px] resize-none"
                placeholder="Describe what your business does..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-widest ml-1">Category</label>
              <select 
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full bg-glass border border-subtle rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors text-sm text-text-primary"
              >
                <option value="General" className="bg-bg-primary">General</option>
                <option value="IT & Software" className="bg-bg-primary">IT & Software</option>
                <option value="E-commerce & Retail" className="bg-bg-primary">E-commerce & Retail</option>
                <option value="Education & EdTech" className="bg-bg-primary">Education & EdTech</option>
                <option value="Healthcare" className="bg-bg-primary">Healthcare</option>
                <option value="Finance & FinTech" className="bg-bg-primary">Finance & FinTech</option>
                <option value="Agriculture & AgriTech" className="bg-bg-primary">Agriculture & AgriTech</option>
                <option value="Food & Beverages" className="bg-bg-primary">Food & Beverages</option>
                <option value="Manufacturing" className="bg-bg-primary">Manufacturing</option>
                <option value="Logistics & Supply Chain" className="bg-bg-primary">Logistics & Supply Chain</option>
                <option value="Real Estate" className="bg-bg-primary">Real Estate</option>
                <option value="Media & Entertainment" className="bg-bg-primary">Media & Entertainment</option>
                <option value="Automotive" className="bg-bg-primary">Automotive</option>
                <option value="Textile & Fashion" className="bg-bg-primary">Textile & Fashion</option>
                <option value="Design" className="bg-bg-primary">Design</option>
                <option value="Development" className="bg-bg-primary">Development</option>
                <option value="AI & Robotics" className="bg-bg-primary">AI & Robotics</option>
                <option value="Marketing & AdTech" className="bg-bg-primary">Marketing & AdTech</option>
                <option value="Consulting" className="bg-bg-primary">Consulting</option>
              </select>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
