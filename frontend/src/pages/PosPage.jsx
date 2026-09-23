import { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Search, Plus, Minus, Trash2, CheckCircle, RefreshCw, User, Tag, CreditCard } from 'lucide-react';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';
import PrintInvoiceModal from '../components/pos/PrintInvoiceModal';
import FinishedGoodSpecCard from '../components/inventory/FinishedGoodSpecCard';

export default function PosPage() {
    const [finishedGoods, setFinishedGoods] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);

    // Search and Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedGsm, setSelectedGsm] = useState('All');
    const [selectedShape, setSelectedShape] = useState('All');

    // Cart State initialized from localStorage for persistence across reloads
    const [cart, setCart] = useState(() => {
        try {
            const savedCart = localStorage.getItem('posCart');
            return savedCart ? JSON.parse(savedCart) : [];
        } catch (err) {
            return [];
        }
    });

    // Sync cart to localStorage whenever cart changes
    useEffect(() => {
        if (cart && cart.length > 0) {
            localStorage.setItem('posCart', JSON.stringify(cart));
        } else {
            localStorage.removeItem('posCart');
        }
    }, [cart]);

    // Customer & Checkout Form State
    const [customerType, setCustomerType] = useState('WALK_IN'); // 'WALK_IN' | 'REGISTERED'
    const [selectedCustomerRef, setSelectedCustomerRef] = useState('');
    const [walkInDetails, setWalkInDetails] = useState({
        name: 'Counter Retail Customer',
        gstin: 'UNREGISTERED',
        phone: ''
    });
    const [paymentMode, setPaymentMode] = useState('CASH');

    // Checkout execution & invoice modal state
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [createdInvoice, setCreatedInvoice] = useState(null);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

    // Fetch Finished Goods & Registered Customers on Mount
    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingProducts(true);
            try {
                const [fgRes, custRes] = await Promise.all([
                    axiosInstance.get('/finished-goods?isActive=true&limit=200'),
                    axiosInstance.get('/customers?isActive=true&limit=200')
                ]);

                if (fgRes.data?.success) {
                    const products = fgRes.data.data || [];
                    setFinishedGoods(products);

                    // Revalidate rehydrated cart items against live available stock
                    setCart((prevCart) => {
                        if (!prevCart || prevCart.length === 0) return [];
                        const validCart = [];
                        let droppedCount = 0;

                        prevCart.forEach((item) => {
                            const fg = products.find((p) => p._id === item._id);
                            if (fg && (fg.currentStock || 0) > 0) {
                                const availableStock = fg.currentStock;
                                const validQty = Math.min(item.quantity, availableStock);
                                validCart.push({
                                    ...item,
                                    pricePerBag: fg.pricePerBag || fg.price || item.pricePerBag,
                                    currentStock: availableStock,
                                    quantity: validQty
                                });
                            } else {
                                droppedCount++;
                            }
                        });

                        if (droppedCount > 0) {
                            toast.error(`${droppedCount} cart item(s) dropped due to stock unavailability.`);
                        }
                        return validCart;
                    });
                }
                if (custRes.data?.success) {
                    const custs = custRes.data.data || [];
                    setCustomers(custs);
                    if (custs.length > 0) {
                        setSelectedCustomerRef(custs[0]._id);
                    }
                }
            } catch (err) {
                console.error('Error loading POS catalog data:', err);
                toast.error('Failed to load product catalog');
            } finally {
                setIsLoadingProducts(false);
            }
        };

        fetchData();
    }, []);

    // Distinct Category Names
    const categories = useMemo(() => {
        const set = new Set();
        finishedGoods.forEach((fg) => {
            const catName = typeof fg.category === 'object' ? fg.category?.name : fg.category;
            if (catName) set.add(catName);
        });
        return ['All', ...Array.from(set)];
    }, [finishedGoods]);

    // Distinct GSM values
    const gsmList = useMemo(() => {
        const set = new Set();
        finishedGoods.forEach((fg) => {
            if (fg.fabricGSM) set.add(fg.fabricGSM);
        });
        return ['All', ...Array.from(set).sort((a, b) => a - b)];
    }, [finishedGoods]);

    // Distinct Shape values
    const shapeList = useMemo(() => {
        const set = new Set();
        finishedGoods.forEach((fg) => {
            if (fg.bagShape) set.add(fg.bagShape);
        });
        return ['All', ...Array.from(set)];
    }, [finishedGoods]);

    // Filtered Finished Goods Grid
    const filteredProducts = useMemo(() => {
        return finishedGoods.filter((fg) => {
            const query = searchQuery.toLowerCase().trim();
            const catName = typeof fg.category === 'object' ? fg.category?.name : fg.category;

            const matchesSearch = !query ||
                (fg.name && fg.name.toLowerCase().includes(query)) ||
                (fg.code && fg.code.toLowerCase().includes(query)) ||
                (fg.color && fg.color.toLowerCase().includes(query)) ||
                (fg.fabricGSM && String(fg.fabricGSM).includes(query));

            const matchesCategory = selectedCategory === 'All' || catName === selectedCategory;
            const matchesGsm = selectedGsm === 'All' || fg.fabricGSM === Number(selectedGsm);
            const matchesShape = selectedShape === 'All' || fg.bagShape === selectedShape;

            return matchesSearch && matchesCategory && matchesGsm && matchesShape;
        });
    }, [finishedGoods, searchQuery, selectedCategory, selectedGsm, selectedShape]);

    // Cart Helper Calculations
    const cartCount = cart.length;
    const totalCartBags = cart.reduce((acc, item) => acc + item.quantity, 0);

    const subtotal = cart.reduce((acc, item) => acc + (item.quantity * item.pricePerBag), 0);
    const estimatedGst = subtotal * 0.18;
    const estimatedCgst = estimatedGst / 2;
    const estimatedSgst = estimatedGst / 2;
    const grandTotalWithGst = subtotal + estimatedGst;

    // State for bulk quantity input per product card
    const [productQuantities, setProductQuantities] = useState({});

    // Add product to cart (or increment bulk quantity if specified)
    const handleAddToCart = (product, customQty) => {
        const availableStock = product.currentStock || 0;
        const inputQty = customQty !== undefined ? customQty : (productQuantities[product._id] || 1);
        const qtyToAdd = Math.max(1, parseInt(inputQty, 10) || 1);

        if (availableStock <= 0) {
            toast.error(`'${product.name}' is currently out of stock`);
            return;
        }

        let addedSuccessfully = false;

        setCart((prevCart) => {
            const existingIndex = prevCart.findIndex((i) => i._id === product._id);
            if (existingIndex > -1) {
                const currentQty = prevCart[existingIndex].quantity;
                if (currentQty + qtyToAdd > availableStock) {
                    toast.error(`Cannot add ${qtyToAdd} more bags. Total exceeds available stock (${availableStock}).`);
                    return prevCart;
                }
                const updated = [...prevCart];
                updated[existingIndex].quantity += qtyToAdd;
                addedSuccessfully = true;
                return updated;
            } else {
                if (qtyToAdd > availableStock) {
                    toast.error(`Cannot add ${qtyToAdd} bags. Only ${availableStock} in stock.`);
                    return prevCart;
                }
                addedSuccessfully = true;
                return [
                    ...prevCart,
                    {
                        _id: product._id,
                        code: product.code,
                        name: product.name,
                        pricePerBag: product.pricePerBag || product.price || 0,
                        currentStock: availableStock,
                        quantity: qtyToAdd
                    }
                ];
            }
        });

        if (addedSuccessfully) {
            toast.success(`Added ${qtyToAdd} unit(s) of '${product.name}' to cart!`);
        }
    };
    // Update quantity of an item in cart
    const handleUpdateQuantity = (productId, newQty) => {
        setCart((prevCart) => {
            return prevCart.map((item) => {
                if (item._id === productId) {
                    const validQty = Math.max(1, Math.min(newQty, item.currentStock));
                    return { ...item, quantity: validQty };
                }
                return item;
            });
        });
    };

    // Remove item from cart
    const handleRemoveFromCart = (productId) => {
        setCart((prevCart) => prevCart.filter((item) => item._id !== productId));
    };

    // Handle Direct Checkout API Call
    const handleCheckout = async () => {
        if (cart.length === 0) {
            toast.error('Your POS cart is empty!');
            return;
        }

        if (customerType === 'REGISTERED' && !selectedCustomerRef) {
            toast.error('Please select a registered customer');
            return;
        }

        if (customerType === 'WALK_IN' && !walkInDetails.name.trim()) {
            toast.error('Please provide walk-in customer name');
            return;
        }

        try {
            setIsCheckingOut(true);

            // Construct mutual-exclusive payload as required by backend contract
            const payload = {
                customerType,
                paymentMode,
                cartItems: cart.map((item) => ({
                    finishedGood: item._id,
                    quantity: item.quantity
                }))
            };

            if (customerType === 'REGISTERED') {
                payload.customerRef = selectedCustomerRef;
            } else {
                payload.walkInDetails = {
                    name: walkInDetails.name.trim(),
                    gstin: walkInDetails.gstin.trim() || 'UNREGISTERED',
                    phone: walkInDetails.phone.trim() || ''
                };
            }

            const res = await axiosInstance.post('/pos/checkout', payload);

            if (res.data?.success && res.data?.data?.invoice) {
                const invoice = res.data.data.invoice;
                toast.success(`Invoice ${invoice.invoiceNumber} generated successfully!`);
                setCreatedInvoice(invoice);
                setIsPrintModalOpen(true);
                setCart([]);
                localStorage.removeItem('posCart');
            }
        } catch (err) {
            console.error('POS Checkout error:', err);
            toast.error(err.response?.data?.message || 'Checkout failed. Please check stock availability.');
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="space-y-5 font-sans">
            {/* Header Banner */}
            <div className="bg-card-bg border border-border rounded-xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-text-main tracking-tight">
                            POS Billing & Quick Checkout
                        </h1>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-100 text-orange-800 border border-orange-300 uppercase tracking-wider">
                            DIRECT COUNTER SALE
                        </span>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                        Buy PP/Paper Woven Bags, process instant billing & download print-ready HTML tax invoices
                    </p>
                </div>

                {/* Right Side Stat Blocks */}
                <div className="flex items-center gap-3">
                    <div className="bg-app-bg border border-border rounded-lg px-3.5 py-2 text-right">
                        <span className="text-[10px] font-extrabold uppercase text-text-muted block">
                            ACTIVE CART ITEMS
                        </span>
                        <span className="text-xs font-mono font-bold text-text-main">
                            {cartCount} Products <span className="text-primary">({totalCartBags} Bags)</span>
                        </span>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2 text-right">
                        <span className="text-[10px] font-extrabold uppercase text-emerald-800 block">
                            CART VALUE (INC. 18% GST)
                        </span>
                        <span className="text-sm font-mono font-extrabold text-emerald-950">
                            ₹{grandTotalWithGst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Main Content: Left Product Browser & Right POS Cart */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

                {/* LEFT COLUMN: Product Catalog Browser (7 Cols) */}
                <div className="lg:col-span-7 space-y-4">

                    {/* Search & Filter Toolbar */}
                    <div className="bg-card-bg border border-border rounded-xl p-4 shadow-2xs space-y-3">
                        {/* Search Bar */}
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-text-muted" size={16} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search bags by name, code, GSM, shape, size or color..."
                                className="w-full pl-9 pr-4 py-2 bg-app-bg border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>

                        {/* Filter Pills Row */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-border">
                            {/* Type Pill */}
                            <div className="flex items-center gap-1 overflow-x-auto max-w-full">
                                <span className="text-[10px] font-bold uppercase text-text-muted mr-1">TYPE:</span>
                                {categories.slice(0, 4).map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${selectedCategory === cat
                                            ? 'bg-primary text-sidebar-bg font-bold shadow-2xs'
                                            : 'bg-app-bg text-text-muted hover:text-text-main border border-border'
                                            }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            {/* GSM Select Pill */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold uppercase text-text-muted">GSM:</span>
                                <select
                                    value={selectedGsm}
                                    onChange={(e) => setSelectedGsm(e.target.value)}
                                    className="bg-app-bg border border-border rounded-md px-2 py-1 text-xs text-text-main focus:outline-none cursor-pointer"
                                >
                                    {gsmList.map((gsm) => (
                                        <option key={gsm} value={gsm}>
                                            {gsm === 'All' ? 'All GSM' : `${gsm} GSM`}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Shape Dropdown */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold uppercase text-text-muted">SHAPE:</span>
                                <select
                                    value={selectedShape}
                                    onChange={(e) => setSelectedShape(e.target.value)}
                                    className="bg-app-bg border border-border rounded-md px-2 py-1 text-xs text-text-main focus:outline-none cursor-pointer"
                                >
                                    {shapeList.map((shape) => (
                                        <option key={shape} value={shape}>
                                            {shape === 'All' ? 'All Shapes' : shape}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Products Grid */}
                    {isLoadingProducts ? (
                        <div className="flex flex-col items-center justify-center p-14 bg-card-bg border border-border rounded-xl">
                            <RefreshCw className="animate-spin text-primary mb-2" size={24} />
                            <p className="text-xs text-text-muted font-medium">Loading POS bag catalog...</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="p-10 bg-card-bg border border-border rounded-xl text-center text-text-muted text-xs">
                            No finished bag products match your search/filter criteria.
                        </div>
                    ) : (
                        <div className="grid lg:grid-cols-2 gap-3">
                            {filteredProducts.map((fg) => {
                                const stock = fg.currentStock || 0;
                                const isAvailable = stock > 0;
                                const cartItem = cart.find((i) => i._id === fg._id);
                                const qtyInCart = cartItem ? cartItem.quantity : 0;

                                return (
                                    <div className='bg-card-bg border border-border rounded-xl p-4 hover:shadow-md transition-all duration-200'>
                                        <FinishedGoodSpecCard key={fg._id} finishedGood={fg} />
                                        <div className="pt-3 flex items-center justify-between">
                                            <div>
                                                <span className="text-[9px] text-text-muted uppercase font-bold block">PRICE</span>
                                                <span className="text-xs font-mono font-bold text-primary">
                                                    ₹{fg.pricePerBag || fg.price || 0}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max={stock}
                                                    disabled={!isAvailable}
                                                    value={productQuantities[fg._id] || 1}
                                                    onChange={(e) => setProductQuantities(prev => ({ ...prev, [fg._id]: e.target.value }))}
                                                    className="w-12 border border-border rounded-lg p-1 text-center font-mono font-bold text-xs bg-card-bg text-text-main focus:outline-none focus:border-primary disabled:opacity-40"
                                                    title="Enter bulk quantity to add"
                                                />
                                                <button
                                                    type="button"
                                                    disabled={!isAvailable}
                                                    onClick={() => handleAddToCart(fg)}
                                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${qtyInCart > 0
                                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                                        : 'bg-primary hover:bg-primary-hover text-sidebar-bg shadow-xs'
                                                        }`}
                                                >
                                                    <Plus size={14} />
                                                    <span>{qtyInCart > 0 ? `+ Add (${qtyInCart})` : 'Add to Cart'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: POS Cart & Billing Summary Panel (5 Cols) */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="bg-card-bg border border-border rounded-xl p-5 shadow-md space-y-4 sticky top-4">

                        {/* Customer Type Header Toggle */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                                Customer Billing Type *
                            </label>
                            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                                <button
                                    type="button"
                                    onClick={() => setCustomerType('WALK_IN')}
                                    className={`py-2 px-3 rounded-lg border text-center transition-all cursor-pointer ${customerType === 'WALK_IN'
                                        ? 'bg-primary text-sidebar-bg font-extrabold border-primary shadow-2xs'
                                        : 'bg-app-bg text-text-muted border-border hover:text-text-main'
                                        }`}
                                >
                                    Walk-in Retail
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCustomerType('REGISTERED')}
                                    className={`py-2 px-3 rounded-lg border text-center transition-all cursor-pointer ${customerType === 'REGISTERED'
                                        ? 'bg-primary text-sidebar-bg font-extrabold border-primary shadow-2xs'
                                        : 'bg-app-bg text-text-muted border-border hover:text-text-main'
                                        }`}
                                >
                                    Registered B2B
                                </button>
                            </div>
                        </div>

                        {/* Customer Fields depending on customerType */}
                        {customerType === 'REGISTERED' ? (
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Select Registered Customer *
                                </label>
                                <select
                                    value={selectedCustomerRef}
                                    onChange={(e) => setSelectedCustomerRef(e.target.value)}
                                    className="w-full border border-border rounded-md p-2 bg-app-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer font-sans"
                                >
                                    {customers.length === 0 ? (
                                        <option value="">No registered customers found</option>
                                    ) : (
                                        customers.map((c) => (
                                            <option key={c._id} value={c._id}>
                                                {c.code || c.customerCode || 'CUST'} - {c.companyName || c.contactPersonName}{c.gstin ? ` (${c.gstin})` : ''}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>
                        ) : (
                            <div className="space-y-2.5 bg-app-bg p-3 rounded-lg border border-border">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-text-muted mb-0.5">
                                        Walk-in Customer Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={walkInDetails.name}
                                        onChange={(e) => setWalkInDetails({ ...walkInDetails, name: e.target.value })}
                                        className="w-full border border-border rounded p-1.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-text-muted mb-0.5">
                                            GSTIN / Tax ID
                                        </label>
                                        <input
                                            type="text"
                                            value={walkInDetails.gstin}
                                            onChange={(e) => setWalkInDetails({ ...walkInDetails, gstin: e.target.value })}
                                            className="w-full border border-border rounded p-1.5 bg-card-bg text-xs text-text-main font-mono focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-text-muted mb-0.5">
                                            Phone Number
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="9876543210"
                                            value={walkInDetails.phone}
                                            onChange={(e) => setWalkInDetails({ ...walkInDetails, phone: e.target.value })}
                                            className="w-full border border-border rounded p-1.5 bg-card-bg text-xs text-text-main font-mono focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Cart Items List */}
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-text-main mb-2 flex items-center justify-between">
                                <span>Cart Items ({cart.length})</span>
                                {cart.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCart([]);
                                            localStorage.removeItem('posCart');
                                        }}
                                        className="text-[10px] text-rose-600 hover:underline font-normal cursor-pointer"
                                    >
                                        Clear Cart
                                    </button>
                                )}
                            </h3>

                            {cart.length === 0 ? (
                                <div className="p-8 border border-dashed border-border rounded-xl text-center space-y-2">
                                    <ShoppingCart size={28} className="mx-auto text-text-muted opacity-40" />
                                    <p className="text-xs font-semibold text-text-muted">Your POS Cart is Empty</p>
                                    <p className="text-[10px] text-text-muted">Click "+ Add to Cart" on any product from the catalog</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                    {cart.map((item) => (
                                        <div key={item._id} className="bg-app-bg border border-border rounded-lg p-2.5 flex items-center justify-between text-xs">
                                            <div className="max-w-[140px]">
                                                <span className="font-bold text-text-main block truncate">{item.name}</span>
                                                <span className="text-[10px] text-text-muted font-mono">₹{item.pricePerBag} / bag</span>
                                            </div>

                                            {/* Quantity Stepper */}
                                            <div className="flex items-center gap-1.5 bg-card-bg border border-border rounded px-1 py-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateQuantity(item._id, item.quantity - 1)}
                                                    className="p-1 text-text-muted hover:text-text-main cursor-pointer"
                                                >
                                                    <Minus size={12} />
                                                </button>
                                                <span className="font-mono font-bold text-xs w-6 text-center">{item.quantity}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateQuantity(item._id, item.quantity + 1)}
                                                    className="p-1 text-text-muted hover:text-text-main cursor-pointer"
                                                >
                                                    <Plus size={12} />
                                                </button>
                                            </div>

                                            {/* Line Total & Remove Button */}
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-text-main">
                                                    ₹{(item.quantity * item.pricePerBag).toLocaleString('en-IN')}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveFromCart(item._id)}
                                                    className="text-text-muted hover:text-rose-600 transition-colors p-1 cursor-pointer"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Live Calculated Financial Summary Preview */}
                        <div className="bg-app-bg border border-border rounded-lg p-3.5 space-y-1.5 text-xs font-sans">
                            <div className="flex justify-between text-text-muted">
                                <span>Subtotal (Net):</span>
                                <span className="font-mono font-semibold">₹{subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-text-muted text-[11px]">
                                <span>CGST (9%):</span>
                                <span className="font-mono">₹{estimatedCgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-text-muted text-[11px]">
                                <span>SGST (9%):</span>
                                <span className="font-mono">₹{estimatedSgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between font-extrabold text-sm text-text-main border-t border-border pt-2">
                                <span>Grand Total (Inc. GST):</span>
                                <span className="font-mono text-primary">₹{grandTotalWithGst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>

                        {/* Payment Mode Selector */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Payment Method *
                            </label>
                            <div className="grid grid-cols-4 gap-1.5 text-xs font-semibold">
                                {['CASH', 'UPI', 'CARD', 'OTHER'].map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => setPaymentMode(mode)}
                                        className={`py-1.5 px-2 rounded-md border text-center transition-all cursor-pointer ${paymentMode === mode
                                            ? 'bg-emerald-600 text-white font-extrabold border-emerald-600 shadow-2xs'
                                            : 'bg-app-bg text-text-muted border-border hover:text-text-main'
                                            }`}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Complete Sale & Generate Invoice Checkout Action */}
                        <button
                            type="button"
                            disabled={cart.length === 0 || isCheckingOut}
                            onClick={handleCheckout}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <CreditCard size={16} />
                            <span>{isCheckingOut ? 'Processing Checkout Transaction...' : 'Complete Sale & Generate Invoice'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Print Invoice Modal View */}
            <PrintInvoiceModal
                isOpen={isPrintModalOpen}
                onClose={() => setIsPrintModalOpen(false)}
                invoice={createdInvoice}
            />
        </div>
    );
}