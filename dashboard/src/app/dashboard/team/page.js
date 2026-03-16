'use client';

import { useState, useEffect } from 'react';
import { cmsAPI } from '@/lib/api';
import { useOtp } from '@/components/OtpProvider';

export default function TeamPage() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({
        name: '', role: '', category: 'Contractor', experience: '', description: '', image: '', contactEmail: '', contactPhone: '', isPublished: true
    });
    const [imageFile, setImageFile] = useState(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const res = await cmsAPI.listTeam();
            setMembers(res.data || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const { requestCmsOtp } = useOtp();

    const handleDelete = async (id) => {
        if (!confirm('Delete this team member?')) return;
        try {
            const otpCode = await requestCmsOtp();
            await cmsAPI.deleteTeamMember(id, otpCode);
            loadData();
        } catch (err) {
            if (err !== 'OTP verification cancelled') console.error(err);
        }
    };

    const handleEdit = (member) => {
        setEditingId(member._id);
        setForm({
            name: member.name, role: member.role, category: member.category, experience: member.experience,
            description: member.description, image: member.image, contactEmail: member.contactEmail, contactPhone: member.contactPhone,
            isPublished: member.isPublished
        });
        setImageFile(null);
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            Object.keys(form).forEach(key => formData.append(key, form[key]));
            if (imageFile) formData.append('image', imageFile);

            const otpCode = await requestCmsOtp();
            if (editingId) {
                await cmsAPI.updateTeamMember(editingId, formData, otpCode);
            } else {
                await cmsAPI.createTeamMember(formData, otpCode);
            }
            setShowModal(false);
            setEditingId(null);
            setForm({ name: '', role: '', category: 'Contractor', experience: '', description: '', image: '', contactEmail: '', contactPhone: '', isPublished: true });
            setImageFile(null);
            loadData();
        } catch (err) {
            if (err !== 'OTP verification cancelled') console.error(err);
        }
    };

    if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Team & Contractors</h2>
                    <p>Manage people profiles displayed on the public websites</p>
                </div>
                <button className="btn btn-primary" onClick={() => {
                    setEditingId(null);
                    setForm({ name: '', role: '', category: 'Contractor', experience: '', description: '', image: '', contactEmail: '', contactPhone: '', isPublished: true });
                    setImageFile(null);
                    setShowModal(true);
                }}>+ Add Member</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {members.length === 0 ? (
                    <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                        <div className="empty-icon">👷</div><h3>No team members found</h3>
                    </div>
                ) : members.map((m) => (
                    <div key={m._id} className="card" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        {m.image ? (
                            <img src={m.image} alt={m.name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--surface-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>👤</div>
                        )}
                        <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0' }}>{m.name}</h3>
                            <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>{m.role} • {m.category}</div>
                            <div style={{ fontSize: '12px', color: 'var(--success)' }}>{m.experience}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => handleEdit(m)}>✏️</button>
                            <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(m._id)}>🗑️</button>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingId ? 'Edit Team Member' : 'Add New Member'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="grid-2">
                                    <div className="form-group">
                                        <label className="form-label">Full Name</label>
                                        <input type="text" className="form-input" required value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Role</label>
                                        <input type="text" className="form-input" placeholder="e.g. Lead Architect" required value={form.role}
                                            onChange={(e) => setForm({ ...form, role: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid-2">
                                    <div className="form-group">
                                        <label className="form-label">Category</label>
                                        <select className="form-select" value={form.category}
                                            onChange={(e) => setForm({ ...form, category: e.target.value })}>
                                            <option value="Contractor">Contractor</option>
                                            <option value="Consultant">Consultant</option>
                                            <option value="Management">Management</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Experience</label>
                                        <input type="text" className="form-input" placeholder="e.g. 15+ Years" value={form.experience}
                                            onChange={(e) => setForm({ ...form, experience: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description / Bio</label>
                                    <textarea className="form-textarea" value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}></textarea>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Profile Image Option (Upload)</label>
                                    <input type="file" className="form-input" accept="image/*"
                                        onChange={(e) => setImageFile(e.target.files[0])} />
                                    {form.image && !imageFile && <p style={{ fontSize: '12px', marginTop: '4px' }}>Current profile picture (<a href={form.image} target="_blank">View</a>)</p>}
                                </div>
                                <div className="grid-2">
                                    <div className="form-group">
                                        <label className="form-label">Contact Email</label>
                                        <input type="email" className="form-input" value={form.contactEmail}
                                            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Contact Phone</label>
                                        <input type="text" className="form-input" value={form.contactPhone}
                                            onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Member</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
