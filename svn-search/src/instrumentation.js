export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const cron = await import('node-cron');
        const { syncProjects } = await import('@/lib/sync');

        // Schedule sync every hour
        cron.schedule('0 * * * *', () => {
            console.log('Running scheduled SVN sync...');
            syncProjects().catch(err => console.error('Scheduled sync failed:', err));
        });

        console.log('Scheduler initialized.');
    }
}
