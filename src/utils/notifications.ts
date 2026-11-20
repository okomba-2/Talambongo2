export type BrowserNotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as BrowserNotificationPermission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    return result as BrowserNotificationPermission;
  } catch {
    return getBrowserNotificationPermission();
  }
}

export async function sendBrowserNotification(
  title: string,
  options?: NotificationOptions
): Promise<boolean> {
  if (getBrowserNotificationPermission() !== 'granted') {
    return false;
  }

  const notificationOptions: NotificationOptions = {
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    ...options,
  };

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(title, notificationOptions);
        return true;
      }
    }
  } catch {
    // Fallback sur Notification standard ci-dessous
  }

  try {
    new Notification(title, notificationOptions);
    return true;
  } catch {
    return false;
  }
}
