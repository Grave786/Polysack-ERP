import { useState, useEffect, useRef, useCallback } from 'react';
import {
    X,
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    ZoomOut,
    Maximize2,
    Send,
    MessageSquare,
    Phone,
    Check,
    Sparkles,
    ShieldCheck
} from 'lucide-react';
import { ProductSvgIllustration } from './ProductImage';

export default function ProductDetailModal({
    isOpen,
    productId,
    onClose,
    onOpenQuoteModal,
    onSelectProduct,
    products = [],
    companyConfig = {}
}) {
    const modalRef = useRef(null);
    const lastFocusedElementRef = useRef(null);
    const imageContainerRef = useRef(null);

    // Track active image and error state
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [failedImages, setFailedImages] = useState(new Set());
    const [isZoomed, setIsZoomed] = useState(false);
    const [panPos, setPanPos] = useState({ x: 50, y: 50 });
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);

    // Mobile touch swipe handling
    const touchStartX = useRef(0);
    const touchEndX = useRef(0);
    const lastTapRef = useRef(0);

    const product = products.find((p) => p.id === productId);

    // Reset gallery states whenever product changes
    useEffect(() => {
        setActiveImageIndex(0);
        setIsZoomed(false);
        setPanPos({ x: 50, y: 50 });
        setFailedImages(new Set());
    }, [productId]);

    // Handle scroll lock and focus management
    useEffect(() => {
        if (isOpen) {
            lastFocusedElementRef.current = document.activeElement;
            document.body.style.overflow = 'hidden';

            // Focus modal on open
            setTimeout(() => {
                modalRef.current?.focus();
            }, 50);
        } else {
            document.body.style.overflow = '';
            setIsLightboxOpen(false);
            setIsZoomed(false);
            if (lastFocusedElementRef.current && typeof lastFocusedElementRef.current.focus === 'function') {
                lastFocusedElementRef.current.focus();
            }
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const images = product?.images && product.images.length > 0
        ? product.images
        : (product?.imageSrc ? [product.imageSrc] : []);

    const allImagesFailed = images.length === 0 || images.every((_, idx) => failedImages.has(idx));
    const currentImageSrc = images[activeImageIndex];
    const isCurrentImageFailed = failedImages.has(activeImageIndex) || !currentImageSrc;
    const hasWorkingGallery = images.length > 1 && !allImagesFailed;

    const handlePrevImage = useCallback(() => {
        setIsZoomed(false);
        setActiveImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    }, [images.length]);

    const handleNextImage = useCallback(() => {
        setIsZoomed(false);
        setActiveImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    }, [images.length]);

    // Keyboard navigation & focus trap
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (isLightboxOpen) {
                    setIsLightboxOpen(false);
                } else if (isZoomed) {
                    setIsZoomed(false);
                } else {
                    onClose();
                }
                return;
            }

            if (hasWorkingGallery) {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    handlePrevImage();
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    handleNextImage();
                }
            }

            // Simple focus trap
            if (e.key === 'Tab' && modalRef.current) {
                const focusable = modalRef.current.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length > 0) {
                    const firstEl = focusable[0];
                    const lastEl = focusable[focusable.length - 1];
                    if (e.shiftKey && document.activeElement === firstEl) {
                        e.preventDefault();
                        lastEl.focus();
                    } else if (!e.shiftKey && document.activeElement === lastEl) {
                        e.preventDefault();
                        firstEl.focus();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isLightboxOpen, isZoomed, onClose, hasWorkingGallery, handlePrevImage, handleNextImage]);

    // Desktop Zoom Mouse Movement
    const handleMouseMove = (e) => {
        if (!isZoomed || !imageContainerRef.current) return;
        const rect = imageContainerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
        setPanPos({ x, y });
    };

    const handleToggleZoom = (e) => {
        if (isCurrentImageFailed) return;
        if (!isZoomed && imageContainerRef.current) {
            const rect = imageContainerRef.current.getBoundingClientRect();
            const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
            setPanPos({ x, y });
        }
        setIsZoomed((prev) => !prev);
    };

    // Mobile double tap zoom
    const handleTouchEnd = () => {
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;
        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
            if (!isCurrentImageFailed) {
                setIsZoomed((prev) => !prev);
            }
        }
        lastTapRef.current = now;

        // Swipe detection
        const diff = touchStartX.current - touchEndX.current;
        if (Math.abs(diff) > 45 && hasWorkingGallery) {
            if (diff > 0) {
                handleNextImage();
            } else {
                handlePrevImage();
            }
        }
    };

    if (!isOpen || !product) return null;

    // Pick 3 related products from other catalog entries
    const relatedProducts = products
        .filter((p) => p.id !== product.id)
        .slice(0, 3);

    return (
        <>
            {/* Backdrop Overlay */}
            <div
                className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200"
                onClick={onClose}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-product-title"
            >
                {/* Modal Container */}
                <div
                    ref={modalRef}
                    tabIndex={-1}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-5xl my-auto overflow-hidden relative flex flex-col lg:flex-row max-h-[94vh] lg:max-h-[88vh] animate-in zoom-in-95 duration-200 focus:outline-hidden"
                >
                    {/* Floating Close Button */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-30 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors shadow-xs"
                        aria-label="Close product modal"
                    >
                        <X size={18} />
                    </button>

                    {/* ============================================================= */}
                    {/* LEFT PANEL: PHOTO GALLERY & VIEWER (~55%)                     */}
                    {/* ============================================================= */}
                    <div className="lg:w-[54%] bg-slate-100/70 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between p-4 sm:p-6 relative select-none">
                        {/* Main Viewport */}
                        <div
                            ref={imageContainerRef}
                            onClick={handleToggleZoom}
                            onMouseMove={handleMouseMove}
                            onTouchStart={(e) => {
                                touchStartX.current = e.touches[0].clientX;
                                touchEndX.current = e.touches[0].clientX;
                            }}
                            onTouchMove={(e) => {
                                touchEndX.current = e.touches[0].clientX;
                            }}
                            onTouchEnd={handleTouchEnd}
                            className={`relative w-full aspect-[4/3] sm:aspect-[16/11] rounded-2xl bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-slate-200/90 overflow-hidden flex items-center justify-center shadow-xs ${
                                isCurrentImageFailed ? '' : isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'
                            }`}
                        >
                            {/* Subtle background texture */}
                            <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />

                            {/* Fullscreen Trigger Button */}
                            {!isCurrentImageFailed && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsLightboxOpen(true);
                                    }}
                                    className="absolute top-3 right-3 z-20 w-8 h-8 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer"
                                    title="View Fullscreen Lightbox"
                                    aria-label="Fullscreen image"
                                >
                                    <Maximize2 size={14} />
                                </button>
                            )}

                            {/* Zoom Status Hint */}
                            {!isCurrentImageFailed && (
                                <div className="absolute top-3 left-3 z-20 px-2 py-1 rounded-md bg-slate-900/75 backdrop-blur-xs text-[10px] font-bold text-white flex items-center gap-1 pointer-events-none">
                                    {isZoomed ? (
                                        <>
                                            <ZoomOut size={12} className="text-amber-400" />
                                            <span>2x Zoom • Click to reset</span>
                                        </>
                                    ) : (
                                        <>
                                            <ZoomIn size={12} className="text-amber-400" />
                                            <span>Click to zoom</span>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Capacity Tag at bottom-left */}
                            <div className="absolute bottom-3 left-3 z-20 px-2.5 py-1 rounded-md bg-slate-900/85 backdrop-blur-xs text-[11px] font-mono font-bold text-white border border-slate-700/60 shadow-xs pointer-events-none">
                                {product.capacity}
                            </div>

                            {/* Main Active Image / SVG Fallback */}
                            <div className="w-full h-full p-3 sm:p-5 flex items-center justify-center">
                                {!isCurrentImageFailed ? (
                                    <img
                                        src={currentImageSrc}
                                        alt={product?.imageAlt || `${product.name} - View ${activeImageIndex + 1}`}
                                        decoding="async"
                                        onError={() => setFailedImages((prev) => new Set(prev).add(activeImageIndex))}
                                        style={
                                            isZoomed
                                                ? {
                                                      transform: 'scale(2.2)',
                                                      transformOrigin: `${panPos.x}% ${panPos.y}%`
                                                  }
                                                : undefined
                                        }
                                        className={`w-full h-full object-contain rounded-xl transition-transform duration-100 ${
                                            isZoomed ? 'pointer-events-none' : ''
                                        }`}
                                    />
                                ) : (
                                    <ProductSvgIllustration productId={product.id} className="w-full h-full max-h-[340px]" />
                                )}
                            </div>

                            {/* Previous / Next Arrow Controls */}
                            {hasWorkingGallery && (
                                <>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handlePrevImage();
                                        }}
                                        className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
                                        aria-label="Previous photo"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleNextImage();
                                        }}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
                                        aria-label="Next photo"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Thumbnail Strip (if multiple photos available) */}
                        {hasWorkingGallery && (
                            <div className="pt-3 flex items-center justify-center gap-2 overflow-x-auto">
                                {images.map((img, idx) => {
                                    const isFailed = failedImages.has(idx);
                                    const isActive = idx === activeImageIndex;
                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                                setIsZoomed(false);
                                                setActiveImageIndex(idx);
                                            }}
                                            className={`relative w-14 h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer bg-white shrink-0 ${
                                                isActive
                                                    ? 'border-amber-500 ring-2 ring-amber-400/50 scale-105'
                                                    : 'border-slate-200/90 hover:border-slate-400 opacity-70 hover:opacity-100'
                                            }`}
                                            aria-label={`Switch to image ${idx + 1}`}
                                        >
                                            {!isFailed ? (
                                                <img
                                                    src={img}
                                                    alt={`Thumbnail ${idx + 1}`}
                                                    onError={() => setFailedImages((prev) => new Set(prev).add(idx))}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full p-1 bg-slate-50 flex items-center justify-center">
                                                    <ProductSvgIllustration productId={product.id} className="w-full h-full" />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ============================================================= */}
                    {/* RIGHT PANEL: FULL SPECIFICATIONS & ACTIONS (~46%)             */}
                    {/* ============================================================= */}
                    <div className="lg:w-[46%] p-5 sm:p-7 overflow-y-auto max-h-[500px] lg:max-h-full space-y-4 font-sans text-left">
                        {/* Header Block */}
                        <div className="space-y-1 pr-6">
                            <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 block">
                                {product.category}
                            </span>
                            <div className="flex items-start justify-between gap-2">
                                <h2
                                    id="modal-product-title"
                                    className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug"
                                >
                                    {product.name}
                                </h2>
                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 whitespace-nowrap shrink-0 mt-0.5">
                                    {product.badge}
                                </span>
                            </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                            {product.description ||
                                'Precision-manufactured polypropylene packaging engineered to stringent industrial standards for moisture barrier, high drop-impact durability, and safe bulk transport.'}
                        </p>

                        {/* Specification Table */}
                        <div className="rounded-xl border border-slate-200/90 overflow-hidden bg-slate-50/50 text-xs">
                            <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                                Technical Specifications
                            </div>
                            <div className="divide-y divide-slate-200/80 text-[11.5px]">
                                <div className="px-3.5 py-1.5 flex justify-between">
                                    <span className="text-slate-500">Weight Capacity:</span>
                                    <span className="font-mono font-bold text-slate-800">{product.capacity}</span>
                                </div>
                                <div className="px-3.5 py-1.5 flex justify-between">
                                    <span className="text-slate-500">GSM Density:</span>
                                    <span className="font-mono font-bold text-slate-800">{product.gsm}</span>
                                </div>
                                <div className="px-3.5 py-1.5 flex justify-between">
                                    <span className="text-slate-500">Lamination:</span>
                                    <span className="font-semibold text-slate-800 text-right">{product.lamination}</span>
                                </div>
                                <div className="px-3.5 py-1.5 flex justify-between">
                                    <span className="text-slate-500">Printing Options:</span>
                                    <span className="font-semibold text-slate-800 text-right">{product.printOption}</span>
                                </div>
                                {product.shape && (
                                    <div className="px-3.5 py-1.5 flex justify-between">
                                        <span className="text-slate-500">Bag Shape / Bottom:</span>
                                        <span className="font-semibold text-slate-800 text-right">{product.shape}</span>
                                    </div>
                                )}
                                <div className="px-3.5 py-1.5 bg-white">
                                    <span className="text-slate-500 block text-[10.5px]">Recommended Uses:</span>
                                    <span className="text-slate-800 italic leading-snug">{product.bestFor}</span>
                                </div>
                            </div>
                        </div>

                        {/* Feature Chips */}
                        {product.features && product.features.length > 0 && (
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                                    Key Manufacturing Attributes
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {product.features.map((feat, i) => (
                                        <span
                                            key={i}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200/80"
                                        >
                                            <Check size={11} className="text-amber-600" />
                                            <span>{feat}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Customization Callout */}
                        <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/70 flex items-start gap-2 text-[11px] text-amber-900 leading-snug">
                            <Sparkles size={14} className="text-amber-600 shrink-0 mt-0.5" />
                            <span>
                                <strong>Customization Available:</strong> All dimensions, mesh count, GSM weight, coating microns, and single/double-side branding can be manufactured to your custom industrial specifications.
                            </span>
                        </div>

                        {/* Primary & Secondary Actions */}
                        <div className="space-y-2 pt-1">
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    onOpenQuoteModal(product.name);
                                }}
                                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white font-black text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                            >
                                <Send size={13} />
                                <span>Get Quote for This Bag</span>
                            </button>

                            <div className="grid grid-cols-2 gap-2">
                                {companyConfig.whatsappRaw && (
                                    <a
                                        href={`https://wa.me/${companyConfig.whatsappRaw}?text=${encodeURIComponent(
                                            `Hello, I would like to inquire about specifications and pricing for ${product.name}.`
                                        )}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 text-center"
                                    >
                                        <MessageSquare size={13} />
                                        <span>WhatsApp Sales</span>
                                    </a>
                                )}

                                {companyConfig.phoneRaw && (
                                    <a
                                        href={`tel:${companyConfig.phoneRaw}`}
                                        className="py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 text-center"
                                    >
                                        <Phone size={13} />
                                        <span>Call Factory</span>
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Related Products Switcher */}
                        {relatedProducts.length > 0 && (
                            <div className="pt-3 border-t border-slate-200/80 space-y-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                                    Related Products
                                </span>
                                <div className="grid grid-cols-3 gap-2">
                                    {relatedProducts.map((rel) => (
                                        <button
                                            key={rel.id}
                                            type="button"
                                            onClick={() => onSelectProduct?.(rel.id)}
                                            className="p-2 rounded-xl bg-slate-50 hover:bg-amber-50/60 border border-slate-200 hover:border-amber-400 transition-all text-left group cursor-pointer"
                                        >
                                            <div className="w-full aspect-[4/3] rounded-md overflow-hidden bg-white border border-slate-200/80 mb-1 flex items-center justify-center p-1">
                                                {(rel.images?.[0] || rel.imageSrc) ? (
                                                    <img
                                                        src={rel.images?.[0] || rel.imageSrc}
                                                        alt={rel.name}
                                                        className={`w-full h-full ${rel.imageFit === 'cover' ? 'object-cover' : 'object-contain'}`}
                                                        loading="lazy"
                                                        decoding="async"
                                                    />
                                                ) : (
                                                    <ProductSvgIllustration productId={rel.id} className="w-full h-full" />
                                                )}
                                            </div>
                                            <div className="text-[10.5px] font-bold text-slate-800 group-hover:text-amber-800 truncate">
                                                {rel.name}
                                            </div>
                                            <div className="text-[9.5px] font-mono text-slate-500">
                                                {rel.capacity}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ================================================================= */}
            {/* FULL-SCREEN LIGHTBOX OVERLAY                                      */}
            {/* ================================================================= */}
            {isLightboxOpen && !isCurrentImageFailed && (
                <div
                    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-4 select-none animate-in fade-in duration-200"
                    onClick={() => setIsLightboxOpen(false)}
                >
                    {/* Lightbox Top Bar */}
                    <div
                        className="w-full max-w-6xl flex items-center justify-between text-white pb-2 z-10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div>
                            <div className="text-sm font-bold text-white tracking-wide">
                                {product.name}
                            </div>
                            {images.length > 1 && (
                                <div className="text-xs text-slate-400 font-mono">
                                    Photo {activeImageIndex + 1} of {images.length}
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsLightboxOpen(false)}
                            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
                            aria-label="Close fullscreen"
                        >
                            <X size={22} />
                        </button>
                    </div>

                    {/* Lightbox Center Image */}
                    <div
                        className="relative max-w-5xl max-h-[80vh] flex items-center justify-center my-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={currentImageSrc}
                            alt={`${product.name} Fullscreen`}
                            decoding="async"
                            className="max-w-[90vw] max-h-[76vh] object-contain rounded-lg shadow-2xl"
                        />

                        {/* Lightbox Navigation Arrows */}
                        {hasWorkingGallery && (
                            <>
                                <button
                                    type="button"
                                    onClick={handlePrevImage}
                                    className="absolute -left-4 sm:-left-12 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition-colors"
                                    aria-label="Previous image"
                                >
                                    <ChevronLeft size={24} />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleNextImage}
                                    className="absolute -right-4 sm:-right-12 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition-colors"
                                    aria-label="Next image"
                                >
                                    <ChevronRight size={24} />
                                </button>
                            </>
                        )}
                    </div>

                    {/* Lightbox Bottom Thumbnails */}
                    {hasWorkingGallery && (
                        <div
                            className="flex items-center gap-2 overflow-x-auto pb-2 z-10"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {images.map((img, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setActiveImageIndex(idx)}
                                    className={`w-14 h-11 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                                        idx === activeImageIndex
                                            ? 'border-amber-400 scale-105 opacity-100'
                                            : 'border-white/20 opacity-50 hover:opacity-80'
                                    }`}
                                >
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
