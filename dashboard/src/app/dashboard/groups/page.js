'use client';

import { useState, useEffect } from 'react';
import { groupsAPI } from '@/lib/api';

const formatCurrency = (amt) => {
    if (!amt) return '₹0';
    if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(1)}Cr`;
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)}L`;
    return `₹${amt.toLocaleString('en-IN')}`;
};

export default function GroupsPage() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadGroups(); }, []);

    const loadGroups = async () => {
        try {
            const res = await groupsAPI.list();
            setGroups(res.data || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const getStatusBadge = (s) => (
        { forming: 'badge-warning', complete: 'badge-success', expired: 'badge-danger', cancelled: 'badge-default' }[s] || 'badge-default'
    );

    if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Group Buying</h2>
                    <p>4 Friends Model — Group discount management</p>
                </div>
            </div>

            {groups.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-icon">👨‍👩‍👧‍👦</div>
                        <h3>No groups created yet</h3>
                        <p>Groups are created when customers initiate group buying via WhatsApp</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                    {groups.map((group) => (
                        <div key={group._id} className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>🔗 {group.groupId}</h3>
                                <span className={`badge ${getStatusBadge(group.status)}`}>{group.status}</span>
                            </div>

                            {group.propertyId && (
                                <div style={{ padding: '12px', background: 'var(--bg-glass)', borderRadius: '8px', marginBottom: '16px' }}>
                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Property</div>
                                    <div style={{ fontWeight: 600 }}>{group.propertyId.title}</div>
                                    <div style={{ color: 'var(--success)', fontWeight: 600 }}>{formatCurrency(group.propertyId.price)}</div>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Members</span>
                                    <div style={{ fontWeight: 700, fontSize: '20px' }}>
                                        {group.members?.length || 0}/{group.requiredMembers}
                                    </div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Discount</span>
                                    <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--success)' }}>
                                        {group.discountPercent}%
                                    </div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Bonus</span>
                                    <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--warning)' }}>
                                        {group.commissionBonus}%
                                    </div>
                                </div>
                            </div>

                            <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Members:</div>
                                {(group.members || []).map((m, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '13px' }}>
                                        <span>👤</span>
                                        <span style={{ color: 'var(--text-primary)' }}>{m.name || 'Unknown'}</span>
                                        <span style={{ color: 'var(--text-muted)' }}>{m.phone}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
