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

    useEffect(() => { loadData(); }, [filter]);

    const loadData = async () => {
        try {
            const params = filter ? { status: filter } : {};
            const [leadsRes, agentsRes] = await Promise.all([
                leadsAPI.list(params),
                agentsAPI.list({ status: 'approved' }),
            ]);
            setLeads(leadsRes.data.leads || []);
            setAgents(agentsRes.data.agents || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
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
                                <td style={{ textTransform: 'capitalize' }}>{lead.propertyType || '-'}</td>
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
                                <td><span className={`badge ${getStatusBadge(lead.status)}`}>{lead.status.replace('_', ' ')}</span></td>
                                <td>
                                    <select className="form-select" style={{ width: '120px', padding: '4px 8px', fontSize: '12px' }}
                                        value={lead.status} onChange={(e) => handleStatusChange(lead, e.target.value)}>
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
        </div>
    );
}
