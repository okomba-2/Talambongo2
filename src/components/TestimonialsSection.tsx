import React, { useRef } from 'react';
import { Star, MessageSquareQuote, ChevronLeft, ChevronRight } from 'lucide-react';
import { INITIAL_TESTIMONIALS } from '../data/initialData';

export const TestimonialsSection: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -320 : 320;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Duplicate list to allow infinite marquee look on desktop and seamless swipe on mobile
  const testimonials = [...INITIAL_TESTIMONIALS, ...INITIAL_TESTIMONIALS];

  return (
    <section id="testimonials-section" className="py-16 sm:py-24 bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 sm:mb-12">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold mb-3 border border-emerald-100">
              <MessageSquareQuote className="w-3.5 h-3.5 text-emerald-600" />
              <span>Témoignages réels</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Ils commencent à mieux comprendre leur argent.
            </h2>
          </div>

          {/* Manual scroll buttons for desktop & tablet */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => scroll('left')}
              aria-label="Avis précédent"
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              aria-label="Avis suivant"
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Scrolling Banner Container */}
      <div className="relative w-full">
        {/* Subtle gradient fades on edges */}
        <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

        <div
          ref={scrollRef}
          className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 px-4 sm:px-8 no-scrollbar scroll-smooth snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {testimonials.map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              className="w-[280px] sm:w-[340px] shrink-0 snap-start p-6 rounded-2xl bg-[#fafbfc] border border-gray-100 hover:border-emerald-200 transition-all flex flex-col justify-between space-y-4"
            >
              {/* Top rating & Quote */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-emerald-600">
                    {[...Array(item.rating || 5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" />
                    ))}
                  </div>
                  <span className="text-[11px] text-gray-400 font-medium">Vérifié</span>
                </div>

                <p className="text-sm text-gray-700 leading-relaxed italic font-normal">
                  « {item.quote} »
                </p>
              </div>

              {/* Author details */}
              <div className="pt-3 border-t border-gray-100/90 flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-gray-800 shrink-0"
                  style={{ backgroundColor: item.avatarBg }}
                >
                  {item.initials}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900 leading-tight">{item.name}</h4>
                  <p className="text-[11px] text-gray-500 font-medium">{item.country}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
