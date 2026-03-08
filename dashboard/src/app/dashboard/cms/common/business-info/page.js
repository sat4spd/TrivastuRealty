'use client';

import { useState, useEffect } from 'react';
import { cmsAPI } from '@/lib/api';

export default function BusinessInfoPage() {
    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        companyName: '', phone: '', altPhone: '', email: '', address: '', city: '', state: '', pincode: '',
        googleMapsUrl: '', googlePlaceId: '',
        facebook: '', instagram: '', youtube: '', linkedin: '', twitter: '', whatsapp: '',
    });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const res = await cmsAPI.getBusinessInfo();
            const data = res.data;
            setInfo(data);
            setForm({
                companyName: data.companyName || '', phone: data.phone || '', altPhone: data.altPhone || '',
                email: data.email || '', address: data.address || '', city: data.city || '', state: data.state || '', pincode: data.pincode || '',
                googleMapsUrl: data.googleMapsUrl || '', googlePlaceId: data.googlePlaceId || '',
                facebook: data.facebook || '', instagram: data.instagram || '', youtube: data.youtube || '',
                linkedin: data.linkedin || '', twitter: data.twitter || '', whatsapp: data.whatsapp || '',
            });
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const { requestCmsOtp } = require('@/components/OtpProvider').useOtp();

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const fd = new FormData();
            Object.keys(form).forEach(k => fd.append(k, form[k]));
            const otp = await requestCmsOtp();
            await cmsAPI.updateBusinessInfo(fd, otp);
            loadData();
        } catch (e) { if (e !== 'OTP verification cancelled') console.error(e); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

    return (
        <div>
            <div className="page-header"><div><h2>⚙️ Common — Business Info</h2><p>Shared contact details, address, and social links across all websites</p></div></div>

            <form onSubmit={handleSave}>
                <div className="card" style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>📞 Contact Information</h3>
                    <div className="grid-2">
                        <div className="form-group"><label className="form-label">Company Name</label><input type="text" className="form-input" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Primary Phone</label><input type="tel" className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                    </div>
                    <div className="grid-2">
                        <div className="form-group"><label className="form-label">Alternate Phone</label><input type="tel" className="form-input" value={form.altPhone} onChange={e => setForm({ ...form, altPhone: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                    </div>
                    <div className="form-group"><label className="form-label">WhatsApp Number</label><input type="tel" className="form-input" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} /></div>
                </div>

                <div className="card" style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>📍 Address</h3>
                    <div className="form-group"><label className="form-label">Full Address</label><input type="text" className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
                    <div className="grid-2">
                        <div className="form-group"><label className="form-label">City</label><input type="text" className="form-input" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">State</label><input type="text" className="form-input" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
                    </div>
                    <div className="grid-2">
                        <div className="form-group"><label className="form-label">Pincode</label><input type="text" className="form-input" value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Google Maps URL</label><input type="url" className="form-input" value={form.googleMapsUrl} onChange={e => setForm({ ...form, googleMapsUrl: e.target.value })} placeholder="https://maps.google.com/..." /></div>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>🔗 Social Media Links</h3>
                    <div className="grid-2">
                        <div className="form-group"><label className="form-label">Facebook</label><input type="url" className="form-input" value={form.facebook} onChange={e => setForm({ ...form, facebook: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Instagram</label><input type="url" className="form-input" value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} /></div>
                    </div>
                    <div className="grid-2">
                        <div className="form-group"><label className="form-label">YouTube</label><input type="url" className="form-input" value={form.youtube} onChange={e => setForm({ ...form, youtube: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">LinkedIn</label><input type="url" className="form-input" value={form.linkedin} onChange={e => setForm({ ...form, linkedin: e.target.value })} /></div>
                    </div>
                    <div className="grid-2">
                        <div className="form-group"><label className="form-label">Twitter / X</label><input type="url" className="form-input" value={form.twitter} onChange={e => setForm({ ...form, twitter: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Google Place ID (for Reviews)</label><input type="text" className="form-input" value={form.googlePlaceId} onChange={e => setForm({ ...form, googlePlaceId: e.target.value })} placeholder="ChIJ..." /></div>
                    </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : '💾 Save Business Info'}</button>
            </form>
        </div>
    );
}
