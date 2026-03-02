"use client";
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface BannerSlide {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
  image?: string;
  bgColor: string;
  textColor?: string;
}

const defaultSlides: BannerSlide[] = [
  {
    id: '1',
    title: 'Nueva Coleccion Primavera',
    subtitle: 'Descubre los estilos mas frescos de la temporada con hasta 40% de descuento',
    ctaText: 'Comprar ahora',
    ctaHref: '/productos?temporada=primavera',
    bgColor: 'from-brand-600 to-brand-800',
    textColor: 'text-white',
  },
  {
    id: '2',
    title: 'Tecnologia de Vanguardia',
    subtitle: 'Los mejores dispositivos al precio mas competitivo del mercado',
    ctaText: 'Ver electronicos',
    ctaHref: '/productos?categoria=electronicos',
    bgColor: 'from-neutral-800 to-neutral-900',
    textColor: 'text-white',
  },
  {
    id: '3',
    title: 'Ofertas Flash - Solo hoy',
    subtitle: 'Hasta 60% en productos seleccionados. Aprovecha antes de que se agoten.',
    ctaText: 'Ver ofertas',
    ctaHref: '/productos?oferta=true',
    bgColor: 'from-error-600 to-error-800',
    textColor: 'text-white',
  },
];

interface HeroBannerProps {
  slides?: BannerSlide[];
}

export function HeroBanner({ slides = defaultSlides }: HeroBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slides.length, isAutoPlaying]);

  const goTo = (index: number) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const prev = () => goTo((currentIndex - 1 + slides.length) % slides.length);
  const next = () => goTo((currentIndex + 1) % slides.length);

  const slide = slides[currentIndex];

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Slide */}
      <div
        className={cn(
          'relative min-h-[400px] md:min-h-[500px] bg-gradient-to-r flex items-center',
          slide.bgColor
        )}
      >
        {slide.image && (
          <Image
            src={slide.image}
            alt={slide.title}
            fill
            className="object-cover mix-blend-overlay opacity-30"
            priority
          />
        )}
        <div className="relative z-10 px-8 md:px-16 py-12 max-w-2xl">
          <h1
            className={cn(
              'text-3xl md:text-5xl font-bold leading-tight mb-4',
              slide.textColor
            )}
          >
            {slide.title}
          </h1>
          <p
            className={cn(
              'text-base md:text-lg mb-8 opacity-90',
              slide.textColor
            )}
          >
            {slide.subtitle}
          </p>
          <Link href={slide.ctaHref}>
            <Button size="lg" variant="secondary" className="font-semibold">
              {slide.ctaText}
            </Button>
          </Link>
        </div>
      </div>

      {/* Navigation */}
      {slides.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={cn(
                  'h-2 rounded-full transition-all',
                  i === currentIndex ? 'w-8 bg-white' : 'w-2 bg-white/50'
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
