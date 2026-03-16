'use client';

import { useState, useEffect } from 'react';
import { cmsAPI } from '@/lib/api';
import { useOtp } from '@/components/OtpProvider';

export default function TestimonialsPage() {
    const [testimonials, setTestimonials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ authorName: '', authorRole: 'Client', content: '', rating: 5, isPublished: true });
    const [imageFile, setImageFile] = useState(null);

    useEffect(() => { loadData(); }, []);
    const loadData = async () => { try { const res = await cmsAPI.listTestimonials(); setTestimonials(res.data || []); } catch (e) { console.error(e); } finally { setLoading(false); } };

    const { requestCmsOtp } = useOtp();

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const fd = new FormData();
            Object.keys(form).forEach(k => fd.append(k, form[k]));
            if (imageFile) fd.append('image', imageFile);
            const otp = await requestCmsOtp();
            editingId ? await cmsAPI.updateTestimonial(editingId, fd, otp) : await cmsAPI.createTestimonial(fd, otp);
            setShowModal(false); setEditingId(null); setImageFile(null);
            setForm({ authorName: '', authorRole: 'Client', content: '', rating: 5, isPublished: true });
            loadData();
        } catch (e) { if (e !== 'OTP verification cancelled') console.error(e); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this testimonial?')) return;
        try { const otp = await requestCmsOtp(); await cmsAPI.deleteTestimonial(id, otp); loadData(); } catch (e) { if (e !== 'OTP verification cancelled') console.error(e); }
    };

    const handleEdit = (t) => {
        setEditingId(t._id);
        setForm({ authorName: t.authorName, authorRole: t.authorRole, content: t.content, rating: t.rating, isPublished: t.isPublished });
        setImageFile(null); setShowModal(true);
    };

    if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>⚙️ Common — Testimonials & Reviews</h2>
                    <p>Shared across trivastu.com, realty.trivastu.com, and plot.trivastu.com</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditingId(null); setForm({ authorName: '', authorRole: 'Client', content: '', rating: 5, isPublished: true }); setImageFile(null); setShowModal(true); }}>+ Add Testimonial</button>
            </div>

            {/* Future: Google Reviews Integration */}
            <div className="card" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}>
                <span style={{ fontSize: '24px' }}>🔗</span>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '14px' }}>Google Reviews Integration</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Set your Google Place ID in Business Info to auto-import reviews from Google Maps.</div>
                </div>
                <span className="badge badge-info">Coming Soon</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {testimonials.length === 0 ? (
                    <div className="empty-state" style={{ gridColumn: '1/-1' }}><div className="empty-icon">⭐</div><h3>No testimonials yet</h3></div>
                ) : testimonials.map((t) => (
                    <div key={t._id} className="card">
                        <div style={{ marginBottom: '8px' }}>{'⭐'.repeat(Math.max(1, t.rating))}</div>
                        <p style={{ fontSize: '14px', fontStyle: 'italic', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.6' }}>"{t.content}"</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
                            {t.image ? <img src={t.image} alt={t.authorName} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>{t.authorName?.charAt(0)}</div>}
                            <div style={{ flex: 1 }}><div style={{ fontWeight: '700', fontSize: '14px' }}>{t.authorName}</div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.authorRole}</div></div>
                            <button className="btn btn-outline btn-sm" onClick={() => handleEdit(t)}>✏️</button>
                            <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(t._id)}>🗑️</button>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>{editingId ? 'Edit' : 'Add'} Testimonial</h3><button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="grid-2">
                                    <div className="form-group"><label className="form-label">Author Name</label><input type="text" className="form-input" required value={form.authorName} onChange={e => setForm({ ...form, authorName: e.target.value })} /></div>
                                    <div className="form-group"><label className="form-label">Role / Context</label><input type="text" className="form-input" required value={form.authorRole} onChange={e => setForm({ ...form, authorRole: e.target.value })} placeholder="e.g. Plot Buyer — Nagari" /></div>
                                </div>
                                <div className="form-group"><label className="form-label">Rating (1-5)</label><input type="number" min="1" max="5" className="form-input" value={form.rating} onChange={e => setForm({ ...form, rating: Number(e.target.value) })} /></div>
                                <div className="form-group"><label className="form-label">Review Content</label><textarea className="form-textarea" required value={form.content} rows={4} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="What did the client say about their experience?"></textarea></div>
                                <div className="form-group"><label className="form-label">Author Photo (Optional)</label><input type="file" className="form-input" accept="image/*" onChange={e => setImageFile(e.target.files[0])} /></div>
                            </div>
                            <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
