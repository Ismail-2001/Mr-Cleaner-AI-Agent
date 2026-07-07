/** @type {import('next').NextConfig} */
const nextConfig = {
    headers: async () => [
        {
            source: '/(.*)',
            headers: [
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                {
                    key: 'Content-Security-Policy',
                    value: [
                        "default-src 'self'",
                        "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
                        "style-src 'self' 'unsafe-inline'",
                        "img-src 'self' data: blob:",
                        "font-src 'self'",
                        "connect-src 'self' https://euuwlluercgopstyyllf.supabase.co https://generativelanguage.googleapis.com wss://euuwlluercgopstyyllf.supabase.co",
                        "frame-ancestors 'none'",
                    ].join('; '),
                },
            ],
        },
    ],
};

export default nextConfig;
