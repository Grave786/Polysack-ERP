import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Package,
    Boxes,
    Factory,
    ShieldCheck,
    Warehouse,
    Heart,
    CheckCircle2,
    ArrowRight,
    Sparkles,
    Menu,
    X,
    Layers,
    Lock,
    Check,
    Phone,
    PhoneCall,
    Mail,
    MapPin,
    Building2,
    UserCheck,
    MessageSquare,
    Clock,
    ChevronDown,
    ChevronUp,
    Send,
    ArrowUp,
    Truck,
    Wheat,
    FlaskConical,
    Beef,
    Sprout,
    ShoppingBag,
    ExternalLink,
    HelpCircle,
    AlertCircle,
    RefreshCw
} from 'lucide-react';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';
import {
    COMPANY_CONFIG,
    STATS_CONFIG,
    PROCESS_STEPS,
    PRODUCT_CATEGORIES,
    PRODUCTS_LIST,
    WHY_CHOOSE_US,
    INDUSTRIES_SERVED,
    QUALITY_STANDARDS,
    ORDERING_STEPS,
    FAQS
} from '../config/landingConfig';
import ProductImage from '../components/landing/ProductImage';
import ProductDetailModal from '../components/landing/ProductDetailModal';

// ── Lightweight IntersectionObserver Count-Up Component ─────────────────────
function CountUpNumber({ end, suffix = '', duration = 1600 }) {
    const [count, setCount] = useState(0);
    const elementRef = useRef(null);
    const hasAnimated = useRef(false);

    useEffect(() => {
        // Respect prefers-reduced-motion
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced) {
            setCount(Number(end) || 0);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasAnimated.current) {
                    hasAnimated.current = true;
                    const startTime = performance.now();
                    const target = Number(end) || 0;

                    const step = (now) => {
                        const elapsed = now - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        // Ease out cubic
                        const easeOut = 1 - Math.pow(1 - progress, 3);
                        setCount(Math.floor(easeOut * target));

                        if (progress < 1) {
                            requestAnimationFrame(step);
                        } else {
                            setCount(target);
                        }
                    };
                    requestAnimationFrame(step);
                }
            },
            { threshold: 0.3 }
        );

        if (elementRef.current) observer.observe(elementRef.current);
        return () => observer.disconnect();
    }, [end, duration]);

    return (
        <span ref={elementRef} className="font-extrabold font-mono tracking-tight">
            {count.toLocaleString('en-IN')}{suffix}
        </span>
    );
}

// ── SVG Icon Helper with Graceful Fallback ───────────────────────────────────
function DynamicIcon({ name, size = 20, className = '' }) {
    const iconMap = {
        Package,
        Boxes,
        Factory,
        ShieldCheck,
        Warehouse,
        Layers,
        Truck,
        UserCheck,
        Sparkles,
        Wheat,
        FlaskConical,
        Building2,
        Beef,
        Sprout,
        ShoppingBag,
        Phone,
        Mail,
        Clock,
        MapPin
    };
    const Component = iconMap[name] || Package;
    return <Component size={size} className={className} />;
}

