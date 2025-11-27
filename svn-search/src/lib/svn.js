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
        // Filter for lines ending in 'pom.xml' (case-insensitive check if needed, but usually lowercase)
        // User example: Select-String -Pattern '/pom\.xml$'
        if (line.trim().endsWith('pom.xml')) {
            // Strip '/pom.xml' or just 'pom.xml' if it's at root (though unlikely for -R)
            const path = line.replace(/\/pom\.xml$/, '').replace(/pom\.xml$/, '');

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
 * @returns {Promise<string>} Raw output
 */
export function svnListRecursive(url) {
    return new Promise((resolve, reject) => {
        const svn = spawn('svn', ['list', '-R', url]);
        let stdout = '';
        let stderr = '';

        svn.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        svn.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        svn.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`SVN command failed with code ${code}: ${stderr}`));
            } else {
                resolve(stdout);
            }
        });

        svn.on('error', (err) => {
            reject(err);
        });
    });
}
