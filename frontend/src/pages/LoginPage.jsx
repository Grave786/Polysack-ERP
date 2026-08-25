import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Mail, Lock, Factory, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim() || !password.trim()) return;

        setIsSubmitting(true);
        const result = await login(email.trim(), password);
        setIsSubmitting(false);

        if (result.success) {
            navigate('/dashboard');
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
                                className="w-full py-2.5 pl-10 pr-3 bg-sidebar-bg border border-sidebar-hover rounded-lg text-sidebar-text-active text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
                                className="w-full py-2.5 pl-10 pr-3 bg-sidebar-bg border border-sidebar-hover rounded-lg text-sidebar-text-active text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
