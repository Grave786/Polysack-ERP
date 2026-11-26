import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const DISMISS_DURATION_MS = 30 * 60 * 1000;

export default function VersionUpdateBanner() {
    const [latestBuildId, setLatestBuildId] = useState(null);
    const dismissedRef = useRef({ buildId: null, until: 0 });

    useEffect(() => {
        if (!import.meta.env.PROD) return;

        const currentBuildId = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : '';
        if (!currentBuildId) return;

        let isMounted = true;

        const checkVersion = async () => {
            if (document.visibilityState === 'hidden') return;
            try {
                const res = await fetch(`/version.json?t=${Date.now()}`, {
                    cache: 'no-store'
                });
                if (!res.ok) return;
                const data = await res.json();
                const remoteBuildId = typeof data?.buildId === 'string' ? data.buildId.trim() : '';
                if (!remoteBuildId || remoteBuildId === String(currentBuildId)) return;

                const now = Date.now();
                if (
                    dismissedRef.current.buildId === remoteBuildId &&
                    now < dismissedRef.current.until
                ) {
                    return;
                }

                if (isMounted) {
                    setLatestBuildId(remoteBuildId);
                }
            } catch {
                // Fail silently if request fails or response is not valid JSON
            }
        };

        const handleFocus = () => {
            checkVersion();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkVersion();
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        const intervalId = window.setInterval(checkVersion, CHECK_INTERVAL_MS);

        return () => {
            isMounted = false;
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.clearInterval(intervalId);
        };
    }, []);

    if (!import.meta.env.PROD || !latestBuildId) {
        return null;
    }

    const handleDismiss = () => {
        dismissedRef.current = {
            buildId: latestBuildId,
            until: Date.now() + DISMISS_DURATION_MS
        };
        setLatestBuildId(null);
    };

    return (
        <div
            role="status"
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 px-4 py-2.5 rounded-xl bg-sidebar-bg text-white border border-primary/40 shadow-xl font-sans text-xs w-[calc(100vw-2rem)] sm:w-auto max-w-md"
        >
            <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                <span className="font-semibold">A new update is available.</span>
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleDismiss}
                    className="px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 font-semibold transition-colors cursor-pointer"
                >
                    Later
                </button>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold transition-colors cursor-pointer shrink-0"
                >
                    <RefreshCw size={12} />
                    <span>Refresh Now</span>
                </button>
            </div>
        </div>
    );
}
