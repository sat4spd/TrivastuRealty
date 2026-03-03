'use client';

import { useState, useEffect } from 'react';
import { analyticsAPI, leadsAPI, agentsAPI } from '@/lib/api';

const formatCurrency = (amt) => {
    if (!amt) return '₹0';
    if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(1)}Cr`;
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)}L`;
    return `₹${amt.toLocaleString('en-IN')}`;
};

export default function DashboardPage() {
    const [stats, setStats] = useState(null);
    const [recentLeads, setRecentLeads] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [statsRes, leadsRes] = await Promise.all([
                analyticsAPI.overview(),
                leadsAPI.list({ limit: 5 }),
            ]);
            setStats(statsRes.data);
            setRecentLeads(leadsRes.data.leads || []);
        } catch (err) {
            console.error('Dashboard load error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

    const s = stats || { leads: {}, agents: {}, properties: {}, customers: {}, revenue: {} };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Dashboard</h2>
                    <p>Welcome back! Here&apos;s what&apos;s happening today.</p>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card" style={{ '--stat-color': 'var(--accent)' }}>
                    <div className="stat-header">
                        <span className="stat-label">Total Leads</span>
                        <div className="stat-icon" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>🎯</div>
                    </div>
                    <div className="stat-value">{s.leads.total || 0}</div>
                    <div className="stat-change">{s.leads.new || 0} new</div>
                </div>

                <div className="stat-card" style={{ '--stat-color': 'var(--success)' }}>
                    <div className="stat-header">
                        <span className="stat-label">Conversion Rate</span>
                        <div className="stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>📈</div>
                    </div>
                    <div className="stat-value">{s.leads.conversionRate || 0}%</div>
                    <div className="stat-change">{s.leads.booked || 0} booked</div>
                </div>

                <div className="stat-card" style={{ '--stat-color': 'var(--purple)' }}>
                    <div className="stat-header">
                        <span className="stat-label">Active Agents</span>
                        <div className="stat-icon" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}>👥</div>
                    </div>
                    <div className="stat-value">{s.agents.active || 0}</div>
                    <div className="stat-change">{s.agents.pending || 0} pending</div>
                </div>

                <div className="stat-card" style={{ '--stat-color': 'var(--cyan)' }}>
                    <div className="stat-header">
                        <span className="stat-label">Properties</span>
                        <div className="stat-icon" style={{ background: 'var(--cyan-bg)', color: 'var(--cyan)' }}>🏠</div>
                    </div>
                    <div className="stat-value">{s.properties.approved || 0}</div>
                    <div className="stat-change">{s.properties.pending || 0} pending review</div>
                </div>

                <div className="stat-card" style={{ '--stat-color': 'var(--warning)' }}>
                    <div className="stat-header">
                        <span className="stat-label">High-Value Leads</span>
                        <div className="stat-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>💎</div>
                    </div>
                    <div className="stat-value">{s.leads.highValue || 0}</div>
                    <div className="stat-change">Budget &gt; ₹50L</div>
                </div>

                <div className="stat-card" style={{ '--stat-color': 'var(--success)' }}>
                    <div className="stat-header">
                        <span className="stat-label">Revenue</span>
                        <div className="stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>💰</div>
                    </div>
                    <div className="stat-value">{formatCurrency(s.revenue.total)}</div>
                    <div className="stat-change">Commission: {formatCurrency(s.revenue.commission)}</div>
                </div>
            </div>

            <div className="grid-2">
                <div className="data-table-wrapper">
                    <div className="data-table-header">
                        <h3>Recent Leads</h3>
                    </div>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Budget</th>
                                <th>Location</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentLeads.length === 0 ? (
                                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px' }}>No leads yet</td></tr>
                            ) : recentLeads.map((lead) => (
                                <tr key={lead._id}>
                                    <td>
                                        <strong style={{ color: 'var(--text-primary)' }}>{lead.customerId?.name || 'Unknown'}</strong>
                                        <br /><span style={{ fontSize: '12px' }}>{lead.customerId?.phone}</span>
                                    </td>
                                    <td>{formatCurrency(lead.budget)}</td>
                                    <td>{lead.location || '-'}</td>
                                    <td>
                                        <span className={`badge ${getStatusBadge(lead.status)}`}>
                                            {lead.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="card">
                    <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 700 }}>Lead Pipeline</h3>
                    {['new', 'contacted', 'site_visit', 'negotiation', 'booked'].map((stage) => (
                        <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', width: '90px', textTransform: 'capitalize' }}>
                                {stage.replace('_', ' ')}
                            </span>
                            <div style={{ flex: 1, height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${s.leads.total ? Math.max((s.leads[stage] || 0) / s.leads.total * 100, 3) : 0}%`,
                                    height: '100%',
                                    background: `linear-gradient(90deg, var(--accent), var(--purple))`,
                                    borderRadius: '4px',
                                    transition: 'width 0.5s ease',
                                }}></div>
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: 600, width: '30px', textAlign: 'right' }}>
                                {s.leads[stage] || 0}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function getStatusBadge(status) {
    const map = {
        new: 'badge-info', contacted: 'badge-purple', site_visit: 'badge-warning',
        negotiation: 'badge-warning', booked: 'badge-success', closed: 'badge-success',
        lost: 'badge-danger',
    };
    return map[status] || 'badge-default';
}
