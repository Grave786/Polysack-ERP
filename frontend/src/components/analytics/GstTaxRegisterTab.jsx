import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { FileText, Receipt, CheckCircle, Percent, RefreshCw, X, Download, Printer } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { generatePdfReport } from '../../utils/pdfExportUtils';

const escapeCsvCell = (val) => {
    if (val === undefined || val === null) return '""';
    const s = String(val);
    return `"${s.replace(/"/g, '""')}"`;
};

const getTodayDdMmYyyy = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
};

const GstTaxRegisterTab = forwardRef(function GstTaxRegisterTab(props, ref) {
    // Current IST Indian Financial Year (April 1 - March 31)
    const getIstCurrentFy = () => {
        const now = new Date();
        const istTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (5.5 * 3600000));
        const year = istTime.getFullYear();
        const month = istTime.getMonth() + 1; // 1 to 12
        return month >= 4 ? year : year - 1;
    };

    const getIstTodayString = () => {
        const now = new Date();
        const istTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (5.5 * 3600000));
        const y = istTime.getFullYear();
        const m = String(istTime.getMonth() + 1).padStart(2, '0');
        const d = String(istTime.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const formatDateDisplay = (dateVal) => {
        if (!dateVal) return '-';
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal);
        const istTime = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + (5.5 * 3600000));
        const day = String(istTime.getDate()).padStart(2, '0');
        const month = String(istTime.getMonth() + 1).padStart(2, '0');
        const year = istTime.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const currentFy = getIstCurrentFy();
    const [selectedFy, setSelectedFy] = useState(currentFy);
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Modal state for GSTR-1 and GSTR-3B filing
    const [activeFilingModal, setActiveFilingModal] = useState(null);
    const [filingFormData, setFilingFormData] = useState({
        filedDate: getIstTodayString(),
        arnNumber: '',
        taxPaid: 0
    });
    const [isSubmittingFiling, setIsSubmittingFiling] = useState(false);

    // Generate last 5 Financial Years
    const fyOptions = Array.from({ length: 5 }, (_, i) => {
        const y = currentFy - i;
        return {
            value: y,
            label: `FY ${y}-${String(y + 1).slice(-2)}`
        };
    });

    const selectedFyOption = fyOptions.find((opt) => opt.value === selectedFy);
    const selectedFyLabel = selectedFyOption ? selectedFyOption.label : `FY ${selectedFy}-${String(selectedFy + 1).slice(-2)}`;

    // Indian format for KPI Cards: Cr, L, or en-IN
    const formatCardCurrency = (val) => {
        const num = Number(val) || 0;
        if (num === 0) return '₹0';
        const abs = Math.abs(num);
        const sign = num < 0 ? '-' : '';

        if (abs >= 10000000) {
            const cr = abs / 10000000;
            return `${sign}₹${cr.toFixed(2)} Cr`;
        }
        if (abs >= 100000) {
            const l = abs / 100000;
            return `${sign}₹${l.toFixed(2)} L`;
        }
        return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    };

    // Indian format for Table Rows: full en-IN grouping with rupee symbol, zero as ₹0
    const formatTableCurrency = (val) => {
        const num = Number(val) || 0;
        if (num === 0) return '₹0';
        return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    };

    const fetchGstRegister = async () => {
        try {
            setIsLoading(true);
            const res = await axiosInstance.get('/analytics/gst-register', {
                params: { fy: selectedFy }
            });
            if (res.data?.success) {
                setData(res.data.data);
            }
        } catch (error) {
            console.error('Error fetching GST tax register:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchGstRegister();
    }, [selectedFy]);

    const summary = data?.summary || {
        totalTaxableTurnover: 0,
        totalGstCollected: 0,
        inputTaxCredit: 0,
        netTaxPayable: 0,
        itcCarryForward: 0
    };

    const months = data?.months || [];
    const companyGstin = data?.companyGstin || '';
    const isRegisterEmpty = months.length === 0 || (
        summary.totalTaxableTurnover === 0 &&
        summary.inputTaxCredit === 0 &&
        months.every((m) => m.taxableSales === 0 && m.itc === 0)
    );

    const exportCsv = () => {
        const todayStr = getTodayDdMmYyyy();
        const filename = `executive-audit-report-gst-tax-register-${todayStr}.csv`;

        const csvLines = [
            [escapeCsvCell('EXECUTIVE AUDIT REPORT - SALES & GST TAX REGISTER')],
            [escapeCsvCell('Generated Date'), escapeCsvCell(todayStr)],
            [escapeCsvCell('Financial Year'), escapeCsvCell(selectedFyLabel)],
            [escapeCsvCell('Company GSTIN'), escapeCsvCell(companyGstin || 'Not Configured')],
            [],
            [escapeCsvCell('--- SUMMARY KPI CARDS ---')],
            [escapeCsvCell('Metric'), escapeCsvCell('Amount (INR)'), escapeCsvCell('Notes')],
            [escapeCsvCell('Total Taxable Turnover'), escapeCsvCell(`₹${Number(summary.totalTaxableTurnover || 0).toLocaleString('en-IN')}`), escapeCsvCell('Output Sales Turnover')],
            [escapeCsvCell('Total GST Collected'), escapeCsvCell(`₹${Number(summary.totalGstCollected || 0).toLocaleString('en-IN')}`), escapeCsvCell('CGST + SGST + IGST Output')],
            [escapeCsvCell('Input Tax Credit (ITC)'), escapeCsvCell(`₹${Number(summary.inputTaxCredit || 0).toLocaleString('en-IN')}`), escapeCsvCell('Purchases & Expenses ITC')],
            [escapeCsvCell('Net GST Payable / (Credit)'), escapeCsvCell(`₹${Number(summary.netTaxPayable || 0).toLocaleString('en-IN')}`), escapeCsvCell(summary.netTaxPayable > 0 ? 'Net Tax Payable' : 'Excess ITC Available')],
            [],
            [escapeCsvCell('--- MONTHLY GST TAX BREAKDOWN & FILING STATUS ---')],
            [
                escapeCsvCell('Return Period'),
                escapeCsvCell('Taxable Sales (INR)'),
                escapeCsvCell('CGST (INR)'),
                escapeCsvCell('SGST (INR)'),
                escapeCsvCell('IGST (INR)'),
                escapeCsvCell('Total GST Liability (INR)'),
                escapeCsvCell('Input Tax Credit (INR)'),
                escapeCsvCell('Net Tax Payable (INR)'),
                escapeCsvCell('GSTR-1 Status'),
                escapeCsvCell('GSTR-3B Status')
            ]
        ];

        if (months.length === 0) {
            csvLines.push([escapeCsvCell('No GST register records found for selected financial year')]);
        } else {
            months.forEach((m) => {
                csvLines.push([
                    escapeCsvCell(m.returnPeriod || m.monthName || '-'),
                    escapeCsvCell(`₹${Number(m.taxableSales || 0).toLocaleString('en-IN')}`),
                    escapeCsvCell(`₹${Number(m.cgst || 0).toLocaleString('en-IN')}`),
                    escapeCsvCell(`₹${Number(m.sgst || 0).toLocaleString('en-IN')}`),
                    escapeCsvCell(`₹${Number(m.igst || 0).toLocaleString('en-IN')}`),
                    escapeCsvCell(`₹${Number(m.totalGstLiability || 0).toLocaleString('en-IN')}`),
                    escapeCsvCell(`₹${Number(m.itc || 0).toLocaleString('en-IN')}`),
                    escapeCsvCell(`₹${Number(m.netPayable || 0).toLocaleString('en-IN')}`),
                    escapeCsvCell(m.gstr1?.status || '-'),
                    escapeCsvCell(m.gstr3b?.status || '-')
                ]);
            });
        }

        const csvContent = '\uFEFF' + csvLines.map((line) => line.join(',')).join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success('GST Tax Register executive audit report exported to CSV!');
    };

    const exportPdf = () => {
        const todayStr = getTodayDdMmYyyy();
        const filename = `executive-audit-report-gst-tax-register-${todayStr}.pdf`;

        generatePdfReport({
            title: 'Sales & GST Tax Register Audit Report',
            subtitle: `Financial Year: ${selectedFyLabel} | GSTIN: ${companyGstin || 'Not Configured'}`,
            generatedDate: todayStr,
            filename,
            summaryCards: [
                { label: 'Total Taxable Turnover', value: `₹${Number(summary.totalTaxableTurnover || 0).toLocaleString('en-IN')}`, notes: 'Output sales turnover' },
                { label: 'Total GST Collected', value: `₹${Number(summary.totalGstCollected || 0).toLocaleString('en-IN')}`, notes: 'CGST + SGST + IGST output' },
                { label: 'Input Tax Credit (ITC)', value: `₹${Number(summary.inputTaxCredit || 0).toLocaleString('en-IN')}`, notes: 'Purchases & expenses ITC' },
                { label: 'Net GST Payable / (Credit)', value: `₹${Number(summary.netTaxPayable || 0).toLocaleString('en-IN')}`, notes: summary.netTaxPayable > 0 ? 'Net Tax Payable' : 'Excess ITC Available' }
            ],
            sections: [
                {
                    title: 'MONTHLY GST TAX BREAKDOWN & FILING STATUS',
                    headers: ['Return Period', 'Taxable Sales (INR)', 'CGST (INR)', 'SGST (INR)', 'IGST (INR)', 'Total GST (INR)', 'ITC (INR)', 'Net Payable (INR)', 'GSTR-1 Status', 'GSTR-3B Status'],
                    rows: months.map((m) => [
                        m.returnPeriod || m.monthName || '-',
                        `₹${Number(m.taxableSales || 0).toLocaleString('en-IN')}`,
                        `₹${Number(m.cgst || 0).toLocaleString('en-IN')}`,
                        `₹${Number(m.sgst || 0).toLocaleString('en-IN')}`,
                        `₹${Number(m.igst || 0).toLocaleString('en-IN')}`,
                        `₹${Number(m.totalGstLiability || 0).toLocaleString('en-IN')}`,
                        `₹${Number(m.itc || 0).toLocaleString('en-IN')}`,
                        `₹${Number(m.netPayable || 0).toLocaleString('en-IN')}`,
                        m.gstr1?.status || '-',
                        m.gstr3b?.status || '-'
                    ])
                }
            ]
        });
        toast.success('GST Tax Register audit report exported to PDF!');
    };

    useImperativeHandle(ref, () => ({
        exportCsv,
        exportPdf
    }));

    // Open Filing Modal
    const handleOpenFilingModal = (returnType, info, row) => {
        setActiveFilingModal({
            returnType,
            info,
            row
        });

        setFilingFormData({
            filedDate: info?.filedDate
                ? new Date(info.filedDate).toISOString().split('T')[0]
                : getIstTodayString(),
            arnNumber: info?.arnNumber || '',
            taxPaid: info?.taxPaid !== undefined && info?.taxPaid !== null
                ? info.taxPaid
                : (returnType === 'GSTR-3B' ? (row.totalGstLiability || 0) : 0)
        });
    };

    // Save Filing (POST)
    const handleSaveFiling = async (e) => {
        e.preventDefault();
        if (!activeFilingModal) return;

        try {
            setIsSubmittingFiling(true);
            const payload = {
                month: activeFilingModal.row.monthKey,
                returnType: activeFilingModal.returnType,
                filedDate: filingFormData.filedDate,
                arnNumber: filingFormData.arnNumber,
                taxPaid: Number(filingFormData.taxPaid) || 0
            };

            const res = await axiosInstance.post('/analytics/gst-filing', payload);
            if (res.data?.success) {
                toast.success(`${activeFilingModal.returnType} filing for ${activeFilingModal.row.returnPeriod} recorded!`);
                setActiveFilingModal(null);
                fetchGstRegister();
            }
        } catch (error) {
            console.error('Error saving GST filing:', error);
            toast.error(error.response?.data?.message || 'Failed to record GST filing');
        } finally {
            setIsSubmittingFiling(false);
        }
    };

    // Undo Filing (DELETE)
    const handleUndoFiling = async () => {
        if (!activeFilingModal?.info?.filingId) return;

        try {
            setIsSubmittingFiling(true);
            const res = await axiosInstance.delete(`/analytics/gst-filing/${activeFilingModal.info.filingId}`);
            if (res.data?.success) {
                toast.success(`${activeFilingModal.returnType} filing for ${activeFilingModal.row.returnPeriod} undone!`);
                setActiveFilingModal(null);
                fetchGstRegister();
            }
        } catch (error) {
            console.error('Error undoing GST filing:', error);
            toast.error(error.response?.data?.message || 'Failed to undo GST filing');
        } finally {
            setIsSubmittingFiling(false);
        }
    };

    // Helper to render return pill
    const renderFilingPill = (returnType, info, row) => {
        if (!info || info.status === '-') {
            return null;
        }

        const { status } = info;
        let badgeClass = 'bg-slate-700 text-white border border-slate-800 hover:bg-slate-800';
        if (status === 'Filed') {
            badgeClass = 'bg-green-100 text-green-800 border border-green-300 hover:bg-green-200';
        } else if (status === 'Pending') {
            badgeClass = 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200';
        } else if (status === 'Overdue') {
            badgeClass = 'bg-red-100 text-red-800 border border-red-300 hover:bg-red-200';
        }

        return (
            <button
                type="button"
                key={returnType}
                onClick={() => handleOpenFilingModal(returnType, info, row)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border transition-all cursor-pointer ${badgeClass}`}
                title={`Click to ${status === 'Filed' ? 'view details or undo' : 'record filing'}`}
            >
                <span>{returnType}:</span>
                <span className="font-extrabold">{status}</span>
            </button>
        );
    };

    return (
        <div className="space-y-5 font-sans">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase">Total Taxable Turnover</span>
                        <Receipt size={16} className="text-amber-500" />
                    </div>
                    <div className="text-xl font-extrabold text-text-main font-mono">
                        {isLoading ? '...' : formatCardCurrency(summary.totalTaxableTurnover)}
                    </div>
                    <div className="text-[10px] text-text-muted">
                        {selectedFyLabel} Output Sales
                    </div>
                </div>

                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase">Total GST Collected</span>
                        <Percent size={16} className="text-blue-500" />
                    </div>
                    <div className="text-xl font-extrabold text-text-main font-mono">
                        {isLoading ? '...' : formatCardCurrency(summary.totalGstCollected)}
                    </div>
                    <div className="text-[10px] text-emerald-600 font-extrabold">
                        CGST + SGST + IGST
                    </div>
                </div>

                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase">Input Tax Credit (ITC)</span>
                        <FileText size={16} className="text-emerald-500" />
                    </div>
                    <div className="text-xl font-extrabold text-emerald-700 font-mono">
                        {isLoading ? '...' : formatCardCurrency(summary.inputTaxCredit)}
                    </div>
                    <div className="text-[10px] text-emerald-600 font-extrabold">
                        {summary.itcCarryForward > 0
                            ? `${formatCardCurrency(summary.itcCarryForward)} Carry Forward`
                            : 'Set-off from Purchase Bills'}
                    </div>
                </div>

                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase">Net Cash Tax Payable</span>
                        <CheckCircle size={16} className="text-primary" />
                    </div>
                    <div className="text-xl font-extrabold text-primary font-mono">
                        {isLoading ? '...' : formatCardCurrency(summary.netTaxPayable)}
                    </div>
                    <div className="text-[10px] text-text-muted">
                        Paid via Electronic Cash Ledger
                    </div>
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-card-bg border border-border rounded-xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-border bg-app-bg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider">
                        GSTR-1 & GSTR-3B STATUTORY TAX REGISTER (MONTHLY)
                    </h3>
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Financial Year Selector */}
                        <div className="flex items-center gap-1.5 bg-card-bg border border-border px-2.5 py-1 rounded-lg">
                            <span className="text-[10px] font-bold text-text-muted uppercase">FY:</span>
                            <select
                                id="gst-fy-selector"
                                value={selectedFy}
                                onChange={(e) => setSelectedFy(Number(e.target.value))}
                                className="bg-transparent text-text-main text-xs font-extrabold focus:outline-none cursor-pointer"
                            >
                                {fyOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value} className="bg-card-bg text-text-main">
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Real GSTIN Badge */}
                        {companyGstin ? (
                            <span className="text-[10px] font-mono font-extrabold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                                • GSTIN: {companyGstin}
                            </span>
                        ) : null}

                        <button
                            type="button"
                            onClick={exportCsv}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-card-bg hover:bg-app-bg text-text-main border border-border font-bold rounded-lg text-xs transition-all shadow-xs cursor-pointer"
                            title="Export GST Tax Register to CSV"
                        >
                            <Download size={13} />
                            <span>Export CSV</span>
                        </button>

                        <button
                            type="button"
                            onClick={exportPdf}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer"
                            title="Export GST Tax Register to PDF"
                        >
                            <Printer size={13} />
                            <span>Export PDF</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-sans">
                        <thead>
                            <tr className="bg-table-header-bg text-table-header-text font-extrabold uppercase text-[10px]">
                                <th className="p-3 border-b border-border">Return Period</th>
                                <th className="p-3 border-b border-border font-mono">Taxable Sales</th>
                                <th className="p-3 border-b border-border font-mono">CGST</th>
                                <th className="p-3 border-b border-border font-mono">SGST</th>
                                <th className="p-3 border-b border-border font-mono">IGST</th>
                                <th className="p-3 border-b border-border font-mono">Total GST Liability</th>
                                <th className="p-3 border-b border-border">Filing Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="p-10 text-center text-text-muted">
                                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-primary" />
                                        <p className="text-xs font-semibold">Loading statutory tax register...</p>
                                    </td>
                                </tr>
                            ) : isRegisterEmpty ? (
                                <tr>
                                    <td colSpan={7} className="p-10 text-center text-text-muted">
                                        <Receipt size={32} className="mx-auto mb-2 opacity-40 text-amber-500" />
                                        <p className="font-semibold text-xs">No GST records found for this financial year</p>
                                    </td>
                                </tr>
                            ) : (
                                months.map((r, i) => (
                                    <tr key={r.monthKey || i} className="hover:bg-app-bg/50 transition-colors text-text-main">
                                        <td className="p-3 font-bold text-text-main">{r.returnPeriod}</td>
                                        <td className="p-3 font-mono font-semibold">{formatTableCurrency(r.taxableSales)}</td>
                                        <td className="p-3 font-mono text-text-muted">{formatTableCurrency(r.cgst)}</td>
                                        <td className="p-3 font-mono text-text-muted">{formatTableCurrency(r.sgst)}</td>
                                        <td className="p-3 font-mono text-text-muted">{formatTableCurrency(r.igst)}</td>
                                        <td className="p-3 font-mono font-extrabold text-primary">{formatTableCurrency(r.totalGstLiability)}</td>
                                        <td className="p-3">
                                            {(!r.gstr1 || r.gstr1.status === '-') && (!r.gstr3b || r.gstr3b.status === '-') ? (
                                                <span className="text-text-muted font-bold text-xs">-</span>
                                            ) : (
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {renderFilingPill('GSTR-1', r.gstr1, r)}
                                                    {renderFilingPill('GSTR-3B', r.gstr3b, r)}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Filing Details / Record Modal */}
            {activeFilingModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-card-bg border border-border rounded-xl shadow-xl max-w-md w-full p-5 space-y-4 font-sans animate-in fade-in zoom-in duration-150">
                        {/* Modal Header */}
                        <div className="flex items-start justify-between border-b border-border pb-3">
                            <div>
                                <h3 className="text-sm font-extrabold text-text-main uppercase tracking-wide">
                                    {activeFilingModal.info.status === 'Filed'
                                        ? `${activeFilingModal.returnType} Filing Details`
                                        : `Record ${activeFilingModal.returnType} Filing`}
                                </h3>
                                <p className="text-xs text-text-muted mt-0.5">
                                    {activeFilingModal.row.returnPeriod} • Due Date: {formatDateDisplay(activeFilingModal.info.dueDate)}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveFilingModal(null)}
                                className="text-text-muted hover:text-text-main p-1 rounded-md transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        {activeFilingModal.info.status === 'Filed' ? (
                            /* Filed Details View */
                            <div className="space-y-3.5 text-xs">
                                <div className="flex justify-between items-center bg-green-100 border border-green-300 text-green-800 p-3 rounded-md font-bold">
                                    <span>Filing Status</span>
                                    <span className="flex items-center gap-1">
                                        <CheckCircle size={14} /> Filed
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 bg-app-bg/50 p-3 rounded-lg border border-border">
                                    <div>
                                        <span className="text-[10px] font-bold text-text-muted uppercase block">Filed Date</span>
                                        <span className="font-semibold text-text-main">{formatDateDisplay(activeFilingModal.info.filedDate)}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-text-muted uppercase block">Due Date</span>
                                        <span className="font-semibold text-text-main">{formatDateDisplay(activeFilingModal.info.dueDate)}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-[10px] font-bold text-text-muted uppercase block">ARN Number</span>
                                        <span className="font-mono font-bold text-primary">{activeFilingModal.info.arnNumber || 'Not provided'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-text-muted uppercase block">Tax Paid</span>
                                        <span className="font-mono font-extrabold text-emerald-700">{formatTableCurrency(activeFilingModal.info.taxPaid)}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-border">
                                    <button
                                        type="button"
                                        disabled={isSubmittingFiling}
                                        onClick={handleUndoFiling}
                                        className="bg-red-500 text-white hover:bg-red-600 font-bold px-4 py-2 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        {isSubmittingFiling ? 'Undoing...' : 'Undo Filing'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveFilingModal(null)}
                                        className="px-4 py-1.5 bg-app-bg hover:bg-border text-text-main rounded-lg text-xs font-semibold border border-border transition-all cursor-pointer"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Record Filing Form View */
                            <form onSubmit={handleSaveFiling} className="space-y-3.5 text-xs">
                                <div>
                                    <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">
                                        Filing Date *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={filingFormData.filedDate}
                                        onChange={(e) => setFilingFormData({ ...filingFormData, filedDate: e.target.value })}
                                        className="w-full border border-border rounded-lg p-2 bg-app-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">
                                        ARN Number (Acknowledgement Ref No)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. AA2409260000001"
                                        value={filingFormData.arnNumber}
                                        onChange={(e) => setFilingFormData({ ...filingFormData, arnNumber: e.target.value })}
                                        className="w-full border border-border rounded-lg p-2 bg-app-bg text-xs font-mono font-semibold text-text-main focus:outline-none focus:border-primary"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">
                                        Tax Paid (₹)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        value={filingFormData.taxPaid}
                                        onChange={(e) => setFilingFormData({ ...filingFormData, taxPaid: e.target.value })}
                                        className="w-full border border-border rounded-lg p-2 bg-app-bg text-xs font-mono font-semibold text-text-main focus:outline-none focus:border-primary"
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                                    <button
                                        type="button"
                                        onClick={() => setActiveFilingModal(null)}
                                        className="px-3.5 py-1.5 bg-app-bg hover:bg-border text-text-main rounded-lg text-xs font-semibold border border-border transition-all cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmittingFiling}
                                        className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50"
                                    >
                                        {isSubmittingFiling ? 'Saving...' : 'Confirm Filing'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

export default GstTaxRegisterTab;
