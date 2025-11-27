import { spawn } from 'child_process';

/**
 * Parses the SVN list output to extract project information.
 * @param {string} output - The raw output from `svn list -R`.
 * @param {string} baseUrl - The base URL of the SVN repository.
 * @returns {Array<{name: string, url: string, path: string}>}
 */
export function parseSvnOutput(output, baseUrl) {
    const lines = output.split(/\r?\n/);
    const projects = [];

    for (const line of lines) {
        // Filter for lines ending in 'pom.xml' (case-insensitive)
        if (/pom\.xml$/i.test(line.trim())) {
            // Strip '/pom.xml' or just 'pom.xml' (case-insensitive)
            const path = line.replace(/\/pom\.xml$/i, '').replace(/pom\.xml$/i, '');

            // Extract Project Name (last directory)
            // Example: APV/branch/DBINS/Hiware-Apv-UI-DbIns -> Hiware-Apv-UI-DbIns
            const parts = path.split('/');
            const name = parts[parts.length - 1];

            // Construct Full URL
            // Ensure baseUrl doesn't have trailing slash if path has leading slash, or handle join
            const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            const url = `${cleanBaseUrl}/${path}`;

            if (name && path) {
                projects.push({ name, url, path });
            }
        }
    }

    return projects;
}

/**
 * Executes `svn list -R` on the given URL.
 * @param {string} url 
 * @param {function(string): void} [onData] - Callback for stdout/stderr data
 * @returns {{ promise: Promise<string>, child: import('child_process').ChildProcess }}
 */
export function svnListRecursive(url, onData) {
    const svn = spawn('svn', ['list', '-R', '--non-interactive', '--trust-server-cert', url]);
    let stdout = '';
    let stderr = '';

    if (onData) {
        svn.stdout.on('data', (data) => onData(data.toString()));
        svn.stderr.on('data', (data) => onData(data.toString()));
    }

    const promise = new Promise((resolve, reject) => {
        svn.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        svn.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        svn.on('close', (code) => {
            if (code === null) {
                reject(new Error('SVN command cancelled'));
            } else if (code !== 0) {
                reject(new Error(`SVN command failed with code ${code}: ${stderr}`));
            } else {
                resolve(stdout);
            }
        });

        svn.on('error', (err) => {
            reject(err);
        });
    });

    return { promise, child: svn };
}
