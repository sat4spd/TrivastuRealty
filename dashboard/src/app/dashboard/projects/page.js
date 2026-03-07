'use client';

import { useState, useEffect } from 'react';
import { cmsAPI } from '@/lib/api';

export default function ProjectsPage() {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({
        title: '', location: '', type: 'Residential', status: 'Ongoing', description: '', image: '', isPublished: true
    });
    const [imageFile, setImageFile] = useState(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const res = await cmsAPI.listProjects();
            setProjects(res.data || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const { requestCmsOtp } = require('@/components/OtpProvider').useOtp();

    const handleDelete = async (id) => {
        if (!confirm('Delete this project?')) return;
        try {
            const otpCode = await requestCmsOtp();
            await cmsAPI.deleteProject(id, otpCode);
            loadData();
        } catch (err) {
            if (err !== 'OTP verification cancelled') console.error(err);
        }
    };

    const handleEdit = (project) => {
        setEditingId(project._id);
        setForm({
            title: project.title,
            location: project.location,
            type: project.type,
            status: project.status,
            description: project.description,
            image: project.image,
            isPublished: project.isPublished
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
                await cmsAPI.updateProject(editingId, formData, otpCode);
            } else {
                await cmsAPI.createProject(formData, otpCode);
            }
            setShowModal(false);
            setEditingId(null);
            setForm({ title: '', location: '', type: 'Residential', status: 'Ongoing', description: '', image: '', isPublished: true });
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
                    <h2>Project Showcase Content</h2>
                    <p>Manage projects displayed on the Trivastu Brand website</p>
                </div>
                <button className="btn btn-primary" onClick={() => {
                    setEditingId(null);
                    setForm({ title: '', location: '', type: 'Residential', status: 'Ongoing', description: '', image: '', isPublished: true });
                    setImageFile(null);
                    setShowModal(true);
                }}>+ Add Project</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                {projects.length === 0 ? (
                    <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                        <div className="empty-icon">🏗️</div><h3>No projects found</h3>
                    </div>
                ) : projects.map((p) => (
                    <div key={p._id} className="card" style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
                            <span className={`badge ${p.status === 'Completed' ? 'badge-success' : p.status === 'Ongoing' ? 'badge-warning' : 'badge-primary'}`}>
                                {p.status}
                            </span>
                        </div>
                        {p.image && <img src={p.image} alt={p.title} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px', marginBottom: '12px' }} />}
                        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>{p.title}</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '12px' }}>📍 {p.location} • {p.type}</p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>{p.description}</p>
                        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-glass)', paddingTop: '14px' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => handleEdit(p)}>✏️ Edit</button>
                            <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto', color: 'var(--danger)' }} onClick={() => handleDelete(p._id)}>🗑️</button>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingId ? 'Edit Project' : 'Add New Project'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Title</label>
                                    <input type="text" className="form-input" required value={form.title}
                                        onChange={(e) => setForm({ ...form, title: e.target.value })} />
                                </div>
                                <div className="grid-2">
                                    <div className="form-group">
                                        <label className="form-label">Location</label>
                                        <input type="text" className="form-input" required value={form.location}
                                            onChange={(e) => setForm({ ...form, location: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Type (e.g. Residential, Commercial)</label>
                                        <input type="text" className="form-input" required value={form.type}
                                            onChange={(e) => setForm({ ...form, type: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select className="form-select" value={form.status}
                                        onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                        <option value="Upcoming">Upcoming</option>
                                        <option value="Ongoing">Ongoing</option>
                                        <option value="Completed">Completed</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <textarea className="form-textarea" required value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}></textarea>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Cover Image</label>
                                    <input type="file" className="form-input" accept="image/*"
                                        onChange={(e) => setImageFile(e.target.files[0])} />
                                    {form.image && !imageFile && <p style={{ fontSize: '12px', marginTop: '4px' }}>Current image attached (<a href={form.image} target="_blank">View</a>)</p>}
                                </div>
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
                                    Published (Visible on Website)
                                </label>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Project</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
