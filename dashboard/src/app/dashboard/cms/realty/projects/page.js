'use client';

import { useState, useEffect } from 'react';
import { cmsAPI } from '@/lib/api';

export default function RealtyProjectsPage() {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ title: '', location: '', type: 'Residential', status: 'Upcoming', description: '', isPublished: true });
    const [imageFiles, setImageFiles] = useState([]);

    useEffect(() => { loadData(); }, []);
    const loadData = async () => { try { const res = await cmsAPI.listRealtyProjects(); setProjects(res.data || []); } catch (e) { console.error(e); } finally { setLoading(false); } };

    const { requestCmsOtp } = require('@/components/OtpProvider').useOtp();

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const fd = new FormData();
            Object.keys(form).forEach(k => fd.append(k, form[k]));
            if (imageFiles.length > 0) {
                fd.append('image', imageFiles[0]);
                imageFiles.forEach(f => fd.append('images', f));
            }
            const otp = await requestCmsOtp();
            editingId ? await cmsAPI.updateRealtyProject(editingId, fd, otp) : await cmsAPI.createRealtyProject(fd, otp);
            setShowModal(false); setEditingId(null); setImageFiles([]);
            setForm({ title: '', location: '', type: 'Residential', status: 'Upcoming', description: '', isPublished: true });
            loadData();
        } catch (e) { if (e !== 'OTP verification cancelled') console.error(e); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this construction project?')) return;
        try { const otp = await requestCmsOtp(); await cmsAPI.deleteRealtyProject(id, otp); loadData(); } catch (e) { if (e !== 'OTP verification cancelled') console.error(e); }
    };

    const handleEdit = (p) => { setEditingId(p._id); setForm({ title: p.title, location: p.location, type: p.type, status: p.status, description: p.description, isPublished: p.isPublished }); setImageFiles([]); setShowModal(true); };

    if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

    const statusColors = { Completed: 'badge-success', Ongoing: 'badge-warning', Upcoming: 'badge-info' };

    return (
        <div>
            <div className="page-header">
                <div><h2>🏠 Realty — Construction Projects</h2><p>Manage construction project portfolio on realty.trivastu.com</p></div>
                <button className="btn btn-primary" onClick={() => { setEditingId(null); setForm({ title: '', location: '', type: 'Residential', status: 'Upcoming', description: '', isPublished: true }); setImageFiles([]); setShowModal(true); }}>+ Add Project</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {projects.length === 0 ? (
                    <div className="empty-state" style={{ gridColumn: '1/-1' }}><div className="empty-icon">🏗️</div><h3>No construction projects</h3><p>Add projects that appear on the Realty website portfolio.</p></div>
                ) : projects.map((p) => (
                    <div key={p._id} className="card">
                        {(p.images?.length > 0 ? p.images[0] : p.image) && <img src={p.images?.length > 0 ? p.images[0] : p.image} alt={p.title} style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '8px', marginBottom: '12px' }} />}
                        {p.images?.length > 1 && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>📷 {p.images.length} images</div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '700' }}>{p.title}</h3>
                            <span className={`badge ${statusColors[p.status] || 'badge-default'}`}>{p.status}</span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>📍 {p.location} • {p.type}</p>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>{p.description}</p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => handleEdit(p)}>✏️ Edit</button>
                            <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(p._id)}>🗑️</button>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>{editingId ? 'Edit' : 'Add'} Construction Project</h3><button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="grid-2">
                                    <div className="form-group"><label className="form-label">Project Title</label><input type="text" className="form-input" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Modern Villa — Doranda" /></div>
                                    <div className="form-group"><label className="form-label">Location</label><input type="text" className="form-input" required value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Ranchi" /></div>
                                </div>
                                <div className="grid-2">
                                    <div className="form-group"><label className="form-label">Type</label>
                                        <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option>Residential</option><option>Commercial</option><option>Renovation</option><option>Interior</option></select></div>
                                    <div className="form-group"><label className="form-label">Status</label>
                                        <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>Completed</option><option>Ongoing</option><option>Upcoming</option></select></div>
                                </div>
                                <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={form.description} rows={3} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe the construction project..."></textarea></div>
                                <div className="form-group"><label className="form-label">Project Images (multiple)</label><input type="file" className="form-input" accept="image/*" multiple onChange={e => setImageFiles(Array.from(e.target.files))} /></div>
                            </div>
                            <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Save Project</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
