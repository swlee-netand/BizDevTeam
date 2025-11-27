import { NextResponse } from 'next/server';
import { getSyncStatus } from '@/lib/sync';

export async function GET() {
    const status = getSyncStatus();
    return NextResponse.json(status);
}
