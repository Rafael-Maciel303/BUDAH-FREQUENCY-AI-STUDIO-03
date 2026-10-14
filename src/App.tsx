/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  ShieldCheck,
  Headphones,
  Sparkles,
  Download,
  CheckCircle2,
  HelpCircle,
  Mail,
  ChevronDown,
  Maximize2,
  RotateCcw,
  Play,
  Lock,
  ArrowRight,
  X,
  FileText
} from 'lucide-react';

// === CONFIG (put at the very top of the code, easy to edit) ===
export const BRAND_NAME = "Budah Frequency";
export const VSL_EMBED_SRC = "https://player.mediadelivery.net/embed/778341/698202b7-6d68-43d8-a7a3-694dcdf7f34d?autoplay=true&loop=false&muted=true&preload=true&responsive=true";   // Bunny Stream vertical VSL (iframe)
export const VSL_EMBED_CODE = `<div style="position:relative;padding-top:177.78%;"><iframe src="https://player.mediadelivery.net/embed/778341/698202b7-6d68-43d8-a7a3-694dcdf7f34d?autoplay=true&loop=false&muted=true&preload=true&responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;fullscreen;" allowfullscreen="true"></iframe></div>`;   // exact embed code from Bunny, use it as the player
export const VSL_ASPECT = "9/16";   // vertical video
export const CHECKOUT_URL = "https://pay.hotmart.com/C107987859R";
export const BUY_BUTTON_APPEAR_AT = "21:55";   // mm:ss of REAL video time
export const PRICE = "$37";
export const GUARANTEE_DAYS = 7;   // MUST match the guarantee configured in Hotmart; owner will confirm
export const CONTACT_EMAIL = "support@yourdomain.com";   // placeholder, owner will replace
export const testMode = false;   // when true, the delayed buy button shows immediately

// Parse mm:ss to seconds
function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 1315; // default 21:55 = 1315 seconds
}

const TARGET_BUY_SECONDS = parseTimeToSeconds(BUY_BUTTON_APPEAR_AT);

