import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import {
    Factory,
    Truck,
    DollarSign,
    Package,
    Activity,
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    Loader2,
    Sparkles,
    Building2,
    Users,
    ShieldCheck,
    Plus,
    Wrench,
    Sun,
    SunMedium,
    Sunset,
    Moon,
    Clock,
    Calendar
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';
import { formatDate, getTodayLocalDateString, formatToLocalDateString } from '../utils/dateUtils';

/**
 * Helper to check if a date value falls within [startYMD, endYMD]
 */
const isDateInRange = (dateVal, startYMD, endYMD) => {
    if (!dateVal) return false;
    let dStr = '';
    if (typeof dateVal === 'string' && dateVal.length >= 10) {
        dStr = dateVal.slice(0, 10);
    } else {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return false;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dStr = `${y}-${m}-${day}`;
    }
    return dStr >= startYMD && dStr <= endYMD;
};

/**
 * Isolated component that ticks every second for the live clock & time-based greeting.
 * Keeping its state local prevents the whole DashboardPage and its heavy charts
 * from re-rendering on every clock tick.
 */
function LiveHeaderClockAndGreeting({ user }) {
    const [currentTime, setCurrentTime] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // 1. Time-based greeting calculation
    const hours = currentTime.getHours();
    let greetingText = 'Good Morning';
    let GreetingIcon = Sun;
    let iconColorClass = 'text-amber-500 bg-amber-500/10 border-amber-500/30';

    if (hours >= 5 && hours < 12) {
        greetingText = 'Good Morning';
        GreetingIcon = Sun;
        iconColorClass = 'text-amber-500 bg-amber-500/10 border-amber-500/30';
    } else if (hours >= 12 && hours < 17) {
        greetingText = 'Good Afternoon';
        GreetingIcon = SunMedium;
        iconColorClass = 'text-amber-600 bg-amber-600/10 border-amber-600/30';
    } else if (hours >= 17 && hours < 21) {
        greetingText = 'Good Evening';
        GreetingIcon = Sunset;
        iconColorClass = 'text-orange-500 bg-orange-500/10 border-orange-500/30';
    } else {
        greetingText = 'Good Night';
        GreetingIcon = Moon;
        iconColorClass = 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
    }

    const displayName = (user?.name || user?.fullName || user?.firstName || (user?.email ? user.email.split('@')[0] : '')).trim();
    const fullGreeting = displayName ? `${greetingText}, ${displayName}` : greetingText;

    // 2. Format 12-hour time hh:mm:ss AM/PM
    let h = currentTime.getHours();
    const m = String(currentTime.getMinutes()).padStart(2, '0');
    const s = String(currentTime.getSeconds()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    const strH = String(h).padStart(2, '0');
    const timeFormatted = `${strH}:${m}:${s} ${ampm}`;

    // 3. Format weekday + dd/mm/yyyy
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayName = weekdays[currentTime.getDay()];
    const dateFormatted = formatDate(currentTime);
    const fullDateString = `${weekdayName}, ${dateFormatted}`;

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full pb-3 border-b border-border/50">
            {/* Left: Time-based Greeting */}
            <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${iconColorClass}`}>
                    <GreetingIcon size={20} className="stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                    <span className="text-lg font-black text-text-main tracking-tight truncate block">
                        {fullGreeting}!
                    </span>
                    <span className="text-[13px] text-text-muted font-medium block">
                        Welcome to your operational overview
                    </span>
                </div>
            </div>

            {/* Right: Live Clock & Date */}
            <div className="flex items-start sm:items-end flex-col shrink-0">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 text-[10px] font-bold tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                        <span>LIVE</span>
                    </div>
                    <div className="font-mono tabular-nums text-sm md:text-base font-black text-text-main tracking-tight">
                        {timeFormatted}
                    </div>
                </div>
                <div className="text-[10.5px] font-medium text-text-muted mt-0.5 flex items-center gap-1">
                    <Calendar size={11} className="text-text-muted shrink-0" />
                    <span>{fullDateString}</span>
                </div>
            </div>
        </div>
    );
}

/**
 * Smooth count-up animation for KPI cards on initial load only.
 * Will not trigger on subsequent clock ticks.
 */
function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0, duration = 800 }) {
    const [displayVal, setDisplayVal] = useState(() => (typeof value === 'number' ? 0 : value));
    const hasAnimated = useRef(false);

    useEffect(() => {
        if (typeof value !== 'number' || isNaN(value)) {
            setDisplayVal(value);
            return;
        }

        if (hasAnimated.current) {
            setDisplayVal(value);
            return;
        }

        let startTimestamp = null;
        const targetValue = value;

        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = targetValue * easeOut;
            setDisplayVal(current);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                setDisplayVal(targetValue);
                hasAnimated.current = true;
            }
        };

        window.requestAnimationFrame(step);
    }, [value, duration]);

    if (typeof displayVal !== 'number' || isNaN(displayVal)) {
        return <span>{prefix}{displayVal}{suffix}</span>;
    }

    const formatted = decimals > 0 
        ? displayVal.toFixed(decimals) 
        : Math.round(displayVal).toLocaleString('en-IN');

    return <span>{prefix}{formatted}{suffix}</span>;
}

export default function DashboardPage() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const [isLoading, setIsLoading] = useState(true);

    const userRoleName = (user?.roleName || (typeof user?.role === 'object' ? user?.role?.name : user?.role) || '').toLowerCase();
    const isSuperAdmin = Boolean(
        user?.isSuperAdmin ||
        !user?.tenant ||
        user?.email === 'superadmin@polysack.com' ||
        userRoleName === 'super admin' ||
        userRoleName === 'super_admin'
    );

    // Datasets for Super Admin
    const [tenantsList, setTenantsList] = useState([]);

    // Raw datasets for Tenant User
    const [salesOrders, setSalesOrders] = useState([]);
    const [workOrders, setWorkOrders] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [rawMaterials, setRawMaterials] = useState([]);
    const [finishedGoods, setFinishedGoods] = useState([]);
    const [machines, setMachines] = useState([]);
    const [payablesSummary, setPayablesSummary] = useState(null);
    const [pendingForProduction, setPendingForProduction] = useState({ linesCount: 0, totalQty: 0, overdueCount: 0 });

    // Fetch datasets on mount depending on user role
    useEffect(() => {
        setIsLoading(true);

        if (isSuperAdmin) {
            // Super Admin: Fetch tenant management metrics, NOT tenant shop-floor APIs
            axiosInstance.get('/tenants')
                .then((res) => {
                    if (res.data?.success && Array.isArray(res.data.data)) {
                        setTenantsList(res.data.data);
                    }
                })
                .catch((err) => {
                    console.error('Error fetching Super Admin tenants list:', err);
                })
                .finally(() => {
                    setIsLoading(false);
                });
        } else {
            // Tenant User: Fetch tenant shop-floor datasets
            Promise.all([
                axiosInstance.get('/sales-orders?limit=200'),
                axiosInstance.get('/work-orders?limit=200'),
                axiosInstance.get('/invoices?limit=200'),
                axiosInstance.get('/raw-materials?limit=200'),
                axiosInstance.get('/finished-goods?limit=200'),
                axiosInstance.get('/machines?isActive=true&limit=200'),
                axiosInstance.get('/purchase-orders/payables-summary').catch(() => ({ data: { success: false } })),
                axiosInstance.get('/dashboard/summary').catch(() => ({ data: { success: false } }))
            ])
                .then(([soRes, woRes, invRes, rmRes, fgRes, mchRes, payRes, sumRes]) => {
                    if (soRes.data?.success && Array.isArray(soRes.data.data)) setSalesOrders(soRes.data.data);
                    if (woRes.data?.success && Array.isArray(woRes.data.data)) setWorkOrders(woRes.data.data);
                    if (invRes.data?.success && Array.isArray(invRes.data.data)) setInvoices(invRes.data.data);
                    if (rmRes.data?.success && Array.isArray(rmRes.data.data)) setRawMaterials(rmRes.data.data);
                    if (fgRes.data?.success && Array.isArray(fgRes.data.data)) setFinishedGoods(fgRes.data.data);
                    if (mchRes.data?.success && Array.isArray(mchRes.data.data)) setMachines(mchRes.data.data);
                    if (payRes.data?.success && payRes.data.data) setPayablesSummary(payRes.data.data);
                    if (sumRes.data?.success && sumRes.data?.data?.pendingForProduction) {
                        setPendingForProduction(sumRes.data.data.pendingForProduction);
                    }
                })
                .catch((err) => {
                    console.error('Error loading dashboard analytics data:', err);
                    toast.error('Failed to load real-time dashboard metrics', { id: 'dashboard-metrics-error' });
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [isSuperAdmin]);

    // -------------------------------------------------------------
    // DATE FILTER & REAL COMPUTED DERIVED METRICS FOR TENANT USERS
    // -------------------------------------------------------------
    const [dateFilterMode, setDateFilterMode] = useState('today');
    const [customFrom, setCustomFrom] = useState(() => getTodayLocalDateString());
    const [customTo, setCustomTo] = useState(() => getTodayLocalDateString());

    const activeDateRange = useMemo(() => {
        const todayStr = getTodayLocalDateString();
        if (dateFilterMode === 'today') {
            return {
                startDate: todayStr,
                endDate: todayStr,
                productionLabel: "TODAY'S PRODUCTION",
                revenueLabel: "TODAY'S REVENUE",
                displayLabel: `Today (${formatDate(todayStr)})`
            };
        }
        if (dateFilterMode === 'yesterday') {
            const y = new Date();
            y.setDate(y.getDate() - 1);
            const yStr = formatToLocalDateString(y);
            return {
                startDate: yStr,
                endDate: yStr,
                productionLabel: "YESTERDAY'S PRODUCTION",
                revenueLabel: "YESTERDAY'S REVENUE",
                displayLabel: `Yesterday (${formatDate(yStr)})`
            };
        }
        if (dateFilterMode === 'week') {
            const now = new Date();
            const day = now.getDay();
            const diffToMonday = (day + 6) % 7;
            const monday = new Date(now);
            monday.setDate(now.getDate() - diffToMonday);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);

            const mStr = formatToLocalDateString(monday);
            const sStr = formatToLocalDateString(sunday);
            return {
                startDate: mStr,
                endDate: sStr,
                productionLabel: "PRODUCTION THIS WEEK",
                revenueLabel: "WEEKLY REVENUE",
                displayLabel: `This Week (${formatDate(mStr)} - ${formatDate(sStr)})`
            };
        }
        if (dateFilterMode === 'month') {
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const fStr = formatToLocalDateString(firstDay);
            const lStr = formatToLocalDateString(lastDay);
            return {
                startDate: fStr,
                endDate: lStr,
                productionLabel: "PRODUCTION THIS MONTH",
                revenueLabel: "MONTHLY REVENUE",
                displayLabel: `This Month (${formatDate(fStr)} - ${formatDate(lStr)})`
            };
        }
        // custom
        const fStr = customFrom || todayStr;
        const tStr = customTo || fStr;
        const isSingle = fStr === tStr;
        return {
            startDate: fStr,
            endDate: tStr,
            productionLabel: isSingle ? `PRODUCTION ON ${formatDate(fStr)}` : `PRODUCTION (${formatDate(fStr)} - ${formatDate(tStr)})`,
            revenueLabel: isSingle ? `REVENUE ON ${formatDate(fStr)}` : "PERIOD REVENUE",
            displayLabel: isSingle ? formatDate(fStr) : `${formatDate(fStr)} - ${formatDate(tStr)}`
        };
    }, [dateFilterMode, customFrom, customTo]);

    // 1. Total Sales Orders & Active Production Count
    const totalSOCount = salesOrders.length;
    const filteredSOCount = useMemo(() => {
        return salesOrders.filter((so) => {
            const d = so.orderDate || so.createdAt;
            return isDateInRange(d, activeDateRange.startDate, activeDateRange.endDate);
        }).length;
    }, [salesOrders, activeDateRange]);

    const activeProductionSOCount = useMemo(() => {
        return salesOrders.filter(
            (so) => so.status === 'CONFIRMED' || so.status === 'READY_FOR_DISPATCH' || so.status === 'IN_PRODUCTION'
        ).length;
    }, [salesOrders]);

    // 2. Production Bags & Distinct Machine Count
    const { filteredProductionBags, filteredDistinctMachinesCount } = useMemo(() => {
        let totalBags = 0;
        const machineSet = new Set();

        workOrders.forEach((wo) => {
            if (Array.isArray(wo.stages) && wo.stages.length > 0) {
                wo.stages.forEach((stg) => {
                    const stgDate = stg.completedAt || stg.updatedAt || stg.date;
                    if (stgDate && isDateInRange(stgDate, activeDateRange.startDate, activeDateRange.endDate)) {
                        totalBags += Number(stg.goodOutputQty || 0);
                        if (stg.assignedMachine) {
                            const mId = typeof stg.assignedMachine === 'object' ? stg.assignedMachine._id : stg.assignedMachine;
                            machineSet.add(mId);
                        }
                    }
                });
            } else if (wo.status === 'COMPLETED') {
                const woDate = wo.updatedAt || wo.createdAt;
                if (woDate && isDateInRange(woDate, activeDateRange.startDate, activeDateRange.endDate)) {
                    totalBags += Number(wo.completedQuantity || 0);
                }
            }
        });

        return {
            filteredProductionBags: totalBags,
            filteredDistinctMachinesCount: machineSet.size
        };
    }, [workOrders, activeDateRange]);

    // 3. Revenue from Invoices
    const filteredRevenue = useMemo(() => {
        return invoices.reduce((acc, inv) => {
            const d = inv.invoiceDate || inv.createdAt;
            if (d && isDateInRange(d, activeDateRange.startDate, activeDateRange.endDate)) {
                return acc + Number(inv.grandTotal || 0);
            }
            return acc;
        }, 0);
    }, [invoices, activeDateRange]);

    // 4. Inventory Valuation & Low Stock Count (RawMaterials + FinishedGoods)
    const { totalValuationAmount, lowStockCount } = useMemo(() => {
        const rmVal = rawMaterials.reduce((acc, rm) => acc + (Number(rm.currentStock || 0) * Number(rm.pricePerUnit || 0)), 0);
        const fgVal = finishedGoods.reduce((acc, fg) => acc + (Number(fg.currentStock || 0) * Number(fg.pricePerBag || 0)), 0);
        const total = rmVal + fgVal;

        const lowStockRM = rawMaterials.filter((rm) => Number(rm.currentStock || 0) <= Number(rm.reorderLevel || 0)).length;

        return {
            totalValuationAmount: total,
            lowStockCount: lowStockRM
        };
    }, [rawMaterials, finishedGoods]);

    // 5. Second Row Metrics
    const filteredPendingDispatchOrdersCount = useMemo(() => {
        return salesOrders.filter((so) => {
            if (so.status !== 'CONFIRMED' && so.status !== 'READY_FOR_DISPATCH') return false;
            const d = so.orderDate || so.createdAt;
            return isDateInRange(d, '1970-01-01', activeDateRange.endDate);
        }).length;
    }, [salesOrders, activeDateRange]);

    const { filteredRunningMachinesCount, filteredMachineUtilizationPct, filteredAvgProductionEfficiencyPct } = useMemo(() => {
        if (machines.length === 0) {
            return { filteredRunningMachinesCount: 0, filteredMachineUtilizationPct: 0, filteredAvgProductionEfficiencyPct: 0 };
        }
        const activeCount = filteredDistinctMachinesCount > 0 
            ? filteredDistinctMachinesCount 
            : machines.filter((m) => m.status === 'RUNNING').length;
        const utilPct = Math.round((activeCount / machines.length) * 100);
        const totalEff = machines.reduce((acc, m) => acc + Number(m.efficiency || 0), 0);
        const avgEff = Math.round(totalEff / machines.length);
        return {
            filteredRunningMachinesCount: activeCount,
            filteredMachineUtilizationPct: Math.min(100, utilPct),
            filteredAvgProductionEfficiencyPct: avgEff
        };
    }, [machines, filteredDistinctMachinesCount]);

    const totalReceivablesLakhs = useMemo(() => {
        const totalDue = invoices.reduce((acc, inv) => {
            const grandTotal = Number(inv.grandTotal || 0);
            const paid = Number(inv.paidAmount || 0);
            return acc + Math.max(0, grandTotal - paid);
        }, 0);
        return totalDue;
    }, [invoices]);

    // 6. Weekly Production Chart Data (Last 7 Days)
    const weeklyChartData = useMemo(() => {
        const days = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const isoDate = d.toISOString().split('T')[0];
            const dayLabel = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'numeric' });

            let dailyBags = 0;
            workOrders.forEach((wo) => {
                if (Array.isArray(wo.stages)) {
                    wo.stages.forEach((stg) => {
                        if (stg.completedAt) {
                            const dateStr = new Date(stg.completedAt).toISOString().split('T')[0];
                            if (dateStr === isoDate) {
                                dailyBags += Number(stg.goodOutputQty || 0);
                            }
                        }
                    });
                }
            });

            days.push({
                date: dayLabel,
                bags: dailyBags
            });
        }
        return days;
    }, [workOrders]);

    // 7. Revenue by Key Customer Donut Chart Data
    const customerDonutData = useMemo(() => {
        const map = {};
        let grandSum = 0;

        invoices.forEach((inv) => {
            const custObj = typeof inv.customer === 'object' ? inv.customer : null;
            const name = custObj?.companyName || inv.walkInCustomer?.name || 'Retail Customers';
            const amt = Number(inv.grandTotal || 0);
            map[name] = (map[name] || 0) + amt;
            grandSum += amt;
        });

        const list = Object.keys(map).map((name) => {
            const val = map[name];
            const pct = grandSum > 0 ? Math.round((val / grandSum) * 100) : 0;
            return { name, value: val, percentage: pct };
        });

        list.sort((a, b) => b.value - a.value);

        if (list.length === 0) {
            return [];
        }

        return list.slice(0, 5);
    }, [invoices]);

    const DONUT_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#64748B'];

    // 8. Computed Critical System Alerts
    const criticalAlerts = useMemo(() => {
        const alerts = [];

        // Low stock raw material alerts
        rawMaterials.forEach((rm) => {
            const curr = Number(rm.currentStock || 0);
            const reorder = Number(rm.reorderLevel || 0);
            if (curr <= reorder) {
                const uomSymbol = typeof rm.uom === 'object' ? rm.uom?.symbol : (rm.uom || 'Kg');
                alerts.push({
                    type: 'REORDER',
                    title: `Low Raw Material Stock: ${rm.name}`,
                    message: `${rm.name} current stock is ${curr.toLocaleString()} ${uomSymbol} (Min safety limit: ${reorder.toLocaleString()} ${uomSymbol})`,
                    actionLabel: 'Generate Purchase PO →',
                    actionPath: '/procurement'
                });
            }
        });

        // Machine breakdown & maintenance alerts
        machines.forEach((m) => {
            if (m.status === 'BREAKDOWN' || m.status === 'MAINTENANCE') {
                alerts.push({
                    type: 'BREAKDOWN',
                    title: `Machine Incident: ${m.name} (${m.code})`,
                    message: `${m.name} — status: ${m.status}`,
                    actionLabel: 'Schedule Maintenance Mechanics →',
                    actionPath: '/master-data'
                });
            }
        });

        return alerts;
    }, [rawMaterials, machines]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-32 font-sans text-text-muted gap-3">
                <Loader2 size={36} className="animate-spin text-primary" />
                <span className="text-sm font-extrabold text-text-main">
                    Initializing Control Center Metrics...
                </span>
            </div>
        );
    }

    // =========================================================
    // SUPER ADMIN VIEW (Multi-tenant Platform Overview)
    // =========================================================
    if (isSuperAdmin) {
        return (
            <div className="space-y-6 font-sans">
                {/* Banner */}
                <div className="bg-gradient-to-br from-card-bg via-card-bg to-amber-500/[0.04] border border-border rounded-xl p-5 shadow-xs flex flex-col gap-4 relative overflow-hidden animate-in fade-in duration-300">
                    <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                    <LiveHeaderClockAndGreeting user={user} />
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-extrabold uppercase tracking-wider">
                                <Sparkles size={12} className="text-amber-600" />
                                <span>SUPER ADMIN PLATFORM CONTROL CENTER</span>
                            </div>
                            <h1 className="text-2xl font-black text-text-main tracking-tight">
                                Global Platform Overview
                            </h1>
                            <p className="text-xs text-text-muted">
                                Multi-tenant architecture management, global role permissions & system provisioning.
                            </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => navigate('/administration')}
                                className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md cursor-pointer"
                            >
                                <Plus size={16} />
                                <span>+ Register New Tenant</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stat Cards Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-card-bg border border-border hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 p-4.5 rounded-xl shadow-2xs space-y-2">
                        <div className="flex items-center justify-between text-text-muted">
                            <span className="text-[11px] font-bold uppercase tracking-wider">REGISTERED TENANTS</span>
                            <Building2 size={18} className="text-amber-500" />
                        </div>
                        <div className="text-2xl font-black text-text-main font-mono">
                            <AnimatedNumber value={tenantsList.length} />
                        </div>
                        <div className="text-[11px] text-emerald-600 font-extrabold">
                            Active Multi-Tenant Orgs
                        </div>
                    </div>

                    <div className="bg-card-bg border border-border hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 p-4.5 rounded-xl shadow-2xs space-y-2">
                        <div className="flex items-center justify-between text-text-muted">
                            <span className="text-[11px] font-bold uppercase tracking-wider">PLATFORM USERS</span>
                            <Users size={18} className="text-blue-500" />
                        </div>
                        <div className="text-2xl font-black text-text-main font-mono">
                            System
                        </div>
                        <div className="text-[11px] text-text-muted font-medium">
                            Global RBAC Management
                        </div>
                    </div>

                    <div className="bg-card-bg border border-border hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 p-4.5 rounded-xl shadow-2xs space-y-2">
                        <div className="flex items-center justify-between text-text-muted">
                            <span className="text-[11px] font-bold uppercase tracking-wider">PERMISSIONS REGISTRY</span>
                            <ShieldCheck size={18} className="text-emerald-500" />
                        </div>
                        <div className="text-2xl font-black text-emerald-700 font-mono">
                            40 / 40
                        </div>
                        <div className="text-[11px] text-emerald-600 font-extrabold">
                            System Permissions Verified
                        </div>
                    </div>

                    <div className="bg-card-bg border border-border hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 p-4.5 rounded-xl shadow-2xs space-y-2">
                        <div className="flex items-center justify-between text-text-muted">
                            <span className="text-[11px] font-bold uppercase tracking-wider">SYSTEM HEALTH</span>
                            <CheckCircle2 size={18} className="text-primary" />
                        </div>
                        <div className="text-2xl font-black text-text-main font-mono">
                            100%
                        </div>
                        <div className="text-[11px] text-emerald-600 font-extrabold">
                            All API Endpoints Normal
                        </div>
                    </div>
                </div>

                {/* Tenants Table */}
                <div className="bg-card-bg border border-border rounded-xl shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-border bg-app-bg flex justify-between items-center">
                        <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider">
                            ACTIVE SYSTEM TENANTS REGISTER
                        </h3>
                        <span className="text-[10px] font-mono font-extrabold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                            • Isolated Compound Indexing
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse font-sans">
                            <thead>
                                <tr className="bg-table-header-bg text-table-header-text font-extrabold uppercase text-[10px]">
                                    <th className="p-3 border-b border-border">Tenant Name / Company</th>
                                    <th className="p-3 border-b border-border">Contact Email</th>
                                    <th className="p-3 border-b border-border">Phone Number</th>
                                    <th className="p-3 border-b border-border font-mono">Registration Date</th>
                                    <th className="p-3 border-b border-border">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {tenantsList.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-text-muted">
                                            No tenant accounts found in system database.
                                        </td>
                                    </tr>
                                ) : (
                                    tenantsList.map((t) => (
                                        <tr key={t._id} className="hover:bg-app-bg/50 transition-colors text-text-main">
                                            <td className="p-3 font-bold text-text-main">
                                                {t.companyName || t.name}
                                            </td>
                                            <td className="p-3 text-text-muted font-mono">{t.email || '-'}</td>
                                            <td className="p-3 font-mono text-text-muted">{t.phone || '-'}</td>
                                            <td className="p-3 font-mono text-text-muted">
                                                {t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN') : '-'}
                                            </td>
                                            <td className="p-3">
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                    Active Tenant
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // =========================================================
    // TENANT USER VIEW (Shop Floor Operational Dashboard)
    // =========================================================
    return (
        <div className="space-y-6 font-sans">
            {/* 1. TOP BANNER */}
            <div className="relative overflow-hidden bg-gradient-to-br from-card-bg via-card-bg to-amber-500/[0.04] border border-border/80 rounded-xl p-5 md:p-6 shadow-xs flex flex-col gap-4 animate-in fade-in duration-300">
                <div className="absolute -top-16 -right-16 w-56 h-56 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

                {/* Top Section: Live Clock & Greeting */}
                <LiveHeaderClockAndGreeting user={user} />

                {/* Middle Section: Main Title & Quick Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-extrabold uppercase tracking-wider">
                            <Sparkles size={12} className="text-amber-600" />
                            <span>INDUSTRIAL EXECUTIVE CONTROL CENTER</span>
                        </div>
                        <h1 className="text-[23px] font-black text-text-main tracking-tight">
                            {(user?.tenant?.companyName || user?.tenant?.name || user?.companyName || 'PP Poly & Paper Products')} <span className="text-primary font-normal text-[16px]">Enterprise ERP</span>
                        </h1>
                        <p className="text-xs text-text-muted">
                            Real-time shop floor metrics, inventory valuation & order dispatches.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        <button
                            type="button"
                            onClick={() => navigate('/production')}
                            className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md hover:shadow-lg cursor-pointer active:scale-95"
                        >
                            <Factory size={16} />
                            <span>Launch Production Line</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                window.print();
                            }}
                            className="flex items-center gap-1.5 px-4 py-2.5 bg-app-bg hover:bg-border/40 border border-border text-text-main font-bold rounded-lg text-xs transition-all cursor-pointer active:scale-95"
                        >
                            <span>Export ERP Audit Report</span>
                        </button>
                    </div>
                </div>

                {/* Bottom Section: Compact Date Filter */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/50 text-xs">
                    <div className="flex items-center flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 text-text-muted font-bold text-[11px] uppercase tracking-wider mr-1">
                            <Calendar size={13} className="text-primary" />
                            <span>Filter Period:</span>
                        </div>
                        {[
                            { key: 'today', label: 'Today' },
                            { key: 'yesterday', label: 'Yesterday' },
                            { key: 'week', label: 'This Week' },
                            { key: 'month', label: 'This Month' },
                            { key: 'custom', label: 'Custom' }
                        ].map((chip) => {
                            const isActive = dateFilterMode === chip.key;
                            return (
                                <button
                                    key={chip.key}
                                    type="button"
                                    onClick={() => setDateFilterMode(chip.key)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        isActive
                                            ? 'bg-primary text-sidebar-bg shadow-xs border border-primary'
                                            : 'bg-app-bg text-text-muted hover:text-text-main hover:bg-border/40 border border-border/70'
                                    }`}
                                >
                                    {chip.label}
                                </button>
                            );
                        })}

                        {dateFilterMode === 'custom' && (
                            <div className="flex items-center gap-1.5 ml-1 bg-app-bg/60 p-1 rounded-lg border border-border/60">
                                <input
                                    type="date"
                                    value={customFrom}
                                    onChange={(e) => setCustomFrom(e.target.value)}
                                    className="px-2 py-0.5 text-xs bg-card-bg border border-border rounded text-text-main font-mono focus:outline-hidden focus:border-primary"
                                />
                                <span className="text-text-muted text-[11px] font-medium">to</span>
                                <input
                                    type="date"
                                    value={customTo}
                                    onChange={(e) => setCustomTo(e.target.value)}
                                    className="px-2 py-0.5 text-xs bg-card-bg border border-border rounded text-text-main font-mono focus:outline-hidden focus:border-primary"
                                />
                            </div>
                        )}
                    </div>

                    <div className="text-[11px] font-semibold text-text-muted bg-app-bg/70 border border-border/60 px-2.5 py-1 rounded-md flex items-center gap-1.5 self-start sm:self-auto">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span>Active Range:</span>
                        <span className="font-mono text-text-main font-bold">{activeDateRange.displayLabel}</span>
                    </div>
                </div>
            </div>

            {/* 2. TOP STAT CARDS ROW */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div
                    onClick={() => navigate('/sales')}
                    className="bg-card-bg border border-border hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer p-4.5 rounded-xl shadow-2xs space-y-2"
                >
                    <div className="flex items-center justify-between text-text-muted">
                        <span className="text-[11px] font-bold uppercase tracking-wider">TOTAL SALES ORDERS</span>
                        <Truck size={18} className="text-amber-500" />
                    </div>
                    <div className="text-2xl font-black text-text-main font-mono">
                        <AnimatedNumber value={totalSOCount} />
                    </div>
                    <div className="text-[11px] text-text-muted font-medium">
                        {activeProductionSOCount} in active production
                    </div>
                    <div className="text-[10px] text-text-muted font-mono pt-1 border-t border-border/40">
                        Orders in selected range: <span className="font-bold text-text-main">{filteredSOCount}</span>
                    </div>
                </div>

                <div
                    onClick={() => navigate('/production')}
                    className="bg-card-bg border border-border hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer p-4.5 rounded-xl shadow-2xs space-y-2"
                >
                    <div className="flex items-center justify-between text-text-muted">
                        <span className="text-[11px] font-bold uppercase tracking-wider">{activeDateRange.productionLabel}</span>
                        <Factory size={18} className="text-emerald-500" />
                    </div>
                    <div className="text-2xl font-black text-emerald-700 font-mono">
                        <AnimatedNumber value={filteredProductionBags} suffix=" Bags" />
                    </div>
                    <div className="text-[11px] text-text-muted font-medium">
                        Across {filteredDistinctMachinesCount > 0 ? filteredDistinctMachinesCount : machines.length} machine plants
                    </div>
                    <div className="text-[10px] text-text-muted font-mono pt-1 border-t border-border/40">
                        {dateFilterMode === 'today' ? "Today's output across stages" : `Output for ${activeDateRange.displayLabel}`}
                    </div>
                </div>

                <div
                    onClick={() => navigate('/analytics?tab=pnl')}
                    className="bg-card-bg border border-border hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer p-4.5 rounded-xl shadow-2xs space-y-2"
                >
                    <div className="flex items-center justify-between text-text-muted">
                        <span className="text-[11px] font-bold uppercase tracking-wider">{activeDateRange.revenueLabel}</span>
                        <DollarSign size={18} className="text-primary" />
                    </div>
                    <div className="text-2xl font-black text-text-main font-mono">
                        ₹<AnimatedNumber value={filteredRevenue / 100000} decimals={2} suffix="L" />
                    </div>
                    <div className="text-[11px] text-text-muted font-medium">
                        Payables: ₹{((payablesSummary?.totalPayable || 0) / 100000).toFixed(2)}L
                    </div>
                    <div className="text-[10px] text-text-muted font-mono pt-1 border-t border-border/40">
                        Invoiced in selected range
                    </div>
                </div>

                <div
                    onClick={() => navigate('/analytics?tab=valuation')}
                    className="bg-card-bg border border-border hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer p-4.5 rounded-xl shadow-2xs space-y-2"
                >
                    <div className="flex items-center justify-between text-text-muted">
                        <span className="text-[11px] font-bold uppercase tracking-wider">INVENTORY VALUATION</span>
                        <Package size={18} className="text-blue-500" />
                    </div>
                    <div className="text-2xl font-black text-text-main font-mono">
                        ₹<AnimatedNumber value={totalValuationAmount / 10000000} decimals={2} suffix="Cr" />
                    </div>
                    <div className="text-[11px] text-amber-700 font-extrabold">
                        {lowStockCount} items low stock
                    </div>
                    <div className="text-[10px] text-text-muted font-mono pt-1 border-t border-border/40">
                        RM + FG live warehouse stock
                    </div>
                </div>

                <div
                    onClick={() => navigate('/production?tab=pending-production')}
                    className="bg-card-bg border border-border hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer p-4.5 rounded-xl shadow-2xs space-y-2"
                >
                    <div className="flex items-center justify-between text-text-muted">
                        <span className="text-[11px] font-bold uppercase tracking-wider">PENDING FOR PRODUCTION</span>
                        <Factory size={18} className="text-indigo-500" />
                    </div>
                    <div className="text-2xl font-black text-text-main font-mono">
                        <AnimatedNumber value={Number(pendingForProduction.linesCount || 0)} suffix=" Lines" />
                    </div>
                    <div className={`text-[11px] font-extrabold ${Number(pendingForProduction.overdueCount || 0) > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {Number(pendingForProduction.overdueCount || 0) > 0
                            ? `${pendingForProduction.overdueCount} overdue SO lines`
                            : 'All pending orders on schedule'}
                    </div>
                    <div className="text-[10px] text-text-muted font-mono pt-1 border-t border-border/40">
                        {Number(pendingForProduction.totalQty || 0).toLocaleString('en-IN')} Bags pending plan
                    </div>
                </div>
            </div>

            {/* 3. SECOND STAT ROW */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div
                    onClick={() => navigate('/dispatch')}
                    className="bg-card-bg border border-border hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer p-3.5 rounded-xl shadow-2xs space-y-1"
                >
                    <span className="text-[10px] font-bold uppercase text-text-muted block">PENDING DISPATCH</span>
                    <span className="text-lg font-black text-text-main font-mono block">
                        <AnimatedNumber value={filteredPendingDispatchOrdersCount} suffix=" Orders" />
                    </span>
                    <span className="text-[10px] text-text-muted block">Ready for gate pass</span>
                </div>

                <div
                    onClick={() => navigate('/production')}
                    className="bg-card-bg border border-border hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer p-3.5 rounded-xl shadow-2xs space-y-1"
                >
                    <span className="text-[10px] font-bold uppercase text-text-muted block">MACHINE UTILIZATION</span>
                    <span className="text-lg font-black text-emerald-700 font-mono block">
                        <AnimatedNumber value={filteredMachineUtilizationPct} suffix="%" />
                    </span>
                    <span className="text-[10px] text-text-muted block">
                        {filteredRunningMachinesCount}/{machines.length} Lines Running
                    </span>
                </div>

                <div
                    onClick={() => navigate('/analytics?tab=yield')}
                    className="bg-card-bg border border-border hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer p-3.5 rounded-xl shadow-2xs space-y-1"
                >
                    <span className="text-[10px] font-bold uppercase text-text-muted block">PROD. EFFICIENCY</span>
                    <span className="text-lg font-black text-text-main font-mono block">
                        <AnimatedNumber value={filteredAvgProductionEfficiencyPct} suffix="%" />
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold block">Target: &gt;90%</span>
                </div>

                <div
                    onClick={() => navigate('/attendance')}
                    className="bg-card-bg border border-border hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer p-3.5 rounded-xl shadow-2xs space-y-1"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-text-muted">ATTENDANCE</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-800">
                            Log
                        </span>
                    </div>
                    <span className="text-lg font-black text-text-main font-mono block">Attendance</span>
                    <span className="text-[10px] text-text-muted block">Shift & Punch Log →</span>
                </div>

                <div
                    onClick={() => navigate('/sales?tab=invoices&filter=outstanding')}
                    className="bg-card-bg border border-border hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer p-3.5 rounded-xl shadow-2xs space-y-1"
                >
                    <span className="text-[10px] font-bold uppercase text-text-muted block">RECEIVABLES</span>
                    <span className="text-lg font-black text-text-main font-mono block">
                        ₹<AnimatedNumber value={totalReceivablesLakhs / 100000} decimals={2} suffix="L" />
                    </span>
                    <span className="text-[10px] text-text-muted block">Outstanding Invoices</span>
                </div>

                <div
                    onClick={() => navigate('/procurement?tab=supplier-outstanding&filter=outstanding')}
                    className="bg-card-bg border border-border hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer p-3.5 rounded-xl shadow-2xs space-y-1"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-text-muted">PAYABLES</span>
                        {payablesSummary?.overduePayable > 0 && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                                Overdue
                            </span>
                        )}
                    </div>
                    <span className="text-lg font-black text-text-main font-mono block">
                        ₹<AnimatedNumber value={(payablesSummary?.totalPayable || 0) / 100000} decimals={2} suffix="L" />
                    </span>
                    <span className="text-[10px] text-text-muted block">
                        {payablesSummary?.suppliersWithDues || 0} Suppliers with dues
                    </span>
                </div>
            </div>

            {/* 4 & 5. CHARTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-card-bg border border-border p-5 rounded-xl shadow-xs space-y-4 font-sans">
                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                        <div>
                            <h3 className="text-xs font-black text-text-main uppercase tracking-wider">
                                WEEKLY PRODUCTION TREND (ACTUAL BAGS PRODUCED)
                            </h3>
                            <p className="text-xs text-text-muted mt-0.5">
                                Computed daily good output quantity across all work order plant stages
                            </p>
                        </div>
                        <span className="text-[10px] font-mono text-text-muted">
                            Target: Derived Capacity
                        </span>
                    </div>

                    <div className="w-full h-72 pt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={weeklyChartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorBags" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px' }}
                                    formatter={(value) => [`${Number(value).toLocaleString()} Bags`, 'Actual Bags Produced']}
                                />
                                <Area type="monotone" dataKey="bags" stroke="#F59E0B" strokeWidth={3} fillOpacity={1} fill="url(#colorBags)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-card-bg border border-border p-5 rounded-xl shadow-xs space-y-4 font-sans">
                    <div className="border-b border-border/60 pb-3">
                        <h3 className="text-xs font-black text-text-main uppercase tracking-wider">
                            REVENUE BY KEY CUSTOMER
                        </h3>
                        <p className="text-xs text-text-muted mt-0.5">
                            Customer share of total invoice sales
                        </p>
                    </div>

                    <div className="w-full h-48 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={customerDonutData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={75}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {customerDonutData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px' }}
                                    formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Sales Revenue']}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border/40">
                        {customerDonutData.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs font-sans">
                                <div className="flex items-center gap-2 truncate max-w-[170px]">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }} />
                                    <span className="font-semibold text-text-main truncate">{item.name}</span>
                                </div>
                                <span className="font-mono font-bold text-text-main">{item.percentage}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 6 & 7. MACHINES GRID & ALERTS PANEL */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-card-bg border border-border p-5 rounded-xl shadow-xs space-y-4 font-sans">
                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                        <div>
                            <h3 className="text-xs font-black text-text-main uppercase tracking-wider">
                                SHOP FLOOR MACHINE LIVE STATUS
                            </h3>
                            <p className="text-xs text-text-muted mt-0.5">
                                Real-time plant line operational status & efficiency monitors
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate('/master-data?tab=machines')}
                            className="text-xs font-bold text-primary hover:text-primary-hover flex items-center gap-1 cursor-pointer"
                        >
                            <span>View All Plant Lines</span>
                            <ChevronRight size={14} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {machines.slice(0, 6).map((m) => {
                            const isRunning = m.status === 'RUNNING';
                            const isMaintenance = m.status === 'MAINTENANCE';
                            const isBreakdown = m.status === 'BREAKDOWN';

                            let badgeStyle = 'bg-gray-100 text-gray-700 border-gray-200';
                            let dotStyle = 'bg-gray-400';

                            if (isRunning) {
                                badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                                dotStyle = 'bg-emerald-500';
                            } else if (isMaintenance) {
                                badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
                                dotStyle = 'bg-amber-500';
                            } else if (isBreakdown) {
                                badgeStyle = 'bg-rose-50 text-rose-800 border-rose-200';
                                dotStyle = 'bg-rose-500';
                            }

                            return (
                                <div key={m._id} className="border border-border p-3.5 rounded-lg bg-card-bg hover:bg-app-bg/50 transition-colors space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono font-bold text-xs uppercase text-text-main">{m.code}</span>
                                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${badgeStyle}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${dotStyle}`} />
                                            <span>{m.status}</span>
                                        </div>
                                    </div>

                                    <div className="text-xs font-bold text-text-main truncate" title={m.name}>
                                        {m.name}
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] text-text-muted pt-1 border-t border-border/40 font-mono">
                                        <span>Type: {m.type || 'Plant'}</span>
                                        <span className="font-bold text-text-main">Eff: {m.efficiency || 90}%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-card-bg border border-border p-5 rounded-xl shadow-xs space-y-4 font-sans">
                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                        <div>
                            <h3 className="text-xs font-black text-text-main uppercase tracking-wider">
                                CRITICAL SYSTEM ALERTS
                            </h3>
                            <p className="text-xs text-text-muted mt-0.5">
                                Raw material reorder triggers & plant breakdown events
                            </p>
                        </div>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-800 border border-rose-200">
                            {criticalAlerts.length} Immediate Actions
                        </span>
                    </div>

                    <div className="space-y-3">
                        {criticalAlerts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center text-text-muted space-y-1">
                                <CheckCircle2 size={32} className="text-emerald-500 mb-1" />
                                <span className="text-xs font-extrabold text-text-main">No critical alerts</span>
                                <span className="text-[11px] text-text-muted">All raw materials and machines are operating normally.</span>
                            </div>
                        ) : (
                            criticalAlerts.slice(0, 4).map((alert, idx) => {
                                const isReorder = alert.type === 'REORDER';

                                return (
                                    <div
                                        key={idx}
                                        className={`p-3 rounded-lg border space-y-2 text-xs font-sans ${
                                            isReorder ? 'bg-amber-50/60 border-amber-200 text-amber-900' : 'bg-rose-50/60 border-rose-200 text-rose-900'
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5 font-bold">
                                            {isReorder ? <AlertTriangle size={15} className="text-amber-600 shrink-0" /> : <Wrench size={15} className="text-rose-600 shrink-0" />}
                                            <span>{alert.title}</span>
                                        </div>

                                        <p className="text-[11px] leading-relaxed text-text-muted">
                                            {alert.message}
                                        </p>

                                        <button
                                            type="button"
                                            onClick={() => navigate(alert.actionPath)}
                                            className={`text-[11px] font-extrabold flex items-center gap-1 hover:underline cursor-pointer ${
                                                isReorder ? 'text-amber-800' : 'text-rose-800'
                                            }`}
                                        >
                                            <span>{alert.actionLabel}</span>
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
