import db from './db';
import { svnListRecursive, parseSvnOutput } from './svn';

const SVN_URL = 'https://192.168.0.134:8443/svn/hiware/v6';
let isSyncing = false;

export function getSyncStatus() {
    const stmt = db.prepare('SELECT value FROM metadata WHERE key = ?');
    const result = stmt.get('last_sync_timestamp');
    return {
        isSyncing,
        lastSync: result ? result.value : null,
    };
}

export async function syncProjects() {
    if (isSyncing) {
        console.log('Sync already in progress.');
        return { success: false, message: 'Already syncing' };
    }

    isSyncing = true;
    console.log('Starting SVN sync...');

    try {
        // 1. Fetch from SVN
        const rawOutput = await svnListRecursive(SVN_URL);

        // 2. Parse
        const projects = parseSvnOutput(rawOutput, SVN_URL);
        console.log(`Found ${projects.length} projects.`);

        // 3. Update DB (Transaction)
        const insert = db.prepare('INSERT INTO projects (name, url, path) VALUES (@name, @url, @path)');
        const clear = db.prepare('DELETE FROM projects'); // Full refresh strategy for simplicity, or we can do upsert/diff
        // User asked for "DB에 없는 결과가 있을 수 있음을 알리는..." but also "DB나 캐시에 정리".
        // A full replace is safest to remove deleted projects, but might cause a split second of empty results if not in transaction.
        // SQLite transactions are atomic.

        const transaction = db.transaction((projects) => {
            clear.run();
            for (const project of projects) {
                insert.run(project);
            }

            // Update timestamp
            const now = new Date().toISOString().replace('T', ' ').split('.')[0]; // Simple format
            db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)').run('last_sync_timestamp', now);
        });

        transaction(projects);
        console.log('Sync completed successfully.');
        return { success: true, count: projects.length };

    } catch (error) {
        console.error('Sync failed:', error);
        return { success: false, error: error.message };
    } finally {
        isSyncing = false;
    }
}
