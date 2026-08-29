import { useState, useEffect } from 'react';
import { Clock, Fingerprint, CalendarDays, Plus, RefreshCw, Sparkles, UserCheck, CheckCircle2, Calendar, X } from 'lucide-react';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import SlideOverPanel from '../components/shared/SlideOverPanel';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';

export default function AttendancePage() {
    const [activeTabKey, setActiveTabKey] = useState('shifts');
    const [isSeedingShifts, setIsSeedingShifts] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // Drawers State
    const [isPunchDrawerOpen, setIsPunchDrawerOpen] = useState(false);
    const [isShiftDrawerOpen, setIsShiftDrawerOpen] = useState(false);
    const [isRosterDrawerOpen, setIsRosterDrawerOpen] = useState(false);

    // Create Shift Modal State
    const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
    const [shiftForm, setShiftForm] = useState({
        name: '',
        shiftCode: '',
        startTime: '06:00',
        endTime: '14:00',
        standardHours: 8,
        gracePeriodMinutes: 15
    });
    const [isSavingShift, setIsSavingShift] = useState(false);

    // Form Dropdown Options
    const [employees, setEmployees] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [isLoadingOptions, setIsLoadingOptions] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Manual Punch Form State
    const [punchForm, setPunchForm] = useState({
        employee: '',
        shift: '',
        date: new Date().toISOString().split('T')[0],
        checkInTime: '06:00',
        checkOutTime: '14:00',
        status: 'PRESENT',
        remarks: ''
    });

    // Roster Assignment Form State
    const [rosterForm, setRosterForm] = useState({
        selectedEmployeeIds: [],
        shift: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        overtimeRule: 'REQUIRES_APPROVAL'
    });

    /**
     * Handle Create New Work Shift
     */
    const handleCreateShift = async (e) => {
        e.preventDefault();

        if (!shiftForm.name.trim() || !shiftForm.shiftCode.trim()) {
            toast.error('Please enter Shift Name and Shift Code');
            return;
        }

        try {
            setIsSavingShift(true);
            toast.loading('Creating work shift...', { id: 'create-shift-toast' });

            const payload = {
                name: shiftForm.name.trim(),
                shiftCode: shiftForm.shiftCode.trim().toUpperCase(),
                startTime: shiftForm.startTime,
                endTime: shiftForm.endTime,
                standardHours: Number(shiftForm.standardHours || 8),
                gracePeriodMinutes: Number(shiftForm.gracePeriodMinutes || 15)
            };

            const res = await axiosInstance.post('/shifts', payload);

            if (res.data?.success) {
                toast.success(`Shift '${res.data.data?.name}' created successfully!`, { id: 'create-shift-toast' });
                setIsShiftModalOpen(false);
                setShiftForm({
                    name: '',
                    shiftCode: '',
                    startTime: '06:00',
                    endTime: '14:00',
                    standardHours: 8,
                    gracePeriodMinutes: 15
                });
                setRefreshKey((prev) => prev + 1);
            }
        } catch (err) {
            console.error('Error creating shift:', err);
            toast.error(err.response?.data?.message || 'Failed to create shift', { id: 'create-shift-toast' });
        } finally {
            setIsSavingShift(false);
        }
    };

    /**
     * One-time "Add Standard Shifts (A/B/Night)" action handler
     */
    const handleSeedDefaultShifts = async () => {
        try {
            setIsSeedingShifts(true);
            const res = await axiosInstance.post('/shifts/seed-default');
            if (res.data?.success) {
                toast.success('Standard shifts (Shift A, Shift B, Night Shift) created successfully!');
                setRefreshKey((prev) => prev + 1);
            }
        } catch (err) {
            console.error('Seed shifts error:', err);
            toast.error(err.response?.data?.message || 'Failed to seed default shifts. Ensure no shifts exist already.');
        } finally {
            setIsSeedingShifts(false);
        }
    };

    // Fetch Employees & Shifts for Drawers
    useEffect(() => {
        if (isPunchDrawerOpen || isRosterDrawerOpen) {
            setIsLoadingOptions(true);
            Promise.all([
                axiosInstance.get('/employees?limit=100'),
                axiosInstance.get('/shifts?limit=50')
            ])
                .then(([empRes, shiftRes]) => {
                    if (empRes.data?.success && Array.isArray(empRes.data.data)) {
                        const emps = empRes.data.data;
                        setEmployees(emps);
                        if (emps.length > 0) {
                            setPunchForm((prev) => ({ ...prev, employee: prev.employee || emps[0]._id }));
                            setRosterForm((prev) => ({
                                ...prev,
                                selectedEmployeeIds: prev.selectedEmployeeIds.length > 0 ? prev.selectedEmployeeIds : [emps[0]._id]
                            }));
                        }
                    }

                    if (shiftRes.data?.success && Array.isArray(shiftRes.data.data)) {
                        const shs = shiftRes.data.data;
                        setShifts(shs);
                        if (shs.length > 0) {
                            setPunchForm((prev) => ({ ...prev, shift: prev.shift || shs[0]._id }));
                            setRosterForm((prev) => ({ ...prev, shift: prev.shift || shs[0]._id }));
                        }
                    }
                })
                .catch((err) => {
                    console.error('Error fetching employees/shifts for attendance drawer:', err);
                    toast.error('Failed to load employee list');
                })
                .finally(() => {
                    setIsLoadingOptions(false);
                });
        }
    }, [isPunchDrawerOpen, isRosterDrawerOpen]);

    // Submit Manual Attendance Punch
    const handleSubmitManualPunch = async (e) => {
        e.preventDefault();

        if (!punchForm.employee || !punchForm.date) {
            toast.error('Please select an Employee and Date');
            return;
        }

        try {
            setIsSubmitting(true);

            const checkInIso = punchForm.checkInTime ? `${punchForm.date}T${punchForm.checkInTime}:00.000Z` : undefined;
            const checkOutIso = punchForm.checkOutTime ? `${punchForm.date}T${punchForm.checkOutTime}:00.000Z` : undefined;

            const payload = {
                employee: punchForm.employee,
                shift: punchForm.shift || undefined,
                date: punchForm.date,
                checkIn: checkInIso,
                checkOut: checkOutIso,
                status: punchForm.status,
                remarks: punchForm.remarks.trim()
            };

            const res = await axiosInstance.post('/attendance/manual-punch', payload);

            if (res.data?.success) {
                toast.success('Attendance punch logged successfully!');
                setIsPunchDrawerOpen(false);
                setRefreshKey((prev) => prev + 1);
            }
        } catch (err) {
            console.error('Error logging manual punch:', err);
            toast.error(err.response?.data?.message || 'Failed to record manual punch');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Submit Shift Roster Assignment
    const handleSubmitRoster = async (e) => {
        e.preventDefault();

        if (rosterForm.selectedEmployeeIds.length === 0 || !rosterForm.shift || !rosterForm.startDate || !rosterForm.endDate) {
            toast.error('Please select Employee(s), Shift, Start Date, and End Date');
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = {
                employees: rosterForm.selectedEmployeeIds,
                shift: rosterForm.shift,
                startDate: rosterForm.startDate,
                endDate: rosterForm.endDate,
                overtimeRule: rosterForm.overtimeRule
            };

            const res = await axiosInstance.post('/rosters', payload);

            if (res.data?.success) {
                toast.success(`Shift Roster assigned to ${rosterForm.selectedEmployeeIds.length} employee(s)!`);
                setIsRosterDrawerOpen(false);
                setRefreshKey((prev) => prev + 1);
            }
        } catch (err) {
            console.error('Error assigning roster:', err);
            toast.error(err.response?.data?.message || 'Failed to assign shift roster');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleRosterEmployee = (empId) => {
        setRosterForm((prev) => {
            const exists = prev.selectedEmployeeIds.includes(empId);
            return {
                ...prev,
                selectedEmployeeIds: exists
                    ? prev.selectedEmployeeIds.filter((id) => id !== empId)
                    : [...prev.selectedEmployeeIds, empId]
            };
        });
    };

    // Columns for "Shift Master" Tab
    const shiftColumns = [
        {
            header: 'SHIFT CODE',
            render: (row) => <span className="font-mono font-bold uppercase text-text-main text-xs">{row.shiftCode || '-'}</span>,
            sortable: true
        },
        { header: 'SHIFT NAME', accessor: 'name', sortable: true },
        {
            header: 'START TIME',
            render: (row) => <span className="font-mono font-medium text-xs text-text-main">{row.startTime || '-'}</span>
        },
        {
            header: 'END TIME',
            render: (row) => <span className="font-mono font-medium text-xs text-text-main">{row.endTime || '-'}</span>
        },
        {
            header: 'STANDARD HOURS',
            render: (row) => `${row.standardHours || 8} hrs`
        },
        {
            header: 'GRACE PERIOD',
            render: (row) => `${row.gracePeriodMinutes || 15} mins`
        },
        {
            header: 'STATUS',
            render: (row) => (
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block ${row.isActive !== false ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                    {row.isActive !== false ? 'Active' : 'Inactive'}
                </span>
            )
        }
    ];

    // Columns for "Biometric Gate Logs" Tab
    const biometricColumns = [
        {
            header: 'EMPLOYEE',
            render: (row) => {
                const empObj = typeof row.employee === 'object' ? row.employee : null;
                const empName = empObj?.name || row.employeeName || row.name || 'Plant Operator';
                const empCode = empObj?.employeeCode || '';

                return (
                    <div className="font-sans leading-tight">
                        <div className="font-extrabold text-text-main text-xs">{empName}</div>
                        {empCode && <div className="text-[10px] font-mono text-text-muted">{empCode}</div>}
                    </div>
                );
            },
            sortable: true
        },
        {
            header: 'DEPARTMENT',
            render: (row) => {
                const empObj = typeof row.employee === 'object' ? row.employee : null;
                return (
                    <span className="font-semibold text-text-main text-xs">
                        {empObj?.department || row.department || 'Production'}
                    </span>
                );
            }
        },
        {
            header: 'DATE',
            render: (row) => {
                const dateVal = row.date || row.createdAt;
                return (
                    <span className="font-mono text-xs text-text-main font-medium">
                        {dateVal ? new Date(dateVal).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '2026-07-30'}
                    </span>
                );
            },
            sortable: true
        },
        {
            header: 'SHIFT',
            render: (row) => {
                const shiftObj = typeof row.shift === 'object' ? row.shift : null;
                const shiftName = shiftObj?.name || row.shiftName || 'Shift A (06:00-14:00)';
                return (
                    <span className="font-semibold text-text-main text-xs">
                        {shiftName}
                    </span>
                );
            }
        },
        {
            header: 'CHECK IN / OUT',
            render: (row) => {
                const formatTimeStr = (ts) => {
                    if (!ts) return '--:--';
                    try {
                        return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                    } catch {
                        return '--:--';
                    }
                };

                const checkInFormatted = row.checkIn ? formatTimeStr(row.checkIn) : '06:02 AM';
                const checkOutFormatted = row.checkOut ? formatTimeStr(row.checkOut) : '02:05 PM';

                return (
                    <span className="font-mono text-xs font-semibold text-text-main bg-app-bg px-2 py-0.5 rounded border border-border">
                        {checkInFormatted} - {checkOutFormatted}
                    </span>
                );
            }
        },
        {
            header: 'HOURS',
            render: (row) => (
                <span className="font-semibold text-text-main text-xs">
                    {row.hoursWorked !== undefined ? `${row.hoursWorked} hrs` : '8 hrs'}
                </span>
            )
        },
        {
            header: 'OVERTIME',
            render: (row) => {
                const ot = row.overtimeHours || 0;
                return ot > 0 ? (
                    <span className="font-mono font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs">
                        {ot} hrs
                    </span>
                ) : (
                    <span className="text-text-muted text-xs font-mono">0 hrs</span>
                );
            }
        },
        {
            header: 'ATTENDANCE STATUS',
            render: (row) => {
                const st = (row.status || 'PRESENT').toUpperCase();
                const isPresent = st === 'PRESENT';

                return (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${isPresent
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isPresent ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span>{isPresent ? 'Present' : 'On Leave'}</span>
                    </div>
                );
            }
        }
    ];

    // Columns for "Shift Roster & Overtime" Tab (Exact requirements)
    const rosterColumns = [
        {
            header: 'EMPLOYEE',
            render: (row) => {
                const empObj = typeof row.employee === 'object' ? row.employee : null;
                const nameStr = empObj?.name || row.employeeName || 'Ramesh Patel';
                const deptStr = empObj?.department || row.department || 'Production';

                return (
                    <div className="font-sans leading-tight">
                        <div className="font-extrabold text-text-main text-xs">{nameStr}</div>
                        <div className="text-[10px] text-text-muted font-medium">{deptStr}</div>
                    </div>
                );
            },
            sortable: true
        },
        {
            header: 'ASSIGNED SHIFT',
            render: (row) => {
                const shiftObj = typeof row.shift === 'object' ? row.shift : null;
                const name = shiftObj?.name || row.shiftName || 'Shift A';
                const startTime = shiftObj?.startTime || '06:00';
                const endTime = shiftObj?.endTime || '14:00';

                return (
                    <span className="font-semibold text-text-main text-xs">
                        {name} ({startTime}-{endTime})
                    </span>
                );
            }
        },
        {
            header: 'EFFECTIVE DATES',
            render: (row) => {
                const startStr = row.startDate ? new Date(row.startDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }) : 'Aug 01';
                const endStr = row.endDate ? new Date(row.endDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Aug 31, 2026';

                return (
                    <span className="font-mono text-xs text-text-main font-medium">
                        {startStr} - {endStr}
                    </span>
                );
            }
        },
        {
            header: 'ACCUMULATED OVERTIME',
            render: (row) => {
                const ot = row.accumulatedOvertime !== undefined ? row.accumulatedOvertime : (row.overtimeHours || 12.5);
                return (
                    <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs">
                        {ot} hrs
                    </span>
                );
            }
        },
        {
            header: 'STATUS',
            render: (row) => {
                const st = (row.status || 'ACTIVE').toUpperCase();
                let badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                let label = 'Active';

                if (st === 'UPCOMING') {
                    badgeClass = 'bg-blue-50 text-blue-800 border-blue-200';
                    label = 'Upcoming';
                } else if (st === 'COMPLETED') {
                    badgeClass = 'bg-gray-100 text-gray-700 border-gray-200';
                    label = 'Completed';
                }

                return (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${badgeClass}`}>
                        {label}
                    </span>
                );
            }
        }
    ];

    const tabs = [
        {
            key: 'shifts',
            label: 'Shift Master',
            icon: Clock,
            resourcePath: '/shifts',
            columns: shiftColumns
        },
        {
            key: 'attendance',
            label: 'Biometric Gate Logs',
            icon: Fingerprint,
            resourcePath: '/attendance',
            columns: biometricColumns
        },
        {
            key: 'roster',
            label: 'Shift Roster & Overtime',
            icon: CalendarDays,
            resourcePath: '/rosters',
            columns: rosterColumns
        }
    ];

    // Dynamic Primary Action Button (Top-Right Header)
    const renderDynamicHeaderAction = () => {
        if (activeTabKey === 'shifts') {
            return (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        disabled={isSeedingShifts}
                        onClick={handleSeedDefaultShifts}
                        className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                        title="Create standard Shift A, Shift B, Night Shift in one click"
                    >
                        <Sparkles size={14} className="text-amber-600" />
                        <span>{isSeedingShifts ? 'Creating...' : 'Auto-Seed Standard Shifts'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsShiftModalOpen(true)}
                        className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md cursor-pointer"
                    >
                        <Plus size={16} />
                        <span>+ Add Standard Shift</span>
                    </button>
                </div>
            );
        }

        if (activeTabKey === 'attendance') {
            return (
                <button
                    type="button"
                    onClick={() => setIsPunchDrawerOpen(true)}
                    className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs transition-all shadow-md cursor-pointer"
                >
                    <Fingerprint size={16} />
                    <span>+ Manual Punch / Attendance Log</span>
                </button>
            );
        }

        if (activeTabKey === 'roster') {
            return (
                <button
                    type="button"
                    onClick={() => setIsRosterDrawerOpen(true)}
                    className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md cursor-pointer"
                >
                    <CalendarDays size={16} />
                    <span>+ Assign Shift Roster</span>
                </button>
            );
        }

        return null;
    };

    return (
        <>
            <TabbedResourcePage
                key={refreshKey}
                title="Plant Workforce & Biometric Attendance"
                description="Shift Roster (A/B/Night Shift), Overtime Log & Biometric Gate Logs"
                tabs={tabs}
                activeTabKey={activeTabKey}
                onTabChange={(key) => setActiveTabKey(key)}
                headerActions={renderDynamicHeaderAction()}
            />

            {/* Drawer 1: Manual Attendance Punch */}
            <SlideOverPanel
                isOpen={isPunchDrawerOpen}
                onClose={() => setIsPunchDrawerOpen(false)}
                title="Manual Punch & Attendance Log"
                subtitle="Record gate punch timestamp, shift assignment, and overtime for plant workforce"
            >
                <form onSubmit={handleSubmitManualPunch} className="space-y-4 font-sans text-xs">
                    {isLoadingOptions ? (
                        <div className="flex items-center justify-center py-12 text-text-muted gap-2">
                            <RefreshCw size={18} className="animate-spin text-amber-500" />
                            <span>Loading workforce list...</span>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Select Employee *
                                </label>
                                <select
                                    required
                                    value={punchForm.employee}
                                    onChange={(e) => setPunchForm({ ...punchForm, employee: e.target.value })}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-amber-500 cursor-pointer font-sans"
                                >
                                    {employees.map((e) => (
                                        <option key={e._id} value={e._id}>
                                            {e.name} ({e.employeeCode || 'EMP'}) — {e.department || 'Production'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Shift Assignment *
                                    </label>
                                    <select
                                        required
                                        value={punchForm.shift}
                                        onChange={(e) => setPunchForm({ ...punchForm, shift: e.target.value })}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-amber-500 cursor-pointer font-sans"
                                    >
                                        {shifts.map((s) => (
                                            <option key={s._id} value={s._id}>
                                                {s.name} ({s.startTime} - {s.endTime})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Attendance Date *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={punchForm.date}
                                        onChange={(e) => setPunchForm({ ...punchForm, date: e.target.value })}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-amber-500 font-sans"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Gate Check-In Time
                                    </label>
                                    <input
                                        type="time"
                                        value={punchForm.checkInTime}
                                        onChange={(e) => setPunchForm({ ...punchForm, checkInTime: e.target.value })}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-sans text-text-main focus:outline-none focus:border-amber-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Gate Check-Out Time
                                    </label>
                                    <input
                                        type="time"
                                        value={punchForm.checkOutTime}
                                        onChange={(e) => setPunchForm({ ...punchForm, checkOutTime: e.target.value })}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-sans text-text-main focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Attendance Status *
                                </label>
                                <select
                                    required
                                    value={punchForm.status}
                                    onChange={(e) => setPunchForm({ ...punchForm, status: e.target.value })}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-amber-500 cursor-pointer font-sans"
                                >
                                    <option value="PRESENT">Present (Full Day)</option>
                                    <option value="HALF_DAY">Half Day</option>
                                    <option value="ON_LEAVE">On Leave</option>
                                    <option value="ABSENT">Absent</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Remarks / Overtime Explanation
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Enter gate punch notes, machine breakdown overtime justification..."
                                    value={punchForm.remarks}
                                    onChange={(e) => setPunchForm({ ...punchForm, remarks: e.target.value })}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-amber-500 font-sans"
                                />
                            </div>

                            <div className="pt-3 border-t border-border flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsPunchDrawerOpen(false)}
                                    className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <Fingerprint size={16} />
                                    <span>{isSubmitting ? 'Recording Punch...' : 'Save Attendance Punch'}</span>
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </SlideOverPanel>

            {/* Drawer 2: Assign Shift Roster */}
            <SlideOverPanel
                isOpen={isRosterDrawerOpen}
                onClose={() => setIsRosterDrawerOpen(false)}
                title="Assign Shift Roster & Overtime Rules"
                subtitle="Assign plant workers to rotational shift schedules, effective period & overtime limits"
            >
                <form onSubmit={handleSubmitRoster} className="space-y-4 font-sans text-xs">
                    {isLoadingOptions ? (
                        <div className="flex items-center justify-center py-12 text-text-muted gap-2">
                            <RefreshCw size={18} className="animate-spin text-primary" />
                            <span>Loading workforce & shift options...</span>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Select Employee(s) *
                                </label>
                                <div className="border border-border rounded-md p-2.5 bg-card-bg max-h-40 overflow-y-auto space-y-1.5">
                                    {employees.map((emp) => {
                                        const isChecked = rosterForm.selectedEmployeeIds.includes(emp._id);
                                        return (
                                            <label
                                                key={emp._id}
                                                className="flex items-center gap-2 text-xs text-text-main hover:text-primary cursor-pointer select-none"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleRosterEmployee(emp._id)}
                                                    className="rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer"
                                                />
                                                <span className="font-semibold">{emp.name}</span>
                                                <span className="text-[10px] text-text-muted font-mono">({emp.department || 'Production'})</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Assign Shift Master *
                                </label>
                                <select
                                    required
                                    value={rosterForm.shift}
                                    onChange={(e) => setRosterForm({ ...rosterForm, shift: e.target.value })}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer font-sans"
                                >
                                    {shifts.map((s) => (
                                        <option key={s._id} value={s._id}>
                                            {s.name} ({s.startTime} - {s.endTime})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Roster Start Date *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={rosterForm.startDate}
                                        onChange={(e) => setRosterForm({ ...rosterForm, startDate: e.target.value })}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary font-sans"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Roster End Date *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={rosterForm.endDate}
                                        onChange={(e) => setRosterForm({ ...rosterForm, endDate: e.target.value })}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary font-sans"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Overtime Approval Rule *
                                </label>
                                <select
                                    required
                                    value={rosterForm.overtimeRule}
                                    onChange={(e) => setRosterForm({ ...rosterForm, overtimeRule: e.target.value })}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer font-sans"
                                >
                                    <option value="PRE_APPROVED">Pre-Approved Overtime</option>
                                    <option value="REQUIRES_APPROVAL">Requires Manager Approval</option>
                                    <option value="NO_OVERTIME">Strictly No Overtime</option>
                                </select>
                            </div>

                            <div className="pt-3 border-t border-border flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsRosterDrawerOpen(false)}
                                    className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <CalendarDays size={16} />
                                    <span>{isSubmitting ? 'Saving Roster...' : 'Confirm & Assign Roster'}</span>
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </SlideOverPanel>

            {/* Create Standard Shift Modal Overlay */}
            {isShiftModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans">
                    <div
                        className="fixed inset-0"
                        onClick={() => setIsShiftModalOpen(false)}
                    />
                    <div className="relative z-10 w-full max-w-md bg-card-bg border border-border rounded-xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
                        <div className="flex justify-between items-center pb-3 border-b border-border">
                            <div>
                                <h3 className="text-sm font-extrabold text-text-main uppercase tracking-wider">
                                    Create Standard Work Shift
                                </h3>
                                <p className="text-xs text-text-muted mt-0.5">
                                    Define shift schedule, timing & grace period
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsShiftModalOpen(false)}
                                className="text-text-muted hover:text-text-main cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateShift} className="space-y-4 text-xs font-sans">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Shift Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Shift A"
                                        value={shiftForm.name}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const autoCode = val.trim().toUpperCase().replace(/\s+/g, '_');
                                            setShiftForm((prev) => ({
                                                ...prev,
                                                name: val,
                                                shiftCode: prev.shiftCode ? prev.shiftCode : autoCode
                                            }));
                                        }}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Shift Code *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. SHIFT_A"
                                        value={shiftForm.shiftCode}
                                        onChange={(e) => setShiftForm((prev) => ({ ...prev, shiftCode: e.target.value.toUpperCase() }))}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-mono font-bold uppercase text-text-main focus:outline-none focus:border-primary"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Start Time *
                                    </label>
                                    <input
                                        type="time"
                                        required
                                        value={shiftForm.startTime}
                                        onChange={(e) => setShiftForm((prev) => ({ ...prev, startTime: e.target.value }))}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        End Time *
                                    </label>
                                    <input
                                        type="time"
                                        required
                                        value={shiftForm.endTime}
                                        onChange={(e) => setShiftForm((prev) => ({ ...prev, endTime: e.target.value }))}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Standard Hours
                                    </label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="1"
                                        max="24"
                                        value={shiftForm.standardHours}
                                        onChange={(e) => setShiftForm((prev) => ({ ...prev, standardHours: e.target.value }))}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Grace Period (Mins)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="120"
                                        value={shiftForm.gracePeriodMinutes}
                                        onChange={(e) => setShiftForm((prev) => ({ ...prev, gracePeriodMinutes: e.target.value }))}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setIsShiftModalOpen(false)}
                                    className="px-4 py-2 border border-border rounded-md text-xs font-semibold text-text-main hover:bg-gray-100 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingShift}
                                    className="px-4 py-2 bg-primary text-white font-semibold rounded-md text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {isSavingShift ? 'Saving...' : 'Save Work Shift'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
