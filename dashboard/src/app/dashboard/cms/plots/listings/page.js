'use client';

import { useState, useEffect } from 'react';
import { propertiesAPI } from '@/lib/api';
import api from '@/lib/api';

export default function PlotListingsPage() {
    const [plots, setPlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({
        title: '', type: 'plot', price: '', location: '', area: '', unit: 'decimals',
        description: '', pricePerSqft: '', landClassification: 'general', website: 'plots',
        isAvailable: true,
    });
    const [highlights, setHighlights] = useState(['']);
    const [imageFiles, setImageFiles] = useState([]);

    useEffect(() => { loadData(); }, []);
    const loadData = async () => {
        try {
            // Primary: Use CMS endpoint which is public and returns approved properties
            const res = await api.get('/cms/properties', { params: { website: 'plots' } });
            const data = Array.isArray(res.data) ? res.data : (res.data?.properties || res.data || []);
            console.log('[PlotListings] CMS API returned', data.length, 'plots');
            setPlots(data);
        } catch (e) {
            console.warn('[PlotListings] CMS endpoint failed:', e.message);
            // Fallback to auth-protected properties API
            try {
                const res2 = await propertiesAPI.list({ status: 'approved' });
                const allProps = Array.isArray(res2.data) ? res2.data : (res2.data?.properties || []);
                const plotTypes = ['plot', 'land', 'commercial'];
                const filtered = allProps.filter(p => p.website === 'plots' || plotTypes.includes(p.type));
                console.log('[PlotListings] Fallback API returned', filtered.length, 'plots');
                setPlots(filtered);
            } catch (e2) { console.error('[PlotListings] Both APIs failed:', e2.message); }
        }
        finally { setLoading(false); }
    };

    const { requestCmsOtp } = require('@/components/OtpProvider').useOtp();

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const fd = new FormData();
            Object.keys(form).forEach(k => fd.append(k, form[k]));
            fd.append('status', 'approved');
            highlights.filter(h => h.trim()).forEach(h => fd.append('highlights', h.trim()));
            imageFiles.forEach(f => fd.append('images', f));
            const otp = await requestCmsOtp();
            if (editingId) {
                await propertiesAPI.update(editingId, fd, otp);
            } else {
                await propertiesAPI.create(fd, otp);
            }
            setShowModal(false); setEditingId(null); setImageFiles([]);
            setForm({ title: '', type: 'plot', price: '', location: '', area: '', unit: 'decimals', description: '', pricePerSqft: '', landClassification: 'general', website: 'plots', isAvailable: true });
            setHighlights(['']);
            loadData();
        } catch (e) { if (e !== 'OTP verification cancelled') console.error(e); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this plot listing?')) return;
        try { const otp = await requestCmsOtp(); await propertiesAPI.delete(id, otp); loadData(); } catch (e) { if (e !== 'OTP verification cancelled') console.error(e); }
    };

    const handleEdit = (p) => {
        setEditingId(p._id);
        setForm({ title: p.title, type: p.type, price: p.price, location: p.location, area: p.area, unit: p.unit || 'decimals', description: p.description || '', pricePerSqft: p.pricePerSqft || '', landClassification: p.landClassification || 'general', website: 'plots', isAvailable: p.isAvailable });
        setHighlights(p.highlights?.length ? [...p.highlights] : ['']);
        setImageFiles([]); setShowModal(true);
    };

    const classificationLabels = { general: '🟢 General', 'sc-st': '🟡 SC/ST', cnt: '🔴 CNT Act' };

    if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

    return (
        <div>
            <div className="page-header">
                <div><h2>🌳 Plots — Plot Listings</h2><p>Manage plots and land shown on plot.trivastu.com/browse</p></div>
                <button className="btn btn-primary" onClick={() => { setEditingId(null); setForm({ title: '', type: 'plot', price: '', location: '', area: '', unit: 'decimals', description: '', pricePerSqft: '', landClassification: 'general', website: 'plots', isAvailable: true }); setHighlights(['']); setImageFiles([]); setShowModal(true); }}>+ Add Plot</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {plots.length === 0 ? (
                    <div className="empty-state" style={{ gridColumn: '1/-1' }}><div className="empty-icon">🌳</div><h3>No plot listings</h3><p>Add your first plot listing.</p></div>
                ) : plots.map((p) => (
                    <div key={p._id} className="card">
                        {p.images?.[0] && <img src={p.images[0]} alt={p.title} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', marginBottom: '12px' }} />}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '700' }}>{p.title}</h3>
                            <span className={`badge ${p.isAvailable ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '10px' }}>{p.isAvailable ? 'Available' : 'Sold'}</span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>📍 {p.location}</p>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            <span>📐 {p.area} {p.unit}</span>
                            <span>💰 ₹{Number(p.price).toLocaleString('en-IN')}</span>
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <span className={`badge ${p.landClassification === 'general' ? 'badge-success' : p.landClassification === 'sc-st' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '10px' }}>
                                {classificationLabels[p.landClassification] || 'General'}
                            </span>
                        </div>
                        {p.highlights?.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>{p.highlights.map((h, i) => <span key={i} className="badge badge-default" style={{ fontSize: '10px' }}>{h}</span>)}</div>}
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => handleEdit(p)}>✏️ Edit</button>
                            <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(p._id)}>🗑️</button>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
                        <div className="modal-header"><h3>{editingId ? 'Edit' : 'Add'} Plot Listing</h3><button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-group"><label className="form-label">Plot Title</label><input type="text" className="form-input" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Premium Residential Plot — Nagari" /></div>
                                <div className="grid-2">
                                    <div className="form-group"><label className="form-label">Type</label>
                                        <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="plot">Residential Plot</option><option value="commercial">Commercial Plot</option><option value="land">Agricultural Land</option></select></div>
                                    <div className="form-group"><label className="form-label">Land Classification</label>
                                        <select className="form-select" value={form.landClassification} onChange={e => setForm({ ...form, landClassification: e.target.value })}>
                                            <option value="general">General — Freely Transferable</option>
                                            <option value="sc-st">SC/ST — Restricted Transfer</option>
                                            <option value="cnt">CNT — Tribal Protected Land</option>
                                        </select></div>
                                </div>
                                <div className="grid-2">
                                    <div className="form-group"><label className="form-label">Price (₹)</label><input type="number" className="form-input" required value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
                                    <div className="form-group"><label className="form-label">Location</label><input type="text" className="form-input" required value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Nagari, Ranchi" /></div>
                                </div>
                                <div className="grid-2">
                                    <div className="form-group"><label className="form-label">Area</label><input type="number" step="0.01" className="form-input" required value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} /></div>
                                    <div className="form-group"><label className="form-label">Unit</label>
                                        <select className="form-select" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}><option value="decimals">Decimals</option><option value="sqft">Square Feet</option><option value="acres">Acres</option><option value="kattha">Kattha</option></select></div>
                                </div>
                                <div className="form-group"><label className="form-label">Price Per Sq.ft (optional)</label><input type="text" className="form-input" value={form.pricePerSqft} onChange={e => setForm({ ...form, pricePerSqft: e.target.value })} placeholder="e.g. ₹1,150/sq.ft" /></div>
                                <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={form.description} rows={3} onChange={e => setForm({ ...form, description: e.target.value })}></textarea></div>

                                <div className="form-group">
                                    <label className="form-label">Highlights</label>
                                    {highlights.map((h, i) => (
                                        <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                                            <input type="text" className="form-input" value={h} onChange={e => { const nh = [...highlights]; nh[i] = e.target.value; setHighlights(nh); }} placeholder="e.g. Corner Plot, East Facing" />
                                            {highlights.length > 1 && <button type="button" className="btn btn-outline btn-sm" onClick={() => setHighlights(highlights.filter((_, j) => j !== i))}>✕</button>}
                                        </div>
                                    ))}
                                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setHighlights([...highlights, ''])}>+ Add Highlight</button>
                                </div>

                                <div className="form-group"><label className="form-label">Plot Images</label><input type="file" className="form-input" accept="image/*" multiple onChange={e => setImageFiles(Array.from(e.target.files))} /></div>
                            </div>
                            <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Save Listing</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
