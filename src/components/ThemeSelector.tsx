import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Palette, Plus, Trash2, X, RefreshCw } from 'lucide-react';
import { useTheme, ThemeType, CustomThemeColors } from '../ThemeContext';

const PREDEFINED_THEMES: { id: ThemeType; label: string; colors: string[] }[] = [
  { id: 'dark', label: 'Classic Dark', colors: ['#020617', '#6366f1', '#f8fafc'] },
  { id: 'light', label: 'Pristine Light', colors: ['#f8fafc', '#4f46e5', '#0f172a'] },
  { id: 'midnight', label: 'Midnight Noir', colors: ['#000000', '#6366f1', '#ffffff'] },
  { id: 'emerald', label: 'Emerald Forest', colors: ['#064e3b', '#10b981', '#ecfdf5'] },
  { id: 'cyberpunk', label: 'Cyberpunk', colors: ['#09090b', '#f0abfc', '#fafafa'] },
  { id: 'sunset', label: 'Sunset Glow', colors: ['#1c1917', '#f97316', '#fff7ed'] },
];

export const ThemeSelector = () => {
  const { theme, setTheme, customColors, setCustomColors } = useTheme();
  const [showCustom, setShowCustom] = useState(theme === 'custom');

  const handleColorChange = (field: keyof CustomThemeColors, value: string) => {
    setCustomColors({ ...customColors, [field]: value });
  };

  const handleResetCustom = () => {
    setCustomColors({
      primary: '#6366f1',
      secondary: '#3b82f6',
      bg: '#020617',
      text: '#f8fafc',
    });
  };

  return (
    <div className="space-y-8 pb-8">
      {/* Preset Themes */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Palette size={18} className="text-indigo-400" />
          <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">Preset Themes</h3>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PREDEFINED_THEMES.map((t) => (
            <motion.button
              key={t.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setTheme(t.id);
                setShowCustom(false);
              }}
              className={`relative overflow-hidden group p-4 rounded-2xl border transition-all ${
                theme === t.id 
                  ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10' 
                  : 'border-subtle bg-bg-primary/20 hover:border-indigo-500/30'
              }`}
            >
              <div className="flex flex-col gap-3">
                <div className="flex gap-1.5 justify-center">
                  {t.colors.map((c, i) => (
                    <div 
                      key={i} 
                      className="w-6 h-6 rounded-full border border-white/10 shadow-sm" 
                      style={{ backgroundColor: c }} 
                    />
                  ))}
                </div>
                <span className={`text-[11px] font-bold tracking-tight text-center ${theme === t.id ? 'text-indigo-400' : 'text-text-secondary'}`}>
                  {t.label}
                </span>
              </div>
              
              <AnimatePresence>
                {theme === t.id && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    className="absolute top-2 right-2 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-white"
                  >
                    <Check size={12} strokeWidth={4} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Custom Theme Trigger */}
      <div className="pt-4 border-t border-subtle">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => {
            setTheme('custom');
            setShowCustom(true);
          }}
          className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between ${
            theme === 'custom'
              ? 'border-indigo-500 bg-indigo-500/10'
              : 'border-dashed border-subtle bg-bg-primary/10 hover:border-indigo-500/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${theme === 'custom' ? 'bg-indigo-500 text-white' : 'bg-glass text-text-secondary'}`}>
              <Plus size={20} />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-text-primary">Create Custom Theme</p>
              <p className="text-[10px] text-text-secondary uppercase tracking-widest">Personalize every detail</p>
            </div>
          </div>
          {theme === 'custom' && <Check size={20} className="text-indigo-500" />}
        </motion.button>
      </div>

      {/* Custom Theme Editor */}
      <AnimatePresence>
        {showCustom && theme === 'custom' && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 32 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden glass-card !p-6 space-y-6 !border-indigo-500/30"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-widest text-indigo-400">Color Configuration</h4>
              <button 
                onClick={handleResetCustom}
                className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-text-secondary hover:text-text-primary transition-colors"
              >
                <RefreshCw size={12} />
                Reset Defaults
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <ColorPicker 
                label="Primary Accent" 
                value={customColors.primary} 
                onChange={(val) => handleColorChange('primary', val)} 
                desc="Buttons, active states, and highlights"
              />
              <ColorPicker 
                label="Secondary Accent" 
                value={customColors.secondary} 
                onChange={(val) => handleColorChange('secondary', val)} 
                desc="Glows, gradients, and secondary actions"
              />
              <ColorPicker 
                label="Background Color" 
                value={customColors.bg} 
                onChange={(val) => handleColorChange('bg', val)} 
                desc="Primary surface and main windows"
              />
              <ColorPicker 
                label="Primary Text" 
                value={customColors.text} 
                onChange={(val) => handleColorChange('text', val)} 
                desc="Main headings and readable content"
              />
            </div>

            <div className="p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
              <p className="text-[10px] text-indigo-400/80 leading-relaxed font-medium">
                Note: Custom themes are stored locally in your browser. Changing common colors like background to pure white might affect neon element visibility.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ColorPicker = ({ label, value, onChange, desc }: { label: string, value: string, onChange: (val: string) => void, desc?: string }) => (
  <div className="space-y-3">
    <div className="flex flex-col">
      <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-1">{label}</label>
      {desc && <p className="text-[9px] text-text-secondary/60 uppercase tracking-widest leading-none mb-2">{desc}</p>}
    </div>
    <div className="flex items-center gap-3">
      <div className="relative w-12 h-12 rounded-xl border border-subtle overflow-hidden flex-shrink-0 group ring-2 ring-transparent hover:ring-indigo-500/30 transition-all">
        <input 
          type="color" 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-[150%] h-[150%] -top-[25%] -left-[25%] cursor-pointer"
        />
      </div>
      <div className="flex-1">
        <input 
          type="text" 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-950 border border-subtle rounded-xl px-4 py-2.5 text-xs font-mono text-text-primary focus:border-indigo-500 outline-none transition-all"
        />
      </div>
    </div>
  </div>
);
