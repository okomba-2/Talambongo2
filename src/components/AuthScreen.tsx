import React, { useState } from 'react';
import { Eye, EyeOff, ArrowLeft, Mail, Lock, User, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
} from 'firebase/auth';
import { auth, browserPopupRedirectResolver, googleProvider } from '../firebase';

interface AuthScreenProps {
  onSuccess: (user: { name: string; email: string }, mode: 'signup' | 'login') => void;
  onBack: () => void;
  initialMode?: 'signup' | 'login';
}

function getFriendlyFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const rawMessage = err instanceof Error ? err.message : String(err || '');
  const currentHost =
    typeof window !== 'undefined' ? window.location.hostname : '';

  if (code === 'auth/unauthorized-domain' || rawMessage.includes('auth/unauthorized-domain')) {
    return `Ce domaine (${currentHost}) n’est pas encore autorisé pour la connexion Google. Ajoute « ${currentHost} » dans Firebase Console → Authentication → Settings → Authorized domains.`;
  }

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Adresse e-mail ou mot de passe incorrect.';
    case 'auth/email-already-in-use':
      return 'Un compte existe déjà avec cette adresse e-mail. Connecte-toi.';
    case 'auth/weak-password':
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    case 'auth/invalid-email':
      return 'L’adresse e-mail saisie n’est pas valide.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Réessaie dans quelques instants.';
    case 'auth/popup-closed-by-user':
      return 'La fenêtre de connexion Google a été fermée avant la fin.';
    case 'auth/popup-blocked':
      return 'Ton navigateur a bloqué la fenêtre Google. Autorise les popups puis réessaie.';
    case 'auth/operation-not-allowed':
      return 'La connexion par e-mail/mot de passe n’est pas encore activée dans Firebase Console. Utilise « Continuer avec Google » ci-dessous ou active Email/Password dans Authentication > Sign-in method.';
    default:
      return rawMessage || 'Une erreur est survenue lors de l’authentification.';
  }
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onSuccess,
  onBack,
  initialMode = 'signup',
}) => {
  const [mode, setMode] = useState<'signup' | 'login' | 'forgot'>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim();

    try {
      if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, trimmedEmail);
        setInfoMessage('Un lien de réinitialisation a été envoyé à ton adresse e-mail.');
        setLoading(false);
        return;
      }

      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        const resolvedName = trimmedName || trimmedEmail.split('@')[0] || 'Utilisateur TalaMbongo';
        if (cred.user) {
          await updateProfile(cred.user, { displayName: resolvedName });
        }
        onSuccess(
          {
            name: resolvedName,
            email: cred.user.email || trimmedEmail,
          },
          'signup'
        );
      } else {
        const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        const fallbackName = trimmedEmail.split('@')[0].replace('.', ' ');
        const resolvedName =
          cred.user.displayName ||
          fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1);
        onSuccess(
          {
            name: resolvedName,
            email: cred.user.email || trimmedEmail,
          },
          'login'
        );
      }
    } catch (err) {
      setErrorMessage(getFriendlyFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
      const userEmail = cred.user.email || '';
      const userName =
        cred.user.displayName ||
        (userEmail ? userEmail.split('@')[0] : 'Utilisateur TalaMbongo');

      onSuccess(
        {
          name: userName,
          email: userEmail,
        },
        mode === 'signup' ? 'signup' : 'login'
      );
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      // Fallback automatique par redirection si la popup est bloquée ou non supportée dans l'environnement déployé (PWA/mobile)
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          sessionStorage.setItem('talambongo_pending_auth_mode', mode === 'signup' ? 'signup' : 'login');
          await signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
          return;
        } catch (redirectErr) {
          setErrorMessage(getFriendlyFirebaseAuthError(redirectErr));
        }
      } else {
        setErrorMessage(getFriendlyFirebaseAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-screen" className="min-h-screen bg-[#fafbfc] flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar with Back Button and Brand */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between pt-2 sm:pt-4">
        <button
          id="auth-back-btn"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition p-2 rounded-xl hover:bg-white border border-transparent hover:border-gray-200 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
            <Eye className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-gray-900 text-base">TalaMbongo</span>
        </div>

        <div className="w-12" />
      </div>

      {/* Main Form Container */}
      <div className="max-w-md w-full mx-auto my-auto py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-3xl p-6 sm:p-9 border border-gray-100 shadow-xs space-y-6"
        >
          {/* Header Texts */}
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              {mode === 'forgot'
                ? 'Mot de passe oublié ?'
                : mode === 'login'
                ? 'Bon retour parmi nous'
                : 'Bienvenue sur TalaMbongo'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 font-normal">
              {mode === 'forgot'
                ? 'Indique ton e-mail pour recevoir les instructions.'
                : mode === 'login'
                ? 'Connecte-toi pour retrouver tes dépenses.'
                : 'Commence à mieux comprendre tes dépenses.'}
            </p>
          </div>

          {infoMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Nom complet (uniquement à l'inscription, placé tout en haut) */}
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 block">
                  Nom complet
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-fullname-input"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex : Jean Kabila"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#fafbfc] border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                  />
                </div>
              </div>
            )}

            {/* 2. Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 block">
                Adresse e-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@exemple.com"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#fafbfc] border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                />
              </div>
            </div>

            {/* 3. Mot de passe avec bouton Afficher / Masquer */}
            {mode !== 'forgot' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700 block">
                    Mot de passe
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setInfoMessage(null);
                        setErrorMessage(null);
                      }}
                      className="text-[11px] text-emerald-700 hover:text-emerald-800 font-medium cursor-pointer"
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-11 py-3 rounded-2xl bg-[#fafbfc] border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                  />
                  <button
                    id="auth-toggle-password-visibility"
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* 4. Bouton « S'inscrire » / « Se connecter » */}
            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : mode === 'forgot' ? (
                'Envoyer le lien'
              ) : mode === 'signup' ? (
                "S'inscrire"
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          {/* Separator "ou" */}
          {mode !== 'forgot' && (
            <>
              <div className="relative flex items-center justify-center">
                <div className="w-full border-t border-gray-100" />
                <span className="bg-white px-3 text-xs text-gray-400 font-medium absolute">
                  ou
                </span>
              </div>

              {/* Google Button */}
              <button
                id="auth-google-btn"
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#fafbfc] hover:bg-gray-50 border border-gray-200 text-gray-800 font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-3 cursor-pointer"
              >
                {/* Google Multi-Color SVG Icon */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.16 0 9.97 0 12s.45 3.84 1.24 5.42l4.04-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continuer avec Google</span>
              </button>
            </>
          )}

          {/* Bottom Switcher: Déjà un compte ? Se connecter / Pas de compte ? Créer un compte */}
          <div className="pt-2 text-center text-xs text-gray-500 font-medium">
            {mode === 'signup' && (
              <p>
                Déjà un compte ?{' '}
                <button
                  id="auth-toggle-login-btn"
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setInfoMessage(null);
                    setErrorMessage(null);
                  }}
                  className="font-bold text-emerald-700 hover:text-emerald-800 underline underline-offset-2 cursor-pointer"
                >
                  Se connecter
                </button>
              </p>
            )}

            {mode === 'login' && (
              <p>
                Pas encore de compte ?{' '}
                <button
                  id="auth-toggle-signup-btn"
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setInfoMessage(null);
                    setErrorMessage(null);
                  }}
                  className="font-bold text-emerald-700 hover:text-emerald-800 underline underline-offset-2 cursor-pointer"
                >
                  Créer un compte
                </button>
              </p>
            )}

            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setInfoMessage(null);
                  setErrorMessage(null);
                }}
                className="font-bold text-emerald-700 hover:text-emerald-800 underline underline-offset-2 cursor-pointer"
              >
                Retour à la connexion
              </button>
            )}
          </div>
        </motion.div>
      </div>

      {/* Security & Trial notice */}
      <div className="max-w-md mx-auto text-center text-[11px] text-gray-400 pb-2">
        Essai gratuit de 7 jours • Chiffrement sécurisé • Données strictement privées
      </div>
    </div>
  );
};
