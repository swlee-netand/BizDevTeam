import db from './db';
import { svnListRecursive, parseSvnOutput } from './svn';

const SVN_URL = 'https://192.168.0.134:8443/svn/hiware/v6';

// State
let isSyncing = false;
let currentProcess = null;
let startTime = null;
let logs = [];
const MAX_LOGS = 100;

function addLog(message) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    logs.push(`[${timestamp}] ${message}`);
    if (logs.length > MAX_LOGS) logs.shift();
}

export function getSyncStatus() {
    const stmt = db.prepare('SELECT value FROM metadata WHERE key = ?');
    const lastSync = stmt.get('last_sync_timestamp')?.value;
    const lastDuration = stmt.get('last_sync_duration_ms')?.value;

    return {
        isSyncing,
        lastSync,
        startTime,
        logs,
        estimatedDuration: lastDuration ? parseInt(lastDuration, 10) : 60000, // Default 60s
    };
}

export function cancelSync() {
    if (isSyncing && currentProcess) {
        addLog('Cancelling sync...');
        currentProcess.kill();
        isSyncing = false;
        currentProcess = null;
        return true;
    }
    return false;
}

export async function syncProjects() {
    if (isSyncing) {
        return { success: false, message: 'Already syncing' };
    }

    isSyncing = true;
    startTime = Date.now();
    logs = [];
    addLog('Starting SVN sync...');

    try {
        // 1. Fetch from SVN
        const commandStr = `svn list -R --non-interactive --trust-server-cert ${SVN_URL}`;
        addLog(`Executing: ${commandStr}`);

        const { promise, child } = svnListRecursive(SVN_URL, (data) => {
            // Optional: Log every line? Might be too noisy. 
            // Let's just log chunks or progress dots if needed.
            // For now, maybe just log that we received data.
            // addLog(`Received data chunk...`); 
        });
        currentProcess = child;

        const rawOutput = await promise;
        currentProcess = null; // Process finished

        // 2. Parse
        addLog('Parsing SVN output...');
        const projects = parseSvnOutput(rawOutput, SVN_URL);
        addLog(`Found ${projects.length} projects.`);

        // 3. Update DB (Transaction)
        addLog('Updating database...');
        const insertOrReplace = db.prepare(`
            INSERT OR REPLACE INTO projects (name, url, path) 
            VALUES (@name, @url, @path)
        `);
        const deleteMissing = db.prepare(`
            DELETE FROM projects 
            WHERE url NOT IN (SELECT value FROM json_each(?))
        `);

        const transaction = db.transaction((projects) => {
            // 1. Upsert all found projects
            for (const project of projects) {
                insertOrReplace.run(project);
            }

            // 2. Delete projects that are no longer in SVN
            const currentUrls = JSON.stringify(projects.map(p => p.url));
            deleteMissing.run(currentUrls);

            // Update timestamp & duration
            const now = new Date().toISOString().replace('T', ' ').split('.')[0];
            const duration = Date.now() - startTime;

            db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)').run('last_sync_timestamp', now);
            db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)').run('last_sync_duration_ms', duration);
        });

        transaction(projects);
        addLog('Sync completed successfully.');
        return { success: true, count: projects.length };

    } catch (error) {
        if (error.message === 'SVN command cancelled') {
            addLog('Sync cancelled by user.');
            return { success: false, message: 'Cancelled' };
        }
        console.error('Sync failed:', error);
        addLog(`Error: ${error.message}`);
        return { success: false, error: error.message };
    } finally {
        isSyncing = false;
        currentProcess = null;
        startTime = null;
    }
}
