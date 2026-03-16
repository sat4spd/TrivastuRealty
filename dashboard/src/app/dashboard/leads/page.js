'use client';

import { useState, useEffect } from 'react';
import { leadsAPI, agentsAPI } from '@/lib/api';

const formatCurrency = (amt) => {
    if (!amt) return '₹0';
    if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(1)}Cr`;
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)}L`;
    return `₹${amt.toLocaleString('en-IN')}`;
};

const STATUS_OPTIONS = ['new', 'contacted', 'site_visit', 'negotiation', 'booked', 'closed', 'lost'];

export default function LeadsPage() {
    const [leads, setLeads] = useState([]);
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [selectedLead, setSelectedLead] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [closingLead, setClosingLead] = useState(null);
    const [closingForm, setClosingForm] = useState({ soldArea: '', saleAmount: '', targetStatus: '' });
    const [waModal, setWaModal] = useState(false);
    const [waForm, setWaForm] = useState({ phone: '', note: '' });
    const [waSending, setWaSending] = useState(false);
    const [waResult, setWaResult] = useState(null); // { ok, msg }

    useEffect(() => { loadData(); }, [filter]);

    const loadData = async () => {
        try {
            const params = filter ? { status: filter } : {};
            const [leadsRes, agentsRes] = await Promise.all([
                leadsAPI.list(params),
                agentsAPI.list({ status: 'approved' }),
            ]);
            const leadsData = Array.isArray(leadsRes.data) ? leadsRes.data : (leadsRes.data?.leads || []);
            const agentsData = Array.isArray(agentsRes.data) ? agentsRes.data : (agentsRes.data?.agents || []);
            setLeads(leadsData);
            setAgents(agentsData);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const downloadCSV = () => {
        const headers = ['Date', 'Name', 'Phone', 'Budget (₹)', 'Location', 'Type', 'Status', 'Agent', 'Source', 'AI Score'];
        const rows = leads.map(l => [
            new Date(l.createdAt || Date.now()).toLocaleDateString('en-IN'),
            l.customerId?.name || 'Unknown',
            l.customerId?.phone || '-',
            l.budget || 0,
            l.location || '-',
            l.propertyType || '-',
            l.status || 'new',
            l.agentId?.name || 'Unassigned',
            l.source || 'whatsapp',
            l.aiScore || '-',
        ]);
        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trivastu-leads-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const updateStatus = async (leadId, status, data = {}) => {
        try {
            await leadsAPI.updateStatus(leadId, status, data);
            loadData();
        } catch (err) { console.error(err); }
    };

    const handleStatusChange = (lead, newStatus) => {
        if (newStatus === 'booked' || newStatus === 'closed') {
            setClosingLead(lead);
            setClosingForm({
                soldArea: lead.propertyId?.area || '',
                saleAmount: lead.propertyId?.price || '',
                targetStatus: newStatus
            });
        } else {
            updateStatus(lead._id, newStatus);
        }
    };

    const assignAgent = async (leadId, agentId) => {
        try {
            await leadsAPI.assign(leadId, agentId);
            loadData();
        } catch (err) { console.error(err); }
    };

    const handleWhatsAppInitiate = async (e) => {
        e.preventDefault();
        setWaSending(true);
        setWaResult(null);
        try {
            await leadsAPI.initiateWhatsApp(waForm.phone, waForm.note);
            setWaResult({ ok: true, msg: `✅ WhatsApp greeting sent to ${waForm.phone}! They'll receive a welcome message shortly.` });
            setWaForm({ phone: '', note: '' });
            setTimeout(() => { setWaModal(false); setWaResult(null); loadData(); }, 2500);
        } catch (err) {
            setWaResult({ ok: false, msg: `❌ ${err.response?.data?.error || err.message}` });
        } finally { setWaSending(false); }
    };

    const getStatusBadge = (status) => {
        const map = { new: 'badge-info', contacted: 'badge-purple', site_visit: 'badge-warning', negotiation: 'badge-warning', booked: 'badge-success', closed: 'badge-success', lost: 'badge-danger' };
        return map[status] || 'badge-default';
    };

    if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Lead Management</h2>
                    <p>{leads.length} total leads</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-outline" onClick={downloadCSV} disabled={leads.length === 0}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ⬇️ Download CSV
                    </button>
                    <button className="btn btn-primary" onClick={() => { setWaModal(true); setWaResult(null); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#25D366', borderColor: '#25D366' }}>
                        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'white' }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        Add Lead via WhatsApp
                    </button>
                </div>
            </div>

            <div className="tabs">
                <button className={`tab ${!filter ? 'active' : ''}`} onClick={() => setFilter('')}>All</button>
                {STATUS_OPTIONS.map(s => (
                    <button key={s} className={`tab ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
                        {s.replace('_', ' ')}
                    </button>
                ))}
            </div>

            <div className="data-table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Budget</th>
                            <th>Location</th>
                            <th>Type</th>
                            <th>Agent</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leads.length === 0 ? (
                            <tr><td colSpan="7"><div className="empty-state"><div className="empty-icon">📭</div><h3>No leads found</h3></div></td></tr>
                        ) : leads.map((lead) => (
                            <tr key={lead._id}>
                                <td>
                                    <strong style={{ color: 'var(--text-primary)' }}>{lead.customerId?.name || 'Unknown'}</strong>
                                    <br /><span style={{ fontSize: '12px' }}>{lead.customerId?.phone}</span>
                                    {lead.isHighValue && <span style={{ marginLeft: '6px' }}>💎</span>}
                                </td>
                                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(lead.budget)}</td>
                                <td>{lead.location || '-'}</td>
                                <td style={{ textTransform: 'capitalize' }}>{(lead.propertyType || '').replace('_', ' ') || '-'}</td>
                                <td>
                                    {lead.agentId ? (
                                        <span className="badge badge-purple">{lead.agentId.name}</span>
                                    ) : (
                                        <select className="form-select" style={{ width: '130px', padding: '4px 8px', fontSize: '12px' }}
                                            onChange={(e) => e.target.value && assignAgent(lead._id, e.target.value)} defaultValue="">
                                            <option value="">Assign Agent</option>
                                            {agents.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                                        </select>
                                    )}
                                </td>
                                <td><span className={`badge ${getStatusBadge(lead.status || 'new')}`}>{(lead.status || 'new').replace('_', ' ')}</span></td>
                                <td>
                                    <select className="form-select" style={{ width: '120px', padding: '4px 8px', fontSize: '12px' }}
                                        value={lead.status || 'new'} onChange={(e) => handleStatusChange(lead, e.target.value)}>
                                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {closingLead && (
                <div className="modal-overlay" onClick={() => setClosingLead(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Close Deal - {closingLead.customerId?.name}</h3>
                            <button className="modal-close" onClick={() => setClosingLead(null)}>✕</button>
                        </div>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            await updateStatus(closingLead._id, closingForm.targetStatus, {
                                soldArea: closingForm.soldArea,
                                saleAmount: closingForm.saleAmount
                            });
                            setClosingLead(null);
                        }}>
                            <div className="modal-body">
                                <p style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>
                                    Confirm the actual sold area and final sale price. This will deduct the inventory from the property and calculate the agent's commission based on the property rate.
                                </p>
                                <div className="form-group">
                                    <label className="form-label">Sold Area ({closingLead.propertyId?.unit || 'sqft'})</label>
                                    <input type="number" step="0.01" className="form-input" required
                                        value={closingForm.soldArea} onChange={e => setClosingForm({ ...closingForm, soldArea: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Final Sale Amount (₹)</label>
                                    <input type="number" className="form-input" required
                                        value={closingForm.saleAmount} onChange={e => setClosingForm({ ...closingForm, saleAmount: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setClosingLead(null)}>Cancel</button>
                                <button type="submit" className="btn btn-success">Confirm & Close</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {waModal && (
                <div className="modal-overlay" onClick={() => setWaModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                        <div className="modal-header" style={{ borderBottom: '2px solid #25D366' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: '#25D366' }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                Add Lead via WhatsApp
                            </h3>
                            <button className="modal-close" onClick={() => setWaModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleWhatsAppInitiate}>
                            <div className="modal-body">
                                <p style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                    Enter the customer's WhatsApp number. ARIA will immediately send them a welcome greeting and start the onboarding conversation to capture their requirements. A new lead will be created automatically once they respond.
                                </p>
                                <div className="form-group">
                                    <label className="form-label">Customer WhatsApp Number *</label>
                                    <input type="tel" className="form-input" required placeholder="e.g. 9876543210 or +919876543210"
                                        value={waForm.phone} onChange={e => setWaForm({ ...waForm, phone: e.target.value })} />
                                    <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Country code optional — defaults to India (+91)</small>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Personal Note (optional)</label>
                                    <textarea className="form-textarea" rows={2}
                                        placeholder="e.g. Referred by Ramesh Ji. Interested in Nagari plots."
                                        value={waForm.note} onChange={e => setWaForm({ ...waForm, note: e.target.value })} />
                                    <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>This will be sent as a follow-up message after the greeting.</small>
                                </div>

                                {waResult && (
                                    <div style={{
                                        padding: '12px 16px', borderRadius: '8px', fontSize: '13px',
                                        background: waResult.ok ? 'rgba(37,211,102,0.1)' : 'rgba(239,68,68,0.1)',
                                        color: waResult.ok ? '#25D366' : 'var(--danger)',
                                        border: `1px solid ${waResult.ok ? '#25D366' : 'var(--danger)'}`,
                                    }}>
                                        {waResult.msg}
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setWaModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={waSending}
                                    style={{ background: '#25D366', borderColor: '#25D366' }}>
                                    {waSending ? 'Sending...' : '📲 Send WhatsApp Greeting'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
