import * as Sentry from '@sentry/nextjs';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export async function sendBookingConfirmation({ email, customerName, service, servicePrice, bookingDate, bookingTime, address }) {
    if (!RESEND_API_KEY) {
        console.log('RESEND_API_KEY not set — skipping email confirmation');
        return { success: false, reason: 'not_configured' };
    }

    try {
        const { Resend } = await import('resend');
        const resend = new Resend(RESEND_API_KEY);

        const priceStr = servicePrice ? `$${servicePrice}` : 'TBD on arrival';

        await resend.emails.send({
            from: 'Mr. Cleaner <bookings@mrcleaner.app>',
            to: email,
            subject: `Booking Confirmed — ${service} on ${bookingDate}`,
            html: `
                <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                    <div style="background: #0a0a0a; padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
                        <span style="background: #c8a45c; color: #0a0a0a; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 0.85rem;">MC</span>
                        <h1 style="color: #fff; margin-top: 16px; font-size: 1.5rem;">Booking Confirmed</h1>
                    </div>
                    <div style="background: #111; padding: 32px; border-radius: 0 0 16px 16px;">
                        <p style="color: #ccc; line-height: 1.7;">Hi ${customerName},</p>
                        <p style="color: #ccc; line-height: 1.7;">Your appointment is locked in. Here's what you need to know:</p>
                        <table style="width: 100%; margin: 24px 0; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #888;">Service</td><td style="padding: 8px 0; color: #fff; text-align: right; font-weight: 600;">${service}</td></tr>
                            <tr><td style="padding: 8px 0; color: #888; border-top: 1px solid #222;">Date</td><td style="padding: 8px 0; color: #fff; text-align: right; border-top: 1px solid #222;">${bookingDate}</td></tr>
                            <tr><td style="padding: 8px 0; color: #888; border-top: 1px solid #222;">Time</td><td style="padding: 8px 0; color: #fff; text-align: right; border-top: 1px solid #222;">${bookingTime}</td></tr>
                            <tr><td style="padding: 8px 0; color: #888; border-top: 1px solid #222;">Price</td><td style="padding: 8px 0; color: #fff; text-align: right; border-top: 1px solid #222; font-weight: 700;">${priceStr}</td></tr>
                        </table>
                        ${address ? `<p style="color: #888; font-size: 0.9rem;">Location: ${address}</p>` : ''}
                        <p style="color: #888; font-size: 0.85rem; margin-top: 24px;">Deposit has been collected. Remaining balance is due on arrival.</p>
                    </div>
                </div>
            `,
        });

        console.log(`Booking confirmation sent to ${email}`);
        return { success: true };
    } catch (error) {
        console.error('Failed to send booking confirmation email:', error.message);
        Sentry.captureException(error, { tags: { module: 'email', method: 'sendBookingConfirmation' } });
        return { success: false, error: error.message };
    }
}
