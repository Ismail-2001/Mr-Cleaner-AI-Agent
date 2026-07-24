/**
 * GET /api/dashboard/analytics/export — CSV export of bookings data
 *
 * Downloads a CSV file of all bookings for the business owner
 * to share with accountant/bookkeeper.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
    if (!supabaseAdmin) {
        return Response.json({ error: 'Database not configured' }, { status: 503 });
    }

    try {
        const { data: bookings, error } = await supabaseAdmin
            .from('bookings')
            .select('customer_name, phone, service, service_price, vehicle_type, booking_date, booking_time, status, created_at')
            .order('booking_date', { ascending: false });

        if (error) {
            return Response.json({ error: error.message }, { status: 500 });
        }

        if (!bookings || bookings.length === 0) {
            return new Response('No bookings to export', { status: 200, headers: { 'Content-Type': 'text/csv' } });
        }

        // Build CSV
        const headers = ['Customer', 'Phone', 'Service', 'Price', 'Vehicle', 'Date', 'Time', 'Status', 'Created'];
        const rows = bookings.map(b => [
            `"${(b.customer_name || '').replace(/"/g, '""')}"`,
            b.phone || '',
            `"${(b.service || '').replace(/"/g, '""')}"`,
            b.service_price ?? '',
            b.vehicle_type || '',
            b.booking_date || '',
            b.booking_time || '',
            b.status || '',
            b.created_at ? new Date(b.created_at).toISOString() : '',
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        return new Response(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="bookings-export-${new Date().toISOString().split('T')[0]}.csv"`,
            },
        });
    } catch (error) {
        console.error('CSV export error:', error.message);
        return Response.json({ error: 'Export failed' }, { status: 500 });
    }
}
