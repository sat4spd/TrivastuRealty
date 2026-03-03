'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const formatCurrency = (amt) => {
    if (!amt) return '₹0';
    if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(1)}Cr`;
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)}L`;
    return `₹${amt.toLocaleString('en-IN')}`;
};

export default function PublicPropertyPage({ params }) {
    const [property, setProperty] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeIdx, setActiveIdx] = useState(0);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch(`${API_URL}/api/properties/${params.id}/public`)
            .then(r => r.json())
            .then(d => { setProperty(d.property); setLoading(false); })
            .catch(() => { setError('Property not found'); setLoading(false); });
    }, [params.id]);

    if (loading) return (
        <div style={{ minHeight: '100vh', background: '#0a0a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#6366f1', fontSize: 18 }}>Loading property...</div>
        </div>
    );

    if (error || !property) return (
        <div style={{ minHeight: '100vh', background: '#0a0a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f1f1f7' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>🏠</div>
                <h2>Property not found</h2>
                <p style={{ color: '#9394b0' }}>This property may have been removed or made private.</p>
            </div>
        </div>
    );

    const allMedia = [
        ...(property.images || []).map(url => ({ url, type: 'image' })),
        ...(property.videos || []).map(url => ({ url, type: 'video' })),
    ];

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a1a', color: '#f1f1f7', fontFamily: 'Inter, sans-serif' }}>
            {/* Header */}
            <div style={{ background: 'rgba(22,22,50,0.9)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12, backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 10 }}>
                <div style={{ fontSize: 28 }}>🏠</div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>Trivastu Realty</div>
                    <div style={{ fontSize: 12, color: '#9394b0' }}>Property Details</div>
                </div>
                <a href="https://wa.me/918105180539" target="_blank" rel="noopener noreferrer"
                    style={{ marginLeft: 'auto', background: '#25d366', color: '#fff', padding: '8px 16px', borderRadius: 20, textDecoration: 'none', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    💬 WhatsApp Us
                </a>
            </div>

            <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>
                {/* Media gallery */}
                {allMedia.length > 0 && (
                    <div style={{ marginBottom: 32 }}>
                        <div style={{ borderRadius: 16, overflow: 'hidden', background: '#111128', marginBottom: 12, aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {allMedia[activeIdx].type === 'video' ? (
                                <video src={allMedia[activeIdx].url} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            ) : (
                                <img src={allMedia[activeIdx].url} alt={property.title}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )}
                        </div>
                        {allMedia.length > 1 && (
                            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
                                {allMedia.map((m, i) => (
                                    <div key={i} onClick={() => setActiveIdx(i)}
                                        style={{ flexShrink: 0, width: 80, height: 60, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: i === activeIdx ? '2px solid #6366f1' : '2px solid transparent', opacity: i === activeIdx ? 1 : 0.6, transition: 'all 0.2s' }}>
                                        {m.type === 'video' ? (
                                            <div style={{ width: '100%', height: '100%', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎬</div>
                                        ) : (
                                            <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Property Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <div style={{ gridColumn: '1/-1' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                                <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{property.title}</h1>
                                <p style={{ color: '#9394b0', fontSize: 15 }}>📍 {property.location}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 30, fontWeight: 800, color: '#22c55e' }}>{formatCurrency(property.price)}</div>
                                <div style={{ fontSize: 13, color: '#9394b0' }}>{property.area} {property.unit}</div>
                            </div>
                        </div>
                    </div>

                    {/* Details grid */}
                    {[
                        { label: 'Type', value: property.type?.charAt(0).toUpperCase() + property.type?.slice(1) },
                        property.bedrooms && { label: 'Bedrooms', value: `${property.bedrooms} BHK` },
                        { label: 'Available Area', value: `${property.availableArea} ${property.unit}` },
                        { label: 'Total Area', value: `${property.totalArea} ${property.unit}` },
                        property.projectName && { label: 'Project', value: property.projectName },
                        { label: 'Status', value: property.status },
                    ].filter(Boolean).map((item, i) => (
                        <div key={i} style={{ background: 'rgba(22,22,50,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px' }}>
                            <div style={{ fontSize: 12, color: '#5e5f7a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{item.label}</div>
                            <div style={{ fontSize: 17, fontWeight: 600 }}>{item.value}</div>
                        </div>
                    ))}

                    {property.description && (
                        <div style={{ gridColumn: '1/-1', background: 'rgba(22,22,50,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '20px 24px' }}>
                            <h3 style={{ marginBottom: 12, fontWeight: 700 }}>About this Property</h3>
                            <p style={{ color: '#9394b0', lineHeight: 1.7 }}>{property.description}</p>
                        </div>
                    )}
                </div>

                {/* CTA */}
                <div style={{ marginTop: 32, textAlign: 'center', padding: '32px', background: 'rgba(99,102,241,0.08)', borderRadius: 16, border: '1px solid rgba(99,102,241,0.2)' }}>
                    <h3 style={{ marginBottom: 8, fontSize: 20 }}>Interested in this property?</h3>
                    <p style={{ color: '#9394b0', marginBottom: 20 }}>Chat directly with our team on WhatsApp</p>
                    <a href={`https://wa.me/918105180539?text=Hi, I'm interested in the property: ${property.title} in ${property.location}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#25d366', color: '#fff', padding: '12px 28px', borderRadius: 24, textDecoration: 'none', fontWeight: 700, fontSize: 16 }}>
                        💬 Chat on WhatsApp
                    </a>
                </div>
            </div>
        </div>
    );
}
