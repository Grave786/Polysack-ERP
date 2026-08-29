import { X, ShieldCheck, ShieldAlert, Award, FileText, CheckCircle2, XCircle, AlertCircle, Calendar, User, Package, Layers } from 'lucide-react';

export default function ViewQCInspectionModal({ isOpen, inspection, onClose }) {
    if (!isOpen || !inspection) return null;

    const isInbound = (inspection.inspectionType || 'INBOUND').toUpperCase() === 'INBOUND';
    const status = (inspection.qcStatus || 'PASSED').toUpperCase();
    const isPassed = status === 'PASSED';
    const isFailed = status === 'FAILED' || status === 'REJECTED';
    const isPartial = status === 'PARTIAL';

    const passedQty = inspection.passedQty !== undefined ? inspection.passedQty : 0;
    const rejectedQty = inspection.rejectedQty !== undefined ? inspection.rejectedQty : 0;
    const totalTested = passedQty + rejectedQty;
    const passPercentage = totalTested > 0 ? Math.round((passedQty / totalTested) * 100) : (isPassed ? 100 : 0);

    const rmObj = typeof inspection.rawMaterial === 'object' ? inspection.rawMaterial : null;
    const fgObj = typeof inspection.finishedGood === 'object' ? inspection.finishedGood : null;
    const grnObj = typeof inspection.grn === 'object' ? inspection.grn : null;
    const woObj = typeof inspection.workOrder === 'object' ? inspection.workOrder : null;
    const suppObj = typeof inspection.supplier === 'object' ? inspection.supplier : null;
    const inspector = typeof inspection.inspectedBy === 'object' ? inspection.inspectedBy : null;

    const defects = inspection.defects || {};

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="fixed inset-0" onClick={onClose} />
            <div className="relative z-10 bg-card-bg border border-border rounded-xl shadow-2xl w-full max-w-2xl p-6 space-y-4 font-sans text-xs max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
                {/* Header with QC Certificate Badge */}
                <div className="flex justify-between items-start pb-3 border-b border-border">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-base text-primary">
                                {inspection.qcCertificateNumber || 'QC-CERTIFICATE'}
                            </span>
                            <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                                    isPassed
                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                        : isFailed
                                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                                        : 'bg-amber-100 text-amber-800 border-amber-300'
                                }`}
                            >
                                • {status}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                isInbound
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : 'bg-purple-100 text-purple-800 border border-purple-200'
                            }`}>
                                {isInbound ? 'Inbound QC (GRN / Raw Material)' : 'Outbound QC (Finished Bags / Production)'}
                            </span>
                        </div>
                        <p className="text-[11px] text-text-muted">
                            Immutable Quality Control Audit Record & Lab Test Certificate
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-text-muted hover:text-text-main text-sm font-bold p-1 rounded-md transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Target Information Card */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-app-bg border border-border rounded-xl p-3.5">
                    <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                            {isInbound ? 'Raw Material Tested' : 'Finished Goods Specification'}
                        </span>
                        <div className="font-bold text-text-main text-sm">
                            {isInbound ? (rmObj?.name || 'Raw Material Item') : (fgObj?.name || 'Finished Goods Spec')}
                        </div>
                        <div className="text-[11px] font-mono text-text-muted">
                            Code: {isInbound ? (rmObj?.code || '-') : (fgObj?.code || '-')}
                        </div>
                        {isInbound && suppObj && (
                            <div className="text-[11px] text-text-muted">
                                Supplier: <strong className="text-text-main">{suppObj.name || suppObj.companyName}</strong>
                            </div>
                        )}
                    </div>

                    <div className="space-y-1 sm:text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                            {isInbound ? 'GRN / Procurement Reference' : 'Factory Work Order Reference'}
                        </span>
                        <div className="font-mono font-extrabold text-primary">
                            {isInbound
                                ? (grnObj?.grnNumber || (inspection.po ? `PO-${inspection.po}` : 'Direct Receipt'))
                                : (woObj?.workOrderNumber || inspection.workOrderNumber || '-')}
                        </div>
                        <div className="text-[11px] text-text-muted">
                            Inspection Date: {inspection.createdAt ? new Date(inspection.createdAt).toLocaleString() : '-'}
                        </div>
                        {inspector && (
                            <div className="text-[11px] text-text-muted">
                                Inspected By: <strong className="text-text-main">{inspector.name || inspector.email}</strong>
                            </div>
                        )}
                    </div>
                </div>

                {/* Inspection Quantities & Metrics Summary */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-app-bg border border-border rounded-xl p-3 text-center space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Total Inspected</span>
                        <span className="font-mono font-extrabold text-base text-text-main">
                            {totalTested.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-text-muted block">
                            {isInbound ? (rmObj?.uom?.name || 'Units/Kg') : 'Bags'}
                        </span>
                    </div>

                    <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-center space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block flex items-center justify-center gap-1">
                            <CheckCircle2 size={12} />
                            Passed Quantity
                        </span>
                        <span className="font-mono font-extrabold text-base text-emerald-700 dark:text-emerald-400">
                            {passedQty.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block">
                            {passPercentage}% Yield
                        </span>
                    </div>

                    <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-xl p-3 text-center space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 block flex items-center justify-center gap-1">
                            <XCircle size={12} />
                            Rejected Quantity
                        </span>
                        <span className="font-mono font-extrabold text-base text-rose-700 dark:text-rose-400">
                            {rejectedQty.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 block">
                            {100 - passPercentage}% Loss
                        </span>
                    </div>
                </div>

                {/* Technical Parameters Tested */}
                <div className="bg-card-bg border border-border rounded-xl p-3.5 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                        Lab Test Parameters & Specifications
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                        {inspection.gsmTested !== undefined && inspection.gsmTested !== null && (
                            <div>
                                <span className="text-[10px] text-text-muted block">GSM Tested</span>
                                <span className="font-mono font-bold text-text-main text-xs">
                                    {inspection.gsmTested} GSM
                                </span>
                            </div>
                        )}
                        {inspection.tensileStrength !== undefined && inspection.tensileStrength !== null && (
                            <div>
                                <span className="text-[10px] text-text-muted block">Tensile Strength</span>
                                <span className="font-mono font-bold text-text-main text-xs">
                                    {inspection.tensileStrength} N
                                </span>
                            </div>
                        )}
                        {inspection.sampleSize !== undefined && inspection.sampleSize !== null && (
                            <div>
                                <span className="text-[10px] text-text-muted block">Sample Batch Size</span>
                                <span className="font-mono font-bold text-text-main text-xs">
                                    {inspection.sampleSize}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Defect Audit Log & Inspector Remarks */}
                {(defects.visualDefects || defects.remarks || inspection.notes || defects.moistureLevel || defects.sealIntegrity) && (
                    <div className="bg-app-bg border border-border rounded-xl p-3.5 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                            Defect Observations & QA Remarks
                        </span>
                        <p className="text-text-main text-xs leading-relaxed whitespace-pre-wrap">
                            {defects.remarks || inspection.notes || defects.visualDefects || 'No adverse defects recorded.'}
                        </p>
                    </div>
                )}

                {/* Immutable Record Notice & Close */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5 text-text-muted text-[11px]">
                        <ShieldCheck size={14} className="text-primary" />
                        <span>Immutable Quality Audit Ledger Record (Read-Only)</span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-card-bg hover:bg-app-bg border border-border text-text-main font-bold rounded-lg text-xs transition-colors cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
