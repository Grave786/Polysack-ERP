import { useState } from 'react';
import { ZoomIn } from 'lucide-react';

/**
 * ProductImage Component
 * Photo-first packaging visual with automatic inline-SVG fallback.
 * Renders the primary real photo with object-fit cover, soft skeleton loading,
 * hover shine sweep, zoom chip, and full keyboard/click accessibility.
 *
 * ViewBox for SVGs: 280 x 210 (4:3 aspect ratio).
 */
export default function ProductImage({
    productId,
    images = [],
    imageSrc = '',
    altText = 'Poly packaging product',
    imageAlt = '',
    imageFit = 'contain',
    capacity = '',
    onClick,
    loading = 'lazy'
}) {
    const primarySrc = (Array.isArray(images) && images.length > 0) ? images[0] : imageSrc;
    const resolvedAlt = imageAlt || altText;
    const [imgLoaded, setImgLoaded] = useState(false);
    const [imgError, setImgError] = useState(false);
    const hasPhoto = Boolean(primarySrc && !imgError);

    const isClickable = typeof onClick === 'function';

    return (
        <div
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            aria-label={isClickable ? `View details of ${resolvedAlt}` : undefined}
            onClick={onClick}
            onKeyDown={(e) => {
                if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onClick();
                }
            }}
            className={`relative w-full aspect-[4/3] rounded-xl bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200/90 border border-slate-200/80 overflow-hidden group select-none shadow-2xs ${
                isClickable ? 'cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-amber-500' : ''
            }`}
        >
            {/* Subtle background dot grid texture */}
            <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />

            {/* Light shine sweep effect on card hover */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none z-20" />

            {/* Hover "View Details" zoom chip */}
            {isClickable && (
                <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-200 px-2 py-1 rounded-md bg-slate-900/85 backdrop-blur-xs text-[10px] font-bold text-white border border-slate-700/60 shadow-xs flex items-center gap-1 z-30 pointer-events-none">
                    <ZoomIn size={12} className="text-amber-400" />
                    <span>View Details</span>
                </div>
            )}

            {/* Capacity pill chip positioned at bottom-left over the image */}
            {capacity && (
                <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 rounded-md bg-slate-900/85 backdrop-blur-xs text-[10.5px] font-mono font-bold text-white border border-slate-700/60 shadow-xs z-10 pointer-events-none">
                    {capacity}
                </div>
            )}

            {/* Skeleton Loading Shimmer while photo loads */}
            {hasPhoto && !imgLoaded && (
                <div className="absolute inset-0 bg-slate-200/70 animate-pulse rounded-xl z-5 pointer-events-none" />
            )}

            {/* Inner Artwork / Photo Container with slight hover zoom */}
            <div className={`w-full h-full flex items-center justify-center transition-transform duration-300 group-hover:scale-[1.04] ${
                hasPhoto && imageFit === 'cover' ? 'p-0' : 'p-2.5 sm:p-3'
            }`}>
                {hasPhoto ? (
                    <img
                        src={primarySrc}
                        alt={resolvedAlt}
                        width={280}
                        height={210}
                        loading={loading}
                        decoding="async"
                        onLoad={() => setImgLoaded(true)}
                        onError={() => setImgError(true)}
                        className={`w-full h-full rounded-lg transition-opacity duration-300 ${
                            imageFit === 'cover'
                                ? 'object-cover object-center'
                                : 'object-contain'
                        } ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                    />
                ) : (
                    <ProductSvgIllustration productId={productId} />
                )}
            </div>
        </div>
    );
}

export function ProductSvgIllustration({ productId, className = "w-full h-full" }) {
    const renderSvg = () => {
        switch (productId) {
            case 'pp-woven-sack-standard':
                return <StandardSackSvg />;
            case 'flour-atta-sack':
                return <FlourSackStackSvg />;
            case 'chemical-granule-bag':
                return <ChemicalBagSvg />;
            case 'bopp-laminated-bag':
                return <BoppBagSvg />;
            case 'cattle-feed-bag':
                return <CattleFeedBagSvg />;
            case 'cement-construction-bag':
                return <CementBagSvg />;
            case 'poly-liner-insert-bag':
                return <PolyLinerCutawaySvg />;
            case 'pp-woven-fabric-roll':
                return <FabricRollSvg />;
            default:
                return <StandardSackSvg />;
        }
    };

    return <div className={`flex items-center justify-center ${className}`}>{renderSvg()}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. STANDARD PP WOVEN SACK
// Upright white/milky sack, visible woven grid, stitched top hem and bottom tape.
// ─────────────────────────────────────────────────────────────────────────────
function StandardSackSvg() {
    return (
        <svg viewBox="0 0 280 210" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="stdWove" width="5" height="5" patternUnits="userSpaceOnUse">
                    <path d="M0 2.5h5M2.5 0v5" stroke="#94a3b8" strokeWidth="0.45" strokeOpacity="0.32" />
                </pattern>
                <linearGradient id="stdBody" x1="85" y1="30" x2="195" y2="180" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="60%" stopColor="#f8fafc" />
                    <stop offset="100%" stopColor="#e2e8f0" />
                </linearGradient>
                <linearGradient id="stdShade" x1="90" y1="100" x2="190" y2="100" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                    <stop offset="25%" stopColor="#ffffff" stopOpacity="0.2" />
                    <stop offset="85%" stopColor="#cbd5e1" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.75" />
                </linearGradient>
                <radialGradient id="stdFloor" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity="0.22" />
                    <stop offset="60%" stopColor="#0f172a" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </radialGradient>
            </defs>

            {/* Floor Contact Shadow */}
            <ellipse cx="140" cy="184" rx="66" ry="9" fill="url(#stdFloor)" />

            {/* Bag Main Body */}
            <path
                d="M96 38 C94 38, 92 48, 91 75 C90 105, 91 145, 93 175 C93 178, 96 180, 100 180 L180 180 C184 180, 187 178, 187 175 C189 145, 190 105, 189 75 C188 48, 186 38, 184 38 Z"
                fill="url(#stdBody)"
                stroke="#cbd5e1"
                strokeWidth="1.2"
            />
            {/* Woven Crosshatch Grid Overlay */}
            <path
                d="M96 38 C94 38, 92 48, 91 75 C90 105, 91 145, 93 175 C93 178, 96 180, 100 180 L180 180 C184 180, 187 178, 187 175 C189 145, 190 105, 189 75 C188 48, 186 38, 184 38 Z"
                fill="url(#stdWove)"
            />
            {/* Cylindrical 3D Light Shading */}
            <path
                d="M96 38 C94 38, 92 48, 91 75 C90 105, 91 145, 93 175 C93 178, 96 180, 100 180 L180 180 C184 180, 187 178, 187 175 C189 145, 190 105, 189 75 C188 48, 186 38, 184 38 Z"
                fill="url(#stdShade)"
            />

            {/* Natural Vertical Fabric Folds */}
            <path d="M112 40 Q110 105 113 178" stroke="#cbd5e1" strokeWidth="0.8" strokeOpacity="0.6" strokeDasharray="6,3" />
            <path d="M166 40 Q168 105 165 178" stroke="#94a3b8" strokeWidth="1" strokeOpacity="0.4" />
            <path d="M138 38 L138 180" stroke="#f1f5f9" strokeWidth="1.2" strokeOpacity="0.8" />

            {/* Top Hem / Open Mouth Hemming */}
            <path d="M94 38 C115 36, 165 36, 186 38 L185 44 C165 42, 115 42, 95 44 Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.8" />
            {/* Top Stitching Thread Line (Navy Blue Industrial Twine) */}
            <path d="M96 41 C115 39, 165 39, 184 41" stroke="#1e3a8a" strokeWidth="1.2" strokeDasharray="3,2" />

            {/* Bottom Reinforcement Tape & Stitching Seam */}
            <rect x="91" y="174" width="98" height="6.5" rx="1.5" fill="#2563eb" stroke="#1d4ed8" strokeWidth="0.6" />
            <path d="M93 177.2 L187 177.2" stroke="#ffffff" strokeWidth="1.2" strokeDasharray="3,2" />

            {/* Center Quality Stamp & Barcode Spec Box */}
            <rect x="118" y="90" width="44" height="34" rx="2" fill="#ffffff" fillOpacity="0.85" stroke="#cbd5e1" strokeWidth="0.8" />
            <rect x="122" y="94" width="36" height="5" rx="1" fill="#0f172a" fillOpacity="0.75" />
            <line x1="122" y1="103" x2="158" y2="103" stroke="#64748b" strokeWidth="0.9" />
            <line x1="122" y1="107" x2="150" y2="107" stroke="#64748b" strokeWidth="0.9" />
            <line x1="122" y1="111" x2="142" y2="111" stroke="#64748b" strokeWidth="0.9" />
            {/* Mini Barcode */}
            <path d="M123 115 h2 v4 h-2z M127 115 h1 v4 h-1z M130 115 h3 v4 h-3z M135 115 h1 v4 h-1z M138 115 h2 v4 h-2z M142 115 h3 v4 h-3z M147 115 h1 v4 h-1z M150 115 h2 v4 h-2z" fill="#334155" />
        </svg>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FLOUR / ATTA SACK STACK (10 Kg / 20 Kg / 30 Kg)
// Stack of 2-3 bags with clean 2-color brand block, wheat stalk icon, and EZ-open twine.
// ─────────────────────────────────────────────────────────────────────────────
function FlourSackStackSvg() {
    return (
        <svg viewBox="0 0 280 210" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="flourWove" width="5" height="5" patternUnits="userSpaceOnUse">
                    <path d="M0 2.5h5M2.5 0v5" stroke="#94a3b8" strokeWidth="0.4" strokeOpacity="0.3" />
                </pattern>
                <linearGradient id="flourBg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#f1f5f9" />
                </linearGradient>
                <radialGradient id="flourFloor" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity="0.25" />
                    <stop offset="70%" stopColor="#0f172a" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </radialGradient>
            </defs>

            {/* Floor Shadow for stack */}
            <ellipse cx="145" cy="186" rx="80" ry="10" fill="url(#flourFloor)" />

            {/* ── BACK SACK (Tilted, 10 Kg) ── */}
            <g transform="rotate(-9 105 130)">
                <path d="M72 65 C70 65, 68 75, 67 95 C66 125, 68 150, 70 168 L130 168 C132 150, 134 125, 133 95 C132 75, 130 65, 128 65 Z" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
                <path d="M72 65 C70 65, 68 75, 67 95 C66 125, 68 150, 70 168 L130 168 C132 150, 134 125, 133 95 C132 75, 130 65, 128 65 Z" fill="url(#flourWove)" />
                {/* Back sack band */}
                <rect x="68" y="95" width="64" height="28" fill="#1e293b" fillOpacity="0.85" />
                <rect x="68" y="123" width="64" height="5" fill="#f59e0b" />
                {/* Stitch */}
                <line x1="68" y1="166" x2="132" y2="166" stroke="#b91c1c" strokeWidth="1.5" strokeDasharray="3,2" />
            </g>

            {/* ── SECOND SACK (Middle, leaning right) ── */}
            <g transform="rotate(6 175 135)">
                <path d="M142 58 C140 58, 138 70, 137 95 C136 125, 138 155, 140 172 L202 172 C204 155, 206 125, 205 95 C204 70, 202 58, 200 58 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                <path d="M142 58 C140 58, 138 70, 137 95 C136 125, 138 155, 140 172 L202 172 C204 155, 206 125, 205 95 C204 70, 202 58, 200 58 Z" fill="url(#flourWove)" />
                <line x1="139" y1="170" x2="203" y2="170" stroke="#1d4ed8" strokeWidth="1.5" strokeDasharray="3,2" />
            </g>

            {/* ── FRONT MAIN SACK (30 Kg, Upright & Bold) ── */}
            <g>
                <path d="M102 46 C100 46, 98 56, 97 85 C96 115, 97 150, 99 180 C99 182, 102 184, 106 184 L178 184 C182 184, 185 182, 185 180 C187 150, 188 115, 187 85 C186 56, 184 46, 182 46 Z" fill="url(#flourBg)" stroke="#cbd5e1" strokeWidth="1.2" />
                <path d="M102 46 C100 46, 98 56, 97 85 C96 115, 97 150, 99 180 C99 182, 102 184, 106 184 L178 184 C182 184, 185 182, 185 180 C187 150, 188 115, 187 85 C186 56, 184 46, 182 46 Z" fill="url(#flourWove)" />

                {/* Printed 2-Color Brand Block (Navy + Amber) */}
                <rect x="97.5" y="76" width="88" height="66" fill="#0f172a" />
                <rect x="97.5" y="142" width="88" height="6" fill="#f59e0b" />
                <rect x="97.5" y="70" width="88" height="6" fill="#f59e0b" />

                {/* Golden Wheat Emblem & Icon */}
                <circle cx="141.5" cy="100" r="16" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.5" />
                {/* Stylized Wheat Stalk */}
                <path d="M141.5 112 V88 M141.5 94 C138 92, 137 88, 141.5 87 C146 88, 145 92, 141.5 94 M141.5 99 C137 97, 136 93, 141.5 92 C147 93, 146 97, 141.5 99 M141.5 104 C137 102, 136 98, 141.5 97 C147 98, 146 102, 141.5 104" stroke="#f59e0b" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />

                {/* Brand Text Marks (Clean generic placeholder blocks) */}
                <rect x="114" y="122" width="55" height="4.5" rx="1" fill="#ffffff" />
                <rect x="123" y="130" width="37" height="3" rx="0.8" fill="#f59e0b" />
                <rect x="120" y="135" width="43" height="2.5" rx="0.6" fill="#94a3b8" />

                {/* Top Fold & EZ-Open Red Pull String */}
                <path d="M100 46 L184 46 L183 51 L101 51 Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.8" />
                <path d="M101 48.5 L183 48.5" stroke="#dc2626" strokeWidth="1.4" strokeDasharray="3,2" />
                {/* Extended Pull Twine Tab on Right */}
                <path d="M183 48.5 Q190 46 193 51" stroke="#dc2626" strokeWidth="1.4" fill="none" />

                {/* Bottom Seam Stitch */}
                <rect x="98" y="178" width="88" height="5" fill="#1e293b" />
                <line x1="99" y1="180.5" x2="185" y2="180.5" stroke="#ffffff" strokeWidth="1" strokeDasharray="3,2" />
            </g>
        </svg>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CHEMICAL & POLYMER BAG (25 Kg)
// Glossy laminated bag with Hazchem warning diamond and inner LDPE liner neck.
// ─────────────────────────────────────────────────────────────────────────────
function ChemicalBagSvg() {
    return (
        <svg viewBox="0 0 280 210" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="chemLiner" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#e0f2fe" stopOpacity="0.45" />
                </linearGradient>
                <linearGradient id="chemGloss" x1="80" y1="40" x2="200" y2="180">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="45%" stopColor="#f8fafc" />
                    <stop offset="100%" stopColor="#e2e8f0" />
                </linearGradient>
                <radialGradient id="chemFloor" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity="0.22" />
                    <stop offset="70%" stopColor="#0f172a" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </radialGradient>
            </defs>

            {/* Floor Contact Shadow */}
            <ellipse cx="140" cy="186" rx="68" ry="9" fill="url(#chemFloor)" />

            {/* Protruding Inner LDPE Poly Liner (Visible at open mouth) */}
            <path
                d="M102 36 C102 24, 115 22, 140 22 C165 22, 178 24, 178 36 L175 48 C160 46, 120 46, 105 48 Z"
                fill="url(#chemLiner)"
                stroke="#38bdf8"
                strokeWidth="1"
                strokeDasharray="4,2"
            />
            {/* Soft liner highlight fold */}
            <path d="M120 23 Q125 35 127 46" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.8" />
            <path d="M152 23 Q150 35 148 46" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.6" />

            {/* Bag Main Body */}
            <path
                d="M94 44 C93 44, 91 55, 90 85 C89 120, 90 155, 93 178 C93 181, 96 183, 100 183 L180 183 C184 183, 187 181, 187 178 C190 155, 191 120, 190 85 C189 55, 187 44, 186 44 Z"
                fill="url(#chemGloss)"
                stroke="#94a3b8"
                strokeWidth="1.2"
            />

            {/* Diagonal Gloss Light Reflection Highlight */}
            <path
                d="M110 44 L138 44 L114 183 L96 183 Z"
                fill="#ffffff"
                fillOpacity="0.4"
            />
            <path
                d="M146 44 L156 44 L132 183 L122 183 Z"
                fill="#ffffff"
                fillOpacity="0.25"
            />

            {/* Hazchem Warning Diamond Label Block */}
            <g transform="translate(140, 96)">
                {/* Rotated Diamond Warning Block */}
                <rect x="-18" y="-18" width="36" height="36" rx="2" transform="rotate(45)" fill="#f59e0b" stroke="#0f172a" strokeWidth="2" />
                <rect x="-15" y="-15" width="30" height="30" rx="1.5" transform="rotate(45)" fill="#fef3c7" stroke="#0f172a" strokeWidth="1" />
                {/* Hazchem Hazard Symbol Icon (Generic chemical warning silhouette) */}
                <path d="M-6 -6 L6 -6 L0 6 Z" fill="#0f172a" />
                <circle cx="0" cy="1" r="2.5" fill="#f59e0b" />
                <rect x="-8" y="10" width="16" height="2" fill="#0f172a" />
            </g>

            {/* Technical Specification Block / Batch Label */}
            <rect x="105" y="128" width="70" height="36" rx="2" fill="#0f172a" />
            <rect x="108" y="132" width="64" height="4" fill="#38bdf8" />
            <line x1="108" y1="140" x2="168" y2="140" stroke="#ffffff" strokeWidth="1" />
            <line x1="108" y1="145" x2="156" y2="145" stroke="#cbd5e1" strokeWidth="0.8" />
            <line x1="108" y1="150" x2="162" y2="150" stroke="#cbd5e1" strokeWidth="0.8" />
            <line x1="108" y1="155" x2="140" y2="155" stroke="#f59e0b" strokeWidth="1" />
            {/* UN Spec Packaging code stamp */}
            <circle cx="164" cy="154" r="5" fill="none" stroke="#38bdf8" strokeWidth="0.8" />
            <text x="164" y="156" fill="#38bdf8" fontSize="4.5" fontFamily="monospace" textAnchor="middle" fontWeight="bold">UN</text>

            {/* Reinforced Bottom Tape */}
            <rect x="91" y="177" width="98" height="6" fill="#0284c7" stroke="#0369a1" strokeWidth="0.8" />
            <line x1="93" y1="180" x2="187" y2="180" stroke="#ffffff" strokeWidth="1.2" strokeDasharray="3,2" />
        </svg>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. BOPP MULTI-COLOR LAMINATED BAG
// Glossy retail bag with photographic multi-color gradient panel and heat-sealed top.
// ─────────────────────────────────────────────────────────────────────────────
function BoppBagSvg() {
    return (
        <svg viewBox="0 0 280 210" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="boppRainbow" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#0284c7" />
                    <stop offset="35%" stopColor="#4f46e5" />
                    <stop offset="70%" stopColor="#e11d48" />
                    <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
                <linearGradient id="boppBody" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#f1f5f9" />
                </linearGradient>
                <radialGradient id="boppFloor" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity="0.24" />
                    <stop offset="70%" stopColor="#0f172a" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </radialGradient>
            </defs>

            {/* Floor Contact Shadow */}
            <ellipse cx="140" cy="184" rx="66" ry="8" fill="url(#boppFloor)" />

            {/* Bag Main Body with Side Gusset Folds */}
            <path
                d="M96 42 L184 42 L188 178 C188 181, 185 183, 180 183 L100 183 C95 183, 92 181, 92 178 Z"
                fill="url(#boppBody)"
                stroke="#cbd5e1"
                strokeWidth="1.2"
            />

            {/* Left & Right Side Gusset Shadow Folds */}
            <path d="M96 42 L105 44 L103 183 L92 178 Z" fill="#94a3b8" fillOpacity="0.25" />
            <path d="M184 42 L175 44 L177 183 L188 178 Z" fill="#64748b" fillOpacity="0.35" />

            {/* Premium Multi-Color Glossy Print Panel */}
            <rect x="105" y="52" width="70" height="98" rx="2" fill="url(#boppRainbow)" />

            {/* Diagonal High-Gloss Reflection Sweep across BOPP print */}
            <path d="M125 52 L145 52 L115 150 L95 150 Z" fill="#ffffff" fillOpacity="0.3" />
            <path d="M152 52 L160 52 L130 150 L122 150 Z" fill="#ffffff" fillOpacity="0.2" />

            {/* Retail Gold Emblem & Brand Medallion */}
            <circle cx="140" cy="86" r="17" fill="#ffffff" stroke="#f59e0b" strokeWidth="1.8" />
            <circle cx="140" cy="86" r="14" fill="#fef3c7" stroke="#d97706" strokeWidth="0.8" />
            {/* Sparkle / Quality Crown Icon */}
            <path d="M133 90 L135 83 L140 86 L145 83 L147 90 Z" fill="#d97706" />

            {/* Clean Photographic Product Panel (Stylized grains/crop waves) */}
            <path d="M105 120 Q120 110 140 118 Q160 126 175 116 L175 150 L105 150 Z" fill="#0f172a" fillOpacity="0.75" />
            <rect x="116" y="132" width="48" height="4" rx="1" fill="#fde047" />
            <rect x="122" y="140" width="36" height="3" rx="0.8" fill="#ffffff" />

            {/* Top Heat-Sealed Crimp Pattern */}
            <rect x="94" y="36" width="92" height="7" rx="1" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.8" />
            {/* Crimp embossing grooves */}
            <path d="M96 38 H184 M96 40 H184 M96 42 H184" stroke="#94a3b8" strokeWidth="0.7" strokeDasharray="2,2" />

            {/* Die-Cut Carry Handle Oval Slot */}
            <rect x="128" y="27" width="24" height="6.5" rx="3.25" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />

            {/* Bottom Fold Seam */}
            <line x1="93" y1="178" x2="187" y2="178" stroke="#0f172a" strokeWidth="1.2" strokeOpacity="0.4" />
        </svg>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ANIMAL & CATTLE FEED BAG (50 Kg)
// Large breathable bleached white sack with bold industrial brand block & cattle icon.
// ─────────────────────────────────────────────────────────────────────────────
function CattleFeedBagSvg() {
    return (
        <svg viewBox="0 0 280 210" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="feedWeave" width="6" height="6" patternUnits="userSpaceOnUse">
                    <path d="M0 3h6M3 0v6" stroke="#94a3b8" strokeWidth="0.5" strokeOpacity="0.35" />
                </pattern>
                <linearGradient id="feedBody" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="60%" stopColor="#f8fafc" />
                    <stop offset="100%" stopColor="#e2e8f0" />
                </linearGradient>
                <radialGradient id="feedFloor" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity="0.25" />
                    <stop offset="70%" stopColor="#0f172a" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </radialGradient>
            </defs>

            {/* Floor Contact Shadow */}
            <ellipse cx="140" cy="186" rx="74" ry="10" fill="url(#feedFloor)" />

            {/* Robust 50 Kg Sack Silhouette (Fuller posture & curved sides) */}
            <path
                d="M90 40 C88 40, 85 54, 84 85 C83 125, 84 158, 88 180 C88 183, 92 185, 96 185 L184 185 C188 185, 192 183, 192 180 C196 158, 197 125, 196 85 C195 54, 192 40, 190 40 Z"
                fill="url(#feedBody)"
                stroke="#cbd5e1"
                strokeWidth="1.2"
            />
            {/* Breathable Woven Grid */}
            <path
                d="M90 40 C88 40, 85 54, 84 85 C83 125, 84 158, 88 180 C88 183, 92 185, 96 185 L184 185 C188 185, 192 183, 192 180 C196 158, 197 125, 196 85 C195 54, 192 40, 190 40 Z"
                fill="url(#feedWeave)"
            />

            {/* 3D Roundness shading */}
            <path d="M84 85 Q85 140 88 180 L102 182 Q96 140 95 85 Z" fill="#94a3b8" fillOpacity="0.3" />
            <path d="M196 85 Q195 140 192 180 L178 182 Q184 140 185 85 Z" fill="#475569" fillOpacity="0.4" />

            {/* Bold Agricultural Brand Panel (Dark Emerald Green + Gold) */}
            <rect x="87" y="70" width="106" height="68" fill="#064e3b" />
            <rect x="87" y="66" width="106" height="4" fill="#f59e0b" />
            <rect x="87" y="138" width="106" height="4" fill="#f59e0b" />

            {/* Central Livestock Cattle Icon */}
            <circle cx="140" cy="98" r="16" fill="#047857" stroke="#f59e0b" strokeWidth="1.5" />
            {/* Cattle Silhouette Outline */}
            <path d="M132 94 C132 90, 134 88, 140 88 C146 88, 148 90, 148 94 C148 98, 146 104, 140 106 C134 104, 132 98, 132 94 Z" fill="#ffffff" />
            {/* Horns */}
            <path d="M134 90 C130 87, 128 84, 129 82 M146 90 C150 87, 152 84, 151 82" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />

            {/* Prominent "50 KG" bold text badge */}
            <rect x="122" y="120" width="36" height="12" rx="2" fill="#f59e0b" />
            <text x="140" y="129" fill="#0f172a" fontSize="8" fontFamily="monospace" fontWeight="900" textAnchor="middle">50 KG</text>

            {/* Top Stitching Twine */}
            <path d="M89 40 L191 40 L190 45 L90 45 Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.8" />
            <path d="M91 42.5 L189 42.5" stroke="#15803d" strokeWidth="1.4" strokeDasharray="3,2" />

            {/* Heavy-Duty Bottom Stitch Tape */}
            <rect x="86" y="179" width="108" height="6.5" fill="#0f172a" stroke="#000000" strokeWidth="0.8" />
            <line x1="88" y1="182.2" x2="192" y2="182.2" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3,2" />
        </svg>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. CEMENT & WALL PUTTY BAG (50 Kg)
// Block-bottom valve sack, micro-perforations, technical markings & warning stripes.
// ─────────────────────────────────────────────────────────────────────────────
function CementBagSvg() {
    return (
        <svg viewBox="0 0 280 210" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="microPerf" width="4" height="4" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="0.45" fill="#64748b" fillOpacity="0.38" />
                </pattern>
                <linearGradient id="cementGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f8fafc" />
                    <stop offset="60%" stopColor="#e2e8f0" />
                    <stop offset="100%" stopColor="#cbd5e1" />
                </linearGradient>
                <radialGradient id="cementFloor" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity="0.25" />
                    <stop offset="70%" stopColor="#0f172a" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </radialGradient>
            </defs>

            {/* Floor Contact Shadow */}
            <ellipse cx="140" cy="184" rx="70" ry="8" fill="url(#cementFloor)" />

            {/* Block Bottom Valve Sack Shape (Box-like 3D structure) */}
            <path
                d="M94 48 L186 48 L186 178 L94 178 Z"
                fill="url(#cementGrad)"
                stroke="#64748b"
                strokeWidth="1.2"
            />
            {/* Micro-perforation surface pattern */}
            <path d="M94 48 L186 48 L186 178 L94 178 Z" fill="url(#microPerf)" />

            {/* Top Block Seal with Valve Flap on Top-Right */}
            <polygon points="94,48 102,38 178,38 186,48" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
            {/* Filling Valve Flap */}
            <polygon points="170,38 186,48 186,58 170,48" fill="#94a3b8" stroke="#475569" strokeWidth="0.8" />
            <text x="178" y="45" fill="#0f172a" fontSize="5" fontWeight="bold">VALVE</text>

            {/* Bottom Flat Block Sealing */}
            <polygon points="94,178 102,185 178,185 186,178" fill="#94a3b8" stroke="#64748b" strokeWidth="1" />

            {/* Industrial Hazard Chevron Stripe Panel (Black & Yellow) */}
            <g transform="translate(94, 60)">
                <rect x="0" y="0" width="92" height="10" fill="#f59e0b" />
                <path d="M0 0 L10 10 M15 0 L25 10 M30 0 L40 10 M45 0 L55 10 M60 0 L70 10 M75 0 L85 10" stroke="#0f172a" strokeWidth="3" />
            </g>

            {/* Technical Markings & Cement Grade Stamp */}
            <rect x="104" y="80" width="72" height="42" rx="2" fill="#0f172a" />
            <rect x="108" y="84" width="64" height="6" fill="#f59e0b" />
            <text x="140" y="89" fill="#0f172a" fontSize="5" fontFamily="monospace" fontWeight="900" textAnchor="middle">GRADE 53 • IS:12269</text>

            {/* Spec lines */}
            <line x1="108" y1="95" x2="168" y2="95" stroke="#ffffff" strokeWidth="0.9" />
            <line x1="108" y1="100" x2="160" y2="100" stroke="#cbd5e1" strokeWidth="0.8" />
            <line x1="108" y1="105" x2="164" y2="105" stroke="#cbd5e1" strokeWidth="0.8" />
            <line x1="108" y1="110" x2="148" y2="110" stroke="#94a3b8" strokeWidth="0.8" />

            {/* ISI Certification Mark Hexagon */}
            <g transform="translate(140, 146)">
                <circle cx="0" cy="0" r="14" fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" />
                <polygon points="0,-10 9,-5 9,5 0,10 -9,5 -9,-5" fill="none" stroke="#dc2626" strokeWidth="1.2" />
                <text x="0" y="3" fill="#dc2626" fontSize="5.5" fontWeight="bold" textAnchor="middle">ISI</text>
            </g>

            {/* High Burst Proof Reinforcement Seam Lines */}
            <line x1="96" y1="168" x2="184" y2="168" stroke="#64748b" strokeWidth="0.8" strokeDasharray="4,2" />
        </svg>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. PP SACK WITH LDPE LINER (25 / 50 Kg)
// Cutaway illustration: outer woven sack peeled to show translucent LDPE liner.
// ─────────────────────────────────────────────────────────────────────────────
function PolyLinerCutawaySvg() {
    return (
        <svg viewBox="0 0 280 210" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="cutWeave" width="5" height="5" patternUnits="userSpaceOnUse">
                    <path d="M0 2.5h5M2.5 0v5" stroke="#94a3b8" strokeWidth="0.45" strokeOpacity="0.32" />
                </pattern>
                <linearGradient id="innerLinerBlue" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.9" />
                    <stop offset="50%" stopColor="#7dd3fc" stopOpacity="0.65" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.4" />
                </linearGradient>
                <radialGradient id="linerFloor" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity="0.22" />
                    <stop offset="70%" stopColor="#0f172a" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </radialGradient>
            </defs>

            {/* Floor Contact Shadow */}
            <ellipse cx="140" cy="184" rx="66" ry="8" fill="url(#linerFloor)" />

            {/* ── INNER LDPE LINER (Extending out of top) ── */}
            <path
                d="M100 25 C100 20, 115 18, 140 18 C165 18, 180 20, 180 25 L182 85 L98 85 Z"
                fill="url(#innerLinerBlue)"
                stroke="#38bdf8"
                strokeWidth="1.2"
            />
            {/* Soft film highlights */}
            <path d="M115 20 Q118 45 116 80" stroke="#ffffff" strokeWidth="1.4" strokeOpacity="0.75" />
            <path d="M165 20 Q162 45 164 80" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.6" />

            {/* ── OUTER WOVEN SACK BODY (With diagonal cutaway section) ── */}
            {/* Full outer outline background */}
            <path
                d="M94 45 C93 45, 91 55, 90 85 C89 120, 90 155, 93 178 C93 181, 96 183, 100 183 L180 183 C184 183, 187 181, 187 178 C190 155, 191 120, 190 85 C189 55, 187 45, 186 45 Z"
                fill="#f8fafc"
                stroke="#cbd5e1"
                strokeWidth="1.2"
            />

            {/* Inner liner exposed behind the cutaway */}
            <path
                d="M91 75 C100 80, 120 70, 145 95 C165 115, 175 105, 189 120 L189 75 Z"
                fill="url(#innerLinerBlue)"
                stroke="#0284c7"
                strokeWidth="0.8"
                strokeDasharray="4,2"
            />

            {/* Cutaway Woven Mask (Lower & Left outer fabric portion) */}
            <path
                d="M91 75 C100 80, 120 70, 145 95 C165 115, 175 105, 189 120 L189 178 C189 181, 185 183, 180 183 L100 183 C96 183, 93 181, 93 178 C90 155, 89 120, 90 85 Z"
                fill="#ffffff"
                stroke="#0284c7"
                strokeWidth="1.4"
            />
            {/* Woven Pattern Overlay on outer bag */}
            <path
                d="M91 75 C100 80, 120 70, 145 95 C165 115, 175 105, 189 120 L189 178 C189 181, 185 183, 180 183 L100 183 C96 183, 93 181, 93 178 C90 155, 89 120, 90 85 Z"
                fill="url(#cutWeave)"
            />

            {/* "100% MOISTURE PROOF" Badge on Cutaway */}
            <g transform="translate(138, 146)">
                <rect x="-35" y="-12" width="70" height="24" rx="4" fill="#0284c7" stroke="#0369a1" strokeWidth="1" />
                <text x="0" y="-1" fill="#ffffff" fontSize="6" fontFamily="sans-serif" fontWeight="900" textAnchor="middle">100% MOISTURE</text>
                <text x="0" y="7" fill="#fde047" fontSize="5.5" fontFamily="sans-serif" fontWeight="800" textAnchor="middle">BARRIER LINER</text>
            </g>

            {/* Moisture Droplets Deflection Graphic on outer layer */}
            <circle cx="108" cy="115" r="3" fill="#38bdf8" fillOpacity="0.8" />
            <circle cx="114" cy="122" r="2" fill="#38bdf8" fillOpacity="0.6" />
            <circle cx="105" cy="126" r="2.2" fill="#38bdf8" fillOpacity="0.7" />

            {/* Top Cutaway Hem Seam & Bottom Tack */}
            <path d="M94 45 L186 45 L185 50 L95 50 Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.8" />
            <line x1="96" y1="47.5" x2="184" y2="47.5" stroke="#0284c7" strokeWidth="1.2" strokeDasharray="3,2" />

            {/* Bottom Stitch Seam with Liner Tack Pin */}
            <rect x="91" y="177" width="98" height="6.5" fill="#1e293b" />
            <line x1="93" y1="180.2" x2="187" y2="180.2" stroke="#ffffff" strokeWidth="1.2" strokeDasharray="3,2" />
        </svg>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. PP WOVEN FABRIC ROLL
// Cylindrical roll standing upright with wound concentric layers and unrolling flat sheet.
// ─────────────────────────────────────────────────────────────────────────────
function FabricRollSvg() {
    return (
        <svg viewBox="0 0 280 210" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="rollWeave" width="5" height="5" patternUnits="userSpaceOnUse">
                    <path d="M0 2.5h5M2.5 0v5" stroke="#94a3b8" strokeWidth="0.45" strokeOpacity="0.35" />
                </pattern>
                <linearGradient id="cylinderGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="25%" stopColor="#f8fafc" />
                    <stop offset="70%" stopColor="#cbd5e1" />
                    <stop offset="100%" stopColor="#94a3b8" />
                </linearGradient>
                <radialGradient id="rollFloor" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity="0.25" />
                    <stop offset="70%" stopColor="#0f172a" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </radialGradient>
            </defs>

            {/* Floor Contact Shadow */}
            <ellipse cx="140" cy="186" rx="80" ry="10" fill="url(#rollFloor)" />

            {/* ── UNROLLING FLAT FABRIC SHEET (Draped onto the floor) ── */}
            <polygon
                points="130,175 60,188 180,188 170,175"
                fill="#e2e8f0"
                stroke="#cbd5e1"
                strokeWidth="1"
            />
            <polygon
                points="130,175 60,188 180,188 170,175"
                fill="url(#rollWeave)"
            />
            {/* Edge Guide Stripe on unrolling sheet */}
            <line x1="75" y1="188" x2="136" y2="175" stroke="#f59e0b" strokeWidth="2.5" />
            <line x1="165" y1="188" x2="164" y2="175" stroke="#0284c7" strokeWidth="2.5" />

            {/* ── UPRIGHT FABRIC ROLL (Cylinder Body) ── */}
            <g transform="translate(45, 0)">
                {/* Cylinder Side Surface */}
                <path
                    d="M60 40 L60 170 C60 178, 120 178, 120 170 L120 40 Z"
                    fill="url(#cylinderGrad)"
                    stroke="#94a3b8"
                    strokeWidth="1.2"
                />
                {/* Woven Pattern Overlay */}
                <path
                    d="M60 40 L60 170 C60 178, 120 178, 120 170 L120 40 Z"
                    fill="url(#rollWeave)"
                />

                {/* Vertical Edge Stripes on wound roll */}
                <line x1="68" y1="46" x2="68" y2="172" stroke="#f59e0b" strokeWidth="3" />
                <line x1="112" y1="46" x2="112" y2="172" stroke="#0284c7" strokeWidth="3" />

                {/* Cylinder Bottom Lip Curve */}
                <path d="M60 170 C60 178, 120 178, 120 170" stroke="#64748b" strokeWidth="1.2" fill="none" />

                {/* ── TOP CONCENTRIC WOUND LAYERS (Visible wound roll top) ── */}
                {/* Outer layer ellipse */}
                <ellipse cx="90" cy="40" rx="30" ry="10" fill="#e2e8f0" stroke="#64748b" strokeWidth="1.2" />
                {/* Consecutive inner wound spirals/circles */}
                <ellipse cx="90" cy="40" rx="24" ry="8" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.8" />
                <ellipse cx="90" cy="40" rx="18" ry="6" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.8" />
                <ellipse cx="90" cy="40" rx="12" ry="4" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="0.8" />
                {/* Hollow Inner Core Tube (Heavy cardboard/PVC core) */}
                <ellipse cx="90" cy="40" rx="6" ry="2.2" fill="#0f172a" stroke="#000000" strokeWidth="1" />
            </g>

            {/* Roll Diameter / Meterage Label Tag on front */}
            <g transform="translate(135, 100)">
                <rect x="-24" y="-12" width="48" height="24" rx="3" fill="#0f172a" stroke="#ffffff" strokeWidth="1" />
                <rect x="-22" y="-10" width="44" height="4" fill="#f59e0b" />
                <text x="0" y="2" fill="#ffffff" fontSize="6.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">1000 M</text>
                <text x="0" y="9" fill="#94a3b8" fontSize="5" fontFamily="monospace" textAnchor="middle">CIRCULAR</text>
            </g>
        </svg>
    );
}
