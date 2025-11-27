import { NextResponse } from 'next/server';
import { syncProjects, cancelSync } from '@/lib/sync';

export async function POST() {
    // Trigger sync in background
    // We don't await this to avoid timeout
    syncProjects().catch(err => console.error('Background sync failed:', err));

    return NextResponse.json({ message: 'Sync started' });
}

export async function DELETE() {
    const success = cancelSync();
    if (success) {
        return NextResponse.json({ message: 'Sync cancelled' });
    } else {
        return NextResponse.json({ message: 'No active sync to cancel' }, { status: 400 });
    }
}
