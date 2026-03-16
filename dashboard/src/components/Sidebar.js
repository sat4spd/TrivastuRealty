'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
    {
        section: 'Overview', items: [
            { href: '/dashboard', icon: '📊', label: 'Dashboard' },
        ]
    },
    {
        section: 'Management', items: [
            { href: '/dashboard/leads', icon: '🎯', label: 'Leads' },
            { href: '/dashboard/agents', icon: '👥', label: 'Agents' },
        ]
    },
    {
        section: '🌐 Update Website',
        collapsible: true,
        groups: [
            {
                label: '🌐 Brand (trivastu.com)',
                items: [
                    { href: '/dashboard/cms/brand/projects', icon: '🏗️', label: 'Projects Showcase' },
                ]
            },
            {
                label: '🏠 Realty (realty.trivastu.com)',
                items: [
                    { href: '/dashboard/cms/realty/projects', icon: '🏗️', label: 'Construction Projects' },
                    { href: '/dashboard/cms/realty/contractors', icon: '👷', label: 'Contractors / Team' },
                    { href: '/dashboard/cms/realty/services', icon: '🔧', label: 'Services & Packages' },
                ]
            },
            {
                label: '🌳 Plots (plot.trivastu.com)',
                items: [
                    { href: '/dashboard/cms/plots/listings', icon: '🏠', label: 'Plot Listings' },
                ]
            },
            {
                label: '⚙️ Common (All Sites)',
                items: [
                    { href: '/dashboard/cms/common/testimonials', icon: '⭐', label: 'Testimonials & Reviews' },
                    { href: '/dashboard/cms/common/business-info', icon: '📞', label: 'Business Info' },
                ]
            },
        ]
    },
    {
        section: 'Engagement', items: [
            { href: '/dashboard/chats', icon: '💬', label: 'Live Chats' },
            { href: '/dashboard/groups', icon: '👨‍👩‍👧‍👦', label: 'Groups' },
            { href: '/dashboard/marketing-campaigns', icon: '📢', label: 'Marketing Campaigns' },
        ]
    },
    {
        section: 'Insights', items: [
            { href: '/dashboard/analytics', icon: '📈', label: 'Analytics' },
            { href: '/dashboard/logs', icon: '💻', label: 'System Logs' },
        ]
    },
];

export default function Sidebar() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [expandedSections, setExpandedSections] = useState({ '🌐 Update Website': true });

    const toggleSection = (section) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const isGroupActive = (section) => {
        if (!section.groups) return false;
        return section.groups.some(g => g.items.some(i => pathname.startsWith(i.href)));
    };

    return (
        <>
            <button
                className="sidebar-hamburger"
                onClick={() => setOpen(o => !o)}
                aria-label={open ? 'Close menu' : 'Open menu'}
            >
                {open ? '✕' : '☰'}
            </button>

            {open && (
                <div className="sidebar-backdrop" onClick={() => setOpen(false)} />
            )}

            <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
                <div className="sidebar-logo">
                    <div className="logo-icon">🏠</div>
                    <div>
                        <h1>Trivastu Realty</h1>
                        <span className="subtitle">Admin Panel</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((section) => {
                        // Collapsible section with sub-groups
                        if (section.collapsible && section.groups) {
                            const isExpanded = expandedSections[section.section] || isGroupActive(section);
                            return (
                                <div key={section.section} className="nav-section">
                                    <div
                                        className={`nav-section-title nav-section-toggle ${isExpanded ? 'expanded' : ''}`}
                                        onClick={() => toggleSection(section.section)}
                                        style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                    >
                                        <span>{section.section}</span>
                                        <span style={{ fontSize: '10px', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                                    </div>
                                    {isExpanded && section.groups.map((group) => (
                                        <div key={group.label} className="nav-subgroup">
                                            <div className="nav-subgroup-title">{group.label}</div>
                                            {group.items.map((item) => (
                                                <Link key={item.href} href={item.href}
                                                    className={`nav-link nav-link-nested ${pathname === item.href ? 'active' : ''}`}
                                                    onClick={() => setOpen(false)}
                                                >
                                                    <span className="icon">{item.icon}</span>
                                                    {item.label}
                                                </Link>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            );
                        }

                        // Normal flat section
                        return (
                            <div key={section.section} className="nav-section">
                                <div className="nav-section-title">{section.section}</div>
                                {section.items.map((item) => (
                                    <Link key={item.href} href={item.href}
                                        className={`nav-link ${pathname === item.href ? 'active' : ''}`}
                                        onClick={() => setOpen(false)}
                                    >
                                        <span className="icon">{item.icon}</span>
                                        {item.label}
                                    </Link>
                                ))}
                            </div>
                        );
                    })}
                </nav>
            </aside>
        </>
    );
}