// ── Reusable Contact Sales Form (Used Inline & in Popup Modal) ───────────────
function ContactSalesForm({ initialProduct = '', onSuccessCallback, isModal = false }) {
    const [formData, setFormData] = useState({
        fullName: '',
        companyName: '',
        mobileNumber: '',
        email: '',
        cityState: '',
        productInterestedIn: initialProduct || 'Standard PP Woven Sack',
        approxQuantity: '',
        quantityUnit: 'Pcs',
        bagSize: '',
        bagGsm: '',
        bagLamination: 'Unlaminated',
        bagPrinting: 'Plain',
        deliveryLocation: '',
        message: '',
        // Honeypot anti-spam fields
        website: '',
        fax: ''
    });

    const [showAdvancedSpecs, setShowAdvancedSpecs] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [enquiryRefNo, setEnquiryRefNo] = useState('');
    const [formErrors, setFormErrors] = useState({});

    // Keep product updated if initialProduct changes
    useEffect(() => {
        if (initialProduct) {
            setFormData((prev) => ({ ...prev, productInterestedIn: initialProduct }));
        }
    }, [initialProduct]);

    const validateForm = () => {
        const errors = {};
        if (!formData.fullName.trim()) {
            errors.fullName = 'Full Name is required.';
        } else if (formData.fullName.trim().length < 2) {
            errors.fullName = 'Please enter at least 2 characters.';
        }

        const digitsPhone = formData.mobileNumber.replace(/\D/g, '');
        const cleanPhone = digitsPhone.length > 10 ? digitsPhone.slice(-10) : digitsPhone;
        if (!cleanPhone) {
            errors.mobileNumber = 'Mobile number is required.';
        } else if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
            errors.mobileNumber = 'Enter a valid 10-digit Indian mobile number.';
        }

        if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
            errors.email = 'Enter a valid email address.';
        }

        if (!formData.message.trim()) {
            errors.message = 'Please provide details of your requirement.';
        } else if (formData.message.trim().length < 5) {
            errors.message = 'Message must be at least 5 characters.';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!validateForm()) {
            toast.error('Please fix the errors in the form.');
            return;
        }

        try {
            setIsSubmitting(true);
            const digitsPhone = formData.mobileNumber.replace(/\D/g, '');
            const cleanPhone = digitsPhone.length > 10 ? digitsPhone.slice(-10) : digitsPhone;

            const payload = {
                fullName: formData.fullName.trim(),
                companyName: formData.companyName.trim(),
                mobileNumber: cleanPhone,
                email: formData.email.trim(),
                cityState: formData.cityState.trim(),
                productInterestedIn: formData.productInterestedIn,
                approxQuantity: formData.approxQuantity ? Number(formData.approxQuantity) : undefined,
                quantityUnit: formData.quantityUnit,
                deliveryLocation: formData.deliveryLocation.trim(),
                message: formData.message.trim(),
                bagDetails: {
                    size: formData.bagSize.trim(),
                    gsm: formData.bagGsm.trim(),
                    lamination: formData.bagLamination,
                    printing: formData.bagPrinting
                },
                // Honeypot fields
                website: formData.website,
                fax: formData.fax
            };

            const res = await axiosInstance.post('/public/enquiries', payload);

            if (res.data?.success) {
                const refNo = res.data.data?.enquiryNumber || 'ENQ-RECEIVED';
                setEnquiryRefNo(refNo);
                setSubmitSuccess(true);
                toast.success(`Enquiry submitted! Reference: ${refNo}`);
                if (onSuccessCallback) onSuccessCallback(refNo);
            }
        } catch (err) {
            console.error('Error submitting enquiry:', err);
            const msg = err.response?.data?.message || 'Could not submit enquiry. Please call us directly.';
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReset = () => {
        setSubmitSuccess(false);
        setEnquiryRefNo('');
        setFormData({
            fullName: '',
            companyName: '',
            mobileNumber: '',
            email: '',
            cityState: '',
            productInterestedIn: 'Standard PP Woven Sack',
            approxQuantity: '',
            quantityUnit: 'Pcs',
            bagSize: '',
            bagGsm: '',
            bagLamination: 'Unlaminated',
            bagPrinting: 'Plain',
            deliveryLocation: '',
            message: '',
            website: '',
            fax: ''
        });
        setFormErrors({});
    };

    if (submitSuccess) {
        return (
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shadow-inner">
                    <CheckCircle2 size={36} className="stroke-[2.5]" />
                </div>
                <div>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        Thank You, Your Enquiry is Received!
                    </h3>
                    <p className="text-sm text-slate-600 mt-1.5 max-w-md mx-auto">
                        Our packaging sales team is reviewing your requirements and will contact you via phone/WhatsApp within 24 hours.
                    </p>
                </div>

                <div className="bg-white border border-emerald-200 rounded-xl p-3.5 max-w-sm mx-auto shadow-xs">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Official Enquiry Reference
                    </span>
                    <span className="font-mono text-lg font-black text-emerald-700">
                        {enquiryRefNo}
                    </span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                        Please save this reference number for future communication.
                    </span>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <a
                        href={`https://wa.me/${COMPANY_CONFIG.whatsappRaw}?text=${encodeURIComponent(`Hello, I have submitted enquiry ref: ${enquiryRefNo}. Please provide a quote.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition-all shadow-sm"
                    >
                        <span>Chat on WhatsApp</span>
                        <ExternalLink size={14} />
                    </a>
                    <button
                        type="button"
                        onClick={handleReset}
                        className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs sm:text-sm transition-all"
                    >
                        Submit Another Requirement
                    </button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans text-slate-800">
            {/* Honeypot Fields (Hidden from human users) */}
            <div style={{ display: 'none' }} aria-hidden="true">
                <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
                <input
                    type="text"
                    name="fax"
                    tabIndex={-1}
                    autoComplete="off"
                    value={formData.fax}
                    onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
                />
            </div>

            {/* Row 1: Full Name & Company Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Full Name <span className="text-rose-600">*</span>
                    </label>
                    <input
                        type="text"
                        required
                        maxLength={100}
                        placeholder="e.g. Rajesh Sharma"
                        value={formData.fullName}
                        onChange={(e) => {
                            setFormData({ ...formData, fullName: e.target.value });
                            if (formErrors.fullName) setFormErrors({ ...formErrors, fullName: null });
                        }}
                        className={`w-full border rounded-xl p-2.5 bg-white text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all ${
                            formErrors.fullName ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 focus:border-amber-500'
                        }`}
                    />
                    {formErrors.fullName && <p className="text-[10px] text-rose-600 mt-1 font-semibold">{formErrors.fullName}</p>}
                </div>

                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Company / Firm Name
                    </label>
                    <input
                        type="text"
                        maxLength={150}
                        placeholder="e.g. Apex Agro Mills Pvt Ltd"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        className="w-full border border-slate-300 rounded-xl p-2.5 bg-white text-xs text-slate-900 font-medium focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 transition-all"
                    />
                </div>
            </div>

            {/* Row 2: Mobile Number & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Mobile Number <span className="text-rose-600">*</span>
                    </label>
                    <div className="flex">
                        <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-300 bg-slate-100 text-slate-600 font-bold text-xs select-none">
                            +91
                        </span>
                        <input
                            type="tel"
                            required
                            maxLength={10}
                            placeholder="9876543210"
                            value={formData.mobileNumber}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                setFormData({ ...formData, mobileNumber: val });
                                if (formErrors.mobileNumber) setFormErrors({ ...formErrors, mobileNumber: null });
                            }}
                            className={`w-full border rounded-r-xl p-2.5 bg-white text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all ${
                                formErrors.mobileNumber ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 focus:border-amber-500'
                            }`}
                        />
                    </div>
                    {formErrors.mobileNumber && <p className="text-[10px] text-rose-600 mt-1 font-semibold">{formErrors.mobileNumber}</p>}
                </div>

                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Email Address
                    </label>
                    <input
                        type="email"
                        maxLength={100}
                        placeholder="rajesh@apexagro.com"
                        value={formData.email}
                        onChange={(e) => {
                            setFormData({ ...formData, email: e.target.value });
                            if (formErrors.email) setFormErrors({ ...formErrors, email: null });
                        }}
                        className={`w-full border rounded-xl p-2.5 bg-white text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all ${
                            formErrors.email ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 focus:border-amber-500'
                        }`}
                    />
                    {formErrors.email && <p className="text-[10px] text-rose-600 mt-1 font-semibold">{formErrors.email}</p>}
                </div>
            </div>

            {/* Row 3: Product Category & Approx Quantity with Unit */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                <div className="sm:col-span-7">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Product of Interest <span className="text-rose-600">*</span>
                    </label>
                    <select
                        value={formData.productInterestedIn}
                        onChange={(e) => setFormData({ ...formData, productInterestedIn: e.target.value })}
                        className="w-full border border-slate-300 rounded-xl p-2.5 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                        {PRODUCTS_LIST.map((p) => (
                            <option key={p.id} value={p.name}>
                                {p.name} ({p.capacity})
                            </option>
                        ))}
                        <option value="Custom PP Woven Sacks">Custom Sized PP Woven Sacks</option>
                        <option value="BOPP Packaging Rolls">BOPP Laminated Packaging Rolls</option>
                        <option value="Other / Multiple Products">Other / Multiple Packaging Requirements</option>
                    </select>
                </div>

                <div className="sm:col-span-5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Approx. Quantity
                    </label>
                    <div className="flex gap-1.5">
                        <input
                            type="number"
                            min="1"
                            step="any"
                            placeholder="e.g. 10000"
                            value={formData.approxQuantity}
                            onChange={(e) => setFormData({ ...formData, approxQuantity: e.target.value })}
                            className="w-full border border-slate-300 rounded-xl p-2.5 bg-white text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                        />
                        <select
                            value={formData.quantityUnit}
                            onChange={(e) => setFormData({ ...formData, quantityUnit: e.target.value })}
                            className="border border-slate-300 rounded-xl px-2.5 py-2 bg-slate-100 text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer shrink-0"
                        >
                            <option value="Pcs">Pcs</option>
                            <option value="Bags">Bags</option>
                            <option value="Kg">Kg</option>
                            <option value="Roll">Rolls</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Row 4: City / State & Delivery Destination */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Your City & State
                    </label>
                    <input
                        type="text"
                        maxLength={100}
                        placeholder="e.g. Ahmedabad, Gujarat"
                        value={formData.cityState}
                        onChange={(e) => setFormData({ ...formData, cityState: e.target.value })}
                        className="w-full border border-slate-300 rounded-xl p-2.5 bg-white text-xs text-slate-900 font-medium focus:outline-none focus:border-amber-500"
                    />
                </div>

                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Delivery Destination / Port
                    </label>
                    <input
                        type="text"
                        maxLength={150}
                        placeholder="e.g. Factory Site, Indore or Mundra Port"
                        value={formData.deliveryLocation}
                        onChange={(e) => setFormData({ ...formData, deliveryLocation: e.target.value })}
                        className="w-full border border-slate-300 rounded-xl p-2.5 bg-white text-xs text-slate-900 font-medium focus:outline-none focus:border-amber-500"
                    />
                </div>
            </div>

            {/* Optional Collapsible Bag Specifications Toggle */}
            <div className="pt-1">
                <button
                    type="button"
                    onClick={() => setShowAdvancedSpecs(!showAdvancedSpecs)}
                    className="text-[11px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1.5 cursor-pointer select-none"
                >
                    <span>{showAdvancedSpecs ? '− Hide Optional Technical Bag Specs' : '+ Add Bag Dimensions, GSM & Print Details (Optional)'}</span>
                </button>

                {showAdvancedSpecs && (
                    <div className="mt-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Size (W x L)</label>
                            <input
                                type="text"
                                placeholder='e.g. 24" x 36"'
                                value={formData.bagSize}
                                onChange={(e) => setFormData({ ...formData, bagSize: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-xs font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Desired GSM</label>
                            <input
                                type="text"
                                placeholder="e.g. 75 GSM"
                                value={formData.bagGsm}
                                onChange={(e) => setFormData({ ...formData, bagGsm: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-xs font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Lamination</label>
                            <select
                                value={formData.bagLamination}
                                onChange={(e) => setFormData({ ...formData, bagLamination: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-xs cursor-pointer"
                            >
                                <option value="Unlaminated">Unlaminated (Breathable)</option>
                                <option value="Laminated">Extrusion Laminated</option>
                                <option value="BOPP Film">BOPP High Gloss</option>
                                <option value="Liner Insert">With Inside Poly Liner</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Printing</label>
                            <select
                                value={formData.bagPrinting}
                                onChange={(e) => setFormData({ ...formData, bagPrinting: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-xs cursor-pointer"
                            >
                                <option value="Plain">Plain (No Print)</option>
                                <option value="1-2 Color Flexo">1–2 Color Flexo</option>
                                <option value="3-4 Color Flexo">3–4 Color Flexo</option>
                                <option value="Multi-Color BOPP">Full Multi-Color BOPP</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Row 5: Detailed Message / Packaging Requirement */}
            <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Requirement &amp; Application Details <span className="text-rose-600">*</span>
                </label>
                <textarea
                    required
                    rows={isModal ? 3 : 4}
                    maxLength={1500}
                    placeholder="Tell us about the material you pack (e.g. Flour, Rice, Polymer granules), required capacity, delivery timeframe, or any specific barrier requirements..."
                    value={formData.message}
                    onChange={(e) => {
                        setFormData({ ...formData, message: e.target.value });
                        if (formErrors.message) setFormErrors({ ...formErrors, message: null });
                    }}
                    className={`w-full border rounded-xl p-3 bg-white text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all ${
                        formErrors.message ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 focus:border-amber-500'
                    }`}
                />
                {formErrors.message && <p className="text-[10px] text-rose-600 mt-1 font-semibold">{formErrors.message}</p>}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm tracking-wide uppercase transition-all shadow-md shadow-amber-500/25 hover:shadow-lg hover:shadow-amber-500/35 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? (
                        <>
                            <RefreshCw size={16} className="animate-spin" />
                            <span>Transmitting Enquiry to Sales Desk...</span>
                        </>
                    ) : (
                        <>
                            <span>Request Factory Direct Quotation</span>
                            <Send size={16} />
                        </>
                    )}
                </button>
                <p className="text-[10px] text-slate-500 text-center mt-2 font-medium">
                    🔒 Strict Privacy: Your technical specifications and contact details are kept strictly confidential.
                </p>
            </div>
        </form>
    );
}

// ── Formatting Helpers for Live Company Profile ───────────────────────────────
const formatIndianPhone = (raw) => {
    if (!raw) return null;
    const digits = String(raw).replace(/\D/g, '');
    const tenDigits = digits.length >= 10 ? digits.slice(-10) : digits;
    if (!tenDigits) return null;
    return {
        display: tenDigits.length === 10
            ? `+91 ${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}`
            : `+91 ${tenDigits}`,
        tel: `+91${tenDigits}`,
        whatsapp: `91${tenDigits}`
    };
};

const formatCompanyAddress = (info) => {
    if (!info) return '';
    const parts = [info.addressLine1, info.addressLine2, info.city]
        .map((p) => (p || '').trim())
        .filter(Boolean);

    const cityLower = (info.city || '').trim().toLowerCase();
    const stateTrimmed = (info.state || '').trim();
    const pincodeTrimmed = (info.pincode || '').trim();

    const cityAlreadyHasState = Boolean(stateTrimmed && cityLower.endsWith(stateTrimmed.toLowerCase()));
    const statePart = !cityAlreadyHasState && stateTrimmed ? stateTrimmed : '';

    let tail = '';
    if (statePart && pincodeTrimmed) {
        tail = `${statePart} - ${pincodeTrimmed}`;
    } else if (statePart) {
        tail = statePart;
    } else if (pincodeTrimmed) {
        tail = pincodeTrimmed;
    }

    if (tail) parts.push(tail);
    return parts.join(', ');
};

const formatCityState = (info) => {
    if (!info) return '';
    const cityTrimmed = (info.city || '').trim();
    const stateTrimmed = (info.state || '').trim();
    if (!cityTrimmed && !stateTrimmed) return '';
    if (cityTrimmed && stateTrimmed && cityTrimmed.toLowerCase().endsWith(stateTrimmed.toLowerCase())) {
        return cityTrimmed;
    }
    return [cityTrimmed, stateTrimmed].filter(Boolean).join(', ');
};

// ── Main Public Landing Page Component ───────────────────────────────────────
export default function LandingPage() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('All Products');
    const [quoteModalOpen, setQuoteModalOpen] = useState(false);
    const [quoteModalProduct, setQuoteModalProduct] = useState('');
    const [openFaqIndex, setOpenFaqIndex] = useState(0);
    const [showBackToTop, setShowBackToTop] = useState(false);
    const [selectedProductModalId, setSelectedProductModalId] = useState(null);
    const [companyInfo, setCompanyInfo] = useState(null);
    const [isLoadingCompany, setIsLoadingCompany] = useState(true);
    const [logoError, setLogoError] = useState(false);

    // Fetch whitelisted company profile once on load (with silent single retry on failure)
    useEffect(() => {
        let isMounted = true;
        const loadCompanyInfo = async () => {
            try {
                const res = await axiosInstance.get('/public/company-info');
                if (isMounted && res.data?.success && res.data?.data) {
                    setCompanyInfo(res.data.data);
                    setIsLoadingCompany(false);
                    return;
                }
            } catch {
                try {
                    const retryRes = await axiosInstance.get('/public/company-info');
                    if (isMounted && retryRes.data?.success && retryRes.data?.data) {
                        setCompanyInfo(retryRes.data.data);
                        setIsLoadingCompany(false);
                        return;
                    }
                } catch {
                    // Fail silently; company blocks stay hidden
                }
            }
            if (isMounted) setIsLoadingCompany(false);
        };
        loadCompanyInfo();
        return () => { isMounted = false; };
    }, []);

    const companyName = (companyInfo?.companyName || '').trim();
    const companyEmail = (companyInfo?.email || '').trim();
    const companyGstin = (companyInfo?.gstin || '').trim();
    const companyLogoUrl = !logoError ? (companyInfo?.logoUrl || '').trim() : '';
    const formattedPhone = useMemo(() => formatIndianPhone(companyInfo?.phone), [companyInfo?.phone]);
    const fullAddress = useMemo(() => formatCompanyAddress(companyInfo), [companyInfo]);
    const cityStateLabel = useMemo(() => formatCityState(companyInfo), [companyInfo]);
    const directionsUrl = fullAddress
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
        : '';

    // Product Detail Modal Handlers
    const handleOpenProductModal = (productId) => {
        setSelectedProductModalId(productId);
        if (productId) {
            window.history.replaceState(null, '', `#product-${productId}`);
        }
    };

    const handleCloseProductModal = () => {
        setSelectedProductModalId(null);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
    };

    // Hash-based direct product modal link listener (#product-<id>)
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash && hash.startsWith('#product-')) {
                const pId = hash.replace('#product-', '');
                const found = PRODUCTS_LIST.find((p) => p.id === pId);
                if (found) {
                    setSelectedProductModalId(pId);
                }
            }
        };

        handleHashChange();
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // Filtered Products
    const filteredProducts = useMemo(() => {
        if (selectedCategory === 'All Products') return PRODUCTS_LIST;
        return PRODUCTS_LIST.filter((p) => p.category === selectedCategory);
    }, [selectedCategory]);

    // Handle Window Scroll Events for Sticky Header & Back-To-Top
    useEffect(() => {
        const handleScroll = () => {
            const y = window.scrollY || document.documentElement.scrollTop;
            setIsHeaderScrolled(y > 35);
            setShowBackToTop(y > 450);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // SEO Meta Tags & JSON-LD Structured Data Injection in Document Head
    useEffect(() => {
        document.title = companyName
            ? `${companyName} | Manufacturer of PP Woven Sacks & Bags`
            : 'Manufacturer of PP Woven Sacks & Bags';

        const organizationSchema = {
            '@context': 'https://schema.org',
            '@type': 'Manufacturer',
            url: window.location.origin,
            description: COMPANY_CONFIG.subTagline
        };
        if (companyName) {
            organizationSchema.name = companyName;
            organizationSchema.legalName = companyName;
        }
        if (formattedPhone?.display) organizationSchema.telephone = formattedPhone.display;
        if (companyEmail) organizationSchema.email = companyEmail;
        if (companyLogoUrl) organizationSchema.logo = companyLogoUrl;
        if (fullAddress) {
            organizationSchema.address = {
                '@type': 'PostalAddress',
                streetAddress: [companyInfo?.addressLine1, companyInfo?.addressLine2].filter(Boolean).join(', '),
                addressLocality: companyInfo?.city || '',
                addressRegion: companyInfo?.state || '',
                postalCode: companyInfo?.pincode || '',
                addressCountry: 'India'
            };
        }

        const faqSchema = {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQS.map((f) => ({
                '@type': 'Question',
                name: f.question,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: f.answer
                }
            }))
        };

        const existingOrg = document.getElementById('polysack-org-jsonld');
        if (existingOrg) existingOrg.remove();
        const existingFaq = document.getElementById('polysack-faq-jsonld');
        if (existingFaq) existingFaq.remove();

        const orgScript = document.createElement('script');
        orgScript.type = 'application/ld+json';
        orgScript.id = 'polysack-org-jsonld';
        orgScript.text = JSON.stringify(organizationSchema);
        document.head.appendChild(orgScript);

        const faqScript = document.createElement('script');
        faqScript.type = 'application/ld+json';
        faqScript.id = 'polysack-faq-jsonld';
        faqScript.text = JSON.stringify(faqSchema);
        document.head.appendChild(faqScript);

        return () => {
            const el1 = document.getElementById('polysack-org-jsonld');
            if (el1) el1.remove();
            const el2 = document.getElementById('polysack-faq-jsonld');
            if (el2) el2.remove();
        };
    }, [companyName, formattedPhone, companyEmail, companyLogoUrl, fullAddress, companyInfo]);

    // Helper: Open Quote Modal for a specific product
    const handleOpenQuoteModal = (productName = '') => {
        setQuoteModalProduct(productName);
        setQuoteModalOpen(true);
    };

    // Helper: Scroll smoothly to a section
    const scrollToSection = (e, id) => {
        e.preventDefault();
        setIsMobileMenuOpen(false);
        const target = document.getElementById(id);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans selection:bg-amber-400/30 selection:text-amber-900 overflow-x-hidden antialiased">
            {/* ================================================================= */}
            {/* 1. TOP UTILITY BAR & MAIN STICKY HEADER                           */}
            {/* ================================================================= */}
            <div className="bg-[#090e1a] text-slate-300 text-[11px] font-medium border-b border-slate-800/80 py-2 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-center sm:justify-start">
                        {isLoadingCompany ? (
                            <div className="flex items-center gap-4">
                                <span className="h-3.5 w-32 bg-slate-800 rounded animate-pulse inline-block" />
                                <span className="h-3.5 w-44 bg-slate-800 rounded animate-pulse hidden xs:inline-block" />
                            </div>
                        ) : (
                            <>
                                {formattedPhone && (
                                    <a
                                        href={`tel:${formattedPhone.tel}`}
                                        className="flex items-center gap-1.5 hover:text-amber-400 transition-colors"
                                    >
                                        <Phone size={13} className="text-amber-400" />
                                        <span>Sales: {formattedPhone.display}</span>
                                    </a>
                                )}
                                {companyEmail && (
                                    <a
                                        href={`mailto:${companyEmail}`}
                                        className="hidden xs:flex items-center gap-1.5 hover:text-amber-400 transition-colors"
                                    >
                                        <Mail size={13} className="text-amber-400" />
                                        <span>{companyEmail}</span>
                                    </a>
                                )}
                            </>
                        )}
                        <span className="hidden md:flex items-center gap-1.5 text-slate-400">
                            <Clock size={12} className="text-amber-400" />
                            <span>{COMPANY_CONFIG.workingHours}</span>
                        </span>
                    </div>

                    <div className="flex items-center gap-4 text-[11px]">
                        {cityStateLabel && (
                            <span className="text-slate-400 hidden lg:inline">
                                Direct Industrial Manufacturer &bull; {cityStateLabel}
                            </span>
                        )}
                        <a
                            href="#contact"
                            onClick={(e) => scrollToSection(e, 'contact')}
                            className="text-amber-400 font-bold hover:underline flex items-center gap-1"
                        >
                            <span>Quick Enquiry</span>
                            <ArrowRight size={12} />
                        </a>
                    </div>
                </div>
            </div>

            {/* Main Sticky Header */}
            <header
                className={`sticky top-0 z-40 w-full transition-all duration-300 ${
                    isHeaderScrolled
                        ? 'bg-white/95 backdrop-blur-md shadow-md border-b border-slate-200 py-3'
                        : 'bg-white border-b border-slate-200/90 py-4'
                }`}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
                    {/* Brand Logo & Company Title */}
                    <a href="#" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-[#0f172a] to-[#1e293b] border border-slate-700 p-1 flex items-center justify-center shadow-xs shrink-0 text-amber-400 group-hover:scale-105 transition-transform overflow-hidden">
                            {companyLogoUrl ? (
                                <img
                                    src={companyLogoUrl}
                                    alt={companyName || 'Company Logo'}
                                    onError={() => setLogoError(true)}
                                    className="w-full h-full object-contain rounded-lg"
                                />
                            ) : (
                                <Package size={24} className="stroke-[2.2]" />
                            )}
                        </div>
                        <div className="flex flex-col">
                            {isLoadingCompany ? (
                                <span className="h-5 w-44 bg-slate-200 rounded animate-pulse mb-1" />
                            ) : companyName ? (
                                <span className="text-base sm:text-lg font-black tracking-tight text-slate-950 leading-tight">
                                    {companyName}
                                </span>
                            ) : null}
                            <span className="text-[11px] text-slate-500 font-semibold tracking-wide">
                                Manufacturer of PP Woven Sacks &amp; Poly Packaging
                            </span>
                        </div>
                    </a>

                    {/* Desktop Navigation Links */}
                    <nav className="hidden lg:flex items-center gap-6 xl:gap-7 text-xs xl:text-sm font-bold text-slate-700">
                        <a href="#about" onClick={(e) => scrollToSection(e, 'about')} className="hover:text-amber-600 transition-colors">
                            About
                        </a>
                        <a href="#products" onClick={(e) => scrollToSection(e, 'products')} className="hover:text-amber-600 transition-colors">
                            Products
                        </a>
                        <a href="#process" onClick={(e) => scrollToSection(e, 'process')} className="hover:text-amber-600 transition-colors">
                            Process
                        </a>
                        <a href="#why-us" onClick={(e) => scrollToSection(e, 'why-us')} className="hover:text-amber-600 transition-colors">
                            Why Us
                        </a>
                        <a href="#industries" onClick={(e) => scrollToSection(e, 'industries')} className="hover:text-amber-600 transition-colors">
                            Industries
                        </a>
                        <a href="#quality" onClick={(e) => scrollToSection(e, 'quality')} className="hover:text-amber-600 transition-colors">
                            Quality
                        </a>
                        <a href="#faq" onClick={(e) => scrollToSection(e, 'faq')} className="hover:text-amber-600 transition-colors">
                            FAQ
                        </a>
                        <a href="#contact" onClick={(e) => scrollToSection(e, 'contact')} className="hover:text-amber-600 transition-colors">
                            Contact
                        </a>
                    </nav>

                    {/* Right Header CTAs */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Client Login Outline Button (Direct link to /login as required) */}
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 shadow-2xs transition-all cursor-pointer"
                            title="Enterprise Portal & Client Log-in"
                        >
                            <Lock size={13} className="text-amber-600" />
                            <span>Client Login</span>
                        </Link>

                        {/* Primary Amber Get A Quote CTA */}
                        <button
                            type="button"
                            onClick={() => handleOpenQuoteModal()}
                            className="hidden sm:inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-black text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 transition-all shadow-sm shadow-amber-500/25 hover:shadow-md cursor-pointer"
                        >
                            <span>Get A Quote</span>
                            <ArrowRight size={14} />
                        </button>

                        {/* Mobile Menu Toggle Button */}
                        <button
                            type="button"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="p-2 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors lg:hidden cursor-pointer"
                            aria-label="Toggle navigation"
                        >
                            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Dropdown Menu */}
                {isMobileMenuOpen && (
                    <div className="lg:hidden border-b border-slate-200 bg-white px-4 pt-3 pb-5 space-y-2.5 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 pb-1 border-b border-slate-100">
                            Quick Sections
                        </div>
                        <a href="#about" onClick={(e) => scrollToSection(e, 'about')} className="block px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50">About Company</a>
                        <a href="#products" onClick={(e) => scrollToSection(e, 'products')} className="block px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50">Packaging Products</a>
                        <a href="#process" onClick={(e) => scrollToSection(e, 'process')} className="block px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50">Manufacturing Process</a>
                        <a href="#why-us" onClick={(e) => scrollToSection(e, 'why-us')} className="block px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50">Why Choose Us</a>
                        <a href="#industries" onClick={(e) => scrollToSection(e, 'industries')} className="block px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50">Industries Served</a>
                        <a href="#quality" onClick={(e) => scrollToSection(e, 'quality')} className="block px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50">Quality Checks</a>
                        <a href="#faq" onClick={(e) => scrollToSection(e, 'faq')} className="block px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50">Frequently Asked Questions</a>
                        <a href="#contact" onClick={(e) => scrollToSection(e, 'contact')} className="block px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50">Contact &amp; Enquiry</a>

                        <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    handleOpenQuoteModal();
                                }}
                                className="w-full py-2.5 rounded-lg text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-500 text-center shadow-xs"
                            >
                                Get Instant Quote
                            </button>
                            <Link
                                to="/login"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="w-full py-2.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 text-center flex items-center justify-center gap-1.5"
                            >
                                <Lock size={13} className="text-amber-600" />
                                <span>Client / Staff Login</span>
                            </Link>
                        </div>
                    </div>
                )}
            </header>

            {/* ================================================================= */}
            {/* 2. HERO SECTION WITH WOVEN PATTERN & PRODUCT SHOWCASE             */}
            {/* ================================================================= */}
            <section className="relative z-10 bg-gradient-to-br from-[#0a1128] via-[#101b3b] to-[#0a1128] text-white pt-14 pb-20 sm:pt-18 sm:pb-24 lg:pt-22 lg:pb-30 overflow-hidden">
                {/* Subtle Woven Fabric Pattern SVG Overlay */}
                <div
                    className="absolute inset-0 opacity-[0.04] pointer-events-none"
                    style={{
                        backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px), radial-gradient(#f59e0b 1px, transparent 1px)`,
                        backgroundSize: '24px 24px',
                        backgroundPosition: '0 0, 12px 12px'
                    }}
                />

                {/* Soft ambient gradient lights */}
                <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
                        {/* Hero Left Column: Headline & Action CTAs */}
                        <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                            {/* Industry Badge */}
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold tracking-wide uppercase shadow-sm">
                                <Sparkles size={14} className="text-amber-400 animate-pulse" />
                                <span>Direct Bulk Packaging Manufacturer</span>
                            </div>

                            {/* Headline */}
                            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-5xl font-black tracking-tight leading-[1.15] text-white">
                                {COMPANY_CONFIG.tagline.split('.')[0]}.{' '}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400">
                                    {COMPANY_CONFIG.tagline.split('.')[1]}.
                                </span>{' '}
                                {COMPANY_CONFIG.tagline.split('.')[2]}.
                            </h1>

                            {/* Subtitle */}
                            <p className="text-sm sm:text-base lg:text-lg text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
                                {COMPANY_CONFIG.subTagline}
                            </p>

                            {/* CTAs */}
                            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4">
                                <button
                                    type="button"
                                    onClick={() => handleOpenQuoteModal()}
                                    className="w-full sm:w-auto px-8 py-4 rounded-xl text-sm sm:text-base font-black text-slate-950 bg-gradient-to-r from-amber-400 via-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 transition-all shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/35 flex items-center justify-center gap-2 cursor-pointer group"
                                >
                                    <span>Get A Factory Quote</span>
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                                <a
                                    href="#products"
                                    onClick={(e) => scrollToSection(e, 'products')}
                                    className="w-full sm:w-auto px-8 py-4 rounded-xl text-sm sm:text-base font-bold text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer hover:border-slate-500"
                                >
                                    <Boxes size={18} className="text-amber-400" />
                                    <span>Explore Products</span>
                                </a>
                            </div>

                            {/* Trust Row */}
                            <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/50 border border-slate-800">
                                    <CheckCircle2 size={16} className="text-amber-400 shrink-0" />
                                    <span className="text-[11px] font-bold text-slate-200">Custom Size &amp; GSM</span>
                                </div>
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/50 border border-slate-800">
                                    <CheckCircle2 size={16} className="text-amber-400 shrink-0" />
                                    <span className="text-[11px] font-bold text-slate-200">Laminated &amp; BOPP</span>
                                </div>
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/50 border border-slate-800">
                                    <CheckCircle2 size={16} className="text-amber-400 shrink-0" />
                                    <span className="text-[11px] font-bold text-slate-200">Bulk Commercial Lot</span>
                                </div>
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/50 border border-slate-800">
                                    <CheckCircle2 size={16} className="text-amber-400 shrink-0" />
                                    <span className="text-[11px] font-bold text-slate-200">Pan-India Dispatches</span>
                                </div>
                            </div>
                        </div>

                        {/* Hero Right Column: CSS/SVG Bag Packaging Showcase */}
                        <div className="lg:col-span-5">
                            <div className="relative rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800 p-6 sm:p-8 shadow-2xl backdrop-blur-sm space-y-5">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                                            Active Production Line
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                                        Surat &bull; Vapi Plant
                                    </span>
                                </div>

                                {/* Bag Showcase Cards */}
                                <div className="space-y-3">
                                    <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between gap-3 hover:border-amber-400/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                                                <Package size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-white">50 Kg Flour &amp; Grain Sack</h4>
                                                <p className="text-[10px] text-slate-400">Extrusion Laminated &bull; 75 GSM &bull; Food Grade</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                                            Ready to Ship
                                        </span>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between gap-3 hover:border-amber-400/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-blue-400/10 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
                                                <ShieldCheck size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-white">25 Kg Polymer &amp; Chemical Bag</h4>
                                                <p className="text-[10px] text-slate-400">With Inside LDPE Liner &bull; 100% Moisture Proof</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                                            Custom Size
                                        </span>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between gap-3 hover:border-amber-400/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-purple-400/10 border border-purple-400/30 flex items-center justify-center text-purple-400 shrink-0">
                                                <Sparkles size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-white">BOPP High-Gloss Reverse Print</h4>
                                                <p className="text-[10px] text-slate-400">Up to 8 Colors Photographic Retail Packaging</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                                            High Visual
                                        </span>
                                    </div>
                                </div>

                                <div className="pt-2 text-center">
                                    <button
                                        type="button"
                                        onClick={() => handleOpenQuoteModal()}
                                        className="text-xs font-bold text-amber-400 hover:text-amber-300 underline flex items-center justify-center gap-1 mx-auto"
                                    >
                                        <span>Click to Inquire for Custom Capacity / Size</span>
                                        <ArrowRight size={13} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================= */}
            {/* 3. NUMBERS STRIP WITH COUNT-UP (Hides empty values)               */}
            {/* ================================================================= */}
            <section className="relative z-20 -mt-10 sm:-mt-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-8 shadow-xl grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                    {STATS_CONFIG.filter((s) => s.value !== null && s.value !== '' && s.value !== undefined).map((stat) => (
                        <div key={stat.id} className="pt-4 lg:pt-0 lg:px-4 text-center lg:text-left space-y-1">
                            <div className="text-2xl sm:text-3xl lg:text-4xl text-slate-900 font-black">
                                <CountUpNumber end={stat.value} suffix={stat.suffix} />
                            </div>
                            <h3 className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">
                                {stat.label}
                            </h3>
                            <p className="text-[11px] text-slate-500 leading-tight">
                                {stat.description}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ================================================================= */}
            {/* 4. ABOUT / PROCESS TIMELINE (Real ERP pipeline)                   */}
            {/* ================================================================= */}
            <section id="about" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
                {/* About Story & Facts Strip */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    <div className="lg:col-span-6 space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold tracking-wide uppercase">
                            <Factory size={13} className="text-amber-600" />
                            <span>One-Stop Poly Packaging Manufacturer</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                            Engineered for Strength. Customized for Your Product.
                        </h2>
                        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                            {companyName || 'We are'} {companyName ? 'is ' : ''}a premier manufacturer and bulk supplier of high-tenacity polypropylene (PP) woven sacks, laminated packaging bags, BOPP multi-color bags, and custom industrial liners.
                        </p>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            Operating integrated production lines with high-speed tape extrusion, modern circular loom weaving, in-house extrusion coating, and flexographic printing facilities, we serve agricultural grain millers, chemical producers, fertilizer plants, and cement manufacturers nationwide.
                        </p>

                        <div className="pt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-700">
                            {isLoadingCompany ? (
                                <span className="h-8 w-44 rounded-lg bg-slate-200 animate-pulse inline-block" />
                            ) : companyGstin ? (
                                <span className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">GST: {companyGstin}</span>
                            ) : null}
                            <span className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">Established: {COMPANY_CONFIG.yearEstablished}</span>
                            <span className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">Direct Factory Billing</span>
                        </div>
                    </div>

                    <div className="lg:col-span-6 bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-xl space-y-4">
                        <span className="text-xs font-mono font-bold uppercase text-amber-400 tracking-wider">
                            Integrated Quality Infrastructure
                        </span>
                        <h3 className="text-lg sm:text-xl font-black text-white">
                            Zero Compromise on Burst Strength &amp; Seepage Prevention
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                            Unlike repackagers or intermediaries, we control yarn tenacity, mesh count, and micron coating thickness directly on our shop floor. Every bag delivered is tested against rigorous drop and tensile benchmarks.
                        </p>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                                <span className="block text-base sm:text-lg font-black text-amber-400">100% Virgin</span>
                                <span className="text-[11px] text-slate-300">PP Resin Formulation</span>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                                <span className="block text-base sm:text-lg font-black text-amber-400">Anti-Seepage</span>
                                <span className="text-[11px] text-slate-300">LDPE/PP Micron Coating</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Vertical Process Timeline matching ERP Workflow */}
                <div id="process" className="space-y-8 pt-4">
                    <div className="text-center max-w-2xl mx-auto space-y-2">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-amber-600">
                            The Manufacturing Journey
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            From Virgin Poly Granule to Fully Compacted Bales
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-600">
                            Our shop floor follows a tightly audited manufacturing pipeline ensuring strict consistency across every batch.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {PROCESS_STEPS.map((step) => (
                            <div
                                key={step.step}
                                className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group space-y-3"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-2xl font-black text-amber-500/80 group-hover:text-amber-500 transition-colors">
                                        {step.step}
                                    </span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                        Stage {step.step}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                                        {step.title}
                                    </h3>
                                    <h4 className="text-[11px] font-semibold text-amber-600 mt-0.5">
                                        {step.subtitle}
                                    </h4>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    {step.description}
                                </p>
                                <div className="pt-2 flex flex-wrap gap-1.5">
                                    {step.tags.map((t, idx) => (
                                        <span key={idx} className="text-[10px] font-medium px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-600">
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ================================================================= */}
            {/* 5. PRODUCTS SHOWCASE (Filterable + Real Specs + Get Quote)        */}
            {/* ================================================================= */}
            <section id="products" className="py-16 sm:py-24 bg-slate-100/60 border-y border-slate-200/80">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 space-y-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="space-y-2 max-w-2xl">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-600">
                                Product Showcase
                            </span>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                                Technical Specifications &amp; Bag Range
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-600">
                                Manufactured strictly to custom dimensions, GSM, and printing criteria. Select any product below to receive an instant factory quotation.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => handleOpenQuoteModal('Custom Size Bag')}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 shadow-xs shrink-0 cursor-pointer"
                        >
                            <Sparkles size={13} className="text-amber-500" />
                            <span>Request Custom Dimension Bag</span>
                        </button>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                        {PRODUCT_CATEGORIES.map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                    selectedCategory === cat
                                        ? 'bg-slate-900 text-white shadow-sm'
                                        : 'bg-white text-slate-700 hover:bg-slate-200/60 border border-slate-200'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Product Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                        {filteredProducts.map((p, idx) => (
                            <div
                                key={p.id}
                                className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between group space-y-3.5 h-full"
                            >
                                <div className="space-y-3 flex-1 flex flex-col">
                                    {/* Top Card Bar with Badge & Category */}
                                    <div className="flex items-center justify-between min-h-[26px]">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                            {p.category}
                                        </span>
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 whitespace-nowrap">
                                            {p.badge}
                                        </span>
                                    </div>

                                    {/* Product Illustration / Photo Slot with Capacity Pill (Clickable) */}
                                    <ProductImage
                                        productId={p.id}
                                        images={p.images}
                                        imageSrc={p.imageSrc}
                                        imageFit={p.imageFit}
                                        imageAlt={p.imageAlt}
                                        altText={p.imageAlt || p.name}
                                        capacity={p.capacity}
                                        loading={idx < 4 ? "eager" : "lazy"}
                                        onClick={() => handleOpenProductModal(p.id)}
                                    />

                                    {/* Title with uniform height (Clickable to view details) */}
                                    <h3
                                        onClick={() => handleOpenProductModal(p.id)}
                                        className="text-sm font-bold text-slate-900 leading-snug min-h-[2.5rem] flex items-center cursor-pointer hover:text-amber-600 transition-colors"
                                        title={`View details of ${p.name}`}
                                    >
                                        {p.name}
                                    </h3>

                                    {/* Spec List */}
                                    <div className="space-y-1.5 text-[11px] pt-2 border-t border-slate-100">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Weight Capacity:</span>
                                            <span className="font-mono font-bold text-slate-800">{p.capacity}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">GSM Density:</span>
                                            <span className="font-mono font-bold text-slate-800">{p.gsm}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Lamination:</span>
                                            <span className="font-semibold text-slate-800 text-right">{p.lamination}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Printing:</span>
                                            <span className="font-semibold text-slate-800 text-right">{p.printOption}</span>
                                        </div>
                                    </div>

                                    <p className="text-[11px] text-slate-600 italic leading-relaxed pt-1">
                                        Best for: {p.bestFor}
                                    </p>
                                </div>

                                {/* Get Quote Button */}
                                <div className="pt-3 border-t border-slate-100 mt-auto">
                                    <button
                                        type="button"
                                        onClick={() => handleOpenQuoteModal(p.name)}
                                        className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white font-black text-xs transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                                    >
                                        <span>Get Quote for This Bag</span>
                                        <ArrowRight size={13} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ================================================================= */}
            {/* 6. WHY CHOOSE US (6 Feature Cards)                                */}
            {/* ================================================================= */}
            <section id="why-us" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                <div className="text-center max-w-2xl mx-auto space-y-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-amber-600">
                        Competitive Manufacturer Edge
                    </span>
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                        Why Leading Brands Trust Our Packaging
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600">
                        From controlled polymer quality to dependable fleet logistics, our setup is designed for large-scale industrial buyers.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {WHY_CHOOSE_US.map((item, idx) => (
                        <div
                            key={idx}
                            className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs hover:shadow-md transition-all space-y-3 group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                                <DynamicIcon name={item.icon} size={22} className="stroke-[2.2]" />
                            </div>
                            <h3 className="text-base font-bold text-slate-900 leading-snug">
                                {item.title}
                            </h3>
                            <p className="text-xs text-slate-600 leading-relaxed font-normal">
                                {item.description}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ================================================================= */}
            {/* 7. INDUSTRIES WE SERVE (6 Sector Cards)                           */}
            {/* ================================================================= */}
            <section id="industries" className="py-16 sm:py-24 bg-gradient-to-br from-[#0c1427] to-[#141e38] text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                    <div className="text-center max-w-2xl mx-auto space-y-2">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                            Industrial Application Sectors
                        </span>
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
                            Supplying Core Industries Across India
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-300">
                            High-volume packaging engineered to withstand harsh transportation, heavy stacking, and extreme weather.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {INDUSTRIES_SERVED.map((ind, idx) => (
                            <div
                                key={idx}
                                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg hover:border-amber-400/60 transition-all space-y-3"
                            >
                                <div className="w-11 h-11 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center border border-slate-700">
                                    <DynamicIcon name={ind.icon} size={22} className="stroke-[2]" />
                                </div>
                                <h3 className="text-base font-bold text-white">
                                    {ind.name}
                                </h3>
                                <p className="text-xs text-slate-300 leading-relaxed font-normal">
                                    {ind.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ================================================================= */}
            {/* 8. QUALITY CONTROL & PROCESS PROMISE                              */}
            {/* ================================================================= */}
            <section id="quality" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                <div className="text-center max-w-2xl mx-auto space-y-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-amber-600">
                        Zero Defect Assurance
                    </span>
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                        Standardized In-House Quality Checks
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600">
                        Every bag lot is subjected to rigorous physical and chemical performance tests before authorization for dispatch.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {QUALITY_STANDARDS.map((q, idx) => (
                        <div
                            key={idx}
                            className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-2.5 hover:border-amber-400/80 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <ShieldCheck size={18} className="text-amber-500 shrink-0" />
                                <h3 className="text-sm font-bold text-slate-900">
                                    {q.title}
                                </h3>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                {q.description}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Optional Certificate Slots (Only renders if images are configured) */}
                {COMPANY_CONFIG.media.certifications && COMPANY_CONFIG.media.certifications.length > 0 && (
                    <div className="pt-6 border-t border-slate-200 text-center space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Verified Manufacturing Accreditations
                        </span>
                        <div className="flex items-center justify-center gap-6 flex-wrap">
                            {COMPANY_CONFIG.media.certifications.map((img, i) => (
                                <img key={i} src={img} alt="Certification" className="h-12 object-contain opacity-80 hover:opacity-100" />
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* ================================================================= */}
            {/* 9. HOW ORDERING WORKS (4 Step Pipeline)                           */}
            {/* ================================================================= */}
            <section className="py-16 sm:py-20 bg-slate-50 border-y border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
                    <div className="text-center max-w-2xl mx-auto space-y-2">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-amber-600">
                            Simple &amp; Transparent
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            How Bulk Ordering Works
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {ORDERING_STEPS.map((s) => (
                            <div key={s.number} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 shadow-xs relative">
                                <span className="font-mono text-3xl font-black text-amber-500">
                                    {s.number}
                                </span>
                                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                                    {s.title}
                                </h3>
                                <p className="text-xs text-slate-600 leading-relaxed font-normal">
                                    {s.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ================================================================= */}
            {/* 10. FAQ ACCORDION (With JSON-LD Schema)                            */}
            {/* ================================================================= */}
            <section id="faq" className="py-16 sm:py-24 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
                <div className="text-center space-y-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-amber-600">
                        Help &amp; Buyer FAQs
                    </span>
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                        Frequently Asked Questions
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
                        Quick answers regarding minimum order quantities, customization options, printing, and delivery timelines.
                    </p>
                </div>

                <div className="space-y-3">
                    {FAQS.map((faq, idx) => {
                        const isOpen = openFaqIndex === idx;
                        return (
                            <div
                                key={idx}
                                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs transition-all"
                            >
                                <button
                                    type="button"
                                    onClick={() => setOpenFaqIndex(isOpen ? -1 : idx)}
                                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-slate-900 hover:text-amber-600 transition-colors cursor-pointer"
                                >
                                    <span className="leading-snug">{faq.question}</span>
                                    {isOpen ? (
                                        <ChevronUp size={18} className="text-amber-600 shrink-0" />
                                    ) : (
                                        <ChevronDown size={18} className="text-slate-400 shrink-0" />
                                    )}
                                </button>
                                {isOpen && (
                                    <div className="px-4 pb-5 sm:px-5 sm:pb-6 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                                        {faq.answer}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ================================================================= */}
            {/* 11. CONTACT SALES SECTION (Split Layout + Live CRM Form)          */}
            {/* ================================================================= */}
            <section id="contact" className="py-16 sm:py-24 bg-gradient-to-br from-slate-900 via-slate-900 to-[#0a1128] text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                    <div className="text-center max-w-2xl mx-auto space-y-2">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                            Direct Factory Enquiry
                        </span>
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
                            Request Your Customized Quotation
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-300">
                            Fill in your bag requirements below. Your details are securely submitted directly to our commercial sales office for fast technical review.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* Left Column: Factory Coordinates & Contact Details */}
                        <div className="lg:col-span-5 space-y-6">
                            <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 sm:p-8 space-y-6">
                                <div>
                                    <h3 className="text-lg font-black text-white">
                                        Commercial Sales Office
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Direct point of contact for new enquiries, commercial tenders, and custom manufacturing contracts.
                                    </p>
                                </div>

                                <div className="space-y-4 text-xs">
                                    {isLoadingCompany ? (
                                        <div className="space-y-3">
                                            <div className="h-10 bg-slate-700/60 rounded-lg animate-pulse" />
                                            <div className="h-8 bg-slate-700/60 rounded-lg animate-pulse w-3/4" />
                                            <div className="h-8 bg-slate-700/60 rounded-lg animate-pulse w-2/3" />
                                        </div>
                                    ) : (
                                        <>
                                            {fullAddress && (
                                                <div className="flex items-start gap-3">
                                                    <MapPin size={18} className="text-amber-400 shrink-0 mt-0.5" />
                                                    <div>
                                                        <span className="block font-bold text-white">Factory &amp; Works</span>
                                                        <span className="text-slate-300 leading-relaxed block mt-0.5">
                                                            {fullAddress}
                                                        </span>
                                                        {directionsUrl && (
                                                            <a
                                                                href={directionsUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-bold mt-1 underline"
                                                            >
                                                                <span>Get Directions</span>
                                                                <ExternalLink size={11} />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {formattedPhone && (
                                                <div className="flex items-start gap-3">
                                                    <Phone size={18} className="text-amber-400 shrink-0 mt-0.5" />
                                                    <div>
                                                        <span className="block font-bold text-white">Direct Phone</span>
                                                        <a href={`tel:${formattedPhone.tel}`} className="text-amber-300 hover:underline font-mono">
                                                            {formattedPhone.display}
                                                        </a>
                                                    </div>
                                                </div>
                                            )}

                                            {companyEmail && (
                                                <div className="flex items-start gap-3">
                                                    <Mail size={18} className="text-amber-400 shrink-0 mt-0.5" />
                                                    <div>
                                                        <span className="block font-bold text-white">Sales Inquiries</span>
                                                        <a href={`mailto:${companyEmail}`} className="text-amber-300 hover:underline">
                                                            {companyEmail}
                                                        </a>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <div className="flex items-start gap-3">
                                        <Clock size={18} className="text-amber-400 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="block font-bold text-white">Operating Hours</span>
                                            <span className="text-slate-300">{COMPANY_CONFIG.workingHours}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* WhatsApp Instant Chat CTA */}
                                {formattedPhone && (
                                    <div className="pt-2">
                                        <a
                                            href={`https://wa.me/${formattedPhone.whatsapp}?text=${encodeURIComponent('Hello, I would like to inquire about PP woven sacks quotation.')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                                        >
                                            <MessageSquare size={16} />
                                            <span>Message Sales Desk on WhatsApp</span>
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Plant / Google Map Placeholder Card */}
                            <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-4 text-center space-y-2">
                                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                                    Strategic Manufacturing Location
                                </span>
                                <div className="h-28 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-slate-500 text-xs px-3">
                                    <MapPin size={24} className="text-amber-500 mb-1" />
                                    <span className="font-bold text-slate-300">{cityStateLabel || 'Industrial Manufacturing Works'}</span>
                                    {directionsUrl ? (
                                        <a
                                            href={directionsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] text-amber-400 hover:underline mt-0.5 inline-flex items-center gap-1"
                                        >
                                            <span>Open Location on Google Maps</span>
                                            <ExternalLink size={10} />
                                        </a>
                                    ) : (
                                        <span className="text-[10px] text-slate-500">Fast Pan-India Logistics &amp; Dispatch</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Contact Sales Form (Feeds directly to CRM) */}
                        <div className="lg:col-span-7 bg-white text-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-200">
                            <div className="mb-4 pb-3 border-b border-slate-100">
                                <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                                    Contact Commercial Sales
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Submissions go directly into our Customer Relationship Management system.
                                </p>
                            </div>

                            <ContactSalesForm />
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================= */}
            {/* 12. FOOTER (Rich Brand Footer + Client Login)                     */}
            {/* ================================================================= */}
            <footer className="bg-[#070b14] text-slate-400 text-xs border-t border-slate-800 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8">
                        {/* Col 1: Brand Info */}
                        <div className="lg:col-span-4 space-y-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold overflow-hidden">
                                    {companyLogoUrl ? (
                                        <img
                                            src={companyLogoUrl}
                                            alt={companyName || 'Company Logo'}
                                            onError={() => setLogoError(true)}
                                            className="w-full h-full object-contain bg-white"
                                        />
                                    ) : (
                                        <Package size={18} />
                                    )}
                                </div>
                                {isLoadingCompany ? (
                                    <span className="h-5 w-44 bg-slate-800 rounded animate-pulse inline-block" />
                                ) : companyName ? (
                                    <span className="text-base font-black text-white">
                                        {companyName}
                                    </span>
                                ) : null}
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                {COMPANY_CONFIG.subTagline}
                            </p>
                            {companyGstin && (
                                <p className="text-[11px] text-slate-500">
                                    GSTIN: <span className="font-mono text-slate-300">{companyGstin}</span>
                                </p>
                            )}
                        </div>

                        {/* Col 2: Quick Links */}
                        <div className="lg:col-span-2 space-y-2.5">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                                Navigation
                            </h4>
                            <ul className="space-y-1.5 text-xs">
                                <li><a href="#about" onClick={(e) => scrollToSection(e, 'about')} className="hover:text-amber-400 transition-colors">About Us</a></li>
                                <li><a href="#products" onClick={(e) => scrollToSection(e, 'products')} className="hover:text-amber-400 transition-colors">Packaging Products</a></li>
                                <li><a href="#process" onClick={(e) => scrollToSection(e, 'process')} className="hover:text-amber-400 transition-colors">Production Process</a></li>
                                <li><a href="#quality" onClick={(e) => scrollToSection(e, 'quality')} className="hover:text-amber-400 transition-colors">Quality Control</a></li>
                                <li><a href="#faq" onClick={(e) => scrollToSection(e, 'faq')} className="hover:text-amber-400 transition-colors">Buyer FAQ</a></li>
                                <li><a href="#contact" onClick={(e) => scrollToSection(e, 'contact')} className="hover:text-amber-400 transition-colors">Contact Sales</a></li>
                            </ul>
                        </div>

                        {/* Col 3: Product Highlights */}
                        <div className="lg:col-span-3 space-y-2.5">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                                Packaging Solutions
                            </h4>
                            <ul className="space-y-1.5 text-xs text-slate-400">
                                <li>PP Woven Sacks (25 / 50 Kg)</li>
                                <li>Atta &amp; Flour Laminated Bags</li>
                                <li>Chemical &amp; Polymer Liner Sacks</li>
                                <li>BOPP Multi-Color Retail Bags</li>
                                <li>Block Bottom Valve Sacks</li>
                                <li>Continuous PP Woven Fabric Rolls</li>
                            </ul>
                        </div>

                        {/* Col 4: Contact & ERP Client Portal Link */}
                        <div className="lg:col-span-3 space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                                Plant &amp; Dispatch Office
                            </h4>
                            {fullAddress && (
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    {fullAddress}
                                </p>
                            )}
                            {formattedPhone && (
                                <p className="text-xs text-slate-300 font-mono">
                                    Tel: <a href={`tel:${formattedPhone.tel}`} className="hover:text-amber-400 transition-colors">{formattedPhone.display}</a>
                                </p>
                            )}
                            {companyEmail && (
                                <p className="text-xs text-slate-300">
                                    Email: <a href={`mailto:${companyEmail}`} className="hover:text-amber-400 transition-colors">{companyEmail}</a>
                                </p>
                            )}

                            <div className="pt-2">
                                <Link
                                    to="/login"
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 underline"
                                >
                                    <Lock size={12} />
                                    <span>Authorized Staff &amp; Client ERP Portal</span>
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Copyright Strip */}
                    <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-[11px]">
                        <p>© {new Date().getFullYear()}{companyName ? ` ${companyName}.` : ''} All Rights Reserved.  Designed &amp; Developed by <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500 inline-block" /> Requin Solutions Pvt. Ltd</p>
                        <div className="flex items-center gap-4">
                            <span>Industrial Packaging Manufacturer</span>
                            <span>&bull;</span>
                            <a href="#contact" onClick={(e) => scrollToSection(e, 'contact')} className="hover:text-amber-400 transition-colors">
                                Inquire Online
                            </a>
                        </div>
                    </div>
                </div>
            </footer>

            {/* ================================================================= */}
            {/* FLOATING ACTION BUTTONS (WhatsApp & Back-to-Top)                  */}
            {/* ================================================================= */}
            {/* Floating WhatsApp Button */}
            {formattedPhone && (
                <a
                    href={`https://wa.me/${formattedPhone.whatsapp}?text=${encodeURIComponent('Hello, I want to inquire about custom PP woven bags.')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-40 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                    title="Chat with Sales on WhatsApp"
                    aria-label="WhatsApp Chat"
                >
                    <MessageSquare size={22} />
                </a>
            )}

            {/* Floating Back to Top Button */}
            {showBackToTop && (
                <button
                    type="button"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="fixed bottom-18 right-4 sm:bottom-20 sm:right-6 z-40 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-900/90 hover:bg-slate-900 text-white flex items-center justify-center shadow-md border border-slate-700 transition-all hover:scale-105 cursor-pointer"
                    title="Back to Top"
                    aria-label="Back to Top"
                >
                    <ArrowUp size={15} />
                </button>
            )}

            {/* ================================================================= */}
            {/* POPUP MODAL: "GET A QUOTE" / "INQUIRE NOW"                        */}
            {/* ================================================================= */}
            {quoteModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl p-5 sm:p-7 relative max-h-[92vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] my-auto space-y-4">
                        <div className="flex items-start justify-between pb-3 border-b border-slate-200">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                                    Request a Factory Quote
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Direct manufacturer pricing for PP woven sacks &amp; packaging.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setQuoteModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                                aria-label="Close modal"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <ContactSalesForm
                            initialProduct={quoteModalProduct}
                            isModal={true}
                            onSuccessCallback={() => {
                                // Keep modal open to show reference number
                            }}
                        />
                    </div>
                </div>
            )}

            {/* ================================================================= */}
            {/* POPUP MODAL: PRODUCT DETAIL & ZOOM GALLERY                        */}
            {/* ================================================================= */}
            <ProductDetailModal
                isOpen={Boolean(selectedProductModalId)}
                productId={selectedProductModalId}
                onClose={handleCloseProductModal}
                onOpenQuoteModal={handleOpenQuoteModal}
                onSelectProduct={(newId) => handleOpenProductModal(newId)}
                products={PRODUCTS_LIST}
                companyConfig={{
                    ...COMPANY_CONFIG,
                    legalName: companyName,
                    phone: formattedPhone?.display || '',
                    phoneRaw: formattedPhone?.tel || '',
                    whatsappRaw: formattedPhone?.whatsapp || '',
                    email: companyEmail
                }}
            />
        </div>
    );
}
