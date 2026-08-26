import { useState } from 'react';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import { Clock, Fingerprint, CalendarDays, Sparkles } from 'lucide-react';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';

export default function AttendancePage() {
    const [isSeedingShifts, setIsSeedingShifts] = useState(false);

    /**
     * One-time "Add Standard Shifts (A/B/Night)" action handler
     */
    const handleSeedDefaultShifts = async () => {
        try {
            setIsSeedingShifts(true);
            const res = await axiosInstance.post('/shifts/seed-default');
            if (res.data?.success) {
                toast.success('Standard shifts (Shift A, Shift B, Night Shift) created successfully!');
                window.location.reload();
            }
        } catch (err) {
            console.error('Seed shifts error:', err);
            toast.error(err.response?.data?.message || 'Failed to seed default shifts. Ensure no shifts exist already.');
        } finally {
            setIsSeedingShifts(false);
        }
    };

    const tabs = [
        {
            key: 'shifts',
            label: 'Shift Master',
            icon: Clock,
            resourcePath: '/shifts',
            columns: [
                {
                    header: 'Shift Code',
                    render: (row) => <span className="font-mono font-bold uppercase">{row.shiftCode || '-'}</span>,
                    sortable: true
                },
                { header: 'Shift Name', accessor: 'name', sortable: true },
                {
                    header: 'Start Time',
                    render: (row) => <span className="font-mono font-medium">{row.startTime || '-'}</span>
                },
                {
                    header: 'End Time',
                    render: (row) => <span className="font-mono font-medium">{row.endTime || '-'}</span>
                },
                {
                    header: 'Standard Hours',
                    render: (row) => `${row.standardHours || 8} hrs`
                },
                {
                    header: 'Grace Period',
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
            ]
        },
        {
            key: 'biometrics',
            label: 'Biometric Gate Logs',
            icon: Fingerprint,
            isPlaceholder: true,
            placeholderTitle: 'Biometric Attendance Integration',
            placeholderMessage: 'Coming Soon — Real-time biometric gate punch logs, RFID scanner sync, and daily attendance records.'
        },
        {
            key: 'roster',
            label: 'Shift Roster & Overtime',
            icon: CalendarDays,
            isPlaceholder: true,
            placeholderTitle: 'Workforce Roster & Overtime Log',
            placeholderMessage: 'Coming Soon — Monthly shift roster assignment, rotational shifts, and overtime approval workflow.'
        }
    ];

    const seedButtonAction = (
        <button
            type="button"
            disabled={isSeedingShifts}
            onClick={handleSeedDefaultShifts}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            title="Create standard Shift A (06:00-14:00), Shift B (14:00-22:00), Night Shift (22:00-06:00) in one click"
        >
            <Sparkles size={14} className="text-amber-600" />
            <span>{isSeedingShifts ? 'Creating...' : 'Add Standard Shifts (A/B/Night)'}</span>
        </button>
    );

    return (
        <TabbedResourcePage
            title="Attendance & Workforce HR"
            description="Shift master definitions, biometric gate attendance logs, and workforce rosters."
            tabs={tabs}
            headerActions={seedButtonAction}
        />
    );
}
