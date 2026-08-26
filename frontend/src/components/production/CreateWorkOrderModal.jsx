import { useState, useEffect } from 'react';
import SlideOverPanel from '../shared/SlideOverPanel';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export default function CreateWorkOrderModal({ isOpen, onClose, onSuccess }) {
    const [customers, setCustomers] = useState([]);
    const [finishedGoods, setFinishedGoods] = useState([]);
    const [machines, setMachines] = useState([]);
    const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(false);

    const [customer, setCustomer] = useState('');
    const [finishedGood, setFinishedGood] = useState('');
    const [targetQuantity, setTargetQuantity] = useState('');
    const [priority, setPriority] = useState('MEDIUM');
    const [assignedMachine, setAssignedMachine] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch dropdown options when modal opens
    useEffect(() => {
        if (!isOpen) return;

        const fetchDropdowns = async () => {
            try {
                setIsLoadingDropdowns(true);
                const [custRes, fgRes, mchRes] = await Promise.all([
                    axiosInstance.get('/customers?isActive=true&limit=100'),
                    axiosInstance.get('/finished-goods?isActive=true&limit=100'),
                    axiosInstance.get('/machines?isActive=true&limit=100')
                ]);

                if (custRes.data?.success) {
                    const list = custRes.data.data || [];
                    setCustomers(list);
                    if (list.length > 0 && !customer) {
                        setCustomer(list[0]._id);
                    }
                }

                if (fgRes.data?.success) {
                    const list = fgRes.data.data || [];
                    setFinishedGoods(list);
                    if (list.length > 0 && !finishedGood) {
                        setFinishedGood(list[0]._id);
                    }
                }

                if (mchRes.data?.success) {
                    setMachines(mchRes.data.data || []);
                }
            } catch (err) {
                console.error('Failed to load dropdown options:', err);
                toast.error('Failed to load customers, products, or machine options.');
            } finally {
                setIsLoadingDropdowns(false);
            }
        };

        fetchDropdowns();
    }, [isOpen]);

    if (!isOpen) return null;

    // Derived primary operator based on selected machine
    const selectedMachineObj = machines.find((m) => m._id === assignedMachine);
    const primaryOperator = selectedMachineObj?.currentOperator || (assignedMachine ? 'No Operator Assigned' : '');

    const isFormValid = customer && finishedGood && targetQuantity && Number(targetQuantity) >= 1;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isFormValid) return;

        try {
            setIsSubmitting(true);
            const payload = {
                customer,
                finishedGood,
                targetQuantity: Number(targetQuantity),
                priority: priority || 'MEDIUM',
                assignedMachine: assignedMachine || null
            };

            const res = await axiosInstance.post('/work-orders', payload);

            if (res.data?.success) {
                const woNum = res.data.data?.workOrderNumber || 'Work Order';
                toast.success(`Work Order ${woNum} created successfully!`);

                // Reset state
                setTargetQuantity('');
                setAssignedMachine('');
                setPriority('MEDIUM');

                onClose();
                if (onSuccess) onSuccess();
            }
        } catch (err) {
            console.error('Error creating work order:', err);
            toast.error(err.response?.data?.message || 'Failed to create Work Order');
        } finally {
            setIsSubmitting(false);
        }
    };

    const footerButtons = (
        <>
            <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-text-main hover:bg-sidebar-hover transition-colors cursor-pointer"
            >
                Cancel
            </button>
            <button
                type="submit"
                form="create-work-order-form"
                disabled={!isFormValid || isSubmitting}
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
                {isSubmitting ? 'Launching...' : 'Launch Work Order'}
            </button>
        </>
    );

    return (
        <SlideOverPanel
            isOpen={isOpen}
            onClose={onClose}
            title="Schedule New Production Work Order"
            subtitle="Assign Product Specs, Machine Line & Production Operator"
            widthClass="w-full max-w-full sm:max-w-lg"
            footer={footerButtons}
        >
            <form id="create-work-order-form" onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
                {/* 1. Select Customer / Client */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                        Select Customer / Client *
                    </label>
                    <select
                        required
                        value={customer}
                        onChange={(e) => setCustomer(e.target.value)}
                        disabled={isLoadingDropdowns}
                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer disabled:opacity-50"
                    >
                        <option value="" disabled>
                            {isLoadingDropdowns ? 'Loading Customers...' : '-- Select Customer --'}
                        </option>
                        {customers.map((c) => (
                            <option key={c._id} value={c._id}>
                                {c.companyName || c.name} ({c.customerCode || c.code || 'CUST'})
                            </option>
                        ))}
                    </select>
                </div>

                {/* 2. Select Finished Bag Specification */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                        Select Finished Bag Specification *
                    </label>
                    <select
                        required
                        value={finishedGood}
                        onChange={(e) => setFinishedGood(e.target.value)}
                        disabled={isLoadingDropdowns}
                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer disabled:opacity-50"
                    >
                        <option value="" disabled>
                            {isLoadingDropdowns ? 'Loading Specifications...' : '-- Select Finished Good Spec --'}
                        </option>
                        {finishedGoods.map((fg) => (
                            <option key={fg._id} value={fg._id}>
                                {fg.code || 'FG'} - {fg.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 3. Side by side: Target Quantity & Priority */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                            Target Quantity (Bags) *
                        </label>
                        <input
                            type="number"
                            required
                            min="1"
                            placeholder="e.g. 20000"
                            value={targetQuantity}
                            onChange={(e) => setTargetQuantity(e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono font-bold"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                            Priority *
                        </label>
                        <select
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer font-semibold"
                        >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                        </select>
                    </div>
                </div>

                {/* 4. Side by side: Machine Line Allocation & Primary Operator */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                            Machine Line Allocation
                        </label>
                        <select
                            value={assignedMachine}
                            onChange={(e) => setAssignedMachine(e.target.value)}
                            disabled={isLoadingDropdowns}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer disabled:opacity-50 font-sans"
                        >
                            <option value="">-- Optional Machine --</option>
                            {machines.map((m) => (
                                <option key={m._id} value={m._id}>
                                    {m.code || 'MCH'} - {m.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                            Primary Operator
                        </label>
                        <input
                            type="text"
                            readOnly
                            disabled
                            placeholder="Select a machine first"
                            value={primaryOperator}
                            className="w-full border border-border rounded-md p-2.5 bg-app-bg text-xs text-text-muted font-medium focus:outline-none cursor-not-allowed"
                        />
                    </div>
                </div>
            </form>
        </SlideOverPanel>
    );
}
