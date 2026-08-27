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
        <div className="min-h-screen flex items-center justify-center bg-sidebar-bg p-6 font-sans">
            <div className="w-full max-w-md bg-sidebar-hover border border-sidebar-hover rounded-2xl p-8 shadow-2xl space-y-6">
                <div className="text-center">
                    <div className="w-14 h-14 mx-auto mb-4 bg-primary/15 border border-primary/30 rounded-xl flex items-center justify-center text-primary">
                        <Factory size={28} />
                    </div>
                    <h2 className="text-2xl font-extrabold text-sidebar-text-active tracking-tight">
                        PolySack ERP
                    </h2>
                    <p className="text-xs text-sidebar-text mt-1">
                        Multi-Tenant Manufacturing Platform
                    </p>
                </div>

                {suspensionError && (
                    <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-rose-300 text-xs font-sans animate-in fade-in duration-200">
                        <ShieldAlert size={18} className="text-rose-400 shrink-0 mt-0.5" />
                        <div className="leading-relaxed">
                            <span className="font-bold block text-rose-200 uppercase tracking-wider text-[10px]">
                                Account Suspended
                            </span>
                            <span>{suspensionError}</span>
                        </div>
                    </div>
                )}

                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-sidebar-text" htmlFor="email">
                            Email Address
                        </label>
                        <div className="relative flex items-center">
                            <Mail className="absolute left-3.5 text-sidebar-text pointer-events-none" size={18} />
                            <input
                                id="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full py-2.5 pl-10 pr-3 bg-sidebar-bg border border-sidebar-hover rounded-lg text-sidebar-text-active text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-sans"
                                placeholder="admin@polysack.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-sidebar-text" htmlFor="password">
                            Password
                        </label>
                        <div className="relative flex items-center">
                            <Lock className="absolute left-3.5 text-sidebar-text pointer-events-none" size={18} />
                            <input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full py-2.5 pl-10 pr-3 bg-sidebar-bg border border-sidebar-hover rounded-lg text-sidebar-text-active text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-sans"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-sidebar-bg font-bold rounded-lg text-sm transition-all duration-150 shadow-md shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer mt-2"
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

                <div className="pt-4 border-t border-sidebar-hover/60 text-center text-xs text-text-muted">
                    Protected System • Authorized Personnel Only
                </div>
            </div>
        </div>
    );
}
