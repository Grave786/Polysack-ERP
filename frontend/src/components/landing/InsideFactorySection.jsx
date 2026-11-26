import { useState, useEffect, useRef } from 'react';
import { Play, Film, Maximize2, X } from 'lucide-react';

/**
 * "Inside Our Factory" showcase section.
 * - Left (~60%): Featured video player with native controls (muted by default, unmute available).
 * - Right (~40%): Stacked cards for the remaining clips (horizontal scroll/stacked on mobile).
 * - Only one video plays at a time across the page (notifies parent to pause hero playlist).
 */
export default function InsideFactorySection({
    videos = [],
    onPlayStateChange
}) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [failedIndices, setFailedIndices] = useState(() => new Set());
    const [isVisible, setIsVisible] = useState(false);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);

    const sectionRef = useRef(null);
    const featuredVideoRef = useRef(null);
    const lightboxVideoRef = useRef(null);
    const lightboxCloseBtnRef = useRef(null);

    // Fade-in on scroll using IntersectionObserver (respecting prefers-reduced-motion)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        if (reduced) {
            setIsVisible(true);
            return;
        }
        const el = sectionRef.current;
        if (!el || typeof IntersectionObserver === 'undefined') {
            setIsVisible(true);
            return;
        }
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.15 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Close lightbox on Escape & focus close button on open
    useEffect(() => {
        if (!isLightboxOpen) return;
        lightboxCloseBtnRef.current?.focus();
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                handleCloseLightbox();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isLightboxOpen]);

    if (!Array.isArray(videos) || videos.length === 0) {
        return null;
    }

    const activeVideo = videos[selectedIndex] || videos[0];
    const sideVideos = videos
        .map((v, idx) => ({ ...v, idx }))
        .filter((v) => v.idx !== selectedIndex);

    const handleSelectVideo = (idx) => {
        if (failedIndices.has(idx)) return;
        setSelectedIndex(idx);
        setTimeout(() => {
            const el = featuredVideoRef.current;
            if (el) {
                el.currentTime = 0;
                el.play().catch(() => {});
            }
        }, 50);
    };

    const handleOpenLightbox = () => {
        if (featuredVideoRef.current && !featuredVideoRef.current.paused) {
            featuredVideoRef.current.pause();
        }
        setIsLightboxOpen(true);
        onPlayStateChange?.(true);
    };

    const handleCloseLightbox = () => {
        if (lightboxVideoRef.current && !lightboxVideoRef.current.paused) {
            lightboxVideoRef.current.pause();
        }
        setIsLightboxOpen(false);
        onPlayStateChange?.(false);
    };

    const markFailed = (idx) => {
        setFailedIndices((prev) => {
            const next = new Set(prev);
            next.add(idx);
            return next;
        });
    };

    return (
        <section
            id="factory"
            ref={sectionRef}
            className={`py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 transition-all duration-700 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
        >
            {/* Section Heading */}
            <div className="text-center max-w-2xl mx-auto space-y-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-600">
                    In-House Manufacturing
                </span>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                    Inside Our Factory
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">
                    A closer look at our integrated shop floor, quality checkpoints, and dispatch-ready packaging lines.
                </p>
            </div>

            {/* Responsive 60% / 40% Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left (~60%): Featured Player */}
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-md overflow-hidden">
                    <div className="relative aspect-video bg-[#0a1128] flex items-center justify-center">
                        {failedIndices.has(selectedIndex) ? (
                            <div className="flex flex-col items-center justify-center text-slate-400 p-6 text-center space-y-2">
                                <Film size={32} className="text-amber-400/70" />
                                <p className="text-xs font-semibold">Video unavailable at the moment.</p>
                            </div>
                        ) : (
                            <video
                                key={activeVideo.src}
                                ref={featuredVideoRef}
                                src={activeVideo.src}
                                controls
                                muted
                                playsInline
                                preload="metadata"
                                onPlay={() => onPlayStateChange?.(true)}
                                onPause={() => onPlayStateChange?.(false)}
                                onEnded={() => onPlayStateChange?.(false)}
                                onError={() => markFailed(selectedIndex)}
                                className="w-full h-full object-cover"
                            />
                        )}
                        <button
                            type="button"
                            onClick={handleOpenLightbox}
                            aria-label="Open video in expanded modal"
                            className="absolute top-3 right-3 p-2 rounded-lg bg-slate-950/65 hover:bg-slate-950/85 text-white border border-white/15 backdrop-blur-xs transition-colors cursor-pointer"
                            title="Expand video"
                        >
                            <Maximize2 size={14} />
                        </button>
                    </div>
                    <div className="p-4 sm:p-5 flex items-start justify-between gap-4 border-t border-slate-100">
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-slate-900">
                                {activeVideo.title}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 mt-1">
                                {activeVideo.caption}
                            </p>
                        </div>
                        <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                            Clip {selectedIndex + 1} of {videos.length}
                        </span>
                    </div>
                </div>

                {/* Right (~40%): Stacked Video Cards (Horizontal scroll on mobile) */}
                <div className="lg:col-span-5 flex lg:flex-col gap-4 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
                    {sideVideos.map((vid) => (
                        <button
                            key={vid.id || vid.idx}
                            type="button"
                            onClick={() => handleSelectVideo(vid.idx)}
                            className="min-w-[270px] sm:min-w-[300px] lg:min-w-0 w-full text-left bg-white rounded-2xl border border-slate-200/90 p-3 shadow-xs hover:shadow-md hover:-translate-y-0.5 hover:border-amber-400/70 transition-all duration-200 flex items-center gap-3.5 group cursor-pointer"
                        >
                            <div className="relative w-32 sm:w-36 aspect-video rounded-xl overflow-hidden bg-[#0a1128] shrink-0 flex items-center justify-center">
                                {failedIndices.has(vid.idx) ? (
                                    <Film size={20} className="text-slate-400" />
                                ) : (
                                    <video
                                        src={vid.src}
                                        muted
                                        playsInline
                                        preload="metadata"
                                        tabIndex={-1}
                                        aria-hidden="true"
                                        onError={() => markFailed(vid.idx)}
                                        className="w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-300"
                                    />
                                )}
                                <div className="absolute inset-0 bg-slate-950/35 group-hover:bg-slate-950/20 transition-colors flex items-center justify-center">
                                    <span className="w-9 h-9 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                                        <Play size={15} className="fill-current ml-0.5" />
                                    </span>
                                </div>
                            </div>

                            <div className="min-w-0 flex-1 space-y-1">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600">
                                    Clip {vid.idx + 1}
                                </span>
                                <h4 className="text-sm font-bold text-slate-900 group-hover:text-amber-600 transition-colors truncate">
                                    {vid.title}
                                </h4>
                                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                    {vid.caption}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Optional Expanded Lightbox Modal */}
            {isLightboxOpen && (
                <div
                    className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label={activeVideo.title}
                    onClick={handleCloseLightbox}
                >
                    <div
                        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 text-white">
                            <div>
                                <h3 className="text-sm font-bold">{activeVideo.title}</h3>
                                <p className="text-[11px] text-slate-400">{activeVideo.caption}</p>
                            </div>
                            <button
                                ref={lightboxCloseBtnRef}
                                type="button"
                                onClick={handleCloseLightbox}
                                aria-label="Close video modal"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="aspect-video bg-black">
                            <video
                                ref={lightboxVideoRef}
                                src={activeVideo.src}
                                controls
                                muted
                                playsInline
                                autoPlay
                                className="w-full h-full object-contain"
                            />
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
