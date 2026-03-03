'use client';

import { io } from 'socket.io-client';

// Use the same API URL for Socket.IO — works in both dev and production
const SOCKET_URL = typeof window !== 'undefined' && window.location.hostname.includes('trivastu.com')
    ? 'https://api.trivastu.com'
    : (process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000');

let socket = null;

export const getSocket = () => {
    if (!socket) {
        socket = io(SOCKET_URL, {
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });
    }
    return socket;
};

export const connectSocket = () => {
    const s = getSocket();
    if (!s.connected) s.connect();
    return s;
};

export const disconnectSocket = () => {
    if (socket?.connected) socket.disconnect();
};
