'use client';

import { useState, useEffect } from 'react';
import { broadcastAPI, propertiesAPI } from '@/lib/api';

const formatCurrency = (amt) => {
    if (!amt) return '₹0';
    if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(1)}Cr`;
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)}L`;
    return `₹${amt.toLocaleString('en-IN')}`;
};

export default function BroadcastsPage() {
    const [logs, setLogs] = useState([]);
    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState(null);
    const [form, setForm] = useState({
        targetAudience: 'customers',
        customMessage: '',
        propertyId: '',
        location: '', budgetMin: '', budgetMax: '', leadStage: '',
    });

    useEffect(() => { loadLogs(); loadProperties(); }, []);

    const loadLogs = async () => {
        try {
            const res = await broadcastAPI.logs();
            setLogs(res.data.logs || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const loadProperties = async () => {
        try {
            const res = await propertiesAPI.list({ status: 'approved' });
            const allProps = Array.isArray(res.data) ? res.data : (res.data?.properties || []);
            setProperties(allProps);
        } catch (err) { console.error(err); }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        setSending(true);
        setResult(null);
        try {
            const payload = {
                targetAudience: form.targetAudience,
                customMessage: form.customMessage,
                propertyId: form.propertyId || undefined,
                filters: form.targetAudience === 'customers' ? {
                    location: form.location || undefined,
                    budgetMin: form.budgetMin ? parseInt(form.budgetMin) : undefined,
                    budgetMax: form.budgetMax ? parseInt(form.budgetMax) : undefined,
                    leadStage: form.leadStage || undefined,
                } : {},
            };
            const res = await broadcastAPI.send(payload);
            setResult(res.data);
            loadLogs();
        } catch (err) { console.error(err); setResult({ success: false, message: 'Broadcast failed' }); }
        finally { setSending(false); }
    };

    if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Broadcast System</h2>
                    <p>Send targeted messages to customers or agents</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>📢 New Broadcast</button>
            </div>

            <div className="data-table-wrapper">
                <div className="data-table-header"><h3>Broadcast History</h3></div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Template</th>
                            <th>Audience</th>
                            <th>Recipients</th>
                            <th>Delivered</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.length === 0 ? (
                            <tr><td colSpan="5"><div className="empty-state"><div className="empty-icon">📢</div><h3>No broadcasts sent yet</h3></div></td></tr>
                        ) : logs.map((log) => (
                            <tr key={log._id}>
                                <td><strong style={{ color: 'var(--text-primary)' }}>{log.templateName}</strong></td>
                                <td><span className="badge badge-info">{log.targetAudience || 'customers'}</span></td>
                                <td>{log.totalRecipients}</td>
                                <td><span className="badge badge-success">{log.deliveredCount}</span></td>
                                <td style={{ fontSize: '13px' }}>{new Date(log.sentAt).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>📢 New Broadcast</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSend}>
                            <div className="modal-body">

                                {/* Audience selector */}
                                <div className="form-group">
                                    <label className="form-label">📣 Send To</label>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        {['customers', 'agents'].map(a => (
                                            <button key={a} type="button"
                                                onClick={() => setForm({ ...form, targetAudience: a })}
                                                style={{
                                                    flex: 1, padding: '10px', border: `2px solid ${form.targetAudience === a ? 'var(--accent)' : 'var(--border-glass)'}`,
                                                    borderRadius: 10, background: form.targetAudience === a ? 'var(--accent-glow)' : 'var(--bg-input)',
                                                    color: 'var(--text-primary)', cursor: 'pointer', fontWeight: form.targetAudience === a ? 700 : 400, transition: 'all 0.2s'
                                                }}>
                                                {a === 'customers' ? '👥 All Customers' : '👨‍💼 All Active Agents'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Message</label>
                                    <textarea className="form-textarea" required placeholder="Type your broadcast message..."
                                        value={form.customMessage} onChange={(e) => setForm({ ...form, customMessage: e.target.value })} />
                                </div>

                                {/* Property attachment */}
                                <div className="form-group">
                                    <label className="form-label">🏠 Attach Property (optional)</label>
                                    <select className="form-select" value={form.propertyId}
                                        onChange={(e) => setForm({ ...form, propertyId: e.target.value })}>
                                        <option value="">— No property —</option>
                                        {properties.map(p => (
                                            <option key={p._id} value={p._id}>
                                                {p.title} — {p.location} ({formatCurrency(p.price)})
                                            </option>
                                        ))}
                                    </select>
                                    {form.propertyId && (
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                            ✅ Property details + shareable link will be appended to the message
                                        </div>
                                    )}
                                </div>

                                {/* Customer filters — only show when audience is customers */}
                                {form.targetAudience === 'customers' && (
                                    <>
                                        <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>🎯 Customer Filters</h4>
                                        <div className="grid-2">
                                            <div className="form-group">
                                                <label className="form-label">Location</label>
                                                <input type="text" className="form-input" placeholder="e.g. Bhopal"
                                                    value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Lead Stage</label>
                                                <select className="form-select" value={form.leadStage}
                                                    onChange={(e) => setForm({ ...form, leadStage: e.target.value })}>
                                                    <option value="">All Stages</option>
                                                    <option value="new">New</option>
                                                    <option value="contacted">Contacted</option>
                                                    <option value="site_visit">Site Visit</option>
                                                    <option value="negotiation">Negotiation</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Min Budget (₹)</label>
                                                <input type="number" className="form-input" value={form.budgetMin}
                                                    onChange={(e) => setForm({ ...form, budgetMin: e.target.value })} />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Max Budget (₹)</label>
                                                <input type="number" className="form-input" value={form.budgetMax}
                                                    onChange={(e) => setForm({ ...form, budgetMax: e.target.value })} />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {result && (
                                    <div style={{
                                        padding: '12px', borderRadius: '8px', marginTop: '12px',
                                        background: result.success ? 'var(--success-bg)' : 'var(--danger-bg)',
                                        color: result.success ? 'var(--success)' : 'var(--danger)'
                                    }}>
                                        {result.success
                                            ? `✅ Sent to ${result.totalRecipients} recipients (${result.delivered} delivered, ${result.failed} failed)`
                                            : `❌ ${result.message}`}
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={sending}>
                                    {sending ? 'Sending...' : '📢 Send Broadcast'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
