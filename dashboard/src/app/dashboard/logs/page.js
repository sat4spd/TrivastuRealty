'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import './logs.css';

export default function LogsPage() {
    const [logs, setLogs] = useState([]);
    const [isPaused, setIsPaused] = useState(false);
    const [filterLevel, setFilterLevel] = useState('ALL');
    const logsEndRef = useRef(null);

    useEffect(() => {
        const socket = connectSocket();

        const handleLog = (logData) => {
            if (isPaused) return;
            setLogs(prev => {
                // Prepend newest log to top, keep last 100
                const newLogs = [logData, ...prev];
                return newLogs.slice(0, 100);
            });
        };

        socket.on('system_log', handleLog);

        return () => {
            socket.off('system_log', handleLog);
            disconnectSocket();
        };
    }, [isPaused]);

    useEffect(() => {
        // Scroll to top when new log arrives (newest is at top)
        if (!isPaused && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, []); // only on mount, don't auto-scroll since newest is at top

    const clearLogs = () => setLogs([]);

    const filteredLogs = filterLevel === 'ALL'
        ? logs
        : logs.filter(log => log.level.includes(filterLevel));

    const getLevelClass = (level) => {
        if (level.includes('ERROR')) return 'log-error';
        if (level.includes('WARN')) return 'log-warn';
        if (level.includes('DEBUG')) return 'log-debug';
        return 'log-info';
    };

    return (
        <div className="dashboard-content">
            <Header title="System Logs & Health" />

            <main className="content-area">
                <div className="card">
                    <div className="logs-header">
                        <h2>Real-time Backend Logs</h2>
                        <div className="logs-controls">
                            <select
                                value={filterLevel}
                                onChange={(e) => setFilterLevel(e.target.value)}
                                className="form-select"
                            >
                                <option value="ALL">All Levels</option>
                                <option value="INFO">Info</option>
                                <option value="WARN">Warnings</option>
                                <option value="ERROR">Errors</option>
                                <option value="DEBUG">Debug</option>
                            </select>
                            <button
                                className={`btn ${isPaused ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setIsPaused(!isPaused)}
                            >
                                {isPaused ? '▶️ Resume' : '⏸️ Pause'}
                            </button>
                            <button className="btn btn-danger" onClick={clearLogs}>
                                🗑️ Clear
                            </button>
                        </div>
                    </div>

                    <div className="logs-container">
                        {filteredLogs.length === 0 ? (
                            <div className="no-logs">Waiting for system logs...</div>
                        ) : (
                            <div className="terminal-window">
                                {filteredLogs.map((log, index) => (
                                    <div key={index} className={`log-entry ${getLevelClass(log.level)}`}>
                                        <span className="log-time">
                                            [{new Date(log.timestamp).toLocaleTimeString()}]
                                        </span>
                                        <span className={`log-badge badge-${getLevelClass(log.level)}`}>
                                            {log.level}
                                        </span>
                                        <span className="log-message">{log.message}</span>
                                    </div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
