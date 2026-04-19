import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeType = 'dark' | 'light' | 'midnight' | 'emerald' | 'cyberpunk' | 'sunset' | 'custom';

export interface CustomThemeColors {
  primary: string;
  secondary: string;
  bg: string;
  text: string;
}

interface ThemeContextType {
  theme: ThemeType;
  customColors: CustomThemeColors;
  setTheme: (theme: ThemeType) => void;
  setCustomColors: (colors: CustomThemeColors) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const DEFAULT_CUSTOM_COLORS: CustomThemeColors = {
  primary: '#6366f1',
  secondary: '#3b82f6',
  bg: '#020617',
  text: '#f8fafc',
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeType>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as ThemeType) || 'dark';
  });

  const [customColors, setCustomColorsState] = useState<CustomThemeColors>(() => {
    const saved = localStorage.getItem('customColors');
    return saved ? JSON.parse(saved) : DEFAULT_CUSTOM_COLORS;
  });

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const setCustomColors = (colors: CustomThemeColors) => {
    setCustomColorsState(colors);
    localStorage.setItem('customColors', JSON.stringify(colors));
  };

  useEffect(() => {
    const root = window.document.documentElement;
    // Remove all possible theme classes
    root.classList.remove('light', 'dark', 'midnight', 'emerald', 'cyberpunk', 'sunset', 'custom');
    root.classList.add(theme);
    
    document.body.classList.remove('light', 'dark', 'midnight', 'emerald', 'cyberpunk', 'sunset', 'custom');
    document.body.classList.add(theme);

    if (theme === 'custom') {
      root.style.setProperty('--accent-primary', customColors.primary);
      root.style.setProperty('--accent-secondary', customColors.secondary);
      root.style.setProperty('--slate-950', customColors.bg);
      root.style.setProperty('--text-primary', customColors.text);
    } else {
      root.style.removeProperty('--accent-primary');
      root.style.removeProperty('--accent-secondary');
      root.style.removeProperty('--slate-950');
      root.style.removeProperty('--text-primary');
    }
  }, [theme, customColors]);

  const toggleTheme = () => {
    const themes: ThemeType[] = ['dark', 'light', 'midnight', 'emerald', 'cyberpunk', 'sunset'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  return (
    <ThemeContext.Provider value={{ theme, customColors, setTheme, setCustomColors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
