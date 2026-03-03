'use client';

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

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="logo-icon">🏠</div>
                <div>
                    <h1>Trivastu Realty</h1>
                    <span className="subtitle">Admin Panel</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((section) => (
                    <div key={section.section} className="nav-section">
                        <div className="nav-section-title">{section.section}</div>
                        {section.items.map((item) => (
                            <Link key={item.href} href={item.href}
                                className={`nav-link ${pathname === item.href ? 'active' : ''}`}>
                                <span className="icon">{item.icon}</span>
                                {item.label}
                            </Link>
                        ))}
                    </div>
                ))}
            </nav>
        </aside>
    );
}