// Track custom Meta Pixel events safely
function trackPixel(eventName: string, params?: Record<string, unknown>, isCustom: boolean = false) {
  try {
    if (typeof window !== 'undefined' && (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq) {
      if (isCustom) {
        (window as unknown as { fbq: (...args: unknown[]) => void }).fbq('trackCustom', eventName, params);
      } else {
        (window as unknown as { fbq: (...args: unknown[]) => void }).fbq('track', eventName, params);
      }
    }
  } catch (err) {
    console.warn('Meta Pixel call skipped:', err);
  }
}

// Global checkout handler
function handleCheckout(source: string) {
  trackPixel('InitiateCheckout', {
    content_name: BRAND_NAME,
    value: 37,
    currency: 'USD',
    source: source,
  });
  window.open(CHECKOUT_URL, '_blank', 'noopener,noreferrer');
}

export default function App() {
  // Video player states
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerInstanceRef = useRef<any>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showBuyButton, setShowBuyButton] = useState(testMode);
  const [savedResumeTime, setSavedResumeTime] = useState<number | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeModal, setActiveModal] = useState<'privacy' | 'terms' | 'refund' | null>(null);

  // Milestone refs to ensure 25%, 50%, 75% are fired strictly ONCE
  const milestone25Fired = useRef(false);
  const milestone50Fired = useRef(false);
  const milestone75Fired = useRef(false);

  // Check URL query parameters for test mode (e.g. ?test=true)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('test') === 'true' || urlParams.get('testMode') === 'true' || testMode) {
        setShowBuyButton(true);
      }
      
      // Check saved progress from previous session
      try {
        const stored = localStorage.getItem('budah_frequency_vsl_time');
        if (stored) {
          const parsed = parseFloat(stored);
          if (parsed > 15 && parsed < 2000) {
            setSavedResumeTime(parsed);
            setShowResumeBanner(true);
          }
        }
      } catch (e) {
        // LocalStorage access may be restricted in some iframes
      }
    }
  }, []);

  // Initialize Bunny Player.js
  useEffect(() => {
    let checkTimer: NodeJS.Timeout | null = null;
    let fallbackTimer: NodeJS.Timeout | null = null;

    const initPlayer = () => {
      const win = window as any;
      if (win.playerjs && iframeRef.current) {
        try {
          const player = new win.playerjs.Player(iframeRef.current);
          playerInstanceRef.current = player;

          player.on('ready', () => {
            setIsPlayerReady(true);
            player.getDuration((d: number) => {
              if (d && !isNaN(d)) setDuration(d);
            });
          });

          player.on('timeupdate', (data: { seconds: number; duration: number }) => {
            const sec = data.seconds || 0;
            const dur = data.duration || 0;
            setCurrentTime(sec);
            if (dur && !isNaN(dur)) setDuration(dur);

            // Milestone tracking based on REAL playback time
            if (dur > 0) {
              const fraction = sec / dur;
              if (fraction >= 0.25 && !milestone25Fired.current) {
                milestone25Fired.current = true;
                trackPixel('VideoWatched25', { duration: dur, seconds: sec }, true);
              }
              if (fraction >= 0.50 && !milestone50Fired.current) {
                milestone50Fired.current = true;
                trackPixel('VideoWatched50', { duration: dur, seconds: sec }, true);
              }
              if (fraction >= 0.75 && !milestone75Fired.current) {
                milestone75Fired.current = true;
                trackPixel('VideoWatched75', { duration: dur, seconds: sec }, true);
              }
            }

            // Delayed buy button reveal based on REAL playback time
            if (sec >= TARGET_BUY_SECONDS) {
              setShowBuyButton(true);
            }

            // Save resume position
            if (sec > 10 && Math.floor(sec) % 4 === 0) {
              try {
                localStorage.setItem('budah_frequency_vsl_time', sec.toString());
              } catch (e) {}
            }
          });
        } catch (err) {
          console.warn('Player.js initialization note:', err);
        }
      }
    };

    // Retry checking if playerjs script is ready
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const win = window as any;
      if (win.playerjs && iframeRef.current) {
        clearInterval(interval);
        initPlayer();
      } else if (attempts > 30) {
        clearInterval(interval);
      }
    }, 250);

    // 8-second fallback timer if Player.js takes too long
    fallbackTimer = setTimeout(() => {
      if (!isPlayerReady) {
        setIsPlayerReady(true);
      }
    }, 8000);

    return () => {
      clearInterval(interval);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (checkTimer) clearTimeout(checkTimer);
    };
  }, []);

  // Handler for user clicking "Tap to listen"
  const handleStartListening = (resumeAt?: number) => {
    setHasStarted(true);
    setShowResumeBanner(false);
    const player = playerInstanceRef.current;
    if (player) {
      try {
        player.unmute();
        if (typeof resumeAt === 'number' && resumeAt > 0) {
          player.setCurrentTime(resumeAt);
        } else {
          player.setCurrentTime(0);
        }
        player.play();
      } catch (err) {
        console.warn('Player command note:', err);
      }
    }
  };

  const handleFullscreenToggle = () => {
    if (iframeRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        iframeRef.current.requestFullscreen().catch(() => {});
      }
    }
  };

  // Easing progress for psychological progress bar:
  // Starts fast and smoothly decelerates, based on real time
  const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : Math.min(1, currentTime / 1400);
  const smoothedProgressPercent = Math.min(100, Math.pow(progressRatio, 0.6) * 100);

  // Format seconds to mm:ss
  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainingSecs = Math.floor(sec % 60);
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  return (
    <div className="relative min-h-screen bg-[#05070d] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Background Aurora Drift Layers */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        {/* Soft Teal Aurora */}
        <div className="absolute -top-[15%] left-[10%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full bg-teal-500/10 blur-[130px] animate-aurora-1" />
        {/* Deep Violet Aurora */}
        <div className="absolute top-[35%] right-[5%] w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] rounded-full bg-violet-600/10 blur-[140px] animate-aurora-2" />
        {/* Subtle Amber Glow */}
        <div className="absolute bottom-[10%] left-[20%] w-[45vw] h-[45vw] max-w-[600px] max-h-[600px] rounded-full bg-amber-500/5 blur-[150px] animate-aurora-3" />
      </div>

      {/* STICKY TOP BAR (3-Zone Contract, strictly <= 15% mobile viewport height) */}
      <header className="sticky top-0 z-40 w-full h-14 md:h-16 bg-[#05070d]/85 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto h-full flex items-center justify-between gap-4">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#"
            className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-white hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
          >
            {BRAND_NAME}
          </a>

          {/* Zone 2: Concise single-line navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-medium text-slate-300">
            <a href="#vsl-section" className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0">
              Video
            </a>
            <a href="#what-is" className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0">
              About
            </a>
            <a href="#frequencies" className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0">
              12 Frequencies
            </a>
            <a href="#whats-included" className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0">
              Included
            </a>
            <a href="#faq" className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0">
              FAQ
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              onClick={() => handleCheckout('sticky_top_bar')}
              className="btn-gold-glow bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-bold px-3.5 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm rounded-full flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Get Access</span>
              <span className="hidden xs:inline">· {PRICE}</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="relative z-10 flex-1 flex flex-col items-center w-full">
        {/* ========================================================= */}
        {/* 1. HERO SECTION */}
        {/* ========================================================= */}
        <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-8 sm:pt-16 sm:pb-12 text-center">
          {/* Subtle sound wave accent SVG */}
          <div className="flex justify-center items-center gap-1.5 mb-5 opacity-80" aria-hidden="true">
            <span className="w-1 h-3 bg-amber-400/70 rounded-full animate-pulse" />
            <span className="w-1 h-6 bg-teal-400/80 rounded-full animate-pulse [animation-delay:150ms]" />
            <span className="w-1 h-8 bg-amber-300 rounded-full animate-pulse [animation-delay:300ms]" />
            <span className="w-1 h-10 bg-teal-300 rounded-full animate-pulse [animation-delay:450ms]" />
            <span className="w-1 h-8 bg-amber-300 rounded-full animate-pulse [animation-delay:300ms]" />
            <span className="w-1 h-6 bg-teal-400/80 rounded-full animate-pulse [animation-delay:150ms]" />
            <span className="w-1 h-3 bg-amber-400/70 rounded-full animate-pulse" />
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-white leading-[1.15] max-w-4xl mx-auto">
            Harmonize Your Mind and Awaken Deep Inner Stillness
          </h1>

          <p className="mt-5 sm:mt-6 text-base sm:text-lg text-slate-300 font-light max-w-2xl mx-auto leading-relaxed">
            A curated digital sanctuary of 12 Solfeggio &amp; harmonic healing audio frequencies designed to quiet mental noise, deepen meditation, and restore natural tranquility.
          </p>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 max-w-md mx-auto">
            <a
              href="#vsl-section"
              className="w-full sm:w-auto px-6 py-3 rounded-full glass-panel hover:bg-white/10 text-white font-medium text-sm sm:text-base transition-all border border-white/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>Watch the Video</span>
            </a>

            <button
              onClick={() => handleCheckout('hero_cta')}
              className="w-full sm:w-auto btn-gold-glow bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-bold px-7 py-3 rounded-full text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Buy Now – {PRICE}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-3 text-xs text-slate-400">
            <span>Instant Digital Access</span>
            <span aria-hidden="true">·</span>
            <span>{GUARANTEE_DAYS}-Day Guarantee</span>
            <span aria-hidden="true">·</span>
            <span>Universal MP3 Format</span>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 2. VSL PLAYER SECTION (Bunny Stream Vertical 9:16) */}
        {/* ========================================================= */}
        <section id="vsl-section" className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col items-center">
          <div className="text-center mb-6">
            <span className="text-xs uppercase tracking-widest text-amber-400/90 font-medium">Video Presentation</span>
            <h2 className="font-serif text-2xl sm:text-3xl text-white mt-1">Discover the Power of Frequency</h2>
          </div>

          {/* Vertical Video Container (Mobile fills screen, desktop max ~400px, 9:16 aspect ratio) */}
          <div className="w-full max-w-[390px] mx-auto relative rounded-3xl overflow-hidden shadow-[0_12px_45px_rgba(0,0,0,0.85)] border border-white/15 bg-slate-950">
            {/* The 9:16 Aspect Ratio Embed Wrapper (177.78% padding-top) */}
            <div className="relative w-full" style={{ paddingTop: '177.78%' }}>
              <iframe
                ref={iframeRef}
                src={VSL_EMBED_SRC}
                loading="lazy"
                title={`${BRAND_NAME} Presentation`}
                className="absolute inset-0 w-full h-full border-0"
                allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;fullscreen;"
                allowFullScreen
              />

              {/* Pulsing "Tap to listen" Overlay (Active until tapped) */}
              {!hasStarted && (
                <div
                  onClick={() => handleStartListening()}
                  className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all hover:bg-slate-950/70"
                >
                  {/* Concentric Pulsing Play Icon */}
                  <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-full bg-amber-400/20 animate-ping absolute inset-0" />
                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg relative z-10 text-slate-950">
                      <Volume2 className="w-9 h-9" />
                    </div>
                  </div>

                  <h3 className="font-serif text-2xl font-bold text-white mb-2">Tap to Listen</h3>
                  <p className="text-xs sm:text-sm text-amber-200/90 font-medium max-w-xs">
                    Tap anywhere to turn on audio and start the presentation from the beginning
                  </p>

                  <div className="mt-6 px-4 py-2 rounded-full bg-white/10 text-slate-200 text-xs border border-white/20 flex items-center gap-2">
                    <Headphones className="w-3.5 h-3.5 text-amber-300" />
                    <span>Best experienced with headphones</span>
                  </div>

                  {/* Resume Prompt if previous session detected */}
                  {showResumeBanner && savedResumeTime && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartListening(savedResumeTime);
                      }}
                      className="mt-6 p-3 rounded-xl bg-teal-900/60 border border-teal-400/30 text-teal-100 text-xs flex items-center gap-2 hover:bg-teal-900/90 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4 text-teal-300 shrink-0" />
                      <span>Resume playback at {formatSeconds(savedResumeTime)}?</span>
                    </div>
                  )}
                </div>
              )}

              {/* Transparent Shield Layer after unmuted so viewers don't accidentally pause or scrub */}
              {hasStarted && (
                <div
                  className="absolute inset-0 z-10 pointer-events-auto bg-transparent select-none"
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {/* Top-Right Fullscreen Toggle Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFullscreenToggle();
                    }}
                    title="Fullscreen"
                    aria-label="Toggle Fullscreen"
                    className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white/80 hover:text-white hover:bg-black/80 transition-colors border border-white/10 cursor-pointer pointer-events-auto"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Fake Smooth Progress Bar (Non-clickable, no skipping) */}
            <div className="w-full bg-slate-900/90 border-t border-white/10 px-4 py-2.5 flex items-center gap-3 text-[11px] text-slate-400 select-none">
              <span className="font-mono tabular-nums text-slate-300">{formatSeconds(currentTime)}</span>
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${Math.max(2, smoothedProgressPercent)}%` }}
                />
              </div>
              <span className="font-mono tabular-nums text-slate-400">
                {duration > 0 ? formatSeconds(duration) : '24:30'}
              </span>
            </div>
          </div>

          {/* Small Notice below the player */}
          <p className="mt-3 text-xs text-slate-400 text-center max-w-sm">
            Please watch the full presentation without skipping to understand how these frequencies interact with your mental state.
          </p>

          {/* DELAYED BUY BUTTON (Fades in at BUY_BUTTON_APPEAR_AT or in testMode) */}
          <div
            className={`w-full max-w-md mx-auto mt-8 transition-all duration-700 ease-out transform ${
              showBuyButton
                ? 'opacity-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
          >
            <div className="p-6 rounded-2xl glass-panel border border-amber-500/30 text-center shadow-[0_0_35px_rgba(245,158,11,0.18)]">
              <span className="text-xs font-semibold text-amber-300 tracking-wider uppercase">Collection Now Available</span>
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-white mt-1 mb-2">
                Unlock {BRAND_NAME}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mb-5">
                Instant access to all 12 Solfeggio &amp; healing frequency MP3 tracks.
              </p>

              <button
                onClick={() => handleCheckout('delayed_vsl_button')}
                className="w-full btn-gold-glow bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-bold py-3.5 px-6 rounded-full text-base flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Get Instant Access – {PRICE}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="mt-4 flex items-center justify-center gap-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-400" /> Secure Checkout
                </span>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-teal-400" /> {GUARANTEE_DAYS}-Day Guarantee
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 3. WHAT IS BUDAH FREQUENCY */}
        {/* ========================================================= */}
        <section id="what-is" className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="p-8 sm:p-12 rounded-3xl glass-panel border border-white/10 relative overflow-hidden">
            {/* Subtle corner glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-2xl">
              <span className="text-xs font-semibold tracking-wider text-teal-400 uppercase">The Science of Sound</span>
              <h2 className="font-serif text-3xl sm:text-4xl text-white font-medium mt-2 mb-6">
                What is {BRAND_NAME}?
              </h2>

              <div className="space-y-4 text-slate-300 font-light text-base leading-relaxed">
                <p>
                  {BRAND_NAME} is a master-engineered audio collection comprising 12 mathematically calibrated soundscapes, harmonic overtone recordings, and ancient Solfeggio tone frequencies.
                </p>
                <p>
                  In a noisy world filled with chaotic acoustic stimuli and mental overload, pure frequencies provide your auditory system with a grounding acoustic anchor. Each track is tuned to precise vibrational cycles, inviting your nervous system to ease naturally into tranquility, focus, and quiet presence.
                </p>
                <p>
                  Engineered with pristine 320kbps fidelity, the collection delivers warm, rich acoustic resonance whether played softly on room speakers or experienced deeply through quality stereo headphones.
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="font-serif text-2xl font-bold text-amber-400">12</div>
                  <div className="text-xs text-slate-400 mt-1">Master MP3 Tracks</div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="font-serif text-2xl font-bold text-teal-400">320kbps</div>
                  <div className="text-xs text-slate-400 mt-1">Studio HD Quality</div>
                </div>
                <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="font-serif text-2xl font-bold text-violet-400">100%</div>
                  <div className="text-xs text-slate-400 mt-1">Digital &amp; Offline</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 4. BENEFITS (4–6 cards, soft wording, no medical claims) */}
        {/* ========================================================= */}
        <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-semibold tracking-wider text-amber-400 uppercase">Everyday Resonance</span>
            <h2 className="font-serif text-3xl sm:text-4xl text-white font-medium mt-2">
              Gentle Support for Mind and Spirit
            </h2>
            <p className="mt-3 text-slate-300 text-sm sm:text-base font-light">
              Experience the gentle shift as pure harmonic vibrations replace mental clutter with serene clarity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Benefit 1 */}
            <div className="p-6 rounded-2xl glass-panel-subtle hover:bg-white/[0.04] transition-all border border-white/10 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-400/20 flex items-center justify-center text-amber-300 mb-4">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-xl font-medium text-white mb-2">Deep Mental Quiet</h3>
                <p className="text-sm text-slate-300 leading-relaxed font-light">
                  Soothe the constant buzz of thoughts and create an atmosphere of peaceful mental spaciousness whenever you feel overwhelmed.
                </p>
              </div>
            </div>

            {/* Benefit 2 */}
            <div className="p-6 rounded-2xl glass-panel-subtle hover:bg-white/[0.04] transition-all border border-white/10 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-400/20 flex items-center justify-center text-teal-300 mb-4">
                  <Headphones className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-xl font-medium text-white mb-2">Meditation Ease</h3>
                <p className="text-sm text-slate-300 leading-relaxed font-light">
                  Attune your breath and attention effortlessly to steady soundscapes, allowing deeper meditative stillness without struggle.
                </p>
              </div>
            </div>

            {/* Benefit 3 */}
            <div className="p-6 rounded-2xl glass-panel-subtle hover:bg-white/[0.04] transition-all border border-white/10 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-400/20 flex items-center justify-center text-violet-300 mb-4">
                  <Volume2 className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-xl font-medium text-white mb-2">Restful Night Wind-Down</h3>
                <p className="text-sm text-slate-300 leading-relaxed font-light">
                  Signal to your mind that the busy day has concluded with ambient tones that gently accompany your evening relaxation ritual.
                </p>
              </div>
            </div>

            {/* Benefit 4 */}
            <div className="p-6 rounded-2xl glass-panel-subtle hover:bg-white/[0.04] transition-all border border-white/10 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-400/20 flex items-center justify-center text-amber-300 mb-4">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-xl font-medium text-white mb-2">Immersion in Focused Work</h3>
                <p className="text-sm text-slate-300 leading-relaxed font-light">
                  Mask external interruptions during creative tasks, reading, or deep study with non-intrusive harmonic background sound.
                </p>
              </div>
            </div>

            {/* Benefit 5 */}
            <div className="p-6 rounded-2xl glass-panel-subtle hover:bg-white/[0.04] transition-all border border-white/10 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-400/20 flex items-center justify-center text-teal-300 mb-4">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-xl font-medium text-white mb-2">Emotional Balance</h3>
                <p className="text-sm text-slate-300 leading-relaxed font-light">
                  Return to your center after intense social interactions or strenuous days by reconnecting with grounding resonant tones.
                </p>
              </div>
            </div>

            {/* Benefit 6 */}
            <div className="p-6 rounded-2xl glass-panel-subtle hover:bg-white/[0.04] transition-all border border-white/10 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-400/20 flex items-center justify-center text-violet-300 mb-4">
                  <Download className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-xl font-medium text-white mb-2">Sanctuary Anywhere</h3>
                <p className="text-sm text-slate-300 leading-relaxed font-light">
                  Enjoy complete offline freedom. Download the tracks onto your phone or tablet for airplane travel, retreats, or quiet walks.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 5. HOW IT WORKS (3 steps) */}
        {/* ========================================================= */}
        <section className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-semibold tracking-wider text-teal-400 uppercase">Simplicity &amp; Ease</span>
            <h2 className="font-serif text-3xl sm:text-4xl text-white font-medium mt-2">
              How to Experience {BRAND_NAME}
            </h2>
            <p className="mt-3 text-slate-300 text-sm sm:text-base font-light">
              No technical expertise or complicated spiritual rituals required. Three easy steps to incorporate sound into your routine.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl glass-panel border border-white/10 relative">
              <span className="font-serif text-4xl font-bold text-amber-400/40 select-none">01</span>
              <h3 className="font-serif text-xl font-medium text-white mt-3 mb-2">Choose Your Frequency</h3>
              <p className="text-sm text-slate-300 leading-relaxed font-light">
                Pick the track that resonates with your current mood or intention—whether unwinding in the evening, focusing, or meditating.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl glass-panel border border-white/10 relative">
              <span className="font-serif text-4xl font-bold text-teal-400/40 select-none">02</span>
              <h3 className="font-serif text-xl font-medium text-white mt-3 mb-2">Connect Headphones or Speakers</h3>
              <p className="text-sm text-slate-300 leading-relaxed font-light">
                Listen using standard stereo headphones for an intimate personal journey, or play softly through speakers to infuse your room.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl glass-panel border border-white/10 relative">
              <span className="font-serif text-4xl font-bold text-violet-400/40 select-none">03</span>
              <h3 className="font-serif text-xl font-medium text-white mt-3 mb-2">Breathe &amp; Settle In</h3>
              <p className="text-sm text-slate-300 leading-relaxed font-light">
                Press play, take a gentle breath, and allow the harmonious soundwaves to surround you. No forced concentration needed.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 6. AVAILABLE FREQUENCIES GRID (NO play/preview buttons) */}
        {/* Exactly 12 tracks, soft wording for medical terms */}
        {/* ========================================================= */}
        <section id="frequencies" className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-semibold tracking-wider text-amber-400 uppercase">Complete 12-Track Library</span>
            <h2 className="font-serif text-3xl sm:text-4xl text-white font-medium mt-2">
              The 12 Sacred &amp; Harmonic Frequencies
            </h2>
            <p className="mt-3 text-slate-300 text-sm sm:text-base font-light">
              Each audio track has been mastered to pure vibrational frequencies, offering a dedicated sonic landscape for distinct moments of your day.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {/* Track 1: 174Hz – Relief for pain (soft wording) */}
            <div className="p-5 rounded-2xl glass-panel-subtle border border-white/10 hover:border-amber-400/30 transition-all">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-serif text-2xl font-bold text-amber-400">174Hz</span>
                <span className="text-xs text-slate-400">Solfeggio Tone</span>
              </div>
              <h3 className="text-base font-medium text-white mb-1.5">Relief for pain</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-light">
                Traditionally associated with physical ease, soothing tension, and cultivating a comforting sense of comfort throughout the body.
              </p>
            </div>

            {/* Track 2: 258Hz – Vitality */}
            <div className="p-5 rounded-2xl glass-panel-subtle border border-white/10 hover:border-teal-400/30 transition-all">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-serif text-2xl font-bold text-teal-400">258Hz</span>
                <span className="text-xs text-slate-400">Harmonic Tone</span>
              </div>
              <h3 className="text-base font-medium text-white mb-1.5">Vitality</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-light">
                A restorative frequency crafted to revitalize sluggish energy, encouraging renewed stamina and vibrant daily motivation.
              </p>
            </div>

            {/* Track 3: 417Hz – Transformation and change */}
            <div className="p-5 rounded-2xl glass-panel-subtle border border-white/10 hover:border-violet-400/30 transition-all">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-serif text-2xl font-bold text-violet-400">417Hz</span>
                <span className="text-xs text-slate-400">Solfeggio Tone</span>
              </div>
              <h3 className="text-base font-medium text-white mb-1.5">Transformation and change</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-light">
                Facilitates letting go of outdated mental patterns, easing emotional transition, and welcoming positive shifts with openness.
              </p>
            </div>

            {/* Track 4: 432Hz – Calms the mind */}
            <div className="p-5 rounded-2xl glass-panel-subtle border border-white/10 hover:border-amber-400/30 transition-all">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-serif text-2xl font-bold text-amber-300">432Hz</span>
                <span className="text-xs text-slate-400">Verdi Tuning</span>
              </div>
              <h3 className="text-base font-medium text-white mb-1.5">Calms the mind</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-light">
                The universal nature tuning recognized for settling chaotic mental chatter, encouraging peaceful relaxation and inner poise.
              </p>
            </div>

            {/* Track 5: 432Hz + 528Hz – Opening paths */}
            <div className="p-5 rounded-2xl glass-panel-subtle border border-white/10 hover:border-teal-400/30 transition-all">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-serif text-2xl font-bold text-teal-300">432Hz + 528Hz</span>
                <span className="text-xs text-slate-400">Dual Fusion</span>
              </div>
              <h3 className="text-base font-medium text-white mb-1.5">Opening paths</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-light">
                A blended dual harmonic resonance designed for mental clarity, unblocking inspired perspectives, and opening new avenues.
              </p>
            </div>

            {/* Track 6: 528Hz – Solfeggio Frequency */}
            <div className="p-5 rounded-2xl glass-panel-subtle border border-white/10 hover:border-amber-400/30 transition-all">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-serif text-2xl font-bold text-amber-400">528Hz</span>
                <span className="text-xs text-slate-400">The Miracle Note</span>
              </div>
              <h3 className="text-base font-medium text-white mb-1.5">Solfeggio Frequency</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-light">
                The renowned ancient frequency of harmony, transformation, and unconditional love, celebrated for restoring heartfelt balance.
              </p>
            </div>

            {/* Track 7: 639Hz – Harmonious relationships */}
            <div className="p-5 rounded-2xl glass-panel-subtle border border-white/10 hover:border-teal-400/30 transition-all">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-serif text-2xl font-bold text-teal-400">639Hz</span>
                <span className="text-xs text-slate-400">Solfeggio Tone</span>
              </div>
              <h3 className="text-base font-medium text-white mb-1.5">Harmonious relationships</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-light">
                Nurtures interpersonal compassion, clear communication, empathy, and warm relational unity with family, friends, and community.
              </p>
            </div>

            {/* Track 8: 741Hz – Detox (soft wording) */}
            <div className="p-5 rounded-2xl glass-panel-subtle border border-white/10 hover:border-violet-400/30 transition-all">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-serif text-2xl font-bold text-violet-400">741Hz</span>
                <span className="text-xs text-slate-400">Solfeggio Tone</span>
              </div>
              <h3 className="text-base font-medium text-white mb-1.5">Detox</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-light">
                Traditionally associated with mental cleansing, shedding emotional heaviness, and clearing away stagnant energetic clutter.
              </p>
            </div>

            {/* Track 9: 852Hz – Intuition */}
            <div className="p-5 rounded-2xl glass-panel-subtle border border-white/10 hover:border-amber-400/30 transition-all">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-serif text-2xl font-bold text-amber-300">852Hz</span>
                <span className="text-xs text-slate-400">Solfeggio Tone</span>
              </div>
              <h3 className="text-base font-medium text-white mb-1.5">Intuition</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-light">
                Designed to pierce through surface distractions and awaken subtle intuitive knowing, inner discernment, and instinctive wisdom.
              </p>
            </div>

            {/* Track 10: 888Hz – Prosperity and abundance */}
            <div className="p-5 rounded-2xl glass-panel-subtle border border-white/10 hover:border-teal-400/30 transition-all">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-serif text-2xl font-bold text-teal-300">888Hz</span>
                <span className="text-xs text-slate-400">Angel Resonance</span>
              </div>
              <h3 className="text-base font-medium text-white mb-1.5">Prosperity and abundance</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-light">
                Elevates your mindset toward gratitude, receptivity, financial flow, and an expanded perception of life's boundless opportunities.
              </p>
            </div>

            {/* Track 11: 963Hz – Spiritual connection */}
            <div className="p-5 rounded-2xl glass-panel-subtle border border-white/10 hover:border-violet-400/30 transition-all">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-serif text-2xl font-bold text-violet-300">963Hz</span>
                <span className="text-xs text-slate-400">Crown Resonance</span>
              </div>
              <h3 className="text-base font-medium text-white mb-1.5">Spiritual connection</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-light">
                A serene, high-frequency soundscape fostering oneness, deep spiritual presence, and communion with the boundless silence within.
              </p>
            </div>

            {/* Track 12: Sounds of Nature */}
            <div className="p-5 rounded-2xl glass-panel-subtle border border-white/10 hover:border-amber-400/30 transition-all">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-serif text-2xl font-bold text-amber-400">Nature</span>
                <span className="text-xs text-slate-400">Acoustic Biophilia</span>
              </div>
              <h3 className="text-base font-medium text-white mb-1.5">Sounds of Nature</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-light">
                Deeply grounding ambient recordings of gentle rain, whispering woodlands, and rhythmic ocean shores for natural ear grounding.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 7. WHAT'S INCLUDED (NO TESTIMONIALS) */}
        {/* ========================================================= */}
        <section id="whats-included" className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="p-8 sm:p-12 rounded-3xl glass-panel border border-white/10 text-center">
            <span className="text-xs font-semibold tracking-wider text-teal-400 uppercase">Product Specifications</span>
            <h2 className="font-serif text-3xl sm:text-4xl text-white font-medium mt-2 mb-4">
              What's Included in Your Purchase
            </h2>
            <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto font-light mb-8">
              Everything you need for an immersive sound meditation practice, delivered instantly with zero ongoing costs.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left max-w-2xl mx-auto">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-white">All 12 Master Audio MP3 Tracks</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Full, uncompressed 320kbps MP3 files engineered for acoustic clarity.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-white">Instant Digital Access</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Secure direct download link provided immediately upon checkout completion.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-white">Universal Device Compatibility</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Plays seamlessly on iPhone, Android, iPad, Mac, Windows PC, or standalone players.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-white">One-Time Payment &amp; Lifetime Access</h4>
                  <p className="text-xs text-slate-400 mt-0.5">No monthly subscriptions, hidden rebills, or streaming limits. Keep them forever.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 8. OFFER CARD */}
        {/* ========================================================= */}
        <section className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="relative rounded-3xl p-8 sm:p-12 glass-panel border border-amber-500/40 text-center shadow-[0_0_50px_rgba(245,158,11,0.22)] overflow-hidden">
            {/* Ambient gold glow badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Complete Collection Access</span>
            </div>

            <h2 className="font-serif text-3xl sm:text-5xl font-medium text-white mb-2">
              Get {BRAND_NAME} Today
            </h2>
            <p className="text-sm sm:text-base text-slate-300 max-w-lg mx-auto font-light mb-6">
              Claim all 12 Solfeggio &amp; healing frequency MP3 tracks with instant digital delivery and universal offline playback.
            </p>

            {/* Price Lockup */}
            <div className="mb-6">
              <div className="flex items-baseline justify-center gap-2">
                <span className="font-serif text-5xl sm:text-6xl font-bold text-amber-400">{PRICE}</span>
                <span className="text-slate-400 text-sm font-medium">one-time payment</span>
              </div>
              <p className="text-xs text-teal-300 mt-1">Includes all 12 tracks • Zero recurring fees</p>
            </div>

            {/* Buy Button */}
            <div className="max-w-md mx-auto">
              <button
                onClick={() => handleCheckout('offer_card')}
                className="w-full btn-gold-glow bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-bold py-4 px-8 rounded-full text-base sm:text-lg flex items-center justify-center gap-2 cursor-pointer shadow-xl"
              >
                <span>Unlock All 12 Tracks Now</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* Guarantee Badge */}
            <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs text-slate-300">
              <div className="inline-flex items-center gap-2 font-medium text-teal-300">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                <span>{GUARANTEE_DAYS}-Day Money-Back Guarantee</span>
              </div>
              <span className="hidden sm:inline text-slate-600" aria-hidden="true">•</span>
              <p className="text-slate-400 max-w-sm text-center sm:text-left">
                If you are not satisfied with the frequencies, you can request a full refund within {GUARANTEE_DAYS} days through the Hotmart purchase platform.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 9. GUARANTEE SECTION */}
        {/* ========================================================= */}
        <section className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="p-6 sm:p-8 rounded-2xl glass-panel-subtle border border-teal-500/20 text-center">
            <div className="w-12 h-12 rounded-full bg-teal-500/10 border border-teal-400/30 flex items-center justify-center text-teal-300 mx-auto mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-2xl text-white font-medium mb-2">
              Our {GUARANTEE_DAYS}-Day Satisfaction Guarantee
            </h3>
            <p className="text-sm text-slate-300 max-w-xl mx-auto font-light leading-relaxed">
              We want you to experience {BRAND_NAME} with complete confidence. Take up to {GUARANTEE_DAYS} days to explore the 12 frequencies during your meditations, focus sessions, or evening routines. If you feel they aren't the right fit for your practice, you can easily request a full 100% refund directly through the Hotmart purchase platform.
            </p>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 10. FAQ (5–6 questions) */}
        {/* ========================================================= */}
        <section id="faq" className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="text-xs font-semibold tracking-wider text-amber-400 uppercase">Common Inquiries</span>
            <h2 className="font-serif text-3xl sm:text-4xl text-white font-medium mt-2">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3.5">
            {[
              {
                q: "How do I get my files after ordering?",
                a: "Immediately upon completing your checkout on Hotmart, you will receive an email containing your secure digital download link. You can save all 12 MP3 files directly to your smartphone, computer, or tablet right away."
              },
              {
                q: `What is the refund policy?`,
                a: `You are covered by our ${GUARANTEE_DAYS}-day money-back guarantee. If you are not satisfied with the tracks for any reason within ${GUARANTEE_DAYS} days of purchase, you can easily request a 100% full refund directly through the Hotmart purchase platform.`
              },
              {
                q: "Can I listen on my phone or tablet?",
                a: "Yes! All 12 tracks are delivered in universal, high-bitrate 320kbps MP3 audio format. They work flawlessly on Apple iPhone (Files app, Apple Music), Android devices, iPads, laptops, and any standard MP3 player."
              },
              {
                q: "Do I need special headphones or equipment?",
                a: "No special equipment is required. Any standard headphones, wireless earbuds, or ambient room speakers will reproduce the audio clearly. Quality stereo headphones offer the most intimate and immersive experience."
              },
              {
                q: "Is this a one-time purchase or a subscription?",
                a: `Budah Frequency is a 100% one-time payment of ${PRICE}. There are no hidden fees, recurring monthly subscriptions, or renewals. Once downloaded, the files are yours to keep forever.`
              },
              {
                q: "Can I listen while working, studying, or reading?",
                a: "Yes. Many listeners enjoy playing frequencies such as 432Hz or 888Hz at low background volume while reading, working, or journaling to help filter out external noise and sustain calm mental flow."
              }
            ].map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl glass-panel-subtle border border-white/10 overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02]"
                >
                  <span className="font-serif text-lg text-white font-medium">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-amber-400 shrink-0 transition-transform duration-200 ${
                      openFaq === idx ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-4 pt-1 text-sm text-slate-300 leading-relaxed font-light border-t border-white/5">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ========================================================= */}
        {/* 11. FINAL CTA */}
        {/* ========================================================= */}
        <section className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
          <div className="relative p-8 sm:p-14 rounded-3xl glass-panel border border-amber-500/30 overflow-hidden shadow-[0_0_60px_rgba(245,158,11,0.2)]">
            <h2 className="font-serif text-3xl sm:text-5xl font-medium text-white mb-4">
              Step Into the Frequency of Stillness
            </h2>
            <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto font-light mb-8">
              Begin your restorative sound journey today with instant access to the complete 12-track {BRAND_NAME} library.
            </p>

            <div className="max-w-md mx-auto">
              <button
                onClick={() => handleCheckout('final_cta')}
                className="w-full btn-gold-glow bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-bold py-4 px-8 rounded-full text-base sm:text-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Get Instant Access – {PRICE}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3 text-xs text-slate-400">
              <span>Instant Digital Delivery</span>
              <span aria-hidden="true">·</span>
              <span>{GUARANTEE_DAYS}-Day Money-Back Guarantee</span>
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================= */}
      {/* 12. FOOTER */}
      {/* ========================================================= */}
      <footer className="relative z-10 w-full bg-[#03050a] border-t border-white/10 pt-12 pb-8 px-4 sm:px-6 lg:px-8 text-xs text-slate-400">
        <div className="max-w-5xl mx-auto flex flex-col items-center text-center space-y-6">
          {/* Brand */}
          <div className="flex items-center justify-center w-full border-b border-white/10 pb-6">
            <span className="font-serif text-xl font-bold tracking-tight text-white">
              {BRAND_NAME}
            </span>
          </div>

          {/* Legal / Policy Links */}
          <div className="flex flex-wrap justify-center gap-4 sm:gap-8 text-slate-400 font-medium">
            <button
              onClick={() => setActiveModal('privacy')}
              className="hover:text-amber-300 transition-colors underline underline-offset-4 cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setActiveModal('terms')}
              className="hover:text-amber-300 transition-colors underline underline-offset-4 cursor-pointer"
            >
              Terms of Use
            </button>
            <button
              onClick={() => setActiveModal('refund')}
              className="hover:text-amber-300 transition-colors underline underline-offset-4 cursor-pointer"
            >
              Refund Policy
            </button>
          </div>

          {/* Legal Disclaimers */}
          <div className="max-w-3xl space-y-3 text-[11px] text-slate-400 leading-relaxed pt-2">
            <p>
              This product does not replace medical or therapeutic care. Results may vary. Not intended to diagnose, treat, cure or prevent any disease.
            </p>
            <p>
              This site is not part of Facebook or Meta Platforms, Inc. Additionally, this site is NOT endorsed by Facebook in any way. FACEBOOK is a trademark of META PLATFORMS, INC.
            </p>
            <p className="text-slate-400">
              © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* ========================================================= */}
      {/* IN-PAGE LEGAL & POLICY MODALS */}
      {/* ========================================================= */}
      {activeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl glass-panel bg-slate-950/95 border border-white/20 p-6 sm:p-8 text-left shadow-2xl">
            {/* Close Button */}
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Contents */}
            {activeModal === 'privacy' && (
              <div>
                {/* TEMPLATE – review before launch */}
                <h3 className="font-serif text-2xl text-white font-bold mb-4">Privacy Policy</h3>
                <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
                  <p>
                    <strong>1. Overview:</strong> This Privacy Policy outlines how {BRAND_NAME} collects, utilizes, and protects information when you browse this website and acquire the {BRAND_NAME} audio collection.
                  </p>
                  <p>
                    <strong>2. Cookies &amp; Pixels:</strong> We utilize third-party analytics and the Meta Pixel (formerly Facebook Pixel) to measure site traffic, optimize advertising performance, and deliver relevant advertisements. You can manage or disable cookie preferences directly through your browser settings.
                  </p>
                  <p>
                    <strong>3. Orders &amp; Billing Data:</strong> All financial transactions, payments, and product fulfillment are securely processed by Hotmart. We do not store or process your credit card numbers or financial passwords on our servers.
                  </p>
                  <p>
                    <strong>4. Contact Information:</strong> If you reach out to us at {CONTACT_EMAIL}, your email address is used solely to respond to customer inquiries and fulfill support requests. We do not sell your personal data to third parties.
                  </p>
                </div>
              </div>
            )}

            {activeModal === 'terms' && (
              <div>
                {/* TEMPLATE – review before launch */}
                <h3 className="font-serif text-2xl text-white font-bold mb-4">Terms of Use</h3>
                <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
                  <p>
                    <strong>1. Digital Product License:</strong> {BRAND_NAME} is an electronic audio product consisting of 12 downloadable MP3 audio files. Your purchase grants you a personal, non-exclusive, non-transferable license to listen to the files on your personal devices.
                  </p>
                  <p>
                    <strong>2. Prohibited Uses:</strong> Commercial reproduction, redistribution, resale, streaming upload, or inclusion in third-party media libraries without explicit prior written authorization is strictly prohibited.
                  </p>
                  <p>
                    <strong>3. Health Disclaimer:</strong> {BRAND_NAME} is intended solely for personal relaxation, entertainment, and meditative contemplation. It does not replace medical, psychiatric, or therapeutic care. Results may vary, and no medical cures or health treatments are claimed or guaranteed.
                  </p>
                  <p>
                    <strong>4. Intellectual Property:</strong> All trademarks, copyrights, and intellectual property rights related to {BRAND_NAME} are reserved.
                  </p>
                </div>
              </div>
            )}

            {activeModal === 'refund' && (
              <div>
                {/* TEMPLATE – review before launch */}
                <h3 className="font-serif text-2xl text-white font-bold mb-4">Refund Policy</h3>
                <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
                  <p>
                    <strong>1. {GUARANTEE_DAYS}-Day Satisfaction Guarantee:</strong> We provide a {GUARANTEE_DAYS}-day refund window starting from the moment of your original purchase.
                  </p>
                  <p>
                    <strong>2. Requesting a Refund:</strong> If you are not satisfied with your purchase, you may initiate a full refund directly through your Hotmart purchase confirmation receipt or customer portal within {GUARANTEE_DAYS} days.
                  </p>
                  <p>
                    <strong>3. Processing:</strong> You can initiate refunds and view purchase receipts directly inside your Hotmart account. All refunds are processed in full and returned to your original payment method in accordance with standard banking timelines.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
