import { NextResponse } from 'next/server';
import { syncProjects } from '@/lib/sync';

export async function POST() {
    // Trigger sync in background
    // We don't await this to avoid timeout
    syncProjects().catch(err => console.error('Background sync failed:', err));

    return NextResponse.json({ message: 'Sync started' });
}
