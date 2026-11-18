import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface State {
  hasError: boolean;
  errorMessage: string | null;
}

export class FirebaseErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Une erreur inattendue est survenue.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  private getReadableMessage(): string {
    if (!this.state.errorMessage) {
      return 'Une erreur de connexion aux données est survenue.';
    }
    try {
      const parsed = JSON.parse(this.state.errorMessage);
      if (parsed?.error?.includes('Missing or insufficient permissions')) {
        return 'Accès refusé par les règles de sécurité Firebase. Vérifie ton compte ou reconnecte-toi.';
      }
      if (parsed?.error?.includes('Quota exceeded')) {
        return 'Le quota quotidien de la base de données est temporairement atteint.';
      }
      if (parsed?.error) {
        return String(parsed.error);
      }
    } catch {
      // Non-JSON error message
    }
    return this.state.errorMessage;
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f5faf7] flex items-center justify-center p-6 font-['Plus_Jakarta_Sans',sans-serif]">
          <div className="max-w-md w-full bg-white rounded-3xl border border-emerald-100 p-8 text-center space-y-5 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-extrabold text-gray-900">
                Incident de session détecté
              </h1>
              <p className="text-sm text-gray-600 leading-relaxed">
                {this.getReadableMessage()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-3 px-5 rounded-2xl bg-[#087A50] hover:bg-[#063D2E] text-white font-bold text-sm transition inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
              <span>Recharger l’application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
