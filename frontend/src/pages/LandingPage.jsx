import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Package,
    Boxes,
    Factory,
    ShieldCheck,
    Warehouse,
    Receipt,
    ShoppingCart,
    BarChart3,
    CheckCircle2,
    ArrowRight,
    Sparkles,
    Menu,
    X,
    TrendingUp,
    Layers,
    Lock,
    Check
} from 'lucide-react';

/**
 * PolySack ERP - Marketing & Product Landing Page
 * 
 * Visual Theme:
 * - Deep navy/slate background (#0f172a, matching login screen bg-sidebar-bg)
 * - Amber/orange primary brand accent (#f59e0b / #f5a623, matching login screen button)
 * - Clean sans-serif typography with enterprise spacing
 * - Packaging / box / folder iconography
 * - Pure client-side static page with zero required backend dependencies
 */

export default function LandingPage() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
    const [demoSubmitted, setDemoSubmitted] = useState(false);
    const [demoForm, setDemoForm] = useState({
        fullName: '',
        companyName: '',
        email: '',
        phone: '',
        bagType: 'PP Woven Sacks'
    });

    const handleDemoSubmit = (e) => {
        e.preventDefault();
        // Static lead capture simulation — no backend call needed
        setDemoSubmitted(true);
    };

    const closeDemoModal = () => {
        setIsDemoModalOpen(false);
        setDemoSubmitted(false);
        setDemoForm({
            fullName: '',
            companyName: '',
            email: '',
            phone: '',
            bagType: 'PP Woven Sacks'
        });
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans selection:bg-[#f59e0b]/30 selection:text-[#f59e0b] overflow-x-hidden">
            {/* Background ambient lighting effects */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[450px] bg-[#f59e0b]/10 blur-[130px] rounded-full" />
                <div className="absolute top-[45%] -left-32 w-[500px] h-[500px] bg-blue-600/10 blur-[140px] rounded-full" />
                <div className="absolute bottom-10 -right-32 w-[550px] h-[550px] bg-[#f59e0b]/10 blur-[150px] rounded-full" />
            </div>

            {/* ========================================================================= */}
            {/* HEADER SECTION                                                            */}
            {/* ========================================================================= */}
            <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[#0f172a]/90 border-b border-slate-800/80 transition-all">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
                    {/* Brand Logo & Name */}
                    <div className="flex items-center gap-3">
                        {/* TODO: client logo */}
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center text-[#f59e0b] shadow-sm shadow-[#f59e0b]/10 shrink-0">
                            <Package size={22} className="stroke-[2.2]" />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                                {/* TODO: client brand name */}
                                <span className="text-lg sm:text-xl font-black tracking-tight text-white">
                                    PolySack
                                </span>
                                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30">
                                    ERP
                                </span>
                            </div>
                            {/* TODO: client tagline */}
                            <span className="text-[11px] text-slate-400 font-medium hidden xs:block tracking-wide">
                                Multi-Tenant Manufacturing Platform
                            </span>
                        </div>
                    </div>

                    {/* Desktop Navigation Links */}
                    <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
                        <a href="#features" className="hover:text-[#f59e0b] transition-colors">
                            Features
                        </a>
                        <a href="#why-polysack" className="hover:text-[#f59e0b] transition-colors">
                            Why PolySack
                        </a>
                        <a href="#workflow" className="hover:text-[#f59e0b] transition-colors">
                            Process Flow
                        </a>
                    </nav>

                    {/* Right CTA Actions */}
                    <div className="flex items-center gap-2.5 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => setIsDemoModalOpen(true)}
                            className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-all cursor-pointer"
                        >
                            Request Demo
                        </button>
                        <Link
                            to="/login"
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold text-[#0f172a] bg-[#f59e0b] hover:bg-[#d97706] transition-all shadow-md shadow-[#f59e0b]/20 cursor-pointer"
                        >
                            <span>Sign In</span>
                            <ArrowRight size={15} />
                        </Link>

                        {/* Mobile menu toggle button */}
                        <button
                            type="button"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors md:hidden"
                            aria-label="Toggle navigation menu"
                        >
                            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Dropdown Nav */}
                {isMobileMenuOpen && (
                    <div className="md:hidden border-b border-slate-800 bg-[#0f172a] px-4 pt-3 pb-5 space-y-3 animate-in fade-in slide-in-from-top-3 duration-200">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">
                            Navigation
                        </div>
                        <a
                            href="#features"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="block px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white font-medium"
                        >
                            Features
                        </a>
                        <a
                            href="#why-polysack"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="block px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white font-medium"
                        >
                            Why PolySack
                        </a>
                        <a
                            href="#workflow"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="block px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white font-medium"
                        >
                            Process Flow
                        </a>
                        <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    setIsDemoModalOpen(true);
                                }}
                                className="w-full py-2.5 rounded-lg text-sm font-semibold text-slate-200 bg-slate-800 border border-slate-700 text-center"
                            >
                                Request a Demo
                            </button>
                            <Link
                                to="/login"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="w-full py-2.5 rounded-lg text-sm font-bold text-[#0f172a] bg-[#f59e0b] hover:bg-[#d97706] text-center flex items-center justify-center gap-1.5"
                            >
                                <span>Sign In to Portal</span>
                                <ArrowRight size={16} />
                            </Link>
                        </div>
                    </div>
                )}
            </header>

            {/* ========================================================================= */}
            {/* HERO SECTION                                                              */}
            {/* ========================================================================= */}
            <section className="relative z-10 pt-12 pb-16 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                <div className="text-center max-w-4xl mx-auto space-y-6">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] text-xs font-semibold tracking-wide uppercase shadow-xs">
                        <Sparkles size={14} />
                        {/* TODO: client top badge text */}
                        <span>Specialized Cloud Manufacturing ERP</span>
                    </div>

                    {/* Main Headline */}
                    {/* TODO: client hero headline */}
                    <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.15]">
                        The Complete ERP for{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f59e0b] via-[#fbbf24] to-[#f5a623]">
                            PP & Paper Woven Sack
                        </span>{' '}
                        Manufacturers
                    </h1>

                    {/* Subheading */}
                    {/* TODO: client hero subheading */}
                    <p className="text-sm sm:text-base lg:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
                        Purpose-built for bag producers. Seamlessly manage tape extrusion lines, circular loom weaving, lamination, bag conversion, multi-warehouse inventory, and GST-compliant invoicing on one multi-tenant platform.
                    </p>

                    {/* CTAs */}
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                        <button
                            type="button"
                            onClick={() => setIsDemoModalOpen(true)}
                            className="w-full sm:w-auto px-7 py-3.5 rounded-xl text-sm sm:text-base font-extrabold text-[#0f172a] bg-[#f59e0b] hover:bg-[#d97706] transition-all shadow-lg shadow-[#f59e0b]/25 hover:shadow-xl hover:shadow-[#f59e0b]/30 flex items-center justify-center gap-2 cursor-pointer group"
                        >
                            <span>Request a Demo</span>
                            <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                        </button>
                        <Link
                            to="/login"
                            className="w-full sm:w-auto px-7 py-3.5 rounded-xl text-sm sm:text-base font-bold text-white bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <Lock size={16} className="text-[#f59e0b]" />
                            <span>Sign In to Portal</span>
                        </Link>
                    </div>

                    {/* Micro Trust Indicators */}
                    <div className="pt-6 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-slate-400 font-medium">
                        <span className="flex items-center gap-1.5">
                            <CheckCircle2 size={15} className="text-[#f59e0b]" />
                            Multi-Tenant & Multi-Plant Ready
                        </span>
                        <span className="flex items-center gap-1.5">
                            <CheckCircle2 size={15} className="text-[#f59e0b]" />
                            100% GST & e-Way Bill Compliant
                        </span>
                        <span className="flex items-center gap-1.5">
                            <CheckCircle2 size={15} className="text-[#f59e0b]" />
                            Role-Based Operator Access
                        </span>
                    </div>
                </div>

                {/* Hero ERP Interactive Preview / Mockup */}
                <div className="mt-12 sm:mt-16 relative mx-auto max-w-5xl">
                    {/* Ambient border glow */}
                    <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#f59e0b]/30 via-slate-700 to-[#f59e0b]/20 blur-md opacity-70" />

                    <div className="relative rounded-2xl bg-[#1e293b] border border-slate-700/80 shadow-2xl overflow-hidden">
                        {/* Mock window top bar */}
                        <div className="bg-[#0f172a] px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                                <span className="text-xs font-mono text-slate-400 ml-2 hidden sm:inline">
                                    polysack-portal.internal/production-control
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Live Factory Feed
                                </span>
                            </div>
                        </div>

                        {/* Mock dashboard content */}
                        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                            {/* KPI Metric cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                <div className="p-3.5 sm:p-4 rounded-xl bg-[#0f172a]/70 border border-slate-800">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                        Circular Loom Output
                                    </span>
                                    <div className="text-xl sm:text-2xl font-black text-white mt-1">
                                        428,500 <span className="text-xs font-semibold text-slate-400">sacks</span>
                                    </div>
                                    <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 mt-1">
                                        <TrendingUp size={12} /> +8.4% vs shift target
                                    </span>
                                </div>

                                <div className="p-3.5 sm:p-4 rounded-xl bg-[#0f172a]/70 border border-slate-800">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                        Active Extrusion Lines
                                    </span>
                                    <div className="text-xl sm:text-2xl font-black text-white mt-1">
                                        12 / 12 <span className="text-xs font-semibold text-emerald-400">100% online</span>
                                    </div>
                                    <span className="text-[11px] text-slate-400 font-medium block mt-1">
                                        Avg Denier: 650 ± 1.2
                                    </span>
                                </div>

                                <div className="p-3.5 sm:p-4 rounded-xl bg-[#0f172a]/70 border border-slate-800">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                        Resin Scrap Ratio
                                    </span>
                                    <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
                                        1.8% <span className="text-xs font-semibold text-slate-400">(Low)</span>
                                    </div>
                                    <span className="text-[11px] text-slate-400 font-medium block mt-1">
                                        Polymer loss saved: 1.4 MT
                                    </span>
                                </div>

                                <div className="p-3.5 sm:p-4 rounded-xl bg-[#0f172a]/70 border border-slate-800">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                        Dispatched Today
                                    </span>
                                    <div className="text-xl sm:text-2xl font-black text-[#f59e0b] mt-1">
                                        14 Trucks
                                    </div>
                                    <span className="text-[11px] text-slate-400 font-medium block mt-1">
                                        100% e-Way bills generated
                                    </span>
                                </div>
                            </div>

                            {/* Operational Status Table Snippet */}
                            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/50 p-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3 text-xs">
                                    <span className="font-bold text-slate-200">Active Shop Floor Batches</span>
                                    <span className="text-slate-400 text-[11px]">Updated live</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs font-sans">
                                        <thead>
                                            <tr className="text-slate-400 border-b border-slate-800/80 text-[11px]">
                                                <th className="pb-2 font-semibold">BATCH / JOB</th>
                                                <th className="pb-2 font-semibold">BAG SPECIFICATION</th>
                                                <th className="pb-2 font-semibold">LINE</th>
                                                <th className="pb-2 font-semibold">COMPLETION</th>
                                                <th className="pb-2 font-semibold text-right">STATUS</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/40 text-slate-300">
                                            <tr>
                                                <td className="py-2.5 font-mono font-medium text-[#f59e0b]">JOB-2026-0881</td>
                                                <td className="py-2.5">50kg Cement Sack (BOPP Laminated)</td>
                                                <td className="py-2.5 font-mono text-slate-400">Loom #04</td>
                                                <td className="py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-20 bg-slate-800 rounded-full h-1.5">
                                                            <div className="bg-[#f59e0b] h-1.5 rounded-full w-[85%]" />
                                                        </div>
                                                        <span className="text-[10px] font-mono">85%</span>
                                                    </div>
                                                </td>
                                                <td className="py-2.5 text-right">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                        Weaving
                                                    </span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2.5 font-mono font-medium text-[#f59e0b]">JOB-2026-0882</td>
                                                <td className="py-2.5">Sugar Poly Woven (25kg Gusseted)</td>
                                                <td className="py-2.5 font-mono text-slate-400">Print Line #01</td>
                                                <td className="py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-20 bg-slate-800 rounded-full h-1.5">
                                                            <div className="bg-[#f59e0b] h-1.5 rounded-full w-[94%]" />
                                                        </div>
                                                        <span className="text-[10px] font-mono">94%</span>
                                                    </div>
                                                </td>
                                                <td className="py-2.5 text-right">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                                        Flexo Printing
                                                    </span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2.5 font-mono font-medium text-[#f59e0b]">JOB-2026-0883</td>
                                                <td className="py-2.5">Flour Sack with PE Liner Insert</td>
                                                <td className="py-2.5 font-mono text-slate-400">Stitch Unit #03</td>
                                                <td className="py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-20 bg-slate-800 rounded-full h-1.5">
                                                            <div className="bg-[#f59e0b] h-1.5 rounded-full w-[62%]" />
                                                        </div>
                                                        <span className="text-[10px] font-mono">62%</span>
                                                    </div>
                                                </td>
                                                <td className="py-2.5 text-right">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                        Sewing & Cutting
                                                    </span>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* FEATURES GRID SECTION (6 CARDS)                                           */}
            {/* ========================================================================= */}
            <section id="features" className="py-16 sm:py-24 border-t border-slate-800/80 bg-slate-900/40 relative z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Section Header */}
                    <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] text-xs font-bold uppercase tracking-wider mb-3">
                            <Boxes size={14} />
                            Core ERP Modules
                        </div>
                        {/* TODO: client features header */}
                        <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                            Engineered for Every Stage of Sack Production
                        </h2>
                        <p className="text-sm sm:text-base text-slate-400 mt-3">
                            From raw polypropylene granules to finished palletized sacks, manage your entire operations stack within a single unified workspace.
                        </p>
                    </div>

                    {/* Features Grid: 6 Cards as specified */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* 1. Production & Shop Floor */}
                        <div className="rounded-2xl bg-[#1e293b]/70 hover:bg-[#1e293b] border border-slate-800 hover:border-[#f59e0b]/40 p-6 sm:p-7 transition-all duration-200 group shadow-lg">
                            <div className="w-12 h-12 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center text-[#f59e0b] mb-5 group-hover:scale-105 transition-transform">
                                <Factory size={24} />
                            </div>
                            {/* TODO: client feature 1 title */}
                            <h3 className="text-lg font-bold text-white mb-2">
                                Production & Shop Floor
                            </h3>
                            {/* TODO: client feature 1 description */}
                            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                Real-time tape extrusion monitoring, circular loom fabric yields, stitcher conversion counts, and shift operator downtime logs.
                            </p>
                            <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center gap-2 text-xs font-semibold text-[#f59e0b]">
                                <span>Loom tracking & batch BOM</span>
                                <ArrowRight size={14} />
                            </div>
                        </div>

                        {/* 2. Quality Control */}
                        <div className="rounded-2xl bg-[#1e293b]/70 hover:bg-[#1e293b] border border-slate-800 hover:border-[#f59e0b]/40 p-6 sm:p-7 transition-all duration-200 group shadow-lg">
                            <div className="w-12 h-12 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center text-[#f59e0b] mb-5 group-hover:scale-105 transition-transform">
                                <ShieldCheck size={24} />
                            </div>
                            {/* TODO: client feature 2 title */}
                            <h3 className="text-lg font-bold text-white mb-2">
                                Quality Control
                            </h3>
                            {/* TODO: client feature 2 description */}
                            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                Enforce GSM weight checks, tape denier tensile limits, drop tests, burst strength ratings, and quarantine non-conforming lots.
                            </p>
                            <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center gap-2 text-xs font-semibold text-[#f59e0b]">
                                <span>Batch certificates & testing</span>
                                <ArrowRight size={14} />
                            </div>
                        </div>

                        {/* 3. Inventory & Stock */}
                        <div className="rounded-2xl bg-[#1e293b]/70 hover:bg-[#1e293b] border border-slate-800 hover:border-[#f59e0b]/40 p-6 sm:p-7 transition-all duration-200 group shadow-lg">
                            <div className="w-12 h-12 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center text-[#f59e0b] mb-5 group-hover:scale-105 transition-transform">
                                <Warehouse size={24} />
                            </div>
                            {/* TODO: client feature 3 title */}
                            <h3 className="text-lg font-bold text-white mb-2">
                                Inventory & Stock
                            </h3>
                            {/* TODO: client feature 3 description */}
                            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                Multi-warehouse control for virgin PP resin granules, masterbatch colors, fabric bobbins, unprinted rolls, and finished packed bags.
                            </p>
                            <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center gap-2 text-xs font-semibold text-[#f59e0b]">
                                <span>Granule silos & roll tracking</span>
                                <ArrowRight size={14} />
                            </div>
                        </div>

                        {/* 4. POS Billing */}
                        <div className="rounded-2xl bg-[#1e293b]/70 hover:bg-[#1e293b] border border-slate-800 hover:border-[#f59e0b]/40 p-6 sm:p-7 transition-all duration-200 group shadow-lg">
                            <div className="w-12 h-12 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center text-[#f59e0b] mb-5 group-hover:scale-105 transition-transform">
                                <Receipt size={24} />
                            </div>
                            {/* TODO: client feature 4 title */}
                            <h3 className="text-lg font-bold text-white mb-2">
                                POS Billing
                            </h3>
                            {/* TODO: client feature 4 description */}
                            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                Rapid wholesale POS counter billing, multi-rate GST computation, client credit ledger tracking, and instant PDF invoice printing.
                            </p>
                            <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center gap-2 text-xs font-semibold text-[#f59e0b]">
                                <span>GST ready & instant receipts</span>
                                <ArrowRight size={14} />
                            </div>
                        </div>

                        {/* 5. Purchase & GRN */}
                        <div className="rounded-2xl bg-[#1e293b]/70 hover:bg-[#1e293b] border border-slate-800 hover:border-[#f59e0b]/40 p-6 sm:p-7 transition-all duration-200 group shadow-lg">
                            <div className="w-12 h-12 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center text-[#f59e0b] mb-5 group-hover:scale-105 transition-transform">
                                <ShoppingCart size={24} />
                            </div>
                            {/* TODO: client feature 5 title */}
                            <h3 className="text-lg font-bold text-white mb-2">
                                Purchase & GRN
                            </h3>
                            {/* TODO: client feature 5 description */}
                            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                Automated purchase requisitions for polymer raw materials, vendor quotation comparison, and Good Receipt Notes (GRN) verification.
                            </p>
                            <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center gap-2 text-xs font-semibold text-[#f59e0b]">
                                <span>Supplier audits & PO approvals</span>
                                <ArrowRight size={14} />
                            </div>
                        </div>

                        {/* 6. Analytics & Reports */}
                        <div className="rounded-2xl bg-[#1e293b]/70 hover:bg-[#1e293b] border border-slate-800 hover:border-[#f59e0b]/40 p-6 sm:p-7 transition-all duration-200 group shadow-lg">
                            <div className="w-12 h-12 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center text-[#f59e0b] mb-5 group-hover:scale-105 transition-transform">
                                <BarChart3 size={24} />
                            </div>
                            {/* TODO: client feature 6 title */}
                            <h3 className="text-lg font-bold text-white mb-2">
                                Analytics & Reports
                            </h3>
                            {/* TODO: client feature 6 description */}
                            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                Granular cost-per-bag calculations, resin consumption trends, machine efficiency heatmaps, and executive revenue dashboards.
                            </p>
                            <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center gap-2 text-xs font-semibold text-[#f59e0b]">
                                <span>Per-sack margins & yield stats</span>
                                <ArrowRight size={14} />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* VALUE PROPS / "WHY POLYSACK" SECTION                                      */}
            {/* ========================================================================= */}
            <section id="why-polysack" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                    {/* Left Column: Heading & Introduction */}
                    <div className="lg:col-span-5 space-y-5">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] text-xs font-bold uppercase tracking-wider">
                            <Layers size={14} />
                            Tailored For Manufacturers
                        </div>
                        {/* TODO: client why polysack header */}
                        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-snug">
                            Why PolySack Outperforms Generic ERPs
                        </h2>
                        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                            Generic ERPs don't understand denier calculations, loom warp/weft tension, or cylinder printing setups. PolySack was built from the ground up for packaging manufacturers.
                        </p>
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => setIsDemoModalOpen(true)}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-[#0f172a] bg-[#f59e0b] hover:bg-[#d97706] transition-all shadow-md shadow-[#f59e0b]/20 cursor-pointer"
                            >
                                <span>Schedule Plant Walkthrough</span>
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Right Column: 4 Bullet Value Props as requested */}
                    <div className="lg:col-span-7 space-y-4">
                        {/* Benefit 1 */}
                        <div className="p-5 sm:p-6 rounded-2xl bg-[#1e293b]/80 border border-slate-800 hover:border-slate-700 transition-all flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                                <Check size={20} />
                            </div>
                            <div className="space-y-1">
                                {/* TODO: client benefit 1 title */}
                                <h4 className="text-base font-bold text-white">
                                    Multi-tenant & multi-location ready
                                </h4>
                                {/* TODO: client benefit 1 text */}
                                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                    Run multiple plant units (e.g. Vapi, Surat, Ahmedabad) under fully isolated tenant boundaries with centralized corporate oversight.
                                </p>
                            </div>
                        </div>

                        {/* Benefit 2 */}
                        <div className="p-5 sm:p-6 rounded-2xl bg-[#1e293b]/80 border border-slate-800 hover:border-slate-700 transition-all flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/30 text-[#f59e0b] flex items-center justify-center shrink-0 mt-0.5">
                                <Check size={20} />
                            </div>
                            <div className="space-y-1">
                                {/* TODO: client benefit 2 title */}
                                <h4 className="text-base font-bold text-white">
                                    Built for PP/paper woven sack manufacturing
                                </h4>
                                {/* TODO: client benefit 2 text */}
                                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                    Native formulas for tape GSM, mesh density, circular loom width, gusseting depth, and valve bag conversion parameters.
                                </p>
                            </div>
                        </div>

                        {/* Benefit 3 */}
                        <div className="p-5 sm:p-6 rounded-2xl bg-[#1e293b]/80 border border-slate-800 hover:border-slate-700 transition-all flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                                <Check size={20} />
                            </div>
                            <div className="space-y-1">
                                {/* TODO: client benefit 3 title */}
                                <h4 className="text-base font-bold text-white">
                                    GST-compliant billing & inventory
                                </h4>
                                {/* TODO: client benefit 3 text */}
                                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                    Automatic HSN classification (3923/6305), automated e-Way bill sync, and instant warehouse stock deductions upon dispatch.
                                </p>
                            </div>
                        </div>

                        {/* Benefit 4 */}
                        <div className="p-5 sm:p-6 rounded-2xl bg-[#1e293b]/80 border border-slate-800 hover:border-slate-700 transition-all flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                                <Check size={20} />
                            </div>
                            <div className="space-y-1">
                                {/* TODO: client benefit 4 title */}
                                <h4 className="text-base font-bold text-white">
                                    Real-time scrap & wastage minimization
                                </h4>
                                {/* TODO: client benefit 4 text */}
                                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                    Pinpoint resin loss at tape extrusion and loom edge-trimming stages to maximize virgin polymer conversion efficiency.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* MANUFACTURING WORKFLOW FLOW SECTION                                       */}
            {/* ========================================================================= */}
            <section id="workflow" className="py-16 sm:py-20 bg-slate-900/50 border-y border-slate-800/80 relative z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-2xl mx-auto mb-12">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#f59e0b] block mb-2">
                            End-to-End Traceability
                        </span>
                        <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                            Complete Production Pipeline Tracking
                        </h3>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
                        <div className="p-4 rounded-xl bg-[#1e293b] border border-slate-800">
                            <div className="text-xs font-mono font-bold text-[#f59e0b] mb-1">STAGE 01</div>
                            <div className="font-bold text-sm text-white">Raw Granules</div>
                            <div className="text-[11px] text-slate-400 mt-1">PP, CaCO3 & Pigment</div>
                        </div>
                        <div className="p-4 rounded-xl bg-[#1e293b] border border-slate-800">
                            <div className="text-xs font-mono font-bold text-[#f59e0b] mb-1">STAGE 02</div>
                            <div className="font-bold text-sm text-white">Tape Extrusion</div>
                            <div className="text-[11px] text-slate-400 mt-1">Denier & Bobbin Wind</div>
                        </div>
                        <div className="p-4 rounded-xl bg-[#1e293b] border border-slate-800">
                            <div className="text-xs font-mono font-bold text-[#f59e0b] mb-1">STAGE 03</div>
                            <div className="font-bold text-sm text-white">Circular Looms</div>
                            <div className="text-[11px] text-slate-400 mt-1">Tubular Fabric Weave</div>
                        </div>
                        <div className="p-4 rounded-xl bg-[#1e293b] border border-slate-800">
                            <div className="text-xs font-mono font-bold text-[#f59e0b] mb-1">STAGE 04</div>
                            <div className="font-bold text-sm text-white">Lamination</div>
                            <div className="text-[11px] text-slate-400 mt-1">BOPP & Kraft Layer</div>
                        </div>
                        <div className="p-4 rounded-xl bg-[#1e293b] border border-slate-800">
                            <div className="text-xs font-mono font-bold text-[#f59e0b] mb-1">STAGE 05</div>
                            <div className="font-bold text-sm text-white">Flexo Printing</div>
                            <div className="text-[11px] text-slate-400 mt-1">Multi-Color Branding</div>
                        </div>
                        <div className="p-4 rounded-xl bg-[#1e293b] border border-slate-800">
                            <div className="text-xs font-mono font-bold text-[#f59e0b] mb-1">STAGE 06</div>
                            <div className="font-bold text-sm text-white">Bale & Dispatch</div>
                            <div className="text-[11px] text-slate-400 mt-1">e-Way Bill & Delivery</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* BOTTOM CALL TO ACTION                                                     */}
            {/* ========================================================================= */}
            <section className="py-16 sm:py-24 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                <div className="rounded-3xl bg-gradient-to-b from-[#1e293b] to-[#0f172a] border border-[#f59e0b]/30 p-8 sm:p-12 shadow-2xl space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-[#f59e0b]/10 rounded-full blur-3xl pointer-events-none" />

                    <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                        Ready to Modernize Your Sack Manufacturing Operations?
                    </h2>
                    <p className="text-slate-300 max-w-xl mx-auto text-sm sm:text-base">
                        Get up and running in days. No complex on-premise hardware required. Connect your machines and start tracking production immediately.
                    </p>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                        <button
                            type="button"
                            onClick={() => setIsDemoModalOpen(true)}
                            className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm sm:text-base font-black text-[#0f172a] bg-[#f59e0b] hover:bg-[#d97706] transition-all shadow-lg shadow-[#f59e0b]/25 cursor-pointer"
                        >
                            Request Product Demo
                        </button>
                        <Link
                            to="/login"
                            className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm sm:text-base font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all text-center"
                        >
                            Access Existing Tenant Portal
                        </Link>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* FOOTER SECTION                                                            */}
            {/* ========================================================================= */}
            <footer className="border-t border-slate-800/80 bg-[#0b1120] relative z-10 text-slate-400 font-sans">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                        {/* Brand info */}
                        <div className="md:col-span-2 space-y-3">
                            <div className="flex items-center gap-2.5">
                                {/* TODO: client footer logo */}
                                <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center text-[#f59e0b]">
                                    <Package size={18} />
                                </div>
                                <span className="text-lg font-black text-white">PolySack ERP</span>
                            </div>
                            {/* TODO: client footer tagline & description */}
                            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                                Enterprise resource planning system designed specifically for polypropylene (PP), HDPE, and paper woven sack manufacturing plants.
                            </p>
                        </div>

                        {/* Quick Links */}
                        <div className="space-y-2">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                Modules
                            </div>
                            <ul className="space-y-1.5 text-xs">
                                <li>
                                    <a href="#features" className="hover:text-[#f59e0b] transition-colors">
                                        Production & Shop Floor
                                    </a>
                                </li>
                                <li>
                                    <a href="#features" className="hover:text-[#f59e0b] transition-colors">
                                        Quality Assurance
                                    </a>
                                </li>
                                <li>
                                    <a href="#features" className="hover:text-[#f59e0b] transition-colors">
                                        Inventory Silos
                                    </a>
                                </li>
                                <li>
                                    <a href="#features" className="hover:text-[#f59e0b] transition-colors">
                                        POS & GST Billing
                                    </a>
                                </li>
                            </ul>
                        </div>

                        {/* Legal & Contacts */}
                        <div className="space-y-2">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                Resources & Support
                            </div>
                            <ul className="space-y-1.5 text-xs">
                                {/* TODO: client legal links */}
                                <li>
                                    <a href="#privacy" className="hover:text-[#f59e0b] transition-colors">
                                        Privacy Policy
                                    </a>
                                </li>
                                <li>
                                    <a href="#terms" className="hover:text-[#f59e0b] transition-colors">
                                        Terms of Service
                                    </a>
                                </li>
                                <li>
                                    <a href="#contact" className="hover:text-[#f59e0b] transition-colors">
                                        Contact Sales
                                    </a>
                                </li>
                                <li>
                                    <Link to="/login" className="hover:text-[#f59e0b] transition-colors">
                                        Client Sign In
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Bottom Copyright Bar */}
                    <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 text-center sm:text-left">
                        {/* TODO: client copyright text */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                            <span>
                                © {new Date().getFullYear()} PolySack ERP. All Rights Reserved.
                            </span>
                            <span className="hidden sm:inline text-slate-600">•</span>
                            <span>
                                Designed &amp; Developed by{' '}
                                <a
                                    href="https://requinsolutions.com/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-400 hover:text-[#f59e0b] font-medium transition-colors underline-offset-2 hover:underline"
                                >
                                    Requin Solutions Pvt. Ltd
                                </a>
                            </span>
                        </div>
                        <div className="flex items-center gap-6">
                            <a href="#privacy" className="hover:text-slate-400 transition-colors">
                                Privacy
                            </a>
                            <a href="#terms" className="hover:text-slate-400 transition-colors">
                                Terms
                            </a>
                            <a href="#contact" className="hover:text-slate-400 transition-colors">
                                Contact
                            </a>
                        </div>
                    </div>
                </div>
            </footer>

            {/* ========================================================================= */}
            {/* REQUEST A DEMO MODAL (Interactive & Static - No backend required)         */}
            {/* ========================================================================= */}
            {isDemoModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="w-full max-w-md bg-[#1e293b] border border-slate-700 rounded-2xl p-6 sm:p-7 shadow-2xl relative space-y-5">
                        <button
                            type="button"
                            onClick={closeDemoModal}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="space-y-1">
                            <div className="w-10 h-10 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center text-[#f59e0b] mb-3">
                                <Package size={20} />
                            </div>
                            <h3 className="text-xl font-extrabold text-white">
                                {demoSubmitted ? 'Demo Request Received!' : 'Request a Plant Demo'}
                            </h3>
                            <p className="text-xs text-slate-400">
                                {demoSubmitted
                                    ? 'Our manufacturing systems engineer will reach out within 24 business hours.'
                                    : 'See how PolySack optimizes your looms, bobbins, and invoicing.'}
                            </p>
                        </div>

                        {demoSubmitted ? (
                            <div className="space-y-4 pt-2">
                                <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-3">
                                    <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-emerald-200">Thank you, {demoForm.fullName || 'Valued Manufacturer'}!</p>
                                        <p className="mt-1 leading-relaxed">
                                            We will prepare a customized walkthrough focusing on {demoForm.bagType} production pipelines.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeDemoModal}
                                    className="w-full py-2.5 rounded-lg text-sm font-bold text-[#0f172a] bg-[#f59e0b] hover:bg-[#d97706] transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleDemoSubmit} className="space-y-3.5">
                                {/* TODO: client demo form endpoint or CRM hook */}
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                                        Your Full Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={demoForm.fullName}
                                        onChange={(e) => setDemoForm({ ...demoForm, fullName: e.target.value })}
                                        placeholder="e.g. Rajesh Patel"
                                        className="w-full py-2 px-3 bg-[#0f172a] border border-slate-700 rounded-lg text-white text-xs sm:text-sm outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] transition-all"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                                        Plant / Company Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={demoForm.companyName}
                                        onChange={(e) => setDemoForm({ ...demoForm, companyName: e.target.value })}
                                        placeholder="e.g. Gujarat PolySacks Ltd."
                                        className="w-full py-2 px-3 bg-[#0f172a] border border-slate-700 rounded-lg text-white text-xs sm:text-sm outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] transition-all"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                                            Work Email
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            value={demoForm.email}
                                            onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                                            placeholder="you@company.com"
                                            className="w-full py-2 px-3 bg-[#0f172a] border border-slate-700 rounded-lg text-white text-xs sm:text-sm outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                                            Phone / WhatsApp
                                        </label>
                                        <input
                                            type="tel"
                                            required
                                            value={demoForm.phone}
                                            onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                                            placeholder="+91 98765 43210"
                                            className="w-full py-2 px-3 bg-[#0f172a] border border-slate-700 rounded-lg text-white text-xs sm:text-sm outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                                        Primary Product Category
                                    </label>
                                    <select
                                        value={demoForm.bagType}
                                        onChange={(e) => setDemoForm({ ...demoForm, bagType: e.target.value })}
                                        className="w-full py-2 px-3 bg-[#0f172a] border border-slate-700 rounded-lg text-white text-xs sm:text-sm outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] transition-all"
                                    >
                                        <option value="PP Woven Sacks">PP Woven Sacks</option>
                                        <option value="BOPP Laminated Bags">BOPP Laminated Bags</option>
                                        <option value="Multiwall Paper Bags">Multiwall Paper Bags</option>
                                        <option value="FIBC Jumbo Bags">FIBC / Jumbo Bags</option>
                                        <option value="Cement / Fertilizer Bags">Cement / Fertilizer Bags</option>
                                    </select>
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        className="w-full py-3 rounded-lg text-sm font-bold text-[#0f172a] bg-[#f59e0b] hover:bg-[#d97706] transition-all shadow-md shadow-[#f59e0b]/20 cursor-pointer"
                                    >
                                        Submit Request
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
