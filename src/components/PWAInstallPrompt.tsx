import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Smartphone, Monitor, Plus } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if it's iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show the prompt after a short delay if not standalone
      if (!isStandalone) {
        setTimeout(() => setIsVisible(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If iOS and not standalone, show the iOS-specific prompt
    if (isIOSDevice && !isStandalone) {
      setTimeout(() => setIsVisible(true), 5000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const dismissPrompt = () => {
    setIsVisible(false);
    // Optionally save to local storage to not show again for a while
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-24 left-4 right-4 z-[100] md:left-auto md:right-8 md:bottom-8 md:w-96"
        >
          <div className="bg-bg-primary/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl overflow-hidden relative group">
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 blur-[60px] rounded-full group-hover:bg-indigo-500/30 transition-colors duration-500" />
            
            <button 
              onClick={dismissPrompt}
              className="absolute top-3 right-3 p-1 text-text-secondary hover:text-text-primary transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                <Download className="text-white" size={24} />
              </div>
              
              <div className="flex-1 pr-6">
                <h3 className="text-text-primary font-bold text-lg leading-tight">Install Mark 1</h3>
                <p className="text-text-secondary text-sm mt-1">
                  {isIOS 
                    ? "Tap the share button and 'Add to Home Screen' for the best experience."
                    : "Install our app for offline access and a faster experience."}
                </p>
              </div>
            </div>

            {!isIOS && deferredPrompt && (
              <div className="mt-5 flex gap-3">
                <button
                  onClick={handleInstallClick}
                  className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2.5 px-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                >
                  <Smartphone size={18} />
                  Install Now
                </button>
                <button
                  onClick={dismissPrompt}
                  className="px-4 py-2.5 text-text-secondary font-medium hover:text-text-primary transition-colors"
                >
                  Later
                </button>
              </div>
            )}

            {isIOS && (
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-center gap-2 text-xs text-text-secondary italic">
                <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded">
                  <Download size={12} />
                  <span>Share</span>
                </div>
                <span>→</span>
                <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded">
                  <Plus size={12} />
                  <span>Add to Home Screen</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
