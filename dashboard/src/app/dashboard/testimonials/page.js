'use client';

import { useState, useEffect } from 'react';
import { cmsAPI } from '@/lib/api';
import { useOtp } from '@/components/OtpProvider';

export default function TestimonialsPage() {
    const [testimonials, setTestimonials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({
        authorName: '', authorRole: 'Client', content: '', rating: 5, image: '', isPublished: true
    });
    const [imageFile, setImageFile] = useState(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const res = await cmsAPI.listTestimonials();
            setTestimonials(res.data || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const { requestCmsOtp } = useOtp();

    const handleDelete = async (id) => {
        if (!confirm('Delete this testimonial?')) return;
        try {
            const otpCode = await requestCmsOtp();
            await cmsAPI.deleteTestimonial(id, otpCode);
            loadData();
        } catch (err) {
            if (err !== 'OTP verification cancelled') console.error(err);
        }
    };

    const handleEdit = (testimonial) => {
        setEditingId(testimonial._id);
        setForm({
            authorName: testimonial.authorName, authorRole: testimonial.authorRole, content: testimonial.content,
            rating: testimonial.rating, image: testimonial.image, isPublished: testimonial.isPublished
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
                await cmsAPI.updateTestimonial(editingId, formData, otpCode);
            } else {
                await cmsAPI.createTestimonial(formData, otpCode);
            }
            setShowModal(false);
            setEditingId(null);
            setForm({ authorName: '', authorRole: 'Client', content: '', rating: 5, image: '', isPublished: true });
            setImageFile(null);
            loadData();
        } catch (err) {
            if (err !== 'OTP verification cancelled') console.error(err);
        }
    };

    if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

    const renderStars = (count) => '⭐'.repeat(Math.max(1, count));

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Client Testimonials</h2>
                    <p>Manage reviews shown on the Trivastu websites</p>
                </div>
                <button className="btn btn-primary" onClick={() => {
                    setEditingId(null);
                    setForm({ authorName: '', authorRole: 'Client', content: '', rating: 5, image: '', isPublished: true });
                    setImageFile(null);
                    setShowModal(true);
                }}>+ Add Testimonial</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {testimonials.length === 0 ? (
                    <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                        <div className="empty-icon">⭐</div><h3>No testimonials found</h3>
                    </div>
                ) : testimonials.map((t) => (
                    <div key={t._id} className="card" style={{ position: 'relative' }}>
                        <div style={{ marginBottom: '12px', fontSize: '14px' }}>{renderStars(t.rating)}</div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontStyle: 'italic', marginBottom: '20px', lineHeight: '1.6' }}>"{t.content}"</p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px' }}>
                            {t.image ? (
                                <img src={t.image} alt={t.authorName} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>👤</div>
                            )}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{t.authorName}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.authorRole}</div>
                            </div>
                            <button className="btn btn-outline btn-sm" onClick={() => handleEdit(t)}>✏️</button>
                            <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(t._id)}>🗑️</button>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingId ? 'Edit Testimonial' : 'Add Testimonial'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="grid-2">
                                    <div className="form-group">
                                        <label className="form-label">Author Name</label>
                                        <input type="text" className="form-input" required value={form.authorName}
                                            onChange={(e) => setForm({ ...form, authorName: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Role</label>
                                        <input type="text" className="form-input" placeholder="e.g. Home Buyer" required value={form.authorRole}
                                            onChange={(e) => setForm({ ...form, authorRole: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Rating (1-5)</label>
                                    <input type="number" min="1" max="5" className="form-input" required value={form.rating}
                                        onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Testimonial Content</label>
                                    <textarea className="form-textarea" required value={form.content} rows={4}
                                        onChange={(e) => setForm({ ...form, content: e.target.value })}></textarea>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Author Avatar Option (Upload)</label>
                                    <input type="file" className="form-input" accept="image/*"
                                        onChange={(e) => setImageFile(e.target.files[0])} />
                                    {form.image && !imageFile && <p style={{ fontSize: '12px', marginTop: '4px' }}>Current profile picture (<a href={form.image} target="_blank">View</a>)</p>}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Testimonial</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
