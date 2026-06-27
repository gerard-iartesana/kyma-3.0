'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface PWAContextType {
  isOnline: boolean;
  isInstallable: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  updateAvailable: boolean;
  promptInstall: () => Promise<void>;
  applyUpdate: () => void;
  dismissIOSHint: () => void;
  showIOSHint: boolean;
}

const PWAContext = createContext<PWAContextType>({
  isOnline: true,
  isInstallable: false,
  isIOS: false,
  isStandalone: false,
  updateAvailable: false,
  promptInstall: async () => {},
  applyUpdate: () => {},
  dismissIOSHint: () => {},
  showIOSHint: false,
});

export const usePWA = () => useContext(PWAContext);

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [showIOSHint, setShowIOSHint] = useState<boolean>(false);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Initial Online Status
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 2. Standalone & Platform Detection
    const standaloneCheck = window.matchMedia('(display-mode: standalone)').matches || 
                           (window.navigator as any).standalone === true;
    setIsStandalone(standaloneCheck);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    if (isIOSDevice && !standaloneCheck) {
      const dismissed = localStorage.getItem('kyma_ios_hint_dismissed');
      if (!dismissed) {
        setShowIOSHint(true);
      }
    }

    // 3. Deferred Install Prompt (Android / Desktop Chrome/Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Service Worker Registration & Update Check
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
                setWaitingWorker(newWorker);
              }
            });
          }
        });
      }).catch((err) => console.error('Service Worker registration failed:', err));

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  const applyUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  };

  const dismissIOSHint = () => {
    setShowIOSHint(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kyma_ios_hint_dismissed', 'true');
    }
  };

  return (
    <PWAContext.Provider
      value={{
        isOnline,
        isInstallable,
        isIOS,
        isStandalone,
        updateAvailable,
        promptInstall,
        applyUpdate,
        dismissIOSHint,
        showIOSHint,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
}
