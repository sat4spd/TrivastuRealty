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
            { href: '/dashboard/properties', icon: '🏠', label: 'Properties' },
        ]
    },
    {
        section: 'Engagement', items: [
            { href: '/dashboard/chats', icon: '💬', label: 'Live Chats' },
            { href: '/dashboard/broadcasts', icon: '📢', label: 'Broadcasts' },
            { href: '/dashboard/groups', icon: '👨‍👩‍👧‍👦', label: 'Groups' },
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

    return (
        <>
            {/* Hamburger button — visible on small screens */}
            <button
                className="sidebar-hamburger"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
            >
                ☰
            </button>

            {/* Backdrop overlay for mobile */}
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
                    {/* Close button inside sidebar for mobile */}
                    <button
                        className="sidebar-close"
                        onClick={() => setOpen(false)}
                        aria-label="Close menu"
                    >
                        ✕
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((section) => (
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
                    ))}
                </nav>
            </aside>
        </>
    );
}
