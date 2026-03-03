'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default function DashboardLayout({ children }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return <div className="loading-page"><div className="spinner"></div></div>;
    }

    if (!user) return null;

    return (
        <div className="app-layout">
            <Sidebar />
            <Header title="Trivastu Realty" />
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
