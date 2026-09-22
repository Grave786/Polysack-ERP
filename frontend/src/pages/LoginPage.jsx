import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Mail, Lock, Factory, Loader2, ShieldAlert } from 'lucide-react';
import { getFirstPermittedRoute } from '../utils/permissionUtils';

export default function LoginPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const login = useAuthStore((state) => state.login);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [suspensionError, setSuspensionError] = useState(
        searchParams.get('suspended') === 'true'
            ? "Your organization's account has been suspended. Please contact system support."
            : ''
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim() || !password.trim()) return;

        setSuspensionError('');
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
        } else if (result.error && (result.error.toLowerCase().includes('suspended') || result.error.toLowerCase().includes('account is suspended'))) {
            setSuspensionError("Your organization's account has been suspended. Please contact system support.");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans relative selection:bg-[#f59e0b]/30 selection:text-[#b45309]">
            {/* Ambient soft glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-200/25 blur-[120px] rounded-full pointer-events-none" />

            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-xl space-y-6 relative z-10">
                <div className="text-center">
                    <div className="w-14 h-14 mx-auto mb-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center text-[#d97706] shadow-xs">
                        <Factory size={28} />
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                        PolySack ERP
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Multi-Tenant Manufacturing Platform
                    </p>
                </div>

                {suspensionError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs font-sans animate-in fade-in duration-200">
                        <ShieldAlert size={18} className="text-rose-600 shrink-0 mt-0.5" />
                        <div className="leading-relaxed">
                            <span className="font-bold block text-rose-900 uppercase tracking-wider text-[10px]">
                                Account Suspended
                            </span>
                            <span>{suspensionError}</span>
                        </div>
                    </div>
                )}

                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700" htmlFor="email">
                            Email Address
                        </label>
                        <div className="relative flex items-center">
                            <Mail className="absolute left-3.5 text-slate-400 pointer-events-none" size={18} />
                            <input
                                id="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full py-2.5 pl-10 pr-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 text-sm outline-none focus:border-[#f59e0b] focus:bg-white focus:ring-2 focus:ring-[#f59e0b]/20 transition-all font-sans"
                                placeholder="admin@polysack.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700" htmlFor="password">
                            Password
                        </label>
                        <div className="relative flex items-center">
                            <Lock className="absolute left-3.5 text-slate-400 pointer-events-none" size={18} />
                            <input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full py-2.5 pl-10 pr-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 text-sm outline-none focus:border-[#f59e0b] focus:bg-white focus:ring-2 focus:ring-[#f59e0b]/20 transition-all font-sans"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 px-4 bg-[#f59e0b] hover:bg-[#d97706] text-slate-950 font-bold rounded-lg text-sm transition-all duration-150 shadow-md shadow-[#f59e0b]/20 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer mt-2"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                <span>Signing in...</span>
                            </>
                        ) : (
                            'Sign In to Portal'
                        )}
                    </button>
                </form>

                <div className="pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
                    Protected System • Authorized Personnel Only
                </div>
            </div>
        </div>
    );
}
