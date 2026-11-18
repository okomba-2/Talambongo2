import React from 'react';
import { Eye } from 'lucide-react';

interface NavbarProps {
  onStart?: () => void;
}

export const Navbar: React.FC<NavbarProps> = () => {
  return (
    <header
      id="landing-navbar"
      className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-gray-100/80 transition-all"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
        {/* Brand Logo & Name: Horizontal Eye + TalaMbongo */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Eye className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 stroke-[2.4] shrink-0" />
          <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900 leading-none">
            TalaMbongo
          </span>
        </div>
      </div>
    </header>
  );
};
