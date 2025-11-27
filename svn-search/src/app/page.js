'use client';

import { useState, useEffect, useCallback } from 'react';

export default function Home() {
    const [query, setQuery] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [syncStatus, setSyncStatus] = useState({ isSyncing: false, lastSync: null });

    const [showMonitor, setShowMonitor] = useState(false);
    const [progress, setProgress] = useState(0);
    const [remainingTime, setRemainingTime] = useState(null);

    // Fetch Sync Status
    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            setSyncStatus(data);

            if (data.isSyncing && data.startTime) {
                const elapsed = Date.now() - data.startTime;
                const estimated = data.estimatedDuration || 60000;
                const prog = Math.min((elapsed / estimated) * 100, 99); // Cap at 99% until done
                setProgress(prog);

                const remaining = Math.max(0, Math.ceil((estimated - elapsed) / 1000));
                setRemainingTime(remaining);
            } else {
                setProgress(0);
                setRemainingTime(null);
            }
        } catch (error) {
            console.error('Failed to fetch status:', error);
        }
    }, []);

    // Poll status every 1 second for smoother progress
    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 1000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    // Search Logic
    useEffect(() => {
        const search = async () => {
            if (!query) {
                setResults([]);
                return;
            }

            setLoading(true);
            try {
                const res = await fetch(`/api/search?query=${encodeURIComponent(query)}&caseSensitive=${caseSensitive}`);
                const data = await res.json();
                setResults(data);
            } catch (error) {
                console.error('Search failed:', error);
            } finally {
                setLoading(false);
            }
        };

        // Debounce
        const timeoutId = setTimeout(search, 300);
        return () => clearTimeout(timeoutId);
    }, [query, caseSensitive]);

    // Sync Handler
    const handleSync = async () => {
        try {
            setSyncStatus(prev => ({ ...prev, isSyncing: true }));
            await fetch('/api/sync', { method: 'POST' });
        } catch (error) {
            console.error('Sync trigger failed:', error);
        }
    };

    // Cancel Handler
    const handleCancel = async () => {
        if (!confirm('Are you sure you want to cancel the sync?')) return;
        try {
            await fetch('/api/sync', { method: 'DELETE' });
        } catch (error) {
            console.error('Cancel failed:', error);
        }
    };

    return (
        <div className="container">
            <header className="header">
                <h1 className="title">SVN Project Search</h1>
                <div className="status-bar">
                    <span>Last Updated: {syncStatus.lastSync || 'Never'}</span>

                    <div className="button-group">
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowMonitor(!showMonitor)}
                        >
                            {showMonitor ? 'Hide Monitor' : 'Monitor'}
                        </button>

                        {syncStatus.isSyncing ? (
                            <button
                                className="btn btn-danger"
                                onClick={handleCancel}
                            >
                                Cancel Sync
                            </button>
                        ) : (
                            <button
                                className="btn btn-primary"
                                onClick={handleSync}
                            >
                                Sync Now
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Progress & Monitor Section */}
            {(syncStatus.isSyncing || showMonitor) && (
                <div className="monitor-section">
                    {syncStatus.isSyncing && (
                        <div className="progress-container">
                            <div className="progress-info">
                                <span>Syncing...</span>
                                <span>Est. Remaining: {remainingTime !== null ? `${remainingTime}s` : 'Calculating...'}</span>
                            </div>
                            <div className="progress-bar-bg">
                                <div
                                    className="progress-bar-fill"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {showMonitor && (
                        <div className="logs-container">
                            <h3>Sync Logs</h3>
                            <div className="logs-window">
                                {syncStatus.logs && syncStatus.logs.length > 0 ? (
                                    syncStatus.logs.map((log, i) => <div key={i} className="log-line">{log}</div>)
                                ) : (
                                    <div className="log-line text-muted">No logs available.</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <main className="card">
                <div className="search-controls">
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search projects (e.g., appm)..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={caseSensitive}
                            onChange={(e) => setCaseSensitive(e.target.checked)}
                        />
                        Case Sensitive
                    </label>
                </div>

                {loading && <div className="loading">Searching...</div>}

                {!loading && results.length > 0 && (
                    <ul className="results-list">
                        {results.map((project) => (
                            <li key={project.id} className="result-item">
                                <div className="project-name">{project.name}</div>
                                <div className="project-url">{project.url}</div>
                            </li>
                        ))}
                    </ul>
                )}

                {!loading && query && results.length === 0 && (
                    <div className="loading">No projects found.</div>
                )}
            </main>
        </div>
    );
}
