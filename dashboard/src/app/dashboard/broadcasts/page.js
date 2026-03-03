'use client';

import { useState, useEffect } from 'react';
import { broadcastAPI } from '@/lib/api';

const formatCurrency = (amt) => {
    if (!amt) return '₹0';
    if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(1)}Cr`;
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)}L`;
    return `₹${amt.toLocaleString('en-IN')}`;
};

export default function BroadcastsPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState(null);
    const [form, setForm] = useState({
        templateName: 'custom', customMessage: '', location: '', budgetMin: '', budgetMax: '', leadStage: '',
    });

    useEffect(() => { loadLogs(); }, []);

    const loadLogs = async () => {
        try {
            const res = await broadcastAPI.logs();
            setLogs(res.data.logs || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        setSending(true);
        setResult(null);
        try {
            const payload = {
                templateName: form.templateName,
                customMessage: form.customMessage,
                filters: {
                    location: form.location || undefined,
                    budgetMin: form.budgetMin ? parseInt(form.budgetMin) : undefined,
                    budgetMax: form.budgetMax ? parseInt(form.budgetMax) : undefined,
                    leadStage: form.leadStage || undefined,
                },
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
                    <p>Send targeted messages to customers</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>📢 New Broadcast</button>
            </div>

            <div className="data-table-wrapper">
                <div className="data-table-header"><h3>Broadcast History</h3></div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Template</th>
                            <th>Recipients</th>
                            <th>Delivered</th>
                            <th>Read</th>
                            <th>Responses</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.length === 0 ? (
                            <tr><td colSpan="6"><div className="empty-state"><div className="empty-icon">📢</div><h3>No broadcasts sent yet</h3></div></td></tr>
                        ) : logs.map((log) => (
                            <tr key={log._id}>
                                <td><strong style={{ color: 'var(--text-primary)' }}>{log.templateName}</strong></td>
                                <td>{log.totalRecipients}</td>
                                <td><span className="badge badge-success">{log.deliveredCount}</span></td>
                                <td>{log.readCount}</td>
                                <td>{log.responseCount}</td>
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
                                <div className="form-group">
                                    <label className="form-label">Message</label>
                                    <textarea className="form-textarea" required placeholder="Type your broadcast message..."
                                        value={form.customMessage} onChange={(e) => setForm({ ...form, customMessage: e.target.value })} />
                                </div>
                                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>🎯 Audience Filters</h4>
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

                                {result && (
                                    <div style={{
                                        padding: '12px', borderRadius: '8px', marginTop: '12px',
                                        background: result.success ? 'var(--success-bg)' : 'var(--danger-bg)',
                                        color: result.success ? 'var(--success)' : 'var(--danger)'
                                    }}>
                                        {result.success
                                            ? `✅ Sent to ${result.totalRecipients} recipients (${result.delivered} delivered)`
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
