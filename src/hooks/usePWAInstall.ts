import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type BrowserInstallTarget =
  | 'ios-safari'
  | 'ios-other'
  | 'firefox'
  | 'samsung'
  | 'edge'
  | 'chrome'
  | 'other';

const DISMISS_STORAGE_KEY = 'talambongo_install_banner_dismissed';

function detectBrowserTarget(): BrowserInstallTarget {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  const isIOSDevice = /iphone|ipad|ipod/i.test(ua);

  if (isIOSDevice) {
    const isOtherIOSBrowser = /crios|fxios|edgios|opios/i.test(ua);
    return isOtherIOSBrowser ? 'ios-other' : 'ios-safari';
  }
  if (/samsungbrowser/i.test(ua)) return 'samsung';
  if (/firefox|fxios/i.test(ua)) return 'firefox';
  if (/edg/i.test(ua)) return 'edge';
  if (/chrome|crios/i.test(ua)) return 'chrome';
  return 'other';
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      Capacitor.isNativePlatform() ||
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  });
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [browserType, setBrowserType] = useState<BrowserInstallTarget>('other');
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DISMISS_STORAGE_KEY) === '1';
  });

  useEffect(() => {
    const isStandalone =
      Capacitor.isNativePlatform() ||
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);
    setBrowserType(detectBrowserTarget());

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      localStorage.setItem(DISMISS_STORAGE_KEY, '1');
      setIsBannerDismissed(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        localStorage.setItem(DISMISS_STORAGE_KEY, '1');
        setIsBannerDismissed(true);
        return true;
      }
      setDeferredPrompt(null);
      return false;
    } catch {
      return false;
    }
  };

  const dismissBanner = () => {
    localStorage.setItem(DISMISS_STORAGE_KEY, '1');
    setIsBannerDismissed(true);
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    browserType,
    isBannerDismissed,
    dismissBanner,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
