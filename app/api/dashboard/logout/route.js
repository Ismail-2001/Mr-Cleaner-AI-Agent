import { COOKIE_NAME } from '@/lib/session';

/**
 * POST /api/dashboard/logout — Clears the session cookie.
 */
export async function POST() {
    const requestId = crypto.randomUUID();
    console.log(`[${requestId}] Dashboard logout`);

    const isProduction = process.env.NODE_ENV === 'production';
    return Response.json(
        { success: true },
        {
            status: 200,
            headers: {
                'Set-Cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`,
            },
        }
    );
}
