import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
    Factory,
    Mail,
    Lock,
    Eye,
    EyeOff,
    Heart,
    ArrowRight,
    Loader2,
    ShieldAlert,
    ShieldCheck,
    CheckCircle2,
    Package,
    ShoppingCart,
    Truck,
    Building2,
    Sparkles,
    Cpu
} from 'lucide-react';
import { getFirstPermittedRoute } from '../utils/permissionUtils';

export default function LoginPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const login = useAuthStore((state) => state.login);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [generalError, setGeneralError] = useState('');
    const [suspensionError, setSuspensionError] = useState(
        searchParams.get('suspended') === 'true'
            ? "Your organization's account has been suspended. Please contact system support."
            : ''
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim() || !password.trim()) return;

        setSuspensionError('');
        setGeneralError('');
        setIsSubmitting(true);
        const result = await login(email.trim(), password);
        setIsSubmitting(false);

        if (result.success) {
            const userObj = result.user || useAuthStore.getState().user;
            const targetRoute = getFirstPermittedRoute(userObj);
            if (targetRoute === '/403') {
                navigate('/403', { state: { message: 'No modules assigned — contact your administrator.' } });
            } else {
                navigate(targetRoute);
            }
        } else if (
            result.error &&
            (result.error.toLowerCase().includes('suspended') || result.error.toLowerCase().includes('account is suspended'))
        ) {
            setSuspensionError("Your organization's account has been suspended. Please contact system support.");
        } else if (result.error) {
            setGeneralError(result.error);
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 font-sans selection:bg-amber-500/25 selection:text-amber-900 overflow-x-hidden">
            {/* ================= LEFT SHOWCASE PANEL (DESKTOP) ================= */}
            <div className="hidden lg:flex lg:w-[54%] xl:w-[56%] relative bg-gradient-to-br from-[#070d1e] via-[#0b132b] to-[#151e36] text-white flex-col justify-between p-10 xl:p-14 overflow-hidden border-r border-slate-800">
                {/* CSS Industrial Grid Pattern */}
                <div
                    className="absolute inset-0 pointer-events-none opacity-40"
                    style={{
                        backgroundImage: 'radial-gradient(rgba(245, 158, 11, 0.15) 1px, transparent 1px)',
                        backgroundSize: '28px 28px'
                    }}
                />

                {/* Ambient Soft Glow Orbs */}
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-amber-500/15 rounded-full blur-[140px] pointer-events-none" />
                <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-600/10 rounded-full blur-[130px] pointer-events-none" />

                {/* Top: Brand Header */}
                <div className="relative z-10 flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center">
                        <div className="w-full h-full bg-[#0d162d] rounded-[10px] flex items-center justify-center text-amber-400">
                            <Factory size={24} className="stroke-[2.2]" />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-extrabold tracking-tight text-white">PP Poly & Paper Products</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-md font-bold tracking-wider uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                ERP
                            </span>
                        </div>
                        <p className="text-[11px] font-medium tracking-wide text-slate-400 mt-0.5">
                            Multi-Tenant Manufacturing Platform
                        </p>
                    </div>
                </div>

                {/* Middle: Hero & Feature Grid */}
                <div className="relative z-10 my-auto py-8 max-w-xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-amber-300 text-xs font-medium mb-5 backdrop-blur-md">
                        <Sparkles size={14} className="text-amber-400" />
                        <span>Next-Gen Polymer & Woven Sack ERP</span>
                    </div>

                    <h1 className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-[1.2]">
                        Run your entire plant <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500">
                            from one unified platform.
                        </span>
                    </h1>

                    <p className="mt-4 text-slate-300 text-sm xl:text-base leading-relaxed max-w-lg">
                        End-to-end manufacturing execution, batch traceability, quality compliance, and financial tracking engineered for industrial packaging plants.
                    </p>

                    {/* 6 Feature Glass Cards */}
                    <div className="grid grid-cols-2 gap-3.5 mt-8">
                        {/* 1. Production & Looms */}
                        <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-sm hover:bg-white/[0.07] transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 mb-2">
                                <Cpu size={16} />
                            </div>
                            <h3 className="text-xs font-bold text-white tracking-wide">Production & Looms</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                Real-time work orders, loom tracking & scrap logs
                            </p>
                        </div>

                        {/* 2. Quality Control & GSM */}
                        <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-sm hover:bg-white/[0.07] transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 mb-2">
                                <CheckCircle2 size={16} />
                            </div>
                            <h3 className="text-xs font-bold text-white tracking-wide">Quality & GSM Control</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                Tensile, burst, drop tests & roll inspection
                            </p>
                        </div>

                        {/* 3. Inventory & Batches */}
                        <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-sm hover:bg-white/[0.07] transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400 mb-2">
                                <Package size={16} />
                            </div>
                            <h3 className="text-xs font-bold text-white tracking-wide">Inventory & Batches</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                Granules, masterbatch, rolls & FG stock
                            </p>
                        </div>

                        {/* 4. Sales & Receivables */}
                        <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-sm hover:bg-white/[0.07] transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-400 mb-2">
                                <ShoppingCart size={16} />
                            </div>
                            <h3 className="text-xs font-bold text-white tracking-wide">Sales & Receivables</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                Tax invoices, AR aging & customer balance
                            </p>
                        </div>

                        {/* 5. Purchase & Payables */}
                        <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-sm hover:bg-white/[0.07] transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/25 flex items-center justify-center text-orange-400 mb-2">
                                <Truck size={16} />
                            </div>
                            <h3 className="text-xs font-bold text-white tracking-wide">Purchase & GRN</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                PO matching, supplier AP & weighbridge records
                            </p>
                        </div>

                        {/* 6. Multi-Plant Architecture */}
                        <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-sm hover:bg-white/[0.07] transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-cyan-400 mb-2">
                                <Building2 size={16} />
                            </div>
                            <h3 className="text-xs font-bold text-white tracking-wide">Multi-Plant Architecture</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                Multi-facility segregation & role permissions
                            </p>
                        </div>
                    </div>
                </div>

                {/* Bottom: Reassurance & Version */}
                <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-emerald-400" />
                        <span className="font-medium text-slate-300">ISO 9001 & Enterprise Security Standards</span>
                    </div>
                    <span className="text-[11px] text-slate-500">v2.4 Production</span>
                </div>
            </div>

            {/* ================= RIGHT FORM PANEL (LOGIN ACTION) ================= */}
            <div className="w-full lg:w-[46%] xl:w-[44%] min-h-screen flex flex-col justify-between bg-white px-6 py-8 sm:px-12 md:px-16 lg:px-12 xl:px-16 relative z-10">
                {/* Mobile / Tablet Brand Header */}
                <div className="lg:hidden flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20">
                        <Factory size={22} className="stroke-[2.2]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-extrabold text-slate-900 tracking-tight">PolySack</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-amber-100 text-amber-800">
                                ERP
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500">Manufacturing Portal</p>
                    </div>
                </div>

                {/* Center Form Container */}
                <div className="max-w-md w-full mx-auto my-auto py-4">
                    <div className="mb-8">
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                            Welcome back
                        </h2>
                        <p className="text-sm text-slate-500 mt-1.5">
                            Sign in to access your manufacturing workspace.
                        </p>
                    </div>

                    {/* Suspension Error Alert */}
                    {suspensionError && (
                        <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-xs font-sans animate-in fade-in duration-200">
                            <ShieldAlert size={18} className="text-rose-600 shrink-0 mt-0.5" />
                            <div className="leading-relaxed">
                                <span className="font-bold block text-rose-900 uppercase tracking-wider text-[10px]">
                                    Account Suspended
                                </span>
                                <span>{suspensionError}</span>
                            </div>
                        </div>
                    )}

                    {/* General Login Error Alert */}
                    {generalError && !suspensionError && (
                        <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-xs font-sans animate-in fade-in duration-200">
                            <ShieldAlert size={18} className="text-rose-600 shrink-0 mt-0.5" />
                            <div className="leading-relaxed">
                                <span className="font-bold block text-rose-900 uppercase tracking-wider text-[10px]">
                                    Authentication Failed
                                </span>
                                <span>{generalError}</span>
                            </div>
                        </div>
                    )}

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        {/* Email Field */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block" htmlFor="email">
                                Email Address
                            </label>
                            <div className="relative flex items-center">
                                <Mail className="absolute left-3.5 text-slate-400 pointer-events-none" size={18} />
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    autoFocus
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        if (generalError) setGeneralError('');
                                    }}
                                    className="w-full py-2.5 pl-10 pr-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 transition-all font-sans"
                                    placeholder="admin@polysack.com"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block" htmlFor="password">
                                Password
                            </label>
                            <div className="relative flex items-center">
                                <Lock className="absolute left-3.5 text-slate-400 pointer-events-none" size={18} />
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (generalError) setGeneralError('');
                                    }}
                                    className="w-full py-2.5 pl-10 pr-11 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 transition-all font-sans"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    className="absolute right-3 text-slate-400 hover:text-slate-600 focus:outline-none p-1 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Remember Me Checkbox */}
                        <div className="flex items-center justify-between pt-1">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded text-amber-500 border-slate-300 focus:ring-amber-500/30 accent-amber-500 cursor-pointer"
                                />
                                <span className="text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors">
                                    Remember me on this device
                                </span>
                            </label>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold rounded-xl text-sm transition-all duration-150 shadow-md shadow-amber-500/20 flex items-center justify-center gap-2.5 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed group mt-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="animate-spin text-slate-950" size={18} />
                                    <span>Signing in...</span>
                                </>
                            ) : (
                                <>
                                    <span>Sign In to Portal</span>
                                    <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Security Badge */}
                    <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
                        <ShieldCheck size={16} className="text-emerald-600" />
                        <span>Protected System • Authorized Personnel Only</span>
                    </div>
                </div>

                {/* Footer Copyright */}
                <footer className="mt-auto pt-6 text-center text-xs text-slate-400 space-y-1">
                    <p>© 2026 PP Poly & Paper Products. All Rights Reserved.</p>
                    <p className="text-[11px] text-slate-400">
                        Designed & Developed by{' '}
                        <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500 inline-block" />
                        <span className="font-semibold text-slate-600">Requin Solutions Pvt. Ltd</span>
                    </p>
                </footer>
            </div>
        </div>
    );
}
