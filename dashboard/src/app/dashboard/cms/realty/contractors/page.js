'use client';

import { useState, useEffect } from 'react';
import { cmsAPI } from '@/lib/api';

export default function ContractorsPage() {
    const [team, setTeam] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ name: '', role: '', category: 'Contractor', experience: '', description: '', contactPhone: '', contactEmail: '', isPublished: true });
    const [imageFile, setImageFile] = useState(null);

    useEffect(() => { loadData(); }, []);
    const loadData = async () => { try { const res = await cmsAPI.listTeam(); setTeam(res.data || []); } catch (e) { console.error(e); } finally { setLoading(false); } };

    const { requestCmsOtp } = require('@/components/OtpProvider').useOtp();

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const fd = new FormData();
            Object.keys(form).forEach(k => fd.append(k, form[k]));
            if (imageFile) fd.append('image', imageFile);
            const otp = await requestCmsOtp();
            editingId ? await cmsAPI.updateTeamMember(editingId, fd, otp) : await cmsAPI.createTeamMember(fd, otp);
            setShowModal(false); setEditingId(null); setImageFile(null);
            setForm({ name: '', role: '', category: 'Contractor', experience: '', description: '', contactPhone: '', contactEmail: '', isPublished: true });
            loadData();
        } catch (e) { if (e !== 'OTP verification cancelled') console.error(e); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Remove this team member?')) return;
        try { const otp = await requestCmsOtp(); await cmsAPI.deleteTeamMember(id, otp); loadData(); } catch (e) { if (e !== 'OTP verification cancelled') console.error(e); }
    };

    const handleEdit = (m) => {
        setEditingId(m._id);
        setForm({ name: m.name, role: m.role, category: m.category, experience: m.experience, description: m.description || '', contactPhone: m.contactPhone || '', contactEmail: m.contactEmail || '', isPublished: m.isPublished });
        setImageFile(null); setShowModal(true);
    };

    if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

    return (
        <div>
            <div className="page-header">
                <div><h2>🏠 Realty — Contractors & Team</h2><p>Manage verified professionals shown on realty.trivastu.com/contractors</p></div>
                <button className="btn btn-primary" onClick={() => { setEditingId(null); setForm({ name: '', role: '', category: 'Contractor', experience: '', description: '', contactPhone: '', contactEmail: '', isPublished: true }); setImageFile(null); setShowModal(true); }}>+ Add Professional</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {team.length === 0 ? (
                    <div className="empty-state" style={{ gridColumn: '1/-1' }}><div className="empty-icon">👷</div><h3>No team members</h3></div>
                ) : team.map((m) => (
                    <div key={m._id} className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            {m.image ? <img src={m.image} alt={m.name} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>👷</div>}
                            <div><div style={{ fontWeight: '700' }}>{m.name}</div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.role} • {m.category}</div></div>
                        </div>
                        {m.experience && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>🏗️ {m.experience} experience</p>}
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => handleEdit(m)}>✏️ Edit</button>
                            <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(m._id)}>🗑️</button>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>{editingId ? 'Edit' : 'Add'} Professional</h3><button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="grid-2">
                                    <div className="form-group"><label className="form-label">Full Name</label><input type="text" className="form-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                                    <div className="form-group"><label className="form-label">Role</label><input type="text" className="form-input" required value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="e.g. Lead Architect" /></div>
                                </div>
                                <div className="grid-2">
                                    <div className="form-group"><label className="form-label">Category</label>
                                        <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                                            <option>Contractor</option><option>Architect</option><option>Interior Designer</option><option>Civil Engineer</option><option>Electrician</option><option>Plumber</option>
                                        </select></div>
                                    <div className="form-group"><label className="form-label">Experience</label><input type="text" className="form-input" value={form.experience} onChange={e => setForm({ ...form, experience: e.target.value })} placeholder="e.g. 15+ Years" /></div>
                                </div>
                                <div className="grid-2">
                                    <div className="form-group"><label className="form-label">Phone</label><input type="tel" className="form-input" value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} /></div>
                                    <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} /></div>
                                </div>
                                <div className="form-group"><label className="form-label">Profile Photo</label><input type="file" className="form-input" accept="image/*" onChange={e => setImageFile(e.target.files[0])} /></div>
                            </div>
                            <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
