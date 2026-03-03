'use client';

import { useState, useEffect } from 'react';
import { agentsAPI } from '@/lib/api';

export default function AgentsPage() {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ phone: '', name: '', commissionPercent: 2 });

    useEffect(() => { loadAgents(); }, [filter]);

    const loadAgents = async () => {
        try {
            const params = filter ? { status: filter } : {};
            const res = await agentsAPI.list(params);
            setAgents(res.data.agents || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleStatusChange = async (id, status) => {
        try {
            await agentsAPI.updateStatus(id, status);
            loadAgents();
        } catch (err) { console.error(err); }
    };

    const handleAddAgent = async (e) => {
        e.preventDefault();
        try {
            await agentsAPI.create(form);
            setShowModal(false);
            setForm({ phone: '', name: '', commissionPercent: 2 });
            loadAgents();
        } catch (err) { console.error(err); }
    };

    const getStatusEmoji = (s) => ({ approved: '✅', pending: '⏳', rejected: '❌', suspended: '🚫' }[s] || '❓');

    if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Agent Management</h2>
                    <p>{agents.length} agents</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Agent</button>
            </div>

            <div className="tabs">
                <button className={`tab ${!filter ? 'active' : ''}`} onClick={() => setFilter('')}>All</button>
                {['pending', 'approved', 'suspended', 'rejected'].map(s => (
                    <button key={s} className={`tab ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
                        {getStatusEmoji(s)} {s}
                    </button>
                ))}
            </div>

            <div className="data-table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Agent</th>
                            <th>Phone</th>
                            <th>Experience</th>
                            <th>Commission %</th>
                            <th>Deals</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {agents.length === 0 ? (
                            <tr><td colSpan="7"><div className="empty-state"><div className="empty-icon">👥</div><h3>No agents found</h3></div></td></tr>
                        ) : agents.map((agent) => (
                            <tr key={agent._id}>
                                <td><strong style={{ color: 'var(--text-primary)' }}>{agent.name}</strong></td>
                                <td>{agent.phone}</td>
                                <td>{agent.experience || '-'}</td>
                                <td>{agent.commissionPercent}%</td>
                                <td>
                                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{agent.totalDeals || 0}</span>
                                </td>
                                <td>
                                    <span className={`badge ${agent.status === 'approved' ? 'badge-success' :
                                            agent.status === 'pending' ? 'badge-warning' :
                                                agent.status === 'suspended' ? 'badge-danger' : 'badge-default'
                                        }`}>
                                        {getStatusEmoji(agent.status)} {agent.status}
                                    </span>
                                </td>
                                <td style={{ display: 'flex', gap: '6px' }}>
                                    {agent.status === 'pending' && (
                                        <>
                                            <button className="btn btn-success btn-sm" onClick={() => handleStatusChange(agent._id, 'approved')}>Approve</button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleStatusChange(agent._id, 'rejected')}>Reject</button>
                                        </>
                                    )}
                                    {agent.status === 'approved' && (
                                        <button className="btn btn-outline btn-sm" onClick={() => handleStatusChange(agent._id, 'suspended')}>Suspend</button>
                                    )}
                                    {agent.status === 'suspended' && (
                                        <button className="btn btn-success btn-sm" onClick={() => handleStatusChange(agent._id, 'approved')}>Reactivate</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Add New Agent</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAddAgent}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Name</label>
                                    <input type="text" className="form-input" required
                                        value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">WhatsApp Phone (with +91)</label>
                                    <input type="text" className="form-input" required placeholder="+91XXXXXXXXXX"
                                        value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Commission %</label>
                                    <input type="number" className="form-input" min="0" max="100" step="0.5"
                                        value={form.commissionPercent} onChange={(e) => setForm({ ...form, commissionPercent: parseFloat(e.target.value) })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Add Agent</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
