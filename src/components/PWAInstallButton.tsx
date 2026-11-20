import React, { useState } from 'react';
import { Download, Smartphone, CheckCircle2, X } from 'lucide-react';
import { BrowserInstallTarget, usePWAInstall } from '../hooks/usePWAInstall';

interface InstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  browserType: BrowserInstallTarget;
  isInstallable: boolean;
  isInstalled: boolean;
  onNativeInstall: () => Promise<boolean>;
}

export const InstallGuideModal: React.FC<InstallGuideModalProps> = ({
  isOpen,
  onClose,
  browserType,
  isInstallable,
  isInstalled,
  onNativeInstall,
}) => {
  if (!isOpen) return null;

  const isSafariIOS = browserType === 'ios-safari';
  const isOtherIOS = browserType === 'ios-other';
  const isFirefox = browserType === 'firefox';

  const steps: string[] = isSafariIOS
    ? [
        'Appuyez sur le bouton Partager (⎙) dans la barre de Safari.',
        'Sélectionnez "Sur l\'écran d\'accueil".',
        'Confirmez l\'installation en appuyant sur "Ajouter".',
      ]
    : isOtherIOS
    ? [
        'Appuyez sur l\'icône Partager (⎙) ou les trois points en haut de votre navigateur.',
        'Sélectionnez "Ajouter à l\'écran d\'accueil".',
        'Confirmez l\'installation.',
      ]
    : isFirefox
    ? [
        'Appuyez sur les trois points en haut ou en bas de votre navigateur.',
        'Sélectionnez "Installer" ou "Ajouter à l\'écran d\'accueil".',
        'Confirmez l\'installation.',
      ]
    : [
        'Appuyez sur les trois points en haut de votre navigateur.',
        'Sélectionnez "Ajouter à l\'écran d\'accueil".',
        'Confirmez l\'installation.',
      ];

  const handleNativeClick = async () => {
    const installed = await onNativeInstall();
    if (installed) {
      onClose();
    }
  };

  return (
    <div
      id="pwa-install-guide-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-guide-title"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 id="install-guide-title" className="text-base font-bold text-gray-900">
                Installer TalaMbongo
              </h3>
              <p className="text-[11px] text-gray-500">
                Pour installer l&apos;application :
              </p>
            </div>
          </div>
          <button
            id="pwa-install-guide-close-btn"
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isInstalled && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-2 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>TalaMbongo est déjà installée sur cet appareil.</span>
          </div>
        )}

        <ol className="space-y-3 text-sm text-gray-700">
          {steps.map((stepText, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center mt-0.5">
                {idx + 1}
              </span>
              <span className="leading-snug">{stepText}</span>
            </li>
          ))}
        </ol>

        <div className="pt-1 space-y-2">
          {isInstallable && !isInstalled && (
            <button
              id="pwa-install-guide-native-btn"
              type="button"
              onClick={handleNativeClick}
              className="w-full rounded-2xl bg-emerald-600 py-2.5 px-4 text-sm font-bold text-white hover:bg-emerald-700 transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Installer directement</span>
            </button>
          )}
          <button
            id="pwa-install-guide-confirm-btn"
            type="button"
            onClick={onClose}
            className={`w-full rounded-2xl py-2.5 px-4 text-sm font-semibold transition cursor-pointer ${
              isInstallable && !isInstalled
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            J&apos;ai compris
          </button>
        </div>
      </div>
    </div>
  );
};

interface DiscreteInstallBannerProps {
  visible: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}

export const DiscreteInstallBanner: React.FC<DiscreteInstallBannerProps> = ({
  visible,
  onInstall,
  onDismiss,
}) => {
  if (!visible) return null;

  return (
    <div
      id="discrete-pwa-install-banner"
      className="mb-5 px-3.5 py-2.5 rounded-2xl bg-white border border-gray-200/80 shadow-xs flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
          <Download className="w-3.5 h-3.5 text-emerald-600" />
        </div>
        <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate">
          Voulez-vous installer l&apos;application ?
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          id="discrete-pwa-install-btn"
          type="button"
          onClick={onInstall}
          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
        >
          Installer
        </button>
        <button
          id="discrete-pwa-dismiss-btn"
          type="button"
          onClick={onDismiss}
          aria-label="Fermer"
          title="Fermer"
          className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'compact' | 'banner' | 'pill';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'pill',
}) => {
  const { isInstallable, isInstalled, browserType, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowGuide(true);
      }
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        id={variant === 'compact' ? 'pwa-install-compact-btn' : 'pwa-install-btn'}
        type="button"
        onClick={handleClick}
        aria-label="Installer TalaMbongo sur l'écran d'accueil"
        title="Installer l'application"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer ${className}`}
      >
        <Download className="w-3.5 h-3.5 text-emerald-600" />
        <span>Installer</span>
      </button>

      <InstallGuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        browserType={browserType}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        onNativeInstall={install}
      />
    </>
  );
};
