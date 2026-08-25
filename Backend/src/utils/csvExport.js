/**
 * Utility to generate CSV string from data array and field mapping
 * @param {Array<Object>} data - Array of documents/objects
 * @param {Array<{ label: string, key: string|Function }>} fields - Field column mappings
 * @returns {string} CSV formatted string
 */
const generateCsv = (data = [], fields = []) => {
    const escapeCsvValue = (val) => {
        if (val === null || val === undefined) return '""';
        let str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    };

    // Header line
    const headers = fields.map((f) => escapeCsvValue(f.label)).join(',');

    // Data rows
    const rows = data.map((item) => {
        return fields
            .map((field) => {
                let rawVal = null;
                if (typeof field.key === 'function') {
                    rawVal = field.key(item);
                } else if (typeof field.key === 'string') {
                    // Support nested property access e.g., 'category.name'
                    rawVal = field.key.split('.').reduce((prev, curr) => (prev ? prev[curr] : null), item);
                }
                return escapeCsvValue(rawVal);
            })
            .join(',');
    });

    return [headers, ...rows].join('\n');
};

/**
 * Send CSV stream response with proper attachment headers
 */
const sendCsvResponse = (res, filename, csvString) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvString);
};

module.exports = {
    generateCsv,
    sendCsvResponse
};
