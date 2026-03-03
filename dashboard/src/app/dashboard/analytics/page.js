'use client';

import { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { analyticsAPI } from '@/lib/api';

Chart.register(...registerables);

const formatCurrency = (amt) => {
    if (!amt) return '₹0';
    if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(1)}Cr`;
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)}L`;
    return `₹${amt.toLocaleString('en-IN')}`;
};

export default function AnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState(null);
    const [leadData, setLeadData] = useState(null);
    const [agentData, setAgentData] = useState([]);
    const [propertyData, setPropertyData] = useState(null);

    const funnelRef = useRef(null);
    const sourceRef = useRef(null);
    const trendRef = useRef(null);
    const propertyTypeRef = useRef(null);
    const chartsRef = useRef([]);

    useEffect(() => {
        loadData();
        return () => { chartsRef.current.forEach(c => c?.destroy()); };
    }, []);

    const loadData = async () => {
        try {
            const [ov, ld, ag, pr] = await Promise.all([
                analyticsAPI.overview(),
                analyticsAPI.leads(),
                analyticsAPI.agents(),
                analyticsAPI.properties(),
            ]);
            setOverview(ov.data);
            setLeadData(ld.data);
            setAgentData(ag.data || []);
            setPropertyData(pr.data);
            setLoading(false);

            setTimeout(() => renderCharts(ov.data, ld.data, pr.data), 100);
        } catch (err) { console.error(err); setLoading(false); }
    };

    const renderCharts = (ov, ld, pr) => {
        chartsRef.current.forEach(c => c?.destroy());
        chartsRef.current = [];

        const chartColors = {
            accent: '#6366f1', purple: '#a855f7', cyan: '#06b6d4',
            success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
        };

        // Lead Funnel
        if (funnelRef.current && ov) {
            const ctx = funnelRef.current.getContext('2d');
            const chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['New', 'Contacted', 'Site Visit', 'Negotiation', 'Booked', 'Closed', 'Lost'],
                    datasets: [{
                        data: [ov.leads.new, ov.leads.contacted, ov.leads.siteVisit, ov.leads.negotiation, ov.leads.booked, ov.leads.closed, ov.leads.lost],
                        backgroundColor: [chartColors.accent, chartColors.purple, chartColors.cyan, chartColors.warning, chartColors.success, '#10b981', chartColors.danger],
                        borderRadius: 6,
                        borderSkipped: false,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#9394b0', font: { size: 11 } } },
                        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9394b0' } },
                    },
                },
            });
            chartsRef.current.push(chart);
        }

        // Lead Sources
        if (sourceRef.current && ld?.bySource?.length) {
            const ctx = sourceRef.current.getContext('2d');
            const chart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ld.bySource.map(s => s._id || 'Unknown'),
                    datasets: [{
                        data: ld.bySource.map(s => s.count),
                        backgroundColor: [chartColors.accent, chartColors.purple, chartColors.cyan, chartColors.warning],
                        borderWidth: 0,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { color: '#9394b0', padding: 16 } } },
                    cutout: '65%',
                },
            });
            chartsRef.current.push(chart);
        }

        // Lead Trend
        if (trendRef.current && ld?.byMonth?.length) {
            const ctx = trendRef.current.getContext('2d');
            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ld.byMonth.map(m => m._id),
                    datasets: [{
                        label: 'Leads',
                        data: ld.byMonth.map(m => m.count),
                        borderColor: chartColors.accent,
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: chartColors.accent,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#9394b0' } },
                        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9394b0' } },
                    },
                },
            });
            chartsRef.current.push(chart);
        }

        // Property Types
        if (propertyTypeRef.current && pr?.byType?.length) {
            const ctx = propertyTypeRef.current.getContext('2d');
            const chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: pr.byType.map(t => t._id),
                    datasets: [
                        {
                            label: 'Count',
                            data: pr.byType.map(t => t.count),
                            backgroundColor: chartColors.cyan,
                            borderRadius: 6,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: '#9394b0' } } },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#9394b0' } },
                        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9394b0' } },
                    },
                },
            });
            chartsRef.current.push(chart);
        }
    };

    if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Analytics</h2>
                    <p>Business intelligence and performance metrics</p>
                </div>
            </div>

            <div className="grid-2" style={{ marginBottom: '24px' }}>
                <div className="chart-container">
                    <h3>Lead Funnel</h3>
                    <div style={{ height: '280px' }}><canvas ref={funnelRef}></canvas></div>
                </div>
                <div className="chart-container">
                    <h3>Lead Sources</h3>
                    <div style={{ height: '280px' }}><canvas ref={sourceRef}></canvas></div>
                </div>
            </div>

            <div className="grid-2" style={{ marginBottom: '24px' }}>
                <div className="chart-container">
                    <h3>Lead Trend (Monthly)</h3>
                    <div style={{ height: '280px' }}><canvas ref={trendRef}></canvas></div>
                </div>
                <div className="chart-container">
                    <h3>Property Distribution</h3>
                    <div style={{ height: '280px' }}><canvas ref={propertyTypeRef}></canvas></div>
                </div>
            </div>

            <div className="data-table-wrapper">
                <div className="data-table-header"><h3>🏆 Agent Performance Ranking</h3></div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Agent</th>
                            <th>Deals</th>
                            <th>Active Leads</th>
                            <th>Closed Leads</th>
                            <th>Commission</th>
                        </tr>
                    </thead>
                    <tbody>
                        {agentData.length === 0 ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No agent data</td></tr>
                        ) : agentData.map((agent, i) => (
                            <tr key={agent._id}>
                                <td>
                                    <span style={{ fontWeight: 700, fontSize: '16px' }}>
                                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                    </span>
                                </td>
                                <td><strong style={{ color: 'var(--text-primary)' }}>{agent.name}</strong></td>
                                <td style={{ fontWeight: 700 }}>{agent.totalDeals || 0}</td>
                                <td><span className="badge badge-info">{agent.activeLeads || 0}</span></td>
                                <td><span className="badge badge-success">{agent.closedLeads || 0}</span></td>
                                <td style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(agent.totalCommission)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
