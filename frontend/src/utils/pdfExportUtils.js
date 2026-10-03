import { useAuthStore } from '../store/authStore';

/**
 * Shared PDF Generation Utility for Analytics & Executive Reports
 * Generates an executive-formatted printable report and triggers the browser's PDF export dialog.
 */

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export const generatePdfReport = ({
    title = 'Executive Report',
    subtitle = '',
    generatedDate = '',
    companyName = null,
    filename = 'report.pdf',
    summaryCards = [], // Array of { label, value, notes }
    sections = [] // Array of { title, subtitle, headers: [], rows: [[]], columnAlignments: [] }
}) => {
    try {
        const user = useAuthStore.getState()?.user;
        const tenant = user?.tenant || user?.tenantData || {};
        const tenantCompanyName = tenant?.companyName || tenant?.name || user?.companyName || 'PP Poly & Paper Products';

        // Strip any legacy "(PolySack ERP)" or "PolySack ERP" branding if present in passed name
        const cleanPassedName = companyName ? companyName.replace(/\s*\(?PolySack\s*ERP\)?/gi, '').trim() : '';
        const effectiveCompanyName = cleanPassedName || tenantCompanyName;

        const cleanFilename = (filename || 'report.pdf').replace(/\.pdf$/i, '');

        // Build Summary KPI Cards HTML
        let summaryHtml = '';
        if (Array.isArray(summaryCards) && summaryCards.length > 0) {
            summaryHtml = `
                <div class="summary-section">
                    <div class="section-title">EXECUTIVE KPI SUMMARY</div>
                    <div class="kpi-grid">
                        ${summaryCards.map((card) => `
                            <div class="kpi-card">
                                <div class="kpi-label">${escapeHtml(card.label || '')}</div>
                                <div class="kpi-value">${escapeHtml(card.value || '-')}</div>
                                ${card.notes ? `<div class="kpi-notes">${escapeHtml(card.notes)}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Build Sections & Data Tables HTML
        let sectionsHtml = '';
        if (Array.isArray(sections) && sections.length > 0) {
            sectionsHtml = sections.map((sec) => {
                const headers = sec.headers || [];
                const rows = sec.rows || [];
                const alignments = sec.columnAlignments || [];

                return `
                    <div class="report-section">
                        ${sec.title ? `<div class="section-title">${escapeHtml(sec.title)}</div>` : ''}
                        ${sec.subtitle ? `<div class="section-subtitle">${escapeHtml(sec.subtitle)}</div>` : ''}
                        <table class="report-table">
                            <thead>
                                <tr>
                                    ${headers.map((h, idx) => {
                                        const align = alignments[idx] || (
                                            String(h).toLowerCase().includes('qty') ||
                                            String(h).toLowerCase().includes('inr') ||
                                            String(h).toLowerCase().includes('rate') ||
                                            String(h).toLowerCase().includes('amount') ||
                                            String(h).toLowerCase().includes('value') ||
                                            String(h).toLowerCase().includes('kg') ||
                                            String(h).toLowerCase().includes('tax') ||
                                            String(h).toLowerCase().includes('sales')
                                                ? 'right'
                                                : 'left'
                                        );
                                        return `<th style="text-align: ${align}">${escapeHtml(h)}</th>`;
                                    }).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${rows.length === 0 ? `
                                    <tr><td colspan="${Math.max(1, headers.length)}" class="no-data">No records available for this period</td></tr>
                                ` : rows.map((row) => `
                                    <tr>
                                        ${row.map((cell, idx) => {
                                            const cellStr = cell !== undefined && cell !== null ? String(cell) : '-';
                                            const align = alignments[idx] || (
                                                typeof cell === 'number' ||
                                                (/^[\d,.-]+$/.test(cellStr.trim()) || cellStr.startsWith('₹'))
                                                    ? 'right'
                                                    : 'left'
                                            );
                                            return `<td style="text-align: ${align}">${escapeHtml(cellStr)}</td>`;
                                        }).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }).join('');
        }

        const fullHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8">
                <title>${escapeHtml(cleanFilename)}</title>
                <style>
                    @page {
                        size: A4 landscape;
                        margin: 10mm;
                    }
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                    }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                        color: #0f172a;
                        background: #ffffff;
                        padding: 12px;
                        font-size: 11px;
                        line-height: 1.4;
                    }
                    .header-container {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        border-bottom: 2px solid #0284c7;
                        padding-bottom: 10px;
                        margin-bottom: 14px;
                    }
                    .company-name {
                        font-size: 16px;
                        font-weight: 800;
                        color: #0f172a;
                        letter-spacing: -0.02em;
                        text-transform: uppercase;
                    }
                    .company-sub {
                        font-size: 10px;
                        color: #64748b;
                        margin-top: 2px;
                    }
                    .report-title-box {
                        text-align: right;
                    }
                    .report-title {
                        font-size: 14px;
                        font-weight: 800;
                        color: #0284c7;
                        text-transform: uppercase;
                    }
                    .report-meta {
                        font-size: 10px;
                        color: #475569;
                        margin-top: 2px;
                        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    }
                    .summary-section {
                        margin-bottom: 16px;
                    }
                    .section-title {
                        font-size: 11px;
                        font-weight: 800;
                        color: #334155;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        margin-bottom: 6px;
                        padding-bottom: 3px;
                        border-bottom: 1px solid #e2e8f0;
                    }
                    .section-subtitle {
                        font-size: 10px;
                        color: #64748b;
                        margin-bottom: 8px;
                    }
                    .kpi-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                        gap: 8px;
                    }
                    .kpi-card {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 6px;
                        padding: 8px 10px;
                        page-break-inside: avoid;
                    }
                    .kpi-label {
                        font-size: 9px;
                        font-weight: 700;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 0.03em;
                    }
                    .kpi-value {
                        font-size: 13px;
                        font-weight: 800;
                        color: #0f172a;
                        margin-top: 3px;
                        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    }
                    .kpi-notes {
                        font-size: 9px;
                        color: #64748b;
                        margin-top: 2px;
                    }
                    .report-section {
                        margin-bottom: 16px;
                        page-break-inside: auto;
                    }
                    .report-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 10px;
                        page-break-inside: auto;
                    }
                    .report-table thead {
                        display: table-header-group;
                    }
                    .report-table tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                    .report-table th {
                        background: #f1f5f9;
                        color: #334155;
                        font-weight: 700;
                        text-transform: uppercase;
                        font-size: 9px;
                        letter-spacing: 0.03em;
                        padding: 6px 8px;
                        border: 1px solid #cbd5e1;
                    }
                    .report-table td {
                        padding: 5px 8px;
                        border: 1px solid #e2e8f0;
                        color: #1e293b;
                    }
                    .report-table tbody tr:nth-child(even) {
                        background: #f8fafc;
                    }
                    .no-data {
                        text-align: center;
                        padding: 14px;
                        color: #64748b;
                        font-style: italic;
                    }
                    .report-footer {
                        margin-top: 20px;
                        padding-top: 8px;
                        border-top: 1px solid #e2e8f0;
                        display: flex;
                        justify-content: space-between;
                        font-size: 9px;
                        color: #94a3b8;
                    }
                </style>
            </head>
            <body>
                <div class="header-container">
                    <div>
                        <div class="company-name">${escapeHtml(effectiveCompanyName)}</div>
                        <div class="company-sub">Executive Business Intelligence & Operational Audit</div>
                    </div>
                    <div class="report-title-box">
                        <div class="report-title">${escapeHtml(title)}</div>
                        <div class="report-meta">
                            ${subtitle ? `<span>${escapeHtml(subtitle)} &nbsp;|&nbsp; </span>` : ''}
                            <span>Generated: ${escapeHtml(generatedDate || new Date().toLocaleDateString('en-IN'))}</span>
                        </div>
                    </div>
                </div>

                ${summaryHtml}
                ${sectionsHtml}

                <div class="report-footer">
                    <span>${escapeHtml(effectiveCompanyName)} • Confidential Management Report</span>
                    <span>System Timestamp: ${new Date().toLocaleString('en-IN')}</span>
                </div>
            </body>
            </html>
        `;

        // Create invisible iframe for printing
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(fullHtml);
        doc.close();

        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.document.title = cleanFilename;
            iframe.contentWindow.print();
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 1000);
        }, 250);
    } catch (err) {
        console.error('Error generating PDF report:', err);
    }
};
