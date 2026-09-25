import React, { useState } from 'react';
import { X, Eye, Calendar, Layers, ShieldCheck, Tag, Edit3, Building, MapPin, Hash, CheckCircle2, XCircle, FileText, Download, ZoomIn, Paperclip, FileSpreadsheet } from 'lucide-react';

/**
 * Helper to safely extract value or nested property
 */
const resolveVal = (obj, path) => {
    if (!obj) return null;
    if (typeof path === 'function') return path(obj);
    if (!path.includes('.')) return obj[path];
    return path.split('.').reduce((acc, part) => (acc ? acc[part] : null), obj);
};

/**
 * Format comma-separated operator names from Machine.currentOperators or legacy Machine.currentOperator
 */
const formatOperatorNames = (obj) => {
    if (!obj) return '-';
    const ops = (Array.isArray(obj.currentOperators) && obj.currentOperators.length > 0)
        ? obj.currentOperators
        : (obj.currentOperator ? [obj.currentOperator] : (Array.isArray(obj) ? obj : [obj]));
    if (!ops.length) return '-';
    return ops.map((op) => {
        if (typeof op === 'object' && op !== null) {
            return `${op.employeeCode ? `${op.employeeCode} - ` : ''}${op.name || '-'}`;
        }
        return String(op || '-');
    }).join(', ');
};

/**
 * Format displayed value based on type
 */
