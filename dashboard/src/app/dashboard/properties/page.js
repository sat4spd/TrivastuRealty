'use client';

import { useState, useEffect } from 'react';
import { propertiesAPI } from '@/lib/api';

const formatCurrency = (amt) => {
    if (!amt) return '₹0';
    if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(1)}Cr`;
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)}L`;
    return `₹${amt.toLocaleString('en-IN')}`;
};

export default function PropertiesPage() {
    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
        title: '', type: 'apartment', price: '', location: '', area: '', unit: 'sqft', agentCommissionRate: 2.0, bedrooms: '', description: '', projectName: '',
    });
    const [images, setImages] = useState([]);
    const [previews, setPreviews] = useState([]);

    const handleMediaAdd = (e) => {
        const newFiles = Array.from(e.target.files);
        setImages(prev => [...prev, ...newFiles]);
        const newPreviews = newFiles.map(f => ({
            name: f.name,
            type: f.type,
            url: URL.createObjectURL(f),
        }));
        setPreviews(prev => [...prev, ...newPreviews]);
        // Reset input so same file can be picked again if needed
        e.target.value = '';
    };

    const removeMedia = (idx) => {
        setImages(prev => prev.filter((_, i) => i !== idx));
        setPreviews(prev => prev.filter((_, i) => i !== idx));
    };

    useEffect(() => { loadProperties(); }, [filter]);

    const loadProperties = async () => {
        try {
            const params = filter ? { status: filter } : {};
            const res = await propertiesAPI.list(params);
            setProperties(res.data.properties || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleApprove = async (id, status) => {
        try {
            await propertiesAPI.approve(id, status);
            loadProperties();
        } catch (err) { console.error(err); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this property?')) return;
        try {
            await propertiesAPI.delete(id);
            loadProperties();
        } catch (err) { console.error(err); }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            Object.keys(form).forEach(k => formData.append(k, form[k]));
            images.forEach(img => formData.append('images', img));
            await propertiesAPI.create(formData);
            setShowModal(false);
            setForm({ title: '', type: 'apartment', price: '', location: '', area: '', unit: 'sqft', agentCommissionRate: 2.0, bedrooms: '', description: '', projectName: '' });
            setImages([]);
            setPreviews([]);
            loadProperties();
        } catch (err) { console.error(err); }
    };

    const typeIcons = { apartment: '🏢', villa: '🏡', plot: '🌳', commercial: '🏪' };

    if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Property Management</h2>
                    <p>{properties.length} properties</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Property</button>
            </div>

            <div className="tabs">
                <button className={`tab ${!filter ? 'active' : ''}`} onClick={() => setFilter('')}>All</button>
                {['pending', 'approved', 'rejected'].map(s => (
                    <button key={s} className={`tab ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
                        {s === 'approved' ? '✅' : s === 'pending' ? '⏳' : '❌'} {s}
                    </button>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                {properties.length === 0 ? (
                    <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                        <div className="empty-icon">🏠</div><h3>No properties found</h3>
                    </div>
                ) : properties.map((prop) => (
                    <div key={prop._id} className="card" style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
                            <span className={`badge ${prop.status === 'approved' ? 'badge-success' :
                                prop.status === 'pending' ? 'badge-warning' : 'badge-danger'
                                }`}>
                                {prop.status}
                            </span>
                        </div>

                        <div style={{ fontSize: '32px', marginBottom: '12px' }}>{typeIcons[prop.type] || '🏠'}</div>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>{prop.title}</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>{prop.description?.substring(0, 80)}</p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                            <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Price</span>
                                <div style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(prop.price)}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Location</span>
                                <div style={{ fontSize: '14px' }}>📍 {prop.location}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Inventory (Avail / Total)</span>
                                <div style={{ fontSize: '14px' }}>{prop.availableArea} / {prop.totalArea} {prop.unit}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Agent Commission</span>
                                <div style={{ fontSize: '14px', color: 'var(--success)' }}>{prop.agentCommissionRate}%</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-glass)', paddingTop: '14px' }}>
                            {prop.status === 'pending' && (
                                <>
                                    <button className="btn btn-success btn-sm" onClick={() => handleApprove(prop._id, 'approved')}>✅ Approve</button>
                                    <button className="btn btn-danger btn-sm" onClick={() => handleApprove(prop._id, 'rejected')}>❌ Reject</button>
                                </>
                            )}
                            <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={() => handleDelete(prop._id)}>🗑️</button>
                            <a href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/property/${prop._id}`}
                                target="_blank" rel="noopener noreferrer"
                                className="btn btn-outline btn-sm" title="Public Page">🔗</a>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Add New Property</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAdd}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Title</label>
                                    <input type="text" className="form-input" required value={form.title}
                                        onChange={(e) => setForm({ ...form, title: e.target.value })} />
                                </div>
                                <div className="grid-2">
                                    <div className="form-group">
                                        <label className="form-label">Type</label>
                                        <select className="form-select" value={form.type}
                                            onChange={(e) => setForm({ ...form, type: e.target.value })}>
                                            <option value="apartment">Apartment</option>
                                            <option value="villa">Villa</option>
                                            <option value="plot">Plot</option>
                                            <option value="commercial">Commercial</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Price (₹)</label>
                                        <input type="number" className="form-input" required value={form.price}
                                            onChange={(e) => setForm({ ...form, price: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid-2">
                                    <div className="form-group">
                                        <label className="form-label">Location</label>
                                        <input type="text" className="form-input" required value={form.location}
                                            onChange={(e) => setForm({ ...form, location: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Total Area</label>
                                        <input type="number" step="0.01" className="form-input" placeholder="e.g. 1200" required value={form.area}
                                            onChange={(e) => setForm({ ...form, area: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid-2">
                                    <div className="form-group">
                                        <label className="form-label">Area Unit</label>
                                        <select className="form-select" value={form.unit}
                                            onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                                            <option value="sqft">Sq Ft</option>
                                            <option value="sqm">Sq M</option>
                                            <option value="acres">Acres</option>
                                            <option value="decimals">Decimals</option>
                                            <option value="hectares">Hectares</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Agent Commission Rate (%)</label>
                                        <input type="number" step="0.1" className="form-input" value={form.agentCommissionRate}
                                            onChange={(e) => setForm({ ...form, agentCommissionRate: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid-2">
                                    <div className="form-group">
                                        <label className="form-label">Bedrooms</label>
                                        <input type="number" className="form-input" value={form.bedrooms}
                                            onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Project Name</label>
                                        <input type="text" className="form-input" value={form.projectName}
                                            onChange={(e) => setForm({ ...form, projectName: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <textarea className="form-textarea" value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}></textarea>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Photos & Videos</label>
                                    <input type="file" multiple accept="image/*,video/*" className="form-input"
                                        onChange={handleMediaAdd} />
                                    {previews.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                                            {previews.map((p, i) => (
                                                <div key={i} style={{ position: 'relative', width: '80px' }}>
                                                    {p.type.startsWith('video') ? (
                                                        <div style={{ width: 80, height: 60, background: '#1a1a2e', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🎬</div>
                                                    ) : (
                                                        <img src={p.url} alt={p.name} style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6 }} />
                                                    )}
                                                    <button type="button" onClick={() => removeMedia(i)}
                                                        style={{ position: 'absolute', top: -6, right: -6, background: 'var(--danger)', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: 10, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                                    <div style={{ fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)', marginTop: 2 }}>{p.name}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Click multiple times to add more files. Click ✕ to remove.</div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Add Property</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
