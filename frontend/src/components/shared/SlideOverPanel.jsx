import { X } from 'lucide-react';

export default function SlideOverPanel({
    isOpen,
    onClose,
    title,
    subtitle,
    children,
    footer = null,
    widthClass = 'w-full max-w-full sm:max-w-lg'
}) {
    if (!isOpen) return null;

    return (
        <>
            {/* Semi-transparent Backdrop Overlay */}
            <div
                className="fixed inset-0 bg-black/50 z-40 transition-opacity animate-in fade-in duration-150"
                onClick={onClose}
            />

            {/* Slide-out Panel from Right */}
            <div
                className={`fixed top-0 right-0 h-full w-full ${widthClass} bg-card-bg shadow-2xl z-50 flex flex-col border-l border-border font-sans transform transition-all duration-200 animate-in slide-in-from-right duration-200`}
            >
                {/* Panel Header */}
                <div className="bg-sidebar-bg text-sidebar-text-active p-5 flex justify-between items-center border-b border-sidebar-hover shrink-0">
                    <div>
                        <h2 className="text-base font-extrabold tracking-tight text-white">{title}</h2>
                        {subtitle && <p className="text-xs text-sidebar-text mt-0.5">{subtitle}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-sidebar-text hover:text-sidebar-text-active rounded-lg hover:bg-sidebar-hover transition-all cursor-pointer"
                        title="Close Panel"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Panel Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {children}
                </div>

                {/* Optional Panel Footer */}
                {footer && (
                    <div className="p-4 border-t border-border bg-card-bg flex justify-end gap-3 shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </>
    );
}