const formatValue = (val, type, fallback = '-') => {
    if (val === null || val === undefined || val === '') return fallback;

    if (type === 'boolean') {
        const isTrue = val === true || val === 'true' || val === 'Active';
        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${isTrue ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'}`}>
                {isTrue ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                <span>{isTrue ? 'Active' : 'Inactive'}</span>
            </span>
        );
    }

    if (type === 'status') {
        const str = String(val).toUpperCase();
        let colorClasses = 'bg-gray-100 text-gray-800 border-gray-200';
        if (str.includes('ACTIVE') || str === 'AVAILABLE' || str === 'CONFIRMED' || str === 'PASSED' || str === 'DELIVERED') {
            colorClasses = 'bg-emerald-100 text-emerald-800 border-emerald-200';
        } else if (str.includes('LEAD') || str.includes('MAINTENANCE') || str.includes('PENDING') || str.includes('DRAFT')) {
            colorClasses = 'bg-amber-100 text-amber-800 border-amber-200';
        } else if (str.includes('IN_USE') || str.includes('IN USE') || str.includes('IN_PROGRESS')) {
            colorClasses = 'bg-blue-100 text-blue-800 border-blue-200';
        } else if (str.includes('INACTIVE') || str.includes('SERVICE') || str.includes('CANCELLED') || str.includes('FAILED')) {
            colorClasses = 'bg-rose-100 text-rose-800 border-rose-200';
        }
        return (
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${colorClasses}`}>
                {String(val).replace(/_/g, ' ')}
            </span>
        );
    }

    if (type === 'currency') {
        const num = Number(val);
        return isNaN(num) ? String(val) : `₹${num.toLocaleString('en-IN')}`;
    }

    if (type === 'code') {
        return (
            <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-xs">
                {String(val)}
            </span>
        );
    }

    if (type === 'date') {
        try {
            return new Date(val).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return String(val);
        }
    }

    if (typeof val === 'object') {
        if (val.name) return val.name;
        if (val.companyName) return val.companyName;
        if (val.code) return val.code;
        if (val.symbol) return val.symbol;
        if (val.title) return val.title;
        return JSON.stringify(val);
    }

    return String(val);
};

/**
 * Self-contained PO Attachment viewer with image thumbnails + lightbox + PDF chips.
 * Must be a named component (not inline in renderCustom) to legally use useState.
 */
function PoAttachmentViewer({ images = [], pdfs = [], others = [] }) {
    const [lightbox, setLightbox] = useState(null); // { src, name }

    const formatSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <>
            {/* ── Image Thumbnails Grid ── */}
            {images.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                        Images ({images.length})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {images.map((file, idx) => (
                            <div
                                key={idx}
                                className="group relative rounded-xl overflow-hidden border border-border bg-app-bg shadow-xs aspect-[4/3] cursor-pointer"
                                onClick={() => setLightbox({ src: file.data, name: file.name })}
                                title={`Click to view: ${file.name}`}
                            >
                                {/* Thumbnail */}
                                {file.data ? (
                                    <img
                                        src={file.data}
                                        alt={file.name || `Image ${idx + 1}`}
                                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-text-muted">
                                        <Paperclip size={24} />
                                    </div>
                                )}
                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center">
                                    <ZoomIn size={22} className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" />
                                </div>
                                {/* File name strip */}
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-xs px-2 py-1">
                                    <p className="text-[10px] text-white font-medium truncate">{file.name || `Image ${idx + 1}`}</p>
                                    {file.size > 0 && (
                                        <p className="text-[9px] text-white/70">{formatSize(file.size)}</p>
                                    )}
                                </div>
                                {/* Download anchor (stops propagation) */}
                                {file.data && (
                                    <a
                                        href={file.data}
                                        download={file.name || `image_${idx + 1}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="absolute top-1.5 right-1.5 p-1 bg-black/50 hover:bg-black/70 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                        title="Download"
                                    >
                                        <Download size={12} />
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── PDF Chips ── */}
            {pdfs.length > 0 && (
                <div className="space-y-2 mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                        PDF Documents ({pdfs.length})
                    </p>
                    <div className="space-y-2">
                        {pdfs.map((file, idx) => (
                            <div
                                key={idx}
                                className="flex items-center justify-between gap-3 p-3 bg-app-bg border border-border rounded-xl text-xs hover:border-primary/40 transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="p-2 bg-rose-100 dark:bg-rose-950/40 rounded-lg shrink-0">
                                        <FileText size={18} className="text-rose-600 dark:text-rose-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-text-main text-[11px] truncate">
                                            {file.name || `Document ${idx + 1}`}
                                        </p>
                                        {file.size > 0 && (
                                            <p className="text-[10px] text-text-muted font-mono">
                                                {formatSize(file.size)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {file.data && (
                                    <a
                                        href={file.data}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={file.name || `document_${idx + 1}.pdf`}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-lg font-bold text-[11px] shrink-0 transition-colors"
                                    >
                                        <Download size={12} />
                                        View / Download
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Other files (generic) ── */}
            {others.length > 0 && (
                <div className="space-y-1.5 mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                        Other Files ({others.length})
                    </p>
                    {others.map((file, idx) => (
                        <div
                            key={idx}
                            className="flex items-center justify-between p-2.5 bg-app-bg/60 border border-border rounded-lg"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <Paperclip size={14} className="text-text-muted shrink-0" />
                                <span className="font-medium text-text-main text-[11px] truncate">
                                    {file.name || `File ${idx + 1}`}
                                </span>
                                {file.size > 0 && (
                                    <span className="text-[10px] text-text-muted font-mono">
                                        {formatSize(file.size)}
                                    </span>
                                )}
                            </div>
                            {file.data && (
                                <a
                                    href={file.data}
                                    download={file.name || `file_${idx + 1}`}
                                    className="text-primary hover:underline text-[11px] font-bold shrink-0 ml-2"
                                >
                                    Download
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Lightbox Overlay ── */}
            {lightbox && (
                <div
                    className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
                    onClick={() => setLightbox(null)}
                >
                    {/* Close button */}
                    <button
                        type="button"
                        onClick={() => setLightbox(null)}
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors cursor-pointer z-10"
                        title="Close"
                    >
                        <X size={20} />
                    </button>

                    {/* Download button */}
                    {lightbox.src && (
                        <a
                            href={lightbox.src}
                            download={lightbox.name || 'image'}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-4 right-16 p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors z-10"
                            title="Download"
                        >
                            <Download size={20} />
                        </a>
                    )}

                    {/* Image */}
                    <img
                        src={lightbox.src}
                        alt={lightbox.name}
                        className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />

                    {/* File name caption */}
                    {lightbox.name && (
                        <div className="absolute bottom-4 left-0 right-0 text-center">
                            <span className="text-white/80 text-xs font-medium bg-black/40 rounded-full px-4 py-1.5">
                                {lightbox.name}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

/**
 * Self-contained Attachment Viewer for Order Enquiries and general records.
 * Renders previews for Images (with lightbox), PDFs, and Excel/documents.
 */
function AttachmentsViewer({ files = [] }) {
    const [lightbox, setLightbox] = useState(null);

    if (!files || files.length === 0) return null;

    const formatSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getFileTypeInfo = (file) => {
        const name = typeof file === 'string' ? file : (file.name || file.filename || '');
        const mime = (typeof file === 'object' && file.mimeType) ? file.mimeType.toLowerCase() : '';
        const ext = name.split('.').pop().toLowerCase();

        if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
            return { type: 'image', label: 'Image', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800' };
        }
        if (mime === 'application/pdf' || ext === 'pdf') {
            return { type: 'pdf', label: 'PDF', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800' };
        }
        if (['xlsx', 'xls', 'csv'].includes(ext) || mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) {
            return { type: 'excel', label: 'Excel', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800' };
        }
        return { type: 'doc', label: ext ? ext.toUpperCase() : 'Doc', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800' };
    };

    return (
        <>
            <div className="grid grid-cols-1 gap-2.5">
                {files.map((file, idx) => {
                    const fileUrl = typeof file === 'string' ? file : (file.data || file.url || '');
                    const fileName = typeof file === 'string' ? `Attachment ${idx + 1}` : (file.name || file.filename || `View Document ${idx + 1}`);
                    const fileSize = typeof file === 'object' ? file.size : 0;
                    const typeInfo = getFileTypeInfo(file);
                    const isImage = typeInfo.type === 'image';
                    const isPdf = typeInfo.type === 'pdf';
                    const isExcel = typeInfo.type === 'excel';

                    return (
                        <div
                            key={idx}
                            className="flex items-center justify-between gap-3 p-3 bg-app-bg border border-border rounded-xl hover:border-primary/40 transition-colors"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                {isImage && fileUrl ? (
                                    <div
                                        onClick={() => setLightbox({ src: fileUrl, name: fileName })}
                                        className="shrink-0 cursor-pointer group relative rounded-lg overflow-hidden border border-border shadow-xs"
                                        title="Click to view full image"
                                    >
                                        <img
                                            src={fileUrl}
                                            alt={fileName}
                                            className="w-11 h-11 object-cover group-hover:scale-105 transition-transform"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                            <ZoomIn size={14} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 border ${
                                        isPdf ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800' :
                                        isExcel ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800' :
                                        'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800'
                                    }`}>
                                        {isPdf ? (
                                            <FileText size={20} />
                                        ) : isExcel ? (
                                            <FileSpreadsheet size={20} />
                                        ) : (
                                            <Paperclip size={20} />
                                        )}
                                    </div>
                                )}

                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <a
                                            href={fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            download={fileName}
                                            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 truncate"
                                            title={fileName}
                                        >
                                            <span>📎</span>
                                            <span className="truncate">{fileName}</span>
                                        </a>
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${typeInfo.badgeClass}`}>
                                            {typeInfo.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-text-muted mt-0.5">
                                        {fileSize > 0 && <span className="font-mono">{formatSize(fileSize)}</span>}
                                        {fileSize > 0 && <span>•</span>}
                                        <span>Attachment #{idx + 1}</span>
                                    </div>
                                </div>
                            </div>

                            {fileUrl && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <a
                                        href={fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={fileName}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                        title={`Download ${fileName}`}
                                    >
                                        <Download size={13} />
                                        <span className="hidden sm:inline">{isPdf ? 'Open / Download' : isImage ? 'View / Download' : 'Download'}</span>
                                    </a>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Lightbox Overlay */}
            {lightbox && (
                <div
                    className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
                    onClick={() => setLightbox(null)}
                >
                    <button
                        type="button"
                        onClick={() => setLightbox(null)}
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors cursor-pointer z-10"
                        title="Close"
                    >
                        <X size={20} />
                    </button>

                    {lightbox.src && (
                        <a
                            href={lightbox.src}
                            download={lightbox.name || 'image'}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-4 right-16 p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors cursor-pointer z-10 flex items-center gap-1.5 text-xs font-bold"
                            title="Download full image"
                        >
                            <Download size={16} />
                            <span>Download</span>
                        </a>
                    )}

                    <div
                        className="relative max-w-4xl max-h-[85vh] flex flex-col items-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={lightbox.src}
                            alt={lightbox.name}
                            className="max-w-full max-h-[78vh] object-contain rounded-xl shadow-2xl border border-white/10"
                        />
                        <p className="text-white/80 text-xs font-medium mt-3 text-center truncate max-w-md">
                            {lightbox.name}
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}

/**
 * Field schemas for all Master Data tabs
 */
const MASTER_SCHEMAS = {

    customers: [
        {
            title: 'Core Identification & Status',
            fields: [
                { label: 'Customer Code', key: (r) => r.code || r.customerCode, type: 'code' },
                { label: 'Company / Customer Name', key: (r) => r.companyName || r.name, span: 2 },
                { label: 'Customer Status', key: 'status', type: 'status' },
                { label: 'Record Active State', key: 'isActive', type: 'boolean' }
            ]
        },
        {
            title: 'Contact Information',
            fields: [
                { label: 'Contact Person', key: 'contactPerson' },
                { label: 'Phone Number', key: 'phone' },
                { label: 'Email Address', key: 'email', span: 2 }
            ]
        },
        {
            title: 'Address & Location',
            fields: [
                { label: 'Address', key: 'address', span: 2 },
                { label: 'City', key: 'city' },
                { label: 'State', key: 'state' },
                { label: 'Pincode / Postal Code', key: 'pincode' }
            ]
        },
        {
            title: 'Taxation & Credit Terms',
            fields: [
                { label: 'GSTIN Number', key: 'gstin', type: 'code' },
                { label: 'PAN Number', key: 'pan', type: 'code' },
                { label: 'Credit Limit', key: 'creditLimit', type: 'currency' },
                { label: 'Payment Terms', key: (r) => r.paymentTerms || (r.paymentTermsDays ? `${r.paymentTermsDays} Days` : '-') }
            ]
        },
        {
            title: 'System Audit',
            fields: [
                { label: 'Created On', key: 'createdAt', type: 'date' },
                { label: 'Last Updated', key: 'updatedAt', type: 'date' }
            ]
        }
    ],

    suppliers: [
        {
            title: 'Core Identification & Status',
            fields: [
                { label: 'Supplier Code', key: (r) => r.code || r.supplierCode, type: 'code' },
                { label: 'Supplier / Vendor Name', key: (r) => r.name || r.companyName, span: 2 },
                { label: 'Supplier Type / Category', key: 'supplierType' },
                { label: 'Record Active State', key: 'isActive', type: 'boolean' }
            ]
        },
        {
            title: 'Contact Information',
            fields: [
                { label: 'Contact Person', key: 'contactPerson' },
                { label: 'Phone Number', key: 'phone' },
                { label: 'Email Address', key: 'email', span: 2 }
            ]
        },
        {
            title: 'Address & Location',
            fields: [
                { label: 'Address', key: 'address', span: 2 },
                { label: 'City', key: 'city' },
                { label: 'State', key: 'state' },
                { label: 'Pincode / Postal Code', key: 'pincode' }
            ]
        },
        {
            title: 'Taxation & Payment Terms',
            fields: [
                { label: 'GSTIN Number', key: 'gstin', type: 'code' },
                { label: 'PAN Number', key: 'pan', type: 'code' },
                { label: 'Payment Terms', key: (r) => r.paymentTerms || (r.paymentTermsDays ? `${r.paymentTermsDays} Days` : '-') }
            ]
        },
        {
            title: 'System Audit',
            fields: [
                { label: 'Created On', key: 'createdAt', type: 'date' },
                { label: 'Last Updated', key: 'updatedAt', type: 'date' }
            ]
        }
    ],

    employees: [
        {
            title: 'Employment Profile & Status',
            fields: [
                { label: 'Employee Code', key: (r) => r.employeeCode || r.code, type: 'code' },
                { label: 'Full Name', key: 'name', span: 2 },
                { label: 'Employment Status', key: (r) => r.employmentStatus || (r.isActive !== false ? 'Active' : 'Inactive'), type: 'status' },
                { label: 'Record Active State', key: 'isActive', type: 'boolean' }
            ]
        },
        {
            title: 'Department, Role & Shift',
            fields: [
                { label: 'Department', key: 'department' },
                { label: 'Designation / Role', key: (r) => r.designation || r.role },
                {
                    label: 'Shift Assignment',
                    key: (r) => {
                        if (r.shiftAssignment && typeof r.shiftAssignment === 'object') {
                            const name = r.shiftAssignment.name || r.shiftAssignment.shiftCode;
                            const times = r.shiftAssignment.startTime && r.shiftAssignment.endTime ? ` (${r.shiftAssignment.startTime}–${r.shiftAssignment.endTime})` : '';
                            return `${name}${times}`;
                        }
                        return r.shiftAssignment || '-';
                    }
                },
                {
                    label: 'Assigned Facility / Location',
                    key: (r) => (typeof r.facility === 'object' ? `${r.facility?.name} (${r.facility?.code || ''})` : r.facility)
                }
            ]
        },
        {
            title: 'Compensation & Contact Details',
            fields: [
                { label: 'Monthly Salary', key: 'monthlySalary', type: 'currency' },
                { label: 'Phone Number', key: 'phone' },
                { label: 'Email Address', key: 'email', span: 2 },
                { label: 'Date of Joining', key: (r) => r.dateOfJoining || r.joiningDate, type: 'date' }
            ]
        },
        {
            title: 'System Audit',
            fields: [
                { label: 'Created On', key: 'createdAt', type: 'date' },
                { label: 'Last Updated', key: 'updatedAt', type: 'date' }
            ]
        }
    ],

    machines: [
        {
            title: 'Machine Identification & Operational State',
            fields: [
                { label: 'Machine Code', key: (r) => r.code || r.machineCode, type: 'code' },
                { label: 'Machine Name', key: 'name', span: 2 },
                { label: 'Plant Section', key: 'section' },
                { label: 'Plant Location', key: (r) => r.plantLocation || '-' },
                { label: 'Operational Status', key: 'status', type: 'status' },
                { label: 'Record Active State', key: 'isActive', type: 'boolean' }
            ]
        },
        {
            title: 'Capacity & Efficiency Metrics',
            fields: [
                { label: 'Capacity Per Hour', key: (r) => r.capacityPerHour ? `${r.capacityPerHour} Kg/hr` : (r.capacity || '-') },
                { label: 'Machine Efficiency', key: (r) => r.efficiency !== undefined && r.efficiency !== null ? `${r.efficiency}%` : '-' },
                { label: 'Current Operators', key: (r) => formatOperatorNames(r) },
                { label: 'Maintenance Notes', key: 'maintenanceNotes', span: 2 }
            ]
        },
        {
            title: 'System Audit',
            fields: [
                { label: 'Created On', key: 'createdAt', type: 'date' },
                { label: 'Last Updated', key: 'updatedAt', type: 'date' }
            ]
        }
    ],

    'raw-materials': [
        {
            title: 'Core Material Identification',
            fields: [
                { label: 'Item Code', key: (r) => r.code || r.itemCode, type: 'code' },
                { label: 'Raw Material Composed Title', key: 'name', span: 2 },
                { label: 'Category', key: (r) => typeof r.category === 'object' ? r.category?.name : (r.category || '-') },
                { label: 'Unit of Measure (UOM)', key: (r) => typeof r.uom === 'object' ? `${r.uom?.name} (${r.uom?.symbol || r.uom?.abbreviation || ''})` : (r.uom || 'kg') },
                { label: 'Default Location', key: (r) => { const loc = r.defaultLocation; if (!loc || typeof loc !== 'object' || !loc.name) return r.defaultLocation || '-'; return `${loc.name}${loc.code ? ` (${loc.code})` : ''}`; } },
                { label: 'Record Active State', key: 'isActive', type: 'boolean' }
            ]
        },
        {
            title: 'Material Classification & Quality Specs',
            fields: [
                { label: 'Material Description', key: 'materialDescription', span: 2 },
                { label: 'Material Quality-Fabric', key: 'materialQualityFabric' },
                { label: 'Material Quality-Bags', key: 'materialQualityBags' },
                { label: 'Lamination Type', key: 'laminationType' },
                { label: 'Fabric Grammage', key: (r) => r.fabricGrammage ? (r.fabricGrammage.includes('GSM') ? r.fabricGrammage : `${r.fabricGrammage} GSM`) : '-' },
                { label: 'Material Colour', key: (r) => r.materialColour || r.color || '-' },
                { label: 'Thread Colour', key: 'threadColour' },
                { label: 'Quality-Thread-Yarn', key: 'qualityThreadYarn' },
                { label: 'Fabric Size (Fabric Width)', key: 'fabricSize' },
                { label: 'Fabric Average', key: 'fabricAverage', span: 2 }
            ]
        },
        {
            title: 'Commercial, Stock & Tax Parameters',
            fields: [
                { label: 'Grade / Specification', key: 'materialGrade' },
                { label: 'HSN Code', key: 'hsnCode', type: 'code' },
                { label: 'Min Order Qty (MOQ)', key: (r) => r.moq !== undefined && r.moq !== null ? `${r.moq}` : '-' },
                { label: 'Standard Price / Unit', key: 'pricePerUnit', type: 'currency' },
                { label: 'Last Purchase Price', key: 'lastPurchasePrice', type: 'currency' },
                { label: 'Current Stock Level', key: (r) => r.currentStock !== undefined && r.currentStock !== null ? `${r.currentStock} ${typeof r.uom === 'object' ? (r.uom?.symbol || 'kg') : (r.uom || 'kg')}` : '0' },
                { label: 'Reorder Threshold Level', key: (r) => r.reorderLevel !== undefined && r.reorderLevel !== null ? `${r.reorderLevel}` : '0' }
            ]
        },
        {
            title: 'System Audit',
            fields: [
                { label: 'Created On', key: 'createdAt', type: 'date' },
                { label: 'Last Updated', key: 'updatedAt', type: 'date' }
            ]
        }
    ],

    'finished-goods': [
        {
            title: 'Product Identity & Status',
            fields: [
                { label: 'Product Code', key: (r) => r.code || r.itemCode, type: 'code' },
                { label: 'Product Specification / Title', key: 'name', span: 2 },
                { label: 'Bag Type / Category', key: (r) => typeof r.category === 'object' ? r.category?.name : (r.category || '-') },
                { label: 'Unit of Measure (UOM)', key: (r) => typeof r.uom === 'object' ? `${r.uom?.name} (${r.uom?.symbol || ''})` : (r.uom || 'Bags') },
                { label: 'Storage Bay / Location', key: (record) => record.storageBayLocation || record.warehouseLocation || '-' },
                { label: 'Record Active State', key: 'isActive', type: 'boolean' }
            ]
        },
        {
            title: 'Technical Bag Specifications',
            fields: [
                { label: 'Bag Shape', key: 'bagShape' },
                {
                    label: 'Dimensions (Width x Length)',
                    key: (r) => (r.dimensions?.width && r.dimensions?.length ? `${r.dimensions.width} x ${r.dimensions.length} ${r.dimensions?.unit || r.dimensionUnit || 'cm'}` : '-')
                },
                { label: 'Bag Capacity', key: (r) => r.bagCapacity || r.capacity ? `${r.bagCapacity || r.capacity} Kg` : '-' },
                { label: 'Fabric GSM', key: (r) => r.fabricGSM || r.gsm ? `${r.fabricGSM || r.gsm} GSM` : '-' },
                { label: 'Color & Print Specification', key: 'colorAndPrint', span: 2 },
                { label: 'Product Notes / Description', key: 'bagType', span: 2 }
            ]
        },
        {
            title: 'Pricing & Inventory Levels',
            fields: [
                { label: 'Retail Price / Bag', key: (r) => r.retailPrice || r.pricePerBag, type: 'currency' },
                { label: 'Wholesale Price / Bag', key: 'wholesalePrice', type: 'currency' },
                { label: 'Current Finished Stock', key: (r) => `${r.currentStock || 0} Bags` },
                { label: 'Reorder Threshold Level', key: (r) => `${r.reorderLevel || 0} Bags` }
            ]
        },
        {
            title: 'Bill of Materials (BOM / Material Requirements)',
            renderCustom: (r) => {
                const boms = r.materialRequirements || r.items || [];
                if (!Array.isArray(boms) || boms.length === 0) {
                    return (
                        <div className="text-xs text-text-muted italic py-2">
                            No bill of materials (BOM) ingredients linked to this product.
                        </div>
                    );
                }
                return (
                    <div className="overflow-x-auto border border-border rounded-lg shadow-2xs">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-table-header-bg text-table-header-text uppercase text-[10px] font-extrabold">
                                <tr>
                                    <th className="px-3 py-2 border-b border-border">#</th>
                                    <th className="px-3 py-2 border-b border-border">Raw Material Ingredient</th>
                                    <th className="px-3 py-2 border-b border-border text-right">Qty Per Unit Bag</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border bg-card-bg">
                                {boms.map((item, idx) => {
                                    const rmName = typeof item.rawMaterial === 'object'
                                        ? (item.rawMaterial?.name || item.rawMaterial?.code)
                                        : item.rawMaterial;
                                    const qty = item.quantityPerUnit || item.quantity || 0;
                                    return (
                                        <tr key={idx} className="hover:bg-app-bg/50">
                                            <td className="px-3 py-2 font-mono text-text-muted">{idx + 1}</td>
                                            <td className="px-3 py-2 font-medium text-text-main">{rmName || '-'}</td>
                                            <td className="px-3 py-2 font-mono font-bold text-text-main text-right">{qty}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                );
            }
        },
        {
            title: 'System Audit',
            fields: [
                { label: 'Created On', key: 'createdAt', type: 'date' },
                { label: 'Last Updated', key: 'updatedAt', type: 'date' }
            ]
        }
    ],
    'work-orders': [
        {
            title: 'Production Order Identification & Status',
            fields: [
                { label: 'Work Order #', key: 'workOrderNumber', type: 'code' },
                { label: 'Customer / Client', key: (r) => r.customer?.companyName || r.customer?.name || '-', span: 2 },
                { label: 'Work Title / Requirement', key: (r) => r.description || r.remarks || r.jobOrderDetails?.description || '-', span: 2 },
                { label: 'Production Status', key: 'status', type: 'status' },
                { label: 'Priority Level', key: 'priority', type: 'status' }
            ]
        },
        {
            title: 'Product & Plant Allocation',
            fields: [
                { label: 'Finished Bag Specification', key: (r) => r.finishedGood?.name || '-', span: 2 },
                { label: 'Target Bags', key: (r) => `${(r.targetQuantity || 0).toLocaleString('en-IN')} Bags` },
                { label: 'Completed Bags', key: (r) => `${(r.completedQuantity || 0).toLocaleString('en-IN')} Bags` },
                { label: 'Overall Progress', key: (r) => `${r.progressPercentage || 0}%` },
                { label: 'Assigned Machine', key: (r) => r.assignedMachine?.name || r.assignedMachine?.code || 'None' },
                { label: 'Machine Operators', key: (r) => formatOperatorNames(r.assignedMachine) }
            ]
        },
        {
            title: 'Job Order / Job Card Details',
            fields: [
                { label: 'Job Order Date', key: (r) => r.jobOrderDetails?.orderDate, type: 'date' },
                { label: 'Product Category', key: (r) => r.jobOrderDetails?.productCategory || '-' },
                {
                    label: 'Job Description (Print Colours)',
                    key: (r) => {
                        const spec = r.jobOrderDetails?.printSpec;
                        const sides = r.jobOrderDetails?.printSides || spec?.printSides;
                        const f = r.jobOrderDetails?.frontColours !== undefined ? r.jobOrderDetails.frontColours : spec?.frontColours;
                        const b = r.jobOrderDetails?.backColours !== undefined ? r.jobOrderDetails.backColours : spec?.backColours;
                        if (sides || f || b) {
                            return (sides === 'NONE' || (Number(f) === 0 && Number(b) === 0))
                                ? 'Plain / Unprinted'
                                : `Front: ${f || 0} Col, Back: ${b || 0} Col`;
                        }
                        return r.jobOrderDetails?.jobDescriptionPrintColours || '-';
                    }
                },
                {
                    label: 'Job Description 2 (Print Side)',
                    key: (r) => {
                        const sides = r.jobOrderDetails?.printSides || r.jobOrderDetails?.printSpec?.printSides;
                        if (sides) {
                            const sideMap = { FRONT_ONLY: 'Front Only', BACK_ONLY: 'Back Only', BOTH: 'Both Sides (Front & Back)', NONE: 'None (Plain)' };
                            return sideMap[sides] || sides;
                        }
                        return r.jobOrderDetails?.jobDescriptionPrintSide || '-';
                    }
                },
                { label: 'Material Quality — Fabric', key: (r) => r.jobOrderDetails?.materialQualityFabric || '-' },
                { label: 'Fabric Lamination Type', key: (r) => r.jobOrderDetails?.fabricLaminationType || '-' },
                { label: 'Material Colour (Base)', key: (r) => r.jobOrderDetails?.materialColour || '-' },
                { label: 'Printing Colour (Ink)', key: (r) => r.jobOrderDetails?.printingColour || '-' },
                { label: 'Fabric Grammage', key: (r) => r.jobOrderDetails?.fabricGrammage || '-' },
                { label: 'Bag Weight (Gms)', key: (r) => r.jobOrderDetails?.bagWeightGms ? `${r.jobOrderDetails.bagWeightGms} Gms` : '-' },
                { label: 'Fabric Average', key: (r) => r.jobOrderDetails?.fabricAverage || '-' },
                {
                    label: 'Fabric Size in Inch (W × L)',
                    key: (r) => (r.jobOrderDetails?.fabricSizeInInch?.width && r.jobOrderDetails?.fabricSizeInInch?.length)
                        ? `${r.jobOrderDetails.fabricSizeInInch.width} × ${r.jobOrderDetails.fabricSizeInInch.length} inch`
                        : '-'
                },
                { label: 'Contact Person Name', key: (r) => r.jobOrderDetails?.contactPersonName || '-' },
                { label: 'Customer Contact Number', key: (r) => r.jobOrderDetails?.customerContactNumber || '-' },
                { label: 'Contact Person Designation', key: (r) => r.jobOrderDetails?.contactPersonDesignation || '-' },
                {
                    label: 'Total Order Quantity (Job Card)',
                    key: (r) => r.jobOrderDetails?.totalOrderQuantity
                        ? `${r.jobOrderDetails.totalOrderQuantity} ${r.jobOrderDetails.totalOrderQuantityUnit || 'Pcs'}`
                        : '-'
                },
                {
                    label: 'Order Confirmed',
                    key: (r) => r.jobOrderDetails?.orderConfirmed ? 'Confirmed (Yes)' : 'Unconfirmed (No)'
                },
                {
                    label: 'Expected Date of Delivery',
                    key: (r) => r.jobOrderDetails?.expectedDeliveryDate,
                    type: 'date'
                }
            ]
        },
        {
            title: 'Packing Slip & Roll Specifications',
            renderCustom: (record) => {
                const rolls = record.jobOrderDetails?.rolls || [];
                if (!rolls.length) return null;
                return (
                    <div className="overflow-x-auto border border-border rounded-lg">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-app-bg text-text-muted uppercase text-[10px] tracking-wider border-b border-border">
                                <tr>
                                    <th className="px-3 py-2">#</th>
                                    <th className="px-3 py-2">Roll No.</th>
                                    <th className="px-3 py-2">Fabric Length (M)</th>
                                    <th className="px-3 py-2">Width (In)</th>
                                    <th className="px-3 py-2">G.W. (Kg)</th>
                                    <th className="px-3 py-2">N.W. (Kg)</th>
                                    <th className="px-3 py-2">Total Qty (Kg)</th>
                                    <th className="px-3 py-2">Total Qty (Pcs)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border font-mono">
                                {rolls.map((roll, idx) => (
                                    <tr key={idx} className="hover:bg-app-bg/50">
                                        <td className="px-3 py-2 text-text-muted">{idx + 1}</td>
                                        <td className="px-3 py-2 font-bold text-text-main">{roll.rollNumber || '-'}</td>
                                        <td className="px-3 py-2">{roll.fabricLength != null ? `${roll.fabricLength} m` : '-'}</td>
                                        <td className="px-3 py-2">{roll.width != null ? `${roll.width}"` : '-'}</td>
                                        <td className="px-3 py-2">{roll.grossWeight != null ? `${roll.grossWeight} kg` : '-'}</td>
                                        <td className="px-3 py-2">{roll.netWeight != null ? `${roll.netWeight} kg` : '-'}</td>
                                        <td className="px-3 py-2">{roll.totalQuantityKg != null ? `${roll.totalQuantityKg} kg` : '-'}</td>
                                        <td className="px-3 py-2">{roll.totalQuantityPcs != null ? `${roll.totalQuantityPcs} pcs` : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }
        },
        {
            title: 'Purchase Order Attachments (Client PO)',
            renderCustom: (record) => {
                const files = record.jobOrderDetails?.purchaseOrderFiles || [];

                // Empty state
                if (!files.length) {
                    return (
                        <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                            <Paperclip size={22} className="text-text-muted/50" />
                            <p className="text-xs text-text-muted italic">
                                No PO attachments uploaded for this work order.
                            </p>
                        </div>
                    );
                }

                // Separate images and PDFs
                const images = files.filter((f) => f.fileType?.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(f.name || ''));
                const pdfs   = files.filter((f) => f.fileType === 'application/pdf' || /\.pdf$/i.test(f.name || ''));
                const others = files.filter((f) => !images.includes(f) && !pdfs.includes(f));

                // Lightbox component (rendered inline, controlled by parent state via closure)
                // We use a module-level helper to avoid hooks-in-callbacks restriction
                return <PoAttachmentViewer images={images} pdfs={pdfs} others={others} />;
            }
        },
        {
            title: 'System Audit',
            fields: [
                { label: 'Created On', key: 'createdAt', type: 'date' },
                { label: 'Last Updated', key: 'updatedAt', type: 'date' }
            ]
        }
    ],

    complaints: [
        {
            title: 'Complaint Ticket & Status',
            fields: [
                { label: 'Ticket Number', key: (r) => r.ticketNumber || r.code || '-', type: 'code' },
                { label: 'Customer', key: (r) => typeof r.customer === 'object' ? (r.customer?.companyName || r.customer?.name) : (r.customer || '-') },
                { label: 'Complaint Type', key: (r) => (r.complaintType || 'Quality Defect').replace(/_/g, ' ') },
                { label: 'Status', key: 'status', type: 'status' },
                { label: 'Date', key: (r) => r.date ? new Date(r.date).toLocaleDateString('en-GB') : '-' },
                { label: 'Assigned Executive', key: (r) => typeof r.assignedExecutive === 'object' ? (r.assignedExecutive?.name || r.assignedExecutive?.email) : (r.assignedExecutive || '-') }
            ]
        },
        {
            title: 'Defect Details & Resolution',
            fields: [
                { label: 'Description', key: 'description', span: 2 },
                { label: 'Resolution Notes', key: (r) => r.resolutionNotes || 'Pending investigation / resolution', span: 2 }
            ]
        },
        {
            title: 'System Audit',
            fields: [
                { label: 'Created On', key: 'createdAt', type: 'date' },
                { label: 'Last Updated', key: 'updatedAt', type: 'date' }
            ]
        }
    ],

    complaint: [
        {
            title: 'Complaint Ticket & Status',
            fields: [
                { label: 'Ticket Number', key: (r) => r.ticketNumber || r.code || '-', type: 'code' },
                { label: 'Customer', key: (r) => typeof r.customer === 'object' ? (r.customer?.companyName || r.customer?.name) : (r.customer || '-') },
                { label: 'Complaint Type', key: (r) => (r.complaintType || 'Quality Defect').replace(/_/g, ' ') },
                { label: 'Status', key: 'status', type: 'status' },
                { label: 'Date', key: (r) => r.date ? new Date(r.date).toLocaleDateString('en-GB') : '-' },
                { label: 'Assigned Executive', key: (r) => typeof r.assignedExecutive === 'object' ? (r.assignedExecutive?.name || r.assignedExecutive?.email) : (r.assignedExecutive || '-') }
            ]
        },
        {
            title: 'Defect Details & Resolution',
            fields: [
                { label: 'Description', key: 'description', span: 2 },
                { label: 'Resolution Notes', key: (r) => r.resolutionNotes || 'Pending investigation / resolution', span: 2 }
            ]
        },
        {
            title: 'System Audit',
            fields: [
                { label: 'Created On', key: 'createdAt', type: 'date' },
                { label: 'Last Updated', key: 'updatedAt', type: 'date' }
            ]
        }
    ],

    enquiries: [
        {
            title: 'Customer & Enquiry Info',
            fields: [
                { label: 'Customer', key: (r) => typeof r.customer === 'object' ? (r.customer?.companyName || r.customer?.name || '-') : (r.customer || '-'), span: 2 },
                { label: 'Requirement / Description', key: (r) => r.description || r.remarks || '-', span: 2 },
                { label: 'Enquiry Date', key: 'enquiryDate', type: 'date' },
                { label: 'Contact Person', key: 'contactPerson' },
                { label: 'Contact Number', key: 'contactNumber' },
                { label: 'Designation', key: 'contactDesignation' }
            ]
        },
        {
            title: 'Product Specification',
            fields: [
                { label: 'Product Category', key: 'productCategory', type: 'status' },
                {
                    label: 'Print Colours (Front / Back)',
                    key: (r) => {
                        const sides = r.printSides || r.printSpec?.printSides;
                        const f = r.frontColours !== undefined ? r.frontColours : r.printSpec?.frontColours;
                        const b = r.backColours !== undefined ? r.backColours : r.printSpec?.backColours;
                        if (sides || f || b) {
                            return (sides === 'NONE' || (Number(f) === 0 && Number(b) === 0))
                                ? 'Plain / Unprinted'
                                : `Front: ${f || 0} Col, Back: ${b || 0} Col`;
                        }
                        return r.jobDescriptionPrintColours || '-';
                    }
                },
                {
                    label: 'Print Side',
                    key: (r) => {
                        const sides = r.printSides || r.printSpec?.printSides;
                        if (sides) {
                            const sideMap = { FRONT_ONLY: 'Front Only', BACK_ONLY: 'Back Only', BOTH: 'Both Sides (Front & Back)', NONE: 'None (Plain)' };
                            return sideMap[sides] || sides;
                        }
                        return r.jobDescriptionPrintSide === 'Other' ? (r.jobDescriptionPrintSideOther || 'Other') : (r.jobDescriptionPrintSide || '-');
                    }
                }
            ]
        },
        {
            title: 'Material Masters',
            fields: [
                { label: 'Material Quality — Fabric', key: (r) => r.materialQualityFabric || '-' },
                { label: 'Fabric Lamination Type', key: (r) => r.fabricLaminationType || '-' },
                { label: 'Material Colour', key: (r) => r.materialColour || '-' },
                { label: 'Printing Colour', key: (r) => r.printingColour || '-' },
                { label: 'Fabric Grammage', key: (r) => r.fabricGrammage || '-' }
            ]
        },
        {
            title: 'Physical Specifications',
            fields: [
                { label: 'Bag Weight (Gms)', key: (r) => r.bagWeightGms != null ? `${r.bagWeightGms} Gms` : '-' },
                { label: 'Fabric Average', key: (r) => r.fabricAverage || '-' },
                { label: 'Fabric Width (Inch)', key: (r) => r.fabricWidthInch != null ? `${r.fabricWidthInch}"` : '-' },
                { label: 'Fabric Length (Inch)', key: (r) => r.fabricLengthInch != null ? `${r.fabricLengthInch}"` : '-' }
            ]
        },
        {
            title: 'Order Quantity & Confirmation',
            fields: [
                { label: 'Total Order Quantity', key: (r) => r.totalOrderQuantity != null ? r.totalOrderQuantity.toLocaleString('en-IN') : '-' },
                { label: 'Order Confirmed', key: (r) => r.orderConfirmed ? 'Yes — Confirmed' : 'No — Pending', type: 'status' },
                { label: 'Expected Delivery Date', key: (r) => r.orderConfirmed && r.expectedDeliveryDate ? r.expectedDeliveryDate : null, type: 'date' }
            ]
        },
        {
            title: 'Attachments & Uploads',
            renderCustom: (record) => {
                const files = record.poAttachments || record.attachments || [];
                if (!files || files.length === 0) return null;
                return <AttachmentsViewer files={files} />;
            }
        },
        {
            title: 'System Audit',
            fields: [
                { label: 'Created On', key: 'createdAt', type: 'date' },
                { label: 'Last Updated', key: 'updatedAt', type: 'date' }
            ]
        }
    ],

    'purchase-orders': [
        {
            title: 'Purchase Order Information',
            fields: [
                { label: 'PO Number', key: 'poNumber', type: 'code' },
                { label: 'Supplier / Vendor', key: (r) => typeof r.supplier === 'object' ? (r.supplier?.companyName || r.supplier?.name || '-') : (r.supplier || '-'), span: 2 },
                { label: 'PO Date', key: (r) => r.poDate || r.createdAt, type: 'date' },
                { label: 'Expected Delivery Date', key: 'expectedDelivery', type: 'date' },
                { label: 'Status', key: 'status', type: 'status' }
            ]
        },
        {
            title: 'Financial Summary',
            fields: [
                { label: 'Total Value', key: 'totalValue', type: 'currency' },
                { label: 'Tax Amount', key: 'taxAmount', type: 'currency' },
                { label: 'Grand Total', key: (r) => r.grandTotal != null ? r.grandTotal : r.totalValue, type: 'currency' },
                { label: 'Payment Terms', key: (r) => r.paymentTerms || '-' }
            ]
        },
        {
            title: 'Line Items & Materials',
            renderCustom: (record) => {
                const items = record.items || [];
                if (!items.length) return <p className="text-xs text-text-muted">No line items recorded.</p>;
                return (
                    <div className="overflow-x-auto border border-border rounded-lg">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-app-bg text-text-muted uppercase text-[10px] tracking-wider border-b border-border">
                                <tr>
                                    <th className="px-3 py-2">#</th>
                                    <th className="px-3 py-2">Material / Item</th>
                                    <th className="px-3 py-2">Ordered Qty</th>
                                    <th className="px-3 py-2">Received Qty</th>
                                    <th className="px-3 py-2">Rate (₹)</th>
                                    <th className="px-3 py-2">Amount (₹)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border font-mono">
                                {items.map((item, idx) => {
                                    const orderedDisplay = item.orderedQuantity != null
                                        ? `${item.orderedQuantity} ${item.unit || ''}`.trim()
                                        : (item.quantity != null ? `${item.quantity} ${item.uom || ''}`.trim() : '-');
                                    const recvDisplay = item.receivedQuantity != null
                                        ? `${item.receivedQuantity} ${item.unit || item.uom || ''}`.trim()
                                        : '0';
                                    const rateDisplay = item.ratePerUnit != null ? item.ratePerUnit : (item.unitPrice != null ? item.unitPrice : (item.rate || 0));
                                    const amountDisplay = ((item.orderedQuantity != null && item.ratePerUnit != null) ? (item.orderedQuantity * item.ratePerUnit) : (item.totalAmount || 0));

                                    return (
                                        <tr key={idx} className="hover:bg-app-bg/50">
                                            <td className="px-3 py-2 text-text-muted">{idx + 1}</td>
                                            <td className="px-3 py-2 font-bold text-text-main font-sans">
                                                {typeof item.rawMaterial === 'object' ? (item.rawMaterial?.name || item.rawMaterial?.code) : (item.materialName || item.rawMaterial || '-')}
                                            </td>
                                            <td className="px-3 py-2">{orderedDisplay}</td>
                                            <td className="px-3 py-2 text-emerald-700 font-bold">{recvDisplay}</td>
                                            <td className="px-3 py-2">₹{rateDisplay}</td>
                                            <td className="px-3 py-2 font-bold">₹{amountDisplay.toLocaleString('en-IN')}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                );
            }
        },
        {
            title: 'Attachments & Uploads',
            renderCustom: (record) => {
                const files = record.poAttachments || record.attachments || [];
                if (!files || files.length === 0) return null;
                return <AttachmentsViewer files={files} />;
            }
        },
        {
            title: 'System Audit',
            fields: [
                { label: 'Created On', key: 'createdAt', type: 'date' },
                { label: 'Last Updated', key: 'updatedAt', type: 'date' }
            ]
        }
    ]
};

export default function DetailViewModal({
    isOpen = false,
    onClose = () => {},
    record = null,
    tabKey = '',
    tabLabel = 'Record',
    onEdit = null,
    resourceType = '',
    type = '',
    endpoint = ''
}) {
    if (!isOpen || !record) return null;

    const normalizedKey = (tabKey || '').toLowerCase().replace(/_/g, '-');
    const baseSections = MASTER_SCHEMAS[normalizedKey];
    let sections;
    if (baseSections) {
        sections = baseSections;
    } else {
        const fallbackFields = Object.keys(record)
            .filter((k) => !['_id', 'tenant', 'tenantId', '__v', 'assignedBy', 'createdBy', 'updatedBy', 'poAttachments', 'attachments'].includes(k))
            .filter((k) => {
                const val = record[k];
                if (typeof val !== 'object' || val === null) return true;
                // Allow populated refs that have a human-readable name/code
                if (val.name || val.companyName || val.code || val.title) return true;
                // Block raw ObjectId references and empty objects
                return false;
            })
            .slice(0, 14)
            .map((k) => {
                const isDateField = k.toLowerCase().includes('date') || k.toLowerCase().endsWith('at');
                return {
                    label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
                    key: k,
                    type: k.toLowerCase().includes('status') ? 'status'
                        : (k === 'isActive' ? 'boolean'
                        : (isDateField ? 'date'
                        : 'text'))
                };
            });

        sections = [{ title: 'Record Attributes', fields: fallbackFields }];
        const files = record.poAttachments || record.attachments;
        if (Array.isArray(files) && files.length > 0) {
            sections.push({
                title: 'Attachments & Uploads',
                renderCustom: () => <AttachmentsViewer files={files} />
            });
        }
    }

    const titleText = record.workOrderNumber || record.name || record.companyName || record.code || `${tabLabel} Details`;
    const codeBadge = record.code || record.workOrderNumber || record.itemCode || record.customerCode || record.supplierCode || record.employeeCode || record.machineCode;

    const activeContext = (resourceType || type || endpoint || tabKey || '').toLowerCase().replace(/[-_/]/g, '');
    const isWorkOrder =
        resourceType === 'workOrders' ||
        resourceType === 'work-orders' ||
        type === 'workOrders' ||
        type === 'work-orders' ||
        activeContext === 'workorders' ||
        activeContext === 'workorder' ||
        normalizedKey === 'work-orders' ||
        Boolean(tabLabel && tabLabel.toLowerCase().includes('work order'));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            {/* Click-outside backdrop */}
            <div className="fixed inset-0" onClick={onClose} />

            {/* Modal Dialog Card */}
            <div className="relative z-10 w-full max-w-3xl max-h-[90vh] bg-card-bg border border-border rounded-2xl shadow-2xl flex flex-col font-sans overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Modal Header */}
                <div className="px-6 py-4 bg-sidebar-bg text-sidebar-text-active border-b border-sidebar-hover flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-primary/20 text-primary-light rounded-xl shrink-0">
                            <Eye size={20} className="text-white" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-extrabold text-sidebar-text-active truncate">
                                    {titleText}
                                </h3>
                                {codeBadge && (
                                    <span className="font-mono text-[11px] font-bold bg-white/15 text-white px-2 py-0.5 rounded tracking-wider">
                                        {codeBadge}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-sidebar-text mt-0.5">
                                Complete Read-Only Master Record • {tabLabel}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-sidebar-text hover:text-white rounded-lg hover:bg-sidebar-hover transition-colors cursor-pointer"
                        title="Close Dialog"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Modal Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-card-bg">
                    {isWorkOrder && (
                        <div className="col-span-full mb-4">
                            <span className="text-xs font-bold text-gray-500 block">WORK TITLE / REQUIREMENT</span>
                            <p className="text-sm font-medium mt-1">
                                {record.description || record.remarks || record.jobOrderDetails?.description || '-'}
                            </p>
                        </div>
                    )}

                    {sections.map((section, sIdx) => {
                        const customContent = section.renderCustom ? section.renderCustom(record) : null;
                        if (section.renderCustom && !customContent) return null;

                        return (
                            <div key={sIdx} className="space-y-3">
                                <div className="border-b border-border/80 pb-1.5 flex items-center justify-between">
                                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                        <Tag size={13} />
                                        <span>{section.title}</span>
                                    </h4>
                                    <span className="text-[10px] text-text-muted font-medium">Read-Only</span>
                                </div>

                                {/* renderCustom: used for rich custom sections (attachment grids, tables, etc.) */}
                                {section.renderCustom ? (
                                    customContent
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                                        {section.fields?.map((f, fIdx) => {
                                            const key = typeof f.key === 'string' ? f.key : (f.label || '');
                                            if (['_id', 'tenant', 'tenantId', '__v'].includes(key)) return null;
                                            if (['_id', 'tenant', 'tenantId', '__v'].includes(String(f.label).toLowerCase().replace(/[^a-z0-9_]/g, ''))) return null;

                                            let rawVal = resolveVal(record, f.key);
                                            if (key === 'date' || String(f.label).toUpperCase() === 'DATE') {
                                                const d = rawVal || record.date;
                                                if (d) {
                                                    try {
                                                        rawVal = new Date(d).toLocaleDateString('en-GB');
                                                    } catch {
                                                        rawVal = String(d);
                                                    }
                                                }
                                            }
                                            const displayVal = formatValue(rawVal, f.type, f.fallback);
                                            const isFullWidth = f.span === 2;

                                            return (
                                                <div
                                                    key={fIdx}
                                                    className={`p-2.5 rounded-lg border border-border/60 bg-app-bg/40 ${isFullWidth ? 'sm:col-span-2' : ''}`}
                                                >
                                                    <span className="block text-[10.5px] font-bold uppercase tracking-wide text-text-muted mb-1">
                                                        {f.label}
                                                    </span>
                                                    <div className="text-xs font-semibold text-text-main break-words">
                                                        {displayVal}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-3.5 bg-app-bg/60 border-t border-border flex items-center justify-between shrink-0">
                    <div className="text-[11px] text-text-muted">
                        PolySack ERP Industrial Master Registry
                    </div>

                    <div className="flex items-center gap-2.5">
                        {onEdit && (
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    onEdit(record);
                                }}
                                className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-lg text-xs transition-colors cursor-pointer"
                            >
                                <Edit3 size={14} />
                                <span>Edit Record</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-card-bg border border-border hover:bg-app-bg text-text-main font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
