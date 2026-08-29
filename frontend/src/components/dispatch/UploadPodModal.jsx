import { useState, useRef } from 'react';
import { UploadCloud, Image, Trash2, User, Phone, FileText, CheckCircle2 } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export default function UploadPodModal({ isOpen, dispatch, onClose, onSuccess }) {
    if (!isOpen || !dispatch) return null;

    const [receiverName, setReceiverName] = useState(dispatch.pod?.receiverName || '');
    const [receiverPhone, setReceiverPhone] = useState(dispatch.pod?.receiverPhone || '');
    const [notes, setNotes] = useState(dispatch.pod?.notes || '');
    const [proofDocument, setProofDocument] = useState(dispatch.pod?.proofDocument || '');
    const [proofImage, setProofImage] = useState(dispatch.pod?.proofImage || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef(null);

    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new window.Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const maxDim = 1400;

                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        } else {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
                    resolve(dataUrl);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please upload a valid image file (PNG, JPG, JPEG, WEBP).');
            return;
        }

        if (file.size > 20 * 1024 * 1024) {
            toast.error('Image file too large (Max 20 MB).');
            return;
        }

        try {
            const compressedDataUrl = await compressImage(file);
            setProofImage(compressedDataUrl);
            if (!proofDocument) {
                setProofDocument(file.name);
            }
        } catch (err) {
            console.error('Error compressing image:', err);
            // Fallback to raw reader
            const reader = new FileReader();
            reader.onload = () => {
                setProofImage(reader.result);
                if (!proofDocument) setProofDocument(file.name);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        setProofImage('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmitPod = async (e) => {
        e.preventDefault();

        if (!receiverName.trim()) {
            toast.error('Please enter the Receiver Name');
            return;
        }

        if (!proofImage && !proofDocument) {
            toast.error('Please upload a delivery proof photo or document reference.');
            return;
        }

        try {
            setIsSubmitting(true);
            const res = await axiosInstance.patch(`/dispatches/${dispatch._id}/delivery-status`, {
                action: 'UPLOAD_POD',
                receiverName: receiverName.trim(),
                receiverPhone: receiverPhone.trim(),
                notes: notes.trim(),
                proofImage: proofImage || undefined,
                proofDocument: proofDocument.trim() || 'Delivery Proof Photo'
            });

            if (res.data?.success) {
                toast.success(`Proof of Delivery uploaded for ${dispatch.dispatchNumber}! Awaiting Admin Approval.`);
                onClose();
                if (onSuccess) onSuccess();
            }
        } catch (err) {
            console.error('Error uploading POD:', err);
            toast.error(err.response?.data?.message || 'Failed to upload Proof of Delivery');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-card-bg border border-border rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 font-sans text-xs max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center pb-2.5 border-b border-border">
                    <div className="flex items-center gap-2">
                        <UploadCloud className="text-primary" size={20} />
                        <div>
                            <h3 className="font-bold text-sm text-text-main">
                                Mark as Delivered — Upload Proof of Delivery
                            </h3>
                            <p className="text-[11px] text-text-muted">
                                Dispatch #{dispatch.dispatchNumber} • Vehicle {dispatch.vehicleNumber}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-text-muted hover:text-text-main text-sm font-bold cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {dispatch.pod?.rejectionReason && (
                    <div className="bg-danger/10 border border-danger/20 text-danger p-3 rounded-lg text-xs">
                        <span className="font-bold">Previous POD Rejected:</span> {dispatch.pod.rejectionReason}
                    </div>
                )}

                <form onSubmit={handleSubmitPod} className="space-y-3.5">
                    {/* Image Upload Zone */}
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-main mb-1.5">
                            Delivery Proof Photo (Signed Challan / Goods Photo) *
                        </label>

                        {proofImage ? (
                            <div className="relative border border-border rounded-xl p-2 bg-app-bg flex flex-col items-center">
                                <img
                                    src={proofImage}
                                    alt="Delivery Proof"
                                    className="max-h-52 w-auto object-contain rounded-lg shadow-xs"
                                />
                                <div className="flex items-center justify-between w-full mt-2 pt-2 border-t border-border px-1">
                                    <span className="text-[11px] text-text-muted truncate max-w-[200px]">
                                        {proofDocument || 'Proof Image Attached'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleRemoveImage}
                                        className="text-danger hover:underline text-xs font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                        <Trash2 size={13} />
                                        <span>Change / Remove</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-border hover:border-primary rounded-xl p-5 text-center cursor-pointer transition-colors bg-app-bg/50 hover:bg-app-bg group"
                            >
                                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
                                    <Image size={20} />
                                </div>
                                <div className="font-bold text-text-main text-xs">
                                    Click to browse photo or drag and drop
                                </div>
                                <div className="text-[11px] text-text-muted mt-0.5">
                                    Supports PNG, JPG, JPEG, WEBP (Max 5 MB)
                                </div>
                            </div>
                        )}

                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-main mb-1">
                                Receiver Name *
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Rajesh Shah"
                                    value={receiverName}
                                    onChange={(e) => setReceiverName(e.target.value)}
                                    className="w-full border border-border rounded-lg p-2.5 pl-8 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary"
                                />
                                <User size={14} className="absolute left-2.5 top-3 text-text-muted" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-main mb-1">
                                Receiver Phone Number
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="e.g. +91 98250 12345"
                                    value={receiverPhone}
                                    onChange={(e) => setReceiverPhone(e.target.value)}
                                    className="w-full border border-border rounded-lg p-2.5 pl-8 bg-card-bg text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                                />
                                <Phone size={14} className="absolute left-2.5 top-3 text-text-muted" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-main mb-1">
                            Document Reference / Challan Number
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Signed Delivery Challan #DC-1092"
                            value={proofDocument}
                            onChange={(e) => setProofDocument(e.target.value)}
                            className="w-full border border-border rounded-lg p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-main mb-1">
                            Delivery Remarks & Notes
                        </label>
                        <textarea
                            rows={2}
                            placeholder="e.g. All 5,000 bags safely unloaded at Godown #2 in good condition."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full border border-border rounded-lg p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary resize-none"
                        />
                    </div>

                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 text-[11px] text-text-muted leading-relaxed">
                        ℹ️ <strong>Two-Step Verification:</strong> Submitting will transition the dispatch to <span className="font-bold text-purple-700">POD Pending Approval</span>. The approver will visually verify this photo and authorize completion to <strong>DELIVERED</strong>.
                    </div>

                    <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-text-muted hover:text-text-main hover:bg-app-bg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                            <UploadCloud size={15} />
                            <span>{isSubmitting ? 'Uploading POD Photo...' : 'Submit Proof of Delivery'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
