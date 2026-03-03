'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { connectSocket, disconnectSocket } from '@/lib/socket';

export default function Header({ title }) {
    const { user, logout } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [showNotif, setShowNotif] = useState(false);

    useEffect(() => {
        const socket = connectSocket();

        socket.on('admin_notification', (data) => {
            setNotifications(prev => [data, ...prev].slice(0, 20));
            // Auto-hide popup after 5 seconds
            setShowNotif(true);
            setTimeout(() => setShowNotif(false), 5000);
        });

        return () => {
            socket.off('admin_notification');
        };
    }, []);

    return (
        <>
            <header className="header">
                <h1 className="header-title">{title}</h1>
                <div className="header-actions">
                    <div className="notification-bell" onClick={() => setShowNotif(!showNotif)}>
                        🔔
                        {notifications.length > 0 && (
                            <span className="badge">{notifications.length > 9 ? '9+' : notifications.length}</span>
                        )}
                    </div>
                    <div className="user-avatar" onClick={logout} title="Logout">
                        {user?.name?.[0]?.toUpperCase() || 'A'}
                    </div>
                </div>
            </header>

            {showNotif && notifications.length > 0 && (
                <div className="notification-popup">
                    <div className="notif-title">
                        {notifications[0].type?.replace(/_/g, ' ').toUpperCase()}
                    </div>
                    <div className="notif-message">
                        {notifications[0].message?.substring(0, 200)}
                    </div>
                </div>
            )}
        </>
    );
}
