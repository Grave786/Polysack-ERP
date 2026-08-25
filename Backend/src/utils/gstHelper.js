/**
 * Static map of Indian States & Union Territories to 2-digit GST state codes
 */
const INDIAN_GST_STATE_MAP = {
    '01': '01', 'JAMMU AND KASHMIR': '01', 'JAMMU & KASHMIR': '01', 'J&K': '01',
    '02': '02', 'HIMACHAL PRADESH': '02', 'HP': '02',
    '03': '03', 'PUNJAB': '03', 'PB': '03',
    '04': '04', 'CHANDIGARH': '04',
    '05': '05', 'UTTARAKHAND': '05', 'UTTARANCHAL': '05', 'UK': '05',
    '06': '06', 'HARYANA': '06', 'HR': '06',
    '07': '07', 'DELHI': '07', 'NEW DELHI': '07', 'DL': '07',
    '08': '08', 'RAJASTHAN': '08', 'RJ': '08',
    '09': '09', 'UTTAR PRADESH': '09', 'UP': '09',
    '10': '10', 'BIHAR': '10', 'BR': '10',
    '11': '11', 'SIKKIM': '11', 'SK': '11',
    '12': '12', 'ARUNACHAL PRADESH': '12', 'AR': '12',
    '13': '13', 'NAGALAND': '13', 'NL': '13',
    '14': '14', 'MANIPUR': '14', 'MN': '14',
    '15': '15', 'MIZORAM': '15', 'MZ': '15',
    '16': '16', 'TRIPURA': '16', 'TR': '16',
    '17': '17', 'MEGHALAYA': '17', 'ML': '17',
    '18': '18', 'ASSAM': '18', 'AS': '18',
    '19': '19', 'WEST BENGAL': '19', 'WB': '19',
    '20': '20', 'JHARKHAND': '20', 'JH': '20',
    '21': '21', 'ODISHA': '21', 'ORISSA': '21', 'OR': '21', 'OD': '21',
    '22': '22', 'CHHATTISGARH': '22', 'CG': '22',
    '23': '23', 'MADHYA PRADESH': '23', 'MP': '23',
    '24': '24', 'GUJARAT': '24', 'GJ': '24',
    '26': '26', 'DADRA AND NAGAR HAVELI AND DAMAN AND DIU': '26', 'DAMAN AND DIU': '26', 'DADRA AND NAGAR HAVELI': '26',
    '27': '27', 'MAHARASHTRA': '27', 'MH': '27',
    '28': '28', 'ANDHRA PRADESH': '28', 'AP': '28',
    '29': '29', 'KARNATAKA': '29', 'KA': '29',
    '30': '30', 'GOA': '30', 'GA': '30',
    '31': '31', 'LAKSHADWEEP': '31', 'LD': '31',
    '32': '32', 'KERALA': '32', 'KL': '32',
    '33': '33', 'TAMIL NADU': '33', 'TN': '33',
    '34': '34', 'PUDUCHERRY': '34', 'PONDICHERRY': '34', 'PY': '34',
    '35': '35', 'ANDAMAN AND NICOBAR ISLANDS': '35', 'ANDAMAN & NICOBAR': '35', 'AN': '35',
    '36': '36', 'TELANGANA': '36', 'TS': '36', 'TG': '36',
    '37': '37', 'ANDHRA PRADESH (NEW)': '37',
    '38': '38', 'LADAKH': '38', 'LA': '38',
    '97': '97', 'OTHER TERRITORY': '97',
    '99': '99', 'CENTRE JURISDICTION': '99'
};

/**
 * Normalize state name or code to a 2-digit GST state code string
 */
const normalizeStateCode = (input) => {
    if (!input || typeof input !== 'string') return null;
    const clean = input.trim().toUpperCase();
    if (!clean) return null;

    if (/^\d{2}$/.test(clean)) {
        return clean;
    }

    return INDIAN_GST_STATE_MAP[clean] || null;
};

/**
 * Helper to compute GST breakdown (Intra-state CGST+SGST vs Inter-state IGST)
 */
const calculateGstBreakdown = ({
    totalTaxable,
    gstRate = 18,
    sellerStateCode,
    customerGstin,
    customerState,
    isWalkIn = false
}) => {
    const cleanSellerStateCode = normalizeStateCode(sellerStateCode);
    if (!cleanSellerStateCode) {
        throw new Error('Valid 2-digit seller state code (sellerStateCode) is required to calculate GST.');
    }

    let isInterState = false;

    if (!isWalkIn) {
        let customerStateCode = null;

        // Priority 1: Extract 2-digit state code from Customer GSTIN prefix
        if (customerGstin && typeof customerGstin === 'string' && customerGstin.trim().length >= 2) {
            const prefix = customerGstin.trim().substring(0, 2);
            if (/^\d{2}$/.test(prefix)) {
                customerStateCode = prefix;
            }
        }

        // Priority 2: Resolve customerState name or code via INDIAN_GST_STATE_MAP
        if (!customerStateCode && customerState) {
            customerStateCode = normalizeStateCode(customerState);
        }

        // Comparison: Code vs Code
        // Fallback: If customer state code cannot be resolved (empty or unknown), default to Intra-state (same state as seller)
        if (customerStateCode) {
            if (customerStateCode !== cleanSellerStateCode) {
                isInterState = true;
            }
        }
    }

    const rate = Number(gstRate) || 18;
    const gstAmount = totalTaxable * (rate / 100);

    if (isInterState) {
        return {
            gstRate: rate,
            gstAmount,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: gstAmount,
            isInterState: true
        };
    } else {
        return {
            gstRate: rate,
            gstAmount,
            cgstAmount: gstAmount / 2,
            sgstAmount: gstAmount / 2,
            igstAmount: 0,
            isInterState: false
        };
    }
};

module.exports = {
    normalizeStateCode,
    calculateGstBreakdown
};
