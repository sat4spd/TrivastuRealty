'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import api from '@/lib/api';
import './chats.css';

export default function ChatsPage() {
    const [sessions, setSessions] = useState([]);
    const [activePhone, setActivePhone] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingChat, setLoadingChat] = useState(false);

    const messagesEndRef = useRef(null);

    // Fetch initial sessions
    useEffect(() => {
        fetchSessions();
        const socket = connectSocket();

        // Listen for real-time incoming or outgoing messages
        const handleNewChat = (msg) => {
            // Update sessions list
            setSessions(prev => {
                const existingIndex = prev.findIndex(s => s._id === msg.phone);
                let newSessions = [...prev];

                if (existingIndex >= 0) {
                    newSessions[existingIndex] = {
                        ...newSessions[existingIndex],
                        lastMessage: msg.content,
                        lastMessageTime: msg.timestamp,
                        messageCount: newSessions[existingIndex].messageCount + 1,
                        role: msg.role
                    };
                } else {
                    newSessions.push({
                        _id: msg.phone,
                        lastMessage: msg.content,
                        lastMessageTime: msg.timestamp,
                        role: msg.role,
                        messageCount: 1
                    });
                }

                // Sort by latest
                return newSessions.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
            });

            // Update active chat if it matches
            setActivePhone(currentActive => {
                if (currentActive === msg.phone) {
                    setMessages(prevMsgs => [...prevMsgs, msg]);
                }
                return currentActive;
            });
        };

        socket.on('new_chat_message', handleNewChat);

        return () => {
            socket.off('new_chat_message', handleNewChat);
        };
    }, []);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchSessions = async () => {
        try {
            const res = await api.get('/chats/sessions');
            setSessions(res.data);
            setLoading(false);
        } catch (error) {
            console.error('Failed to load chat sessions:', error);
            setLoading(false);
        }
    };

    const loadChat = async (phone) => {
        setActivePhone(phone);
        setLoadingChat(true);
        try {
            const res = await api.get(`/chats/${phone}`);
            setMessages(res.data);
        } catch (error) {
            console.error('Failed to load chat history:', error);
        } finally {
            setLoadingChat(false);
        }
    };

    const getRoleBadge = (role) => {
        const badges = {
            admin: 'badge-purple',
            customer: 'badge-info',
            approved_agent: 'badge-success',
            pending_agent: 'badge-warning',
            new_user: 'badge-default'
        };
        const colors = badges[role] || 'badge-default';
        return <span className={`badge ${colors}`}>{role.replace('_', ' ')}</span>;
    };

    return (
        <div className="dashboard-content">
            <Header title="Live Chats Monitor" />

            <main className="content-area chats-layout">
                {/* Sidebar Sessions */}
                <div className="card sessions-card">
                    <div className="sessions-header">
                        <h3>Active Conversations</h3>
                        <span className="badge badge-info">{sessions.length}</span>
                    </div>

                    <div className="sessions-list">
                        {loading ? (
                            <div className="loading-spinner"></div>
                        ) : sessions.length === 0 ? (
                            <div className="no-data">No active chats</div>
                        ) : (
                            sessions.map(s => (
                                <div
                                    key={s._id}
                                    className={`session-item ${activePhone === s._id ? 'active' : ''}`}
                                    onClick={() => loadChat(s._id)}
                                >
                                    <div className="session-top">
                                        <div className="session-phone">+{s._id}</div>
                                        <div className="session-time">
                                            {new Date(s.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    <div className="session-bottom">
                                        <div className="session-msg">{s.lastMessage || '[Media]'}</div>
                                        {getRoleBadge(s.role)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Chat Window */}
                <div className="card chat-window-card">
                    {!activePhone ? (
                        <div className="empty-chat">
                            <div className="empty-icon">💬</div>
                            <h3>Select a conversation to view</h3>
                            <p>Watch interactions happen in real time</p>
                        </div>
                    ) : (
                        <>
                            <div className="chat-header">
                                <div className="chat-contact-info">
                                    <div className="avatar">A</div>
                                    <div>
                                        <h2>+{activePhone}</h2>
                                        <span className="subtitle">Real-time WhatsApp Thread</span>
                                    </div>
                                </div>
                            </div>

                            <div className="chat-messages">
                                {loadingChat ? (
                                    <div className="loading-spinner"></div>
                                ) : (
                                    <>
                                        {messages.map((msg, i) => (
                                            <div key={msg._id || i} className={`message-bubble-wrapper ${msg.direction}`}>
                                                <div className={`message-bubble ${msg.direction}`}>
                                                    {msg.messageType === 'text' && <div className="msg-text">{msg.content}</div>}
                                                    {msg.messageType === 'interactive' && <div className="msg-interactive">🔘 {msg.content}</div>}
                                                    {msg.messageType === 'audio' && <div className="msg-audio">🎤 <i>{msg.content}</i></div>}
                                                    {['image', 'video', 'document'].includes(msg.messageType) && (
                                                        <div className="msg-media">
                                                            <div className="media-icon">📎</div>
                                                            <div>{msg.content}</div>
                                                        </div>
                                                    )}
                                                    <div className="msg-meta">
                                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        {msg.direction === 'outgoing' && <span className="tick">✓✓</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </>
                                )}
                            </div>

                            <div className="chat-footer">
                                <p className="read-only-notice">
                                    <span className="icon">👁️</span>
                                    This is a live monitor view. The AI or Agent is currently handling this chat.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
