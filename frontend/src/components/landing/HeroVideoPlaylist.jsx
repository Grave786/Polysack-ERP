import { useState, useEffect, useRef, useCallback } from 'react';
import { Pause, Play } from 'lucide-react';

/**
 * Seamless dual-slot background video playlist for the Landing Hero section.
 * - Alternates between two stacked <video> elements (slot 0 and slot 1) with an 800ms crossfade.
 * - Respects prefers-reduced-motion, navigator.connection.saveData / 2g / 3g,
 *   viewport visibility (IntersectionObserver), and tab visibility (visibilitychange).
 * - Falls back silently to the static hero gradient if autoplay fails or videos error.
 */
export default function HeroVideoPlaylist({
    videos = [],
    heroRef,
    isExternallyPaused = false
}) {
    const [shouldRenderVideo, setShouldRenderVideo] = useState(false);
    const [isMobileViewport, setIsMobileViewport] = useState(false);
    const [isHeroVisible, setIsHeroVisible] = useState(true);
    const [isTabVisible, setIsTabVisible] = useState(
        typeof document !== 'undefined' ? document.visibilityState === 'visible' : true
    );
    const [userPaused, setUserPaused] = useState(false);

    // Dual-slot state: activeSlot (0 or 1), slotIndices ([clipIdxForSlot0, clipIdxForSlot1])
    const [activeSlot, setActiveSlot] = useState(0);
    const [activeIndex, setActiveIndex] = useState(0);
    const [slotIndices, setSlotIndices] = useState(() => [
        0,
        videos.length > 1 ? 1 : 0
    ]);
    const [slotReady, setSlotReady] = useState([false, false]);
    const [failedIndices, setFailedIndices] = useState(() => new Set());
    const [autoplayFailed, setAutoplayFailed] = useState(false);

    const videoRefs = [useRef(null), useRef(null)];
    const transitioningRef = useRef(false);

    // Check motion, data-saver, slow connection, and mobile viewport
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const saveData = Boolean(conn?.saveData);
        const slowConn = ['slow-2g', '2g', '3g'].includes(String(conn?.effectiveType || '').toLowerCase());

        setIsMobileViewport(window.innerWidth < 640);

        if (!reducedMotion && !saveData && !slowConn && videos.length > 0) {
            setShouldRenderVideo(true);
        }
    }, [videos.length]);

    // Track hero visibility via IntersectionObserver
    useEffect(() => {
        const target = heroRef?.current;
        if (!target || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsHeroVisible(entry.isIntersecting);
            },
            { threshold: 0.1 }
        );
        observer.observe(target);
        return () => observer.disconnect();
    }, [heroRef]);

    // Track browser tab visibility
    useEffect(() => {
        const onVisChange = () => {
            setIsTabVisible(document.visibilityState === 'visible');
        };
        document.addEventListener('visibilitychange', onVisChange);
        return () => document.removeEventListener('visibilitychange', onVisChange);
    }, []);

    const findNextValidIndex = useCallback(
        (fromIdx, failedSet = failedIndices) => {
            if (!videos.length) return -1;
            for (let step = 1; step <= videos.length; step++) {
                const candidate = (fromIdx + step) % videos.length;
                if (!failedSet.has(candidate)) return candidate;
            }
            return -1;
        },
        [videos.length, failedIndices]
    );

    const allFailed = videos.length === 0 || failedIndices.size >= videos.length;
    const isEffectivelyPlaying =
        shouldRenderVideo &&
        !allFailed &&
        !autoplayFailed &&
        !userPaused &&
        !isExternallyPaused &&
        isHeroVisible &&
        isTabVisible;

    // Play/pause active slot when effective playback state changes
    useEffect(() => {
        const activeEl = videoRefs[activeSlot].current;
        const inactiveEl = videoRefs[1 - activeSlot].current;
        if (inactiveEl && !inactiveEl.paused) {
            inactiveEl.pause();
        }
        if (!activeEl) return;

        if (isEffectivelyPlaying) {
            const playPromise = activeEl.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {
                    setAutoplayFailed(true);
                });
            }
        } else if (!activeEl.paused) {
            activeEl.pause();
        }
    }, [isEffectivelyPlaying, activeSlot, slotIndices]);

    const advanceToIndex = useCallback(
        (nextIdx) => {
            if (nextIdx < 0 || nextIdx >= videos.length || transitioningRef.current) return;
            if (videos.length === 1) {
                const el = videoRefs[activeSlot].current;
                if (el) {
                    el.currentTime = 0;
                    el.play().catch(() => {});
                }
                return;
            }

            transitioningRef.current = true;
            const nextSlot = 1 - activeSlot;
            const afterNextIdx = findNextValidIndex(nextIdx);

            // Ensure nextSlot has nextIdx loaded and starts playing before crossfade
            setSlotIndices((prev) => {
                const copy = [...prev];
                copy[nextSlot] = nextIdx;
                return copy;
            });

            const nextEl = videoRefs[nextSlot].current;
            if (nextEl) {
                nextEl.currentTime = 0;
                if (isEffectivelyPlaying) {
                    nextEl.play().catch(() => {});
                }
            }

            setActiveSlot(nextSlot);
            setActiveIndex(nextIdx);

            // After crossfade completes, preload the following clip in the old slot
            setTimeout(() => {
                if (afterNextIdx !== -1) {
                    setSlotIndices((prev) => {
                        const copy = [...prev];
                        copy[activeSlot] = afterNextIdx;
                        return copy;
                    });
                }
                transitioningRef.current = false;
            }, 850);
        },
        [activeSlot, videos.length, findNextValidIndex, isEffectivelyPlaying]
    );

    const handleTimeUpdate = (slotIdx) => {
        if (slotIdx !== activeSlot || !isEffectivelyPlaying || videos.length <= 1) return;
        const el = videoRefs[slotIdx].current;
        if (!el || !el.duration || !Number.isFinite(el.duration)) return;
        if (el.duration - el.currentTime <= 0.65) {
            const nextIdx = findNextValidIndex(activeIndex);
            if (nextIdx !== -1 && nextIdx !== activeIndex) {
                advanceToIndex(nextIdx);
            }
        }
    };

    const handleEnded = (slotIdx) => {
        if (slotIdx !== activeSlot) return;
        const nextIdx = findNextValidIndex(activeIndex);
        if (nextIdx !== -1) {
            advanceToIndex(nextIdx);
        }
    };

    const handleVideoError = (slotIdx, clipIdx) => {
        setFailedIndices((prev) => {
            const nextSet = new Set(prev);
            nextSet.add(clipIdx);
            if (slotIdx === activeSlot) {
                const fallbackIdx = findNextValidIndex(clipIdx, nextSet);
                if (fallbackIdx !== -1) {
                    setTimeout(() => advanceToIndex(fallbackIdx), 50);
                }
            }
            return nextSet;
        });
    };

    const handleCanPlay = (slotIdx) => {
        setSlotReady((prev) => {
            if (prev[slotIdx]) return prev;
            const copy = [...prev];
            copy[slotIdx] = true;
            return copy;
        });
    };

    const handleTogglePause = () => {
        setAutoplayFailed(false);
        setUserPaused((prev) => !prev);
    };

    const handleJumpToClip = (idx) => {
        if (failedIndices.has(idx)) return;
        setAutoplayFailed(false);
        if (idx === activeIndex) return;
        advanceToIndex(idx);
    };

    if (!shouldRenderVideo || allFailed) {
        return null;
    }

    return (
        <>
            {/* Dual-slot full-bleed background videos */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
                {[0, 1].map((slotIdx) => {
                    const clipIdx = slotIndices[slotIdx] ?? 0;
                    const clip = videos[clipIdx];
                    if (!clip) return null;
                    const isActive = activeSlot === slotIdx;
                    const isVisible = isActive && slotReady[slotIdx] && !autoplayFailed;
                    const preloadMode = isMobileViewport && !isHeroVisible
                        ? 'none'
                        : (isActive ? 'auto' : 'metadata');

                    return (
                        <video
                            key={`hero-slot-${slotIdx}`}
                            ref={videoRefs[slotIdx]}
                            src={clip.src}
                            muted
                            playsInline
                            controls={false}
                            loop={false}
                            disablePictureInPicture
                            preload={preloadMode}
                            tabIndex={-1}
                            aria-hidden="true"
                            onCanPlay={() => handleCanPlay(slotIdx)}
                            onTimeUpdate={() => handleTimeUpdate(slotIdx)}
                            onEnded={() => handleEnded(slotIdx)}
                            onError={() => handleVideoError(slotIdx, clipIdx)}
                            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-800 ${
                                isVisible ? 'opacity-100' : 'opacity-0'
                            }`}
                        />
                    );
                })}

                {/* Dark navy gradient overlay (60-70%) so hero headline, buttons & trust points stay crisp */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#0a1128]/75 via-[#101b3b]/65 to-[#0a1128]/80" />
            </div>

            {/* Bottom-right glassmorphic playlist control */}
            <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-20 flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-950/60 backdrop-blur-md border border-white/15 shadow-lg">
                <button
                    type="button"
                    onClick={handleTogglePause}
                    aria-label={userPaused || autoplayFailed ? 'Play background video' : 'Pause background video'}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white hover:text-amber-400 transition-colors cursor-pointer"
                >
                    {userPaused || autoplayFailed ? <Play size={13} className="fill-current" /> : <Pause size={13} />}
                </button>
                {videos.length > 1 && (
                    <div className="flex items-center gap-1.5" role="group" aria-label="Background video clips">
                        {videos.map((v, idx) => {
                            const isCurrent = idx === activeIndex;
                            const isBroken = failedIndices.has(idx);
                            if (isBroken) return null;
                            return (
                                <button
                                    key={v.id || idx}
                                    type="button"
                                    onClick={() => handleJumpToClip(idx)}
                                    aria-label={`Play clip ${idx + 1}: ${v.title}`}
                                    aria-current={isCurrent ? 'true' : undefined}
                                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                                        isCurrent
                                            ? 'w-5 bg-amber-400'
                                            : 'w-1.5 bg-white/40 hover:bg-white/75'
                                    }`}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}
