import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const caseSensitive = searchParams.get('caseSensitive') === 'true';

    if (!query) {
        return NextResponse.json([]);
    }

    try {
        let sql = 'SELECT * FROM projects WHERE ';
        const params = [];

        if (caseSensitive) {
            // SQLite GLOB is case sensitive, LIKE is case insensitive by default for ASCII
            // But better-sqlite3/sqlite default LIKE is case-insensitive.
            // For case sensitive, we can use GLOB or INSTR.
            // Or we can use `name LIKE ?` and rely on pragma, but GLOB is standard for case-sensitive in SQLite usually, but it uses wildcards differently (* instead of %).
            // Let's use INSTR for exact substring match, or just LIKE.
            // Actually, SQLite `LIKE` is case-insensitive for ASCII characters.
            // To force case-sensitive, we can use `GLOB` which is case-sensitive.
            // GLOB '*pattern*'
            sql += "name GLOB ?";
            params.push(`*${query}*`);
        } else {
            sql += "name LIKE ?";
            params.push(`%${query}%`);
        }

        // Also search in path? User said "appm 문자열이 들어가있는 프로젝트". Usually implies name or path.
        // User example output shows paths.
        // Let's search in both name and path for better UX, or just name as per "Project Name".
        // "appm 문자열이 들어가있는 프로젝트를 찾고싶을때" -> likely name or path.
        // Let's stick to name for now as per "Project Name" extraction logic, but maybe OR path.
        // The user example `Select-String -Pattern '(?i)appm'` runs on the full path output of svn list.
        // So we should search in `path` or `url` or `name`.
        // Let's search in `name` OR `path`.

        // Refined SQL:
        if (caseSensitive) {
            sql = "SELECT * FROM projects WHERE name GLOB ? OR path GLOB ?";
            params.push(`*${query}*`, `*${query}*`);
        } else {
            sql = "SELECT * FROM projects WHERE name LIKE ? OR path LIKE ?";
            params.push(`%${query}%`, `%${query}%`);
        }

        const stmt = db.prepare(sql);
        const results = stmt.all(...params);

        return NextResponse.json(results);
    } catch (error) {
        console.error('Search error:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
