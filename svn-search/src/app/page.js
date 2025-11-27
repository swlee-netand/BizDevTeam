'use client';

import { useState, useEffect, useCallback } from 'react';

export default function Home() {
    const [query, setQuery] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [syncStatus, setSyncStatus] = useState({ isSyncing: false, lastSync: null });

    // Fetch Sync Status
    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            setSyncStatus(data);
        } catch (error) {
            console.error('Failed to fetch status:', error);
        }
    }, []);

    // Poll status every 5 seconds
    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
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
            setSyncStatus(prev => ({ ...prev, isSyncing: true })); // Optimistic update
            await fetch('/api/sync', { method: 'POST' });
            // Status polling will catch the actual state
        } catch (error) {
            console.error('Sync trigger failed:', error);
        }
    };

    return (
        <div className="container">
            <header className="header">
                <h1 className="title">SVN Project Search</h1>
                <div className="status-bar">
                    <span>Last Updated: {syncStatus.lastSync || 'Never'}</span>
                    <button
                        className="btn btn-primary"
                        onClick={handleSync}
                        disabled={syncStatus.isSyncing}
                    >
                        {syncStatus.isSyncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                </div>
            </header>

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
