import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      id="offline-banner"
      role="status"
      className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 z-50 flex items-center gap-2.5 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-medium text-white shadow-lg shadow-amber-900/10"
    >
      <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
      <span>Mode hors ligne actif — Tes dépenses restent enregistrées localement.</span>
    </div>
  );
};
