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
 * - Clean, modern SaaS Light Theme
 * - Crisp slate/white surfaces with subtle borders (border-slate-200)
 * - Deep slate/near-black typography for optimal contrast (text-slate-900 / text-slate-700 / text-slate-600)
 * - Amber/orange primary brand accent (#f59e0b / #d97706) for CTAs, badges, and highlights
 * - Scoped Tailwind classes only — zero modification to authenticated app's dark sidebar theme
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
        <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans selection:bg-[#f59e0b]/30 selection:text-[#b45309] overflow-x-hidden">
            {/* Ambient subtle warm lighting effects for light theme */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[750px] h-[450px] bg-amber-200/25 blur-[140px] rounded-full" />
                <div className="absolute top-[40%] -left-32 w-[550px] h-[550px] bg-blue-100/35 blur-[150px] rounded-full" />
                <div className="absolute bottom-10 -right-32 w-[600px] h-[600px] bg-amber-100/30 blur-[160px] rounded-full" />
            </div>

            {/* ========================================================================= */}
            {/* HEADER / NAVBAR SECTION                                                   */}
            {/* ========================================================================= */}
            <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/95 border-b border-slate-200 transition-all shadow-xs">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
                    {/* Brand Logo & Name */}
                    <div className="flex items-center gap-3">
                        {/* Brand icon mark */}
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center text-[#d97706] shadow-xs shrink-0">
                            <Package size={22} className="stroke-[2.2]" />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                                <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
                                    PolySack
                                </span>
                                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-[#f59e0b]/15 text-[#b45309] border border-[#f59e0b]/30">
                                    ERP
                                </span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-medium hidden xs:block tracking-wide">
                                Multi-Tenant Manufacturing Platform
                            </span>
                        </div>
                    </div>

                    {/* Desktop Navigation Links */}
                    <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-slate-700">
                        <a href="#features" className="hover:text-[#d97706] transition-colors">
                            Features
                        </a>
                        <a href="#why-polysack" className="hover:text-[#d97706] transition-colors">
                            Why PolySack
                        </a>
                        <a href="#workflow" className="hover:text-[#d97706] transition-colors">
                            Process Flow
                        </a>
                    </nav>

                    {/* Right CTA Actions */}
                    <div className="flex items-center gap-2.5 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => setIsDemoModalOpen(true)}
                            className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 shadow-xs transition-all cursor-pointer"
                        >
                            Request Demo
                        </button>
                        <Link
                            to="/login"
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold text-slate-950 bg-[#f59e0b] hover:bg-[#d97706] transition-all shadow-sm shadow-[#f59e0b]/25 cursor-pointer"
                        >
                            <span>Sign In</span>
                            <ArrowRight size={15} />
                        </Link>

                        {/* Mobile menu toggle button */}
                        <button
                            type="button"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors md:hidden"
                            aria-label="Toggle navigation menu"
                        >
                            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Dropdown Nav */}
                {isMobileMenuOpen && (
                    <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-3 pb-5 space-y-3 shadow-lg animate-in fade-in slide-in-from-top-3 duration-200">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">
                            Navigation
                        </div>
                        <a
                            href="#features"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="block px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium"
                        >
                            Features
                        </a>
                        <a
                            href="#why-polysack"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="block px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium"
                        >
                            Why PolySack
                        </a>
                        <a
                            href="#workflow"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="block px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium"
                        >
                            Process Flow
                        </a>
                        <div className="pt-2 border-t border-slate-200 flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    setIsDemoModalOpen(true);
                                }}
                                className="w-full py-2.5 rounded-lg text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 shadow-xs text-center"
                            >
                                Request a Demo
                            </button>
                            <Link
                                to="/login"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="w-full py-2.5 rounded-lg text-sm font-bold text-slate-950 bg-[#f59e0b] hover:bg-[#d97706] text-center flex items-center justify-center gap-1.5 shadow-sm"
                            >
                                <span>Sign In to Portal</span>
                                <ArrowRight size={16} />
                            </Link>
                        </div>
                    </div>
                )}
            </header>

            {/* ========================================================================= */}
            {/* HERO SECTION WITH SIDE-BY-SIDE HERO IMAGE                                 */}
            {/* ========================================================================= */}
            <section className="relative z-10 pt-10 pb-16 sm:pt-14 sm:pb-20 lg:pt-16 lg:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                    {/* Left Column: Headline, CTAs, and Trust Badges */}
                    <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold tracking-wide uppercase shadow-xs">
                            <Sparkles size={14} className="text-[#d97706]" />
                            <span>Specialized Cloud Manufacturing ERP</span>
                        </div>

                        {/* Main Headline */}
                        <h1 className="text-2xl sm:text-3xl lg:text-3xl xl:text-4xl font-black text-slate-900 tracking-tight leading-[1.15]">
                            The Complete ERP for{' '}
                            <span className="text-[#d97706] sm:text-transparent sm:bg-clip-text sm:bg-gradient-to-r sm:from-[#d97706] sm:via-[#f59e0b] sm:to-[#b45309]">
                                PP & Paper Woven Sack
                            </span>{' '}
                            Manufacturers
                        </h1>

                        {/* Subheading */}
                        <p className="text-sm sm:text-base lg:text-lg text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
                            Purpose-built for bag producers. Seamlessly manage tape extrusion lines, circular loom weaving, lamination, bag conversion, multi-warehouse inventory, and GST-compliant invoicing on one multi-tenant platform.
                        </p>

                        {/* CTAs */}
                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4">
                            <button
                                type="button"
                                onClick={() => setIsDemoModalOpen(true)}
                                className="w-full sm:w-auto px-7 py-3.5 rounded-xl text-sm sm:text-base font-extrabold text-slate-950 bg-[#f59e0b] hover:bg-[#d97706] transition-all shadow-md shadow-[#f59e0b]/25 hover:shadow-lg hover:shadow-[#f59e0b]/35 flex items-center justify-center gap-2 cursor-pointer group"
                            >
                                <span>Request a Demo</span>
                                <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                            </button>
                            <Link
                                to="/login"
                                className="w-full sm:w-auto px-7 py-3.5 rounded-xl text-sm sm:text-base font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Lock size={16} className="text-[#d97706]" />
                                <span>Sign In to Portal</span>
                            </Link>
                        </div>

                        {/* Micro Trust Indicators */}
                        <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-y-2 gap-x-6 text-xs text-slate-600 font-medium">
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 size={15} className="text-[#d97706]" />
                                Multi-Tenant & Multi-Plant Ready
                            </span>
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 size={15} className="text-[#d97706]" />
                                100% GST & e-Way Bill Compliant
                            </span>
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 size={15} className="text-[#d97706]" />
                                Role-Based Operator Access
                            </span>
                        </div>
                    </div>

                    {/* Right Column: Hero Section Image from Unsplash */}
                    <div className="lg:col-span-5">
                        <div className="relative rounded-2xl overflow-hidden shadow-xl border border-slate-200/90 bg-white p-2">
                            <div className="relative rounded-xl overflow-hidden aspect-[4/3] sm:aspect-[16/11] bg-slate-100">
                                <img
                                    src="https://images.unsplash.com/photo-1760565030346-4b947220fe3a?q=80&w=1169&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                                    alt="PolySack PP & Paper Woven Sack Manufacturing Plant"
                                    className="w-full h-full object-cover object-center hover:scale-105 transition-transform duration-500"
                                />
                                <img
                                    src="https://images.unsplash.com/photo-1760565030346-4b947220fe3a?q=80&w=1169&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                                    alt="PolySack PP & Paper Woven Sack Manufacturing Plant"
                                    className="w-full h-full object-cover object-center hover:scale-105 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/20 to-transparent pointer-events-none" />
                                <div className="absolute bottom-3.5 left-3.5 right-3.5 text-white">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#f59e0b] text-slate-950 mb-1.5 shadow-xs">
                                        Live Plant Operations
                                    </span>
                                    <p className="text-xs font-semibold text-white leading-snug">
                                        High-speed extrusion lines & circular loom production floor
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hero ERP Interactive Preview / Mockup (Converted to Light Theme) */}
                <div className="mt-12 sm:mt-16 relative mx-auto max-w-5xl">
                    {/* Subtle ambient border glow */}
                    <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-amber-400/20 via-slate-200 to-amber-300/20 blur-md opacity-70" />

                    <div className="relative rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
                        {/* Mock window top bar */}
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-rose-400 inline-block" />
                                <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                                <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                                <span className="text-xs font-mono text-slate-500 ml-2 hidden sm:inline">
                                    polysack-portal.internal/production-control
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Live Factory Feed
                                </span>
                            </div>
                        </div>

                        {/* Mock dashboard content */}
                        <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-white">
                            {/* KPI Metric cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50/80 border border-slate-200">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                                        Circular Loom Output
                                    </span>
                                    <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                                        428,500 <span className="text-xs font-semibold text-slate-500">sacks</span>
                                    </div>
                                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
                                        <TrendingUp size={12} /> +8.4% vs shift target
                                    </span>
                                </div>

                                <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50/80 border border-slate-200">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                                        Active Extrusion Lines
                                    </span>
                                    <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                                        12 / 12 <span className="text-xs font-semibold text-emerald-600">100% online</span>
                                    </div>
                                    <span className="text-[11px] text-slate-500 font-medium block mt-1">
                                        Avg Denier: 650 ± 1.2
                                    </span>
                                </div>

                                <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50/80 border border-slate-200">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                                        Resin Scrap Ratio
                                    </span>
                                    <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
                                        1.8% <span className="text-xs font-semibold text-slate-500">(Low)</span>
                                    </div>
                                    <span className="text-[11px] text-slate-500 font-medium block mt-1">
                                        Polymer loss saved: 1.4 MT
                                    </span>
                                </div>

                                <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50/80 border border-slate-200">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                                        Dispatched Today
                                    </span>
                                    <div className="text-xl sm:text-2xl font-black text-[#d97706] mt-1">
                                        14 Trucks
                                    </div>
                                    <span className="text-[11px] text-slate-500 font-medium block mt-1">
                                        100% e-Way bills generated
                                    </span>
                                </div>
                            </div>

                            {/* Operational Status Table Snippet */}
                            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3 text-xs">
                                    <span className="font-bold text-slate-800">Active Shop Floor Batches</span>
                                    <span className="text-slate-500 text-[11px]">Updated live</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs font-sans">
                                        <thead>
                                            <tr className="text-slate-500 border-b border-slate-200 text-[11px]">
                                                <th className="pb-2 font-semibold">BATCH / JOB</th>
                                                <th className="pb-2 font-semibold">BAG SPECIFICATION</th>
                                                <th className="pb-2 font-semibold">LINE</th>
                                                <th className="pb-2 font-semibold">COMPLETION</th>
                                                <th className="pb-2 font-semibold text-right">STATUS</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700">
                                            <tr>
                                                <td className="py-2.5 font-mono font-bold text-[#d97706]">JOB-2026-0881</td>
                                                <td className="py-2.5 font-medium text-slate-800">50kg Cement Sack (BOPP Laminated)</td>
                                                <td className="py-2.5 font-mono text-slate-500">Loom #04</td>
                                                <td className="py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-20 bg-slate-200 rounded-full h-1.5">
                                                            <div className="bg-[#f59e0b] h-1.5 rounded-full w-[85%]" />
                                                        </div>
                                                        <span className="text-[10px] font-mono text-slate-600">85%</span>
                                                    </div>
                                                </td>
                                                <td className="py-2.5 text-right">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        Weaving
                                                    </span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2.5 font-mono font-bold text-[#d97706]">JOB-2026-0882</td>
                                                <td className="py-2.5 font-medium text-slate-800">Sugar Poly Woven (25kg Gusseted)</td>
                                                <td className="py-2.5 font-mono text-slate-500">Print Line #01</td>
                                                <td className="py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-20 bg-slate-200 rounded-full h-1.5">
                                                            <div className="bg-[#f59e0b] h-1.5 rounded-full w-[94%]" />
                                                        </div>
                                                        <span className="text-[10px] font-mono text-slate-600">94%</span>
                                                    </div>
                                                </td>
                                                <td className="py-2.5 text-right">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                        Flexo Printing
                                                    </span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2.5 font-mono font-bold text-[#d97706]">JOB-2026-0883</td>
                                                <td className="py-2.5 font-medium text-slate-800">Flour Sack with PE Liner Insert</td>
                                                <td className="py-2.5 font-mono text-slate-500">Stitch Unit #03</td>
                                                <td className="py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-20 bg-slate-200 rounded-full h-1.5">
                                                            <div className="bg-[#f59e0b] h-1.5 rounded-full w-[62%]" />
                                                        </div>
                                                        <span className="text-[10px] font-mono text-slate-600">62%</span>
                                                    </div>
                                                </td>
                                                <td className="py-2.5 text-right">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
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
            <section id="features" className="py-16 sm:py-24 border-t border-slate-200 bg-white relative z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Section Header */}
                    <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wider mb-3">
                            <Boxes size={14} className="text-[#d97706]" />
                            Core ERP Modules
                        </div>
                        <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                            Engineered for Every Stage of Sack Production
                        </h2>
                        <p className="text-sm sm:text-base text-slate-600 mt-3">
                            From raw polypropylene granules to finished palletized sacks, manage your entire operations stack within a single unified workspace.
                        </p>
                    </div>

                    {/* Features Grid: 6 Cards in light theme */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* 1. Production & Shop Floor */}
                        <div className="rounded-2xl bg-white hover:bg-slate-50/60 border border-slate-200 hover:border-[#f59e0b]/50 p-6 sm:p-7 transition-all duration-200 group shadow-xs hover:shadow-md">
                            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#d97706] mb-5 group-hover:scale-105 transition-transform">
                                <Factory size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">
                                Production & Shop Floor
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Real-time tape extrusion monitoring, circular loom fabric yields, stitcher conversion counts, and shift operator downtime logs.
                            </p>
                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-[#d97706]">
                                <span>Loom tracking & batch BOM</span>
                                <ArrowRight size={14} />
                            </div>
                        </div>

                        {/* 2. Quality Control */}
                        <div className="rounded-2xl bg-white hover:bg-slate-50/60 border border-slate-200 hover:border-[#f59e0b]/50 p-6 sm:p-7 transition-all duration-200 group shadow-xs hover:shadow-md">
                            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#d97706] mb-5 group-hover:scale-105 transition-transform">
                                <ShieldCheck size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">
                                Quality Control
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Enforce GSM weight checks, tape denier tensile limits, drop tests, burst strength ratings, and quarantine non-conforming lots.
                            </p>
                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-[#d97706]">
                                <span>Batch certificates & testing</span>
                                <ArrowRight size={14} />
                            </div>
                        </div>

                        {/* 3. Inventory & Stock */}
                        <div className="rounded-2xl bg-white hover:bg-slate-50/60 border border-slate-200 hover:border-[#f59e0b]/50 p-6 sm:p-7 transition-all duration-200 group shadow-xs hover:shadow-md">
                            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#d97706] mb-5 group-hover:scale-105 transition-transform">
                                <Warehouse size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">
                                Inventory & Stock
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Multi-warehouse control for virgin PP resin granules, masterbatch colors, fabric bobbins, unprinted rolls, and finished packed bags.
                            </p>
                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-[#d97706]">
                                <span>Granule silos & roll tracking</span>
                                <ArrowRight size={14} />
                            </div>
                        </div>

                        {/* 4. POS Billing */}
                        <div className="rounded-2xl bg-white hover:bg-slate-50/60 border border-slate-200 hover:border-[#f59e0b]/50 p-6 sm:p-7 transition-all duration-200 group shadow-xs hover:shadow-md">
                            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#d97706] mb-5 group-hover:scale-105 transition-transform">
                                <Receipt size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">
                                POS Billing
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Rapid wholesale POS counter billing, multi-rate GST computation, client credit ledger tracking, and instant PDF invoice printing.
                            </p>
                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-[#d97706]">
                                <span>GST ready & instant receipts</span>
                                <ArrowRight size={14} />
                            </div>
                        </div>

                        {/* 5. Purchase & GRN */}
                        <div className="rounded-2xl bg-white hover:bg-slate-50/60 border border-slate-200 hover:border-[#f59e0b]/50 p-6 sm:p-7 transition-all duration-200 group shadow-xs hover:shadow-md">
                            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#d97706] mb-5 group-hover:scale-105 transition-transform">
                                <ShoppingCart size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">
                                Purchase & GRN
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Automated purchase requisitions for polymer raw materials, vendor quotation comparison, and Good Receipt Notes (GRN) verification.
                            </p>
                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-[#d97706]">
                                <span>Supplier audits & PO approvals</span>
                                <ArrowRight size={14} />
                            </div>
                        </div>

                        {/* 6. Analytics & Reports */}
                        <div className="rounded-2xl bg-white hover:bg-slate-50/60 border border-slate-200 hover:border-[#f59e0b]/50 p-6 sm:p-7 transition-all duration-200 group shadow-xs hover:shadow-md">
                            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#d97706] mb-5 group-hover:scale-105 transition-transform">
                                <BarChart3 size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">
                                Analytics & Reports
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Granular cost-per-bag calculations, resin consumption trends, machine efficiency heatmaps, and executive revenue dashboards.
                            </p>
                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-[#d97706]">
                                <span>Per-sack margins & yield stats</span>
                                <ArrowRight size={14} />
                            </div>
                        </div>
                    </div>

                    {/* TODO: client image — manufacturing/warehouse photo */}
                    <div className="mt-10 rounded-2xl overflow-hidden border border-slate-200/80 bg-slate-50/50 shadow-xs">
                        <img
                            src=""
                            alt="PolySack Smart Warehouse Operations"
                            className="w-full h-auto max-h-80 object-cover object-center empty:hidden"
                        />
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
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wider">
                            <Layers size={14} className="text-[#d97706]" />
                            Tailored For Manufacturers
                        </div>
                        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-snug">
                            Why PolySack Outperforms Generic ERPs
                        </h2>
                        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                            Generic ERPs don't understand denier calculations, loom warp/weft tension, or cylinder printing setups. PolySack was built from the ground up for packaging manufacturers.
                        </p>
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => setIsDemoModalOpen(true)}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-slate-950 bg-[#f59e0b] hover:bg-[#d97706] transition-all shadow-sm shadow-[#f59e0b]/20 cursor-pointer"
                            >
                                <span>Schedule Plant Walkthrough</span>
                                <ArrowRight size={16} />
                            </button>
                        </div>

                        {/* TODO: client image — manufacturing/warehouse photo */}
                        <div className="pt-4 rounded-xl overflow-hidden">
                            <img
                                src=""
                                alt="Circular Loom Weaving Floor"
                                className="w-full h-44 rounded-xl object-cover object-center border border-slate-200 empty:hidden"
                            />
                        </div>
                    </div>

                    {/* Right Column: 4 Bullet Value Props */}
                    <div className="lg:col-span-7 space-y-4">
                        {/* Benefit 1 */}
                        <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all flex items-start gap-4 shadow-xs">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                                <Check size={20} />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-base font-bold text-slate-900">
                                    Multi-tenant & multi-location ready
                                </h4>
                                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                    Run multiple plant units (e.g. Vapi, Surat, Ahmedabad) under fully isolated tenant boundaries with centralized corporate oversight.
                                </p>
                            </div>
                        </div>

                        {/* Benefit 2 */}
                        <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all flex items-start gap-4 shadow-xs">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-[#d97706] flex items-center justify-center shrink-0 mt-0.5">
                                <Check size={20} />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-base font-bold text-slate-900">
                                    Built for PP/paper woven sack manufacturing
                                </h4>
                                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                    Native formulas for tape GSM, mesh density, circular loom width, gusseting depth, and valve bag conversion parameters.
                                </p>
                            </div>
                        </div>

                        {/* Benefit 3 */}
                        <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all flex items-start gap-4 shadow-xs">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                                <Check size={20} />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-base font-bold text-slate-900">
                                    GST-compliant billing & inventory
                                </h4>
                                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                    Automatic HSN classification (3923/6305), automated e-Way bill sync, and instant warehouse stock deductions upon dispatch.
                                </p>
                            </div>
                        </div>

                        {/* Benefit 4 */}
                        <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all flex items-start gap-4 shadow-xs">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                                <Check size={20} />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-base font-bold text-slate-900">
                                    Real-time scrap & wastage minimization
                                </h4>
                                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
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
            <section id="workflow" className="py-16 sm:py-20 bg-slate-50/80 border-y border-slate-200 relative z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-2xl mx-auto mb-12">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#d97706] block mb-2">
                            End-to-End Traceability
                        </span>
                        <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                            Complete Production Pipeline Tracking
                        </h3>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
                        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-[#f59e0b]/50 hover:shadow-sm transition-all">
                            <div className="text-xs font-mono font-bold text-[#d97706] mb-1">STAGE 01</div>
                            <div className="font-bold text-sm text-slate-900">Raw Granules</div>
                            <div className="text-[11px] text-slate-500 mt-1">PP, CaCO3 & Pigment</div>
                        </div>
                        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-[#f59e0b]/50 hover:shadow-sm transition-all">
                            <div className="text-xs font-mono font-bold text-[#d97706] mb-1">STAGE 02</div>
                            <div className="font-bold text-sm text-slate-900">Tape Extrusion</div>
                            <div className="text-[11px] text-slate-500 mt-1">Denier & Bobbin Wind</div>
                        </div>
                        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-[#f59e0b]/50 hover:shadow-sm transition-all">
                            <div className="text-xs font-mono font-bold text-[#d97706] mb-1">STAGE 03</div>
                            <div className="font-bold text-sm text-slate-900">Circular Looms</div>
                            <div className="text-[11px] text-slate-500 mt-1">Tubular Fabric Weave</div>
                        </div>
                        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-[#f59e0b]/50 hover:shadow-sm transition-all">
                            <div className="text-xs font-mono font-bold text-[#d97706] mb-1">STAGE 04</div>
                            <div className="font-bold text-sm text-slate-900">Lamination</div>
                            <div className="text-[11px] text-slate-500 mt-1">BOPP & Kraft Layer</div>
                        </div>
                        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-[#f59e0b]/50 hover:shadow-sm transition-all">
                            <div className="text-xs font-mono font-bold text-[#d97706] mb-1">STAGE 05</div>
                            <div className="font-bold text-sm text-slate-900">Flexo Printing</div>
                            <div className="text-[11px] text-slate-500 mt-1">Multi-Color Branding</div>
                        </div>
                        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-[#f59e0b]/50 hover:shadow-sm transition-all">
                            <div className="text-xs font-mono font-bold text-[#d97706] mb-1">STAGE 06</div>
                            <div className="font-bold text-sm text-slate-900">Bale & Dispatch</div>
                            <div className="text-[11px] text-slate-500 mt-1">e-Way Bill & Delivery</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* BOTTOM CALL TO ACTION                                                     */}
            {/* ========================================================================= */}
            <section className="py-16 sm:py-24 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                <div className="rounded-3xl bg-gradient-to-b from-amber-50/50 via-white to-slate-50 border-2 border-amber-200/80 p-8 sm:p-12 shadow-xl space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-200/20 rounded-full blur-3xl pointer-events-none" />

                    <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                        Ready to Modernize Your Sack Manufacturing Operations?
                    </h2>
                    <p className="text-slate-600 max-w-xl mx-auto text-sm sm:text-base">
                        Get up and running in days. No complex on-premise hardware required. Connect your machines and start tracking production immediately.
                    </p>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                        <button
                            type="button"
                            onClick={() => setIsDemoModalOpen(true)}
                            className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm sm:text-base font-black text-slate-950 bg-[#f59e0b] hover:bg-[#d97706] transition-all shadow-md shadow-[#f59e0b]/25 cursor-pointer"
                        >
                            Request Product Demo
                        </button>
                        <Link
                            to="/login"
                            className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm sm:text-base font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 shadow-xs transition-all text-center"
                        >
                            Access Existing Tenant Portal
                        </Link>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* FOOTER SECTION                                                            */}
            {/* ========================================================================= */}
            <footer className="border-t border-slate-200 bg-white relative z-10 text-slate-600 font-sans">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                        {/* Brand info */}
                        <div className="md:col-span-2 space-y-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-[#d97706]">
                                    <Package size={18} />
                                </div>
                                <span className="text-lg font-black text-slate-900">PolySack ERP</span>
                            </div>
                            <p className="text-xs text-slate-600 max-w-sm leading-relaxed">
                                Enterprise resource planning system designed specifically for polypropylene (PP), HDPE, and paper woven sack manufacturing plants.
                            </p>
                        </div>

                        {/* Quick Links */}
                        <div className="space-y-2">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                Modules
                            </div>
                            <ul className="space-y-1.5 text-xs">
                                <li>
                                    <a href="#features" className="hover:text-[#d97706] transition-colors">
                                        Production & Shop Floor
                                    </a>
                                </li>
                                <li>
                                    <a href="#features" className="hover:text-[#d97706] transition-colors">
                                        Quality Assurance
                                    </a>
                                </li>
                                <li>
                                    <a href="#features" className="hover:text-[#d97706] transition-colors">
                                        Inventory Silos
                                    </a>
                                </li>
                                <li>
                                    <a href="#features" className="hover:text-[#d97706] transition-colors">
                                        POS & GST Billing
                                    </a>
                                </li>
                            </ul>
                        </div>

                        {/* Legal & Contacts */}
                        <div className="space-y-2">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                Resources & Support
                            </div>
                            <ul className="space-y-1.5 text-xs">
                                <li>
                                    <a href="#privacy" className="hover:text-[#d97706] transition-colors">
                                        Privacy Policy
                                    </a>
                                </li>
                                <li>
                                    <a href="#terms" className="hover:text-[#d97706] transition-colors">
                                        Terms of Service
                                    </a>
                                </li>
                                <li>
                                    <a href="#contact" className="hover:text-[#d97706] transition-colors">
                                        Contact Sales
                                    </a>
                                </li>
                                <li>
                                    <Link to="/login" className="hover:text-[#d97706] transition-colors">
                                        Client Sign In
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Bottom Copyright Bar */}
                    <div className="pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 text-center sm:text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                            <span>
                                © {new Date().getFullYear()} PolySack ERP. All Rights Reserved.
                            </span>
                            <span className="hidden sm:inline text-slate-400">•</span>
                            <span>
                                Designed &amp; Developed by{' '}❤️
                                <a
                                    href="https://requinsolutions.com/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-700 hover:text-[#d97706] font-medium transition-colors underline-offset-2 hover:underline"
                                >
                                    Requin Solutions Pvt. Ltd
                                </a>
                            </span>
                        </div>
                        <div className="flex items-center gap-6">
                            <a href="#privacy" className="hover:text-slate-700 transition-colors">
                                Privacy
                            </a>
                            <a href="#terms" className="hover:text-slate-700 transition-colors">
                                Terms
                            </a>
                            <a href="#contact" className="hover:text-slate-700 transition-colors">
                                Contact
                            </a>
                        </div>
                    </div>
                </div>
            </footer>

            {/* ========================================================================= */}
            {/* REQUEST A DEMO MODAL                                                      */}
            {/* ========================================================================= */}
            {isDemoModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-2xl relative space-y-5">
                        <button
                            type="button"
                            onClick={closeDemoModal}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="space-y-1">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#d97706] mb-3">
                                <Package size={20} />
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-900">
                                {demoSubmitted ? 'Demo Request Received!' : 'Request a Plant Demo'}
                            </h3>
                            <p className="text-xs text-slate-600">
                                {demoSubmitted
                                    ? 'Our manufacturing systems engineer will reach out within 24 business hours.'
                                    : 'See how PolySack optimizes your looms, bobbins, and invoicing.'}
                            </p>
                        </div>

                        {demoSubmitted ? (
                            <div className="space-y-4 pt-2">
                                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-3">
                                    <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-emerald-900">Thank you, {demoForm.fullName || 'Valued Manufacturer'}!</p>
                                        <p className="mt-1 leading-relaxed">
                                            We will prepare a customized walkthrough focusing on {demoForm.bagType} production pipelines.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeDemoModal}
                                    className="w-full py-2.5 rounded-lg text-sm font-bold text-slate-950 bg-[#f59e0b] hover:bg-[#d97706] transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleDemoSubmit} className="space-y-3.5">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                                        Your Full Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={demoForm.fullName}
                                        onChange={(e) => setDemoForm({ ...demoForm, fullName: e.target.value })}
                                        placeholder="e.g. Rajesh Patel"
                                        className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm outline-none focus:border-[#f59e0b] focus:bg-white focus:ring-1 focus:ring-[#f59e0b] transition-all"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                                        Plant / Company Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={demoForm.companyName}
                                        onChange={(e) => setDemoForm({ ...demoForm, companyName: e.target.value })}
                                        placeholder="e.g. Gujarat PolySacks Ltd."
                                        className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm outline-none focus:border-[#f59e0b] focus:bg-white focus:ring-1 focus:ring-[#f59e0b] transition-all"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                                            Work Email
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            value={demoForm.email}
                                            onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                                            placeholder="you@company.com"
                                            className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm outline-none focus:border-[#f59e0b] focus:bg-white focus:ring-1 focus:ring-[#f59e0b] transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                                            Phone / WhatsApp
                                        </label>
                                        <input
                                            type="tel"
                                            required
                                            value={demoForm.phone}
                                            onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                                            placeholder="+91 98765 43210"
                                            className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm outline-none focus:border-[#f59e0b] focus:bg-white focus:ring-1 focus:ring-[#f59e0b] transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                                        Primary Product Category
                                    </label>
                                    <select
                                        value={demoForm.bagType}
                                        onChange={(e) => setDemoForm({ ...demoForm, bagType: e.target.value })}
                                        className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs sm:text-sm outline-none focus:border-[#f59e0b] focus:bg-white focus:ring-1 focus:ring-[#f59e0b] transition-all"
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
                                        className="w-full py-3 rounded-lg text-sm font-bold text-slate-950 bg-[#f59e0b] hover:bg-[#d97706] transition-all shadow-md shadow-[#f59e0b]/20 cursor-pointer"
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
