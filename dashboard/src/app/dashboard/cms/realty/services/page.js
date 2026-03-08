'use client';

import { useState, useEffect } from 'react';
import { cmsAPI } from '@/lib/api';

export default function ServicesPage() {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ name: '', priceRange: '', unit: '/sq.ft', isPopular: false, order: 0, website: 'realty', isPublished: true });
    const [features, setFeatures] = useState(['']);

    useEffect(() => { loadData(); }, []);
    const loadData = async () => { try { const res = await cmsAPI.listServices('realty'); setServices(res.data || []); } catch (e) { console.error(e); } finally { setLoading(false); } };

    const { requestCmsOtp } = require('@/components/OtpProvider').useOtp();

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const fd = new FormData();
            Object.keys(form).forEach(k => fd.append(k, form[k]));
            features.filter(f => f.trim()).forEach(f => fd.append('features', f.trim()));
            const otp = await requestCmsOtp();
            editingId ? await cmsAPI.updateService(editingId, fd, otp) : await cmsAPI.createService(fd, otp);
            setShowModal(false); setEditingId(null);
            setForm({ name: '', priceRange: '', unit: '/sq.ft', isPopular: false, order: 0, website: 'realty', isPublished: true });
            setFeatures(['']);
            loadData();
        } catch (e) { if (e !== 'OTP verification cancelled') console.error(e); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this service package?')) return;
        try { const otp = await requestCmsOtp(); await cmsAPI.deleteService(id, otp); loadData(); } catch (e) { if (e !== 'OTP verification cancelled') console.error(e); }
    };

    const handleEdit = (s) => {
        setEditingId(s._id);
        setForm({ name: s.name, priceRange: s.priceRange, unit: s.unit, isPopular: s.isPopular, order: s.order, website: s.website, isPublished: s.isPublished });
        setFeatures(s.features?.length ? [...s.features] : ['']);
        setShowModal(true);
    };

    if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

    return (
        <div>
            <div className="page-header">
                <div><h2>🏠 Realty — Services & Packages</h2><p>Manage construction pricing packages on realty.trivastu.com</p></div>
                <button className="btn btn-primary" onClick={() => { setEditingId(null); setForm({ name: '', priceRange: '', unit: '/sq.ft', isPopular: false, order: 0, website: 'realty', isPublished: true }); setFeatures(['']); setShowModal(true); }}>+ Add Package</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {services.length === 0 ? (
                    <div className="empty-state" style={{ gridColumn: '1/-1' }}><div className="empty-icon">🔧</div><h3>No packages yet</h3></div>
                ) : services.map((s) => (
                    <div key={s._id} className="card" style={{ position: 'relative', border: s.isPopular ? '1px solid var(--accent)' : undefined }}>
                        {s.isPopular && <span className="badge badge-purple" style={{ position: 'absolute', top: '-10px', right: '12px' }}>⭐ Most Popular</span>}
                        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>{s.name}</h3>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent)', marginBottom: '12px' }}>{s.priceRange} <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{s.unit}</span></div>
                        <ul style={{ listStyle: 'none', padding: 0, marginBottom: '16px' }}>
                            {(s.features || []).map((f, i) => <li key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '4px 0', display: 'flex', gap: '8px' }}><span style={{ color: 'var(--success)' }}>✓</span> {f}</li>)}
                        </ul>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => handleEdit(s)}>✏️ Edit</button>
                            <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(s._id)}>🗑️</button>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>{editingId ? 'Edit' : 'Add'} Package</h3><button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="grid-2">
                                    <div className="form-group"><label className="form-label">Package Name</label><input type="text" className="form-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Premium" /></div>
                                    <div className="form-group"><label className="form-label">Price Range</label><input type="text" className="form-input" required value={form.priceRange} onChange={e => setForm({ ...form, priceRange: e.target.value })} placeholder="e.g. ₹1,800 - ₹2,200" /></div>
                                </div>
                                <div className="grid-2">
                                    <div className="form-group"><label className="form-label">Unit</label><input type="text" className="form-input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></div>
                                    <div className="form-group"><label className="form-label">Display Order</label><input type="number" className="form-input" value={form.order} onChange={e => setForm({ ...form, order: Number(e.target.value) })} /></div>
                                </div>
                                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="checkbox" checked={form.isPopular} onChange={e => setForm({ ...form, isPopular: e.target.checked })} />
                                    <label className="form-label" style={{ margin: 0 }}>Mark as "Most Popular"</label>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Features</label>
                                    {features.map((f, i) => (
                                        <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                            <input type="text" className="form-input" value={f} onChange={e => { const nf = [...features]; nf[i] = e.target.value; setFeatures(nf); }} placeholder={`Feature ${i + 1}`} />
                                            {features.length > 1 && <button type="button" className="btn btn-outline btn-sm" onClick={() => setFeatures(features.filter((_, j) => j !== i))}>✕</button>}
                                        </div>
                                    ))}
                                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setFeatures([...features, ''])}>+ Add Feature</button>
                                </div>
                            </div>
                            <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Save Package</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
