import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ChevronUp, ChevronDown, Pause, Play } from "lucide-react";

import pic1 from "@/images/pic_1.png";
import pic2 from "@/images/pic_2.png";
import pic3 from "@/images/pic_3.png";
import pic4 from "@/images/pic_4.png";

export interface WaitingSlide {
  image: string;
  title?: string;
  description?: string;
}

const DEFAULT_SLIDES: WaitingSlide[] = [
  { image: pic1 },
  { image: pic2 },
  { image: pic3 },
  { image: pic4 },
];

const AUTO_ADVANCE_MS = 10_000; // 10 seconds per slide, infinite loop

interface WaitingSliderProps {
  slides?: WaitingSlide[];
  statusText?: string;
}

export default function WaitingSlider({ slides = DEFAULT_SLIDES, statusText = "Analyzing…" }: WaitingSliderProps) {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => (i + delta + slides.length) % slides.length);
    },
    [slides.length]
  );

  useEffect(() => {
    if (isPaused || slides.length <= 1) return;
    const t = setInterval(() => go(1), AUTO_ADVANCE_MS);
    return () => clearInterval(t);
  }, [isPaused, go, slides.length]);

  const slide = slides[index];

  return (
    <div className="w-full max-w-lg md:max-w-4xl mx-auto flex flex-col items-center justify-center gap-4 md:gap-5 px-4">
      {/* Badge: spinner + status (Lovable-style) */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
        <span className="text-xs font-medium">{statusText}</span>
      </div>

      {/* Slider row: [dots] card [buttons] on desktop; stacked on mobile */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-5 w-full">
        {/* Dots – one per slide, vertical on desktop, horizontal on mobile */}
        <div className="flex flex-row md:flex-col gap-2 order-2 md:order-1">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className="w-2 h-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 shrink-0"
              style={{
                backgroundColor: i === index ? "var(--primary)" : "rgba(255,255,255,0.25)",
              }}
              aria-label={`Slide ${i + 1} of ${slides.length}`}
              aria-pressed={i === index}
            />
          ))}
        </div>

        {/* Card – larger on desktop */}
        <div className="order-1 md:order-2 w-full max-w-md md:max-w-2xl rounded-2xl md:rounded-3xl overflow-hidden border border-white/10 bg-white/[0.06] shadow-xl">
          <div className="aspect-video w-full bg-muted/30 relative overflow-hidden flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.img
                key={index}
                src={slide.image}
                alt={slide.title || `Slide ${index + 1}`}
                className="w-full h-full object-contain"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://placehold.co/640x360/1a1a2e/4ade80?text=Slide";
                }}
              />
            </AnimatePresence>
          </div>
          {(slide.title || slide.description) && (
            <div className="p-4 md:p-5">
              {slide.title && (
                <h3 className="text-sm font-semibold text-foreground mb-1">{slide.title}</h3>
              )}
              {slide.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">{slide.description}</p>
              )}
            </div>
          )}
        </div>

        {/* Prev / Pause / Next – vertical on desktop, horizontal on mobile */}
        <div className="flex flex-row md:flex-col gap-2 order-3">
          <button
            type="button"
            onClick={() => go(-1)}
            className="p-2 rounded-full border border-white/15 bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
            aria-label="Previous slide"
          >
            <ChevronUp className="w-4 h-4 rotate-90 md:rotate-0" />
          </button>
          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            className="p-2 rounded-full border border-white/15 bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
            aria-label={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="p-2 rounded-full border border-white/15 bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
            aria-label="Next slide"
          >
            <ChevronDown className="w-4 h-4 rotate-90 md:rotate-0" />
          </button>
        </div>
      </div>
    </div>
  );
}
