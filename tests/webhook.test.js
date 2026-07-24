import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockConstructEvent = vi.fn();

// Mock stripe — never hit real API
vi.mock('@/lib/stripe', () => ({
    stripe: {
        webhooks: {
            constructEvent: (...args) => mockConstructEvent(...args),
        },
    },
}));

// Mock supabase-admin
const mockFrom = vi.fn();
vi.mock('@/lib/supabase-admin', () => ({
    supabaseAdmin: {
        from: (...args) => mockFrom(...args),
    },
}));

// Mock twilio
vi.mock('@/lib/twilio', () => ({
    triggerLeadAlerts: vi.fn(),
}));

import { POST } from '@/app/api/stripe/webhook/route';

// Helper: creates a chainable Supabase query mock with optional final values
function makeChain(opts = {}) {
    const chain = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.maybeSingle = vi.fn().mockResolvedValue(opts.maybeSingle || { data: null, error: null });
    chain.insert = vi.fn().mockResolvedValue(opts.insert || { data: null, error: null });
    chain.update = vi.fn(() => chain);
    return chain;
}

function mockRequest(body, stripeSignature) {
    const headers = new Headers();
    if (stripeSignature) {
        headers.set('stripe-signature', stripeSignature);
    }
    headers.set('Content-Type', 'application/json');
    return new Request('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
}

describe('Stripe webhook — revenue integrity', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses real price from chat session, not deposit_amount * 4', async () => {
        // Mock Stripe event verification
        mockConstructEvent.mockReturnValue({
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'cs_test_abc123',
                    metadata: {
                        session_id: 'session_001',
                        service: 'Signature Ceramic',
                        customer_name: 'John Doe',
                        phone: '+1 (507) 479-7804',
                        booking_date: '2026-07-20',
                        booking_time: '10:00 AM',
                        deposit_amount: '50',
                    },
                },
            },
        });

        // Chain 1: idempotency check — bookings.find(stripe_session_id).limit(1).maybeSingle() → null
        const bookingCheck = makeChain({ maybeSingle: { data: null, error: null } });

        // Chain 2: chat_sessions.find(session_id).maybeSingle() → has customer_data.price=450
        const sessionWithPrice = makeChain({
            maybeSingle: { data: { customer_data: { price: 450, vehicle_type: 'SUV' } }, error: null },
        });

        // Chain 3: chat_sessions.update() — needs its own chain for .update().eq()
        const sessionUpdate = makeChain();

        // Chain 4: bookings.insert() — need to capture the insert arguments
        const bookingInsert = makeChain({ insert: { data: null, error: null } });

        const chains = [bookingCheck, sessionWithPrice, sessionUpdate, bookingInsert];
        let idx = 0;
        mockFrom.mockImplementation(() => chains[idx++]);

        const response = await POST(mockRequest({}, 'test_sig'));
        expect(response.status).toBe(200);

        // Verify idempotency check used stripe_session_id (not notes)
        const idempotencyEqCalls = bookingCheck.eq.mock.calls;
        const hasStripeSessionIdCheck = idempotencyEqCalls.some(
            ([field, value]) => field === 'stripe_session_id' && value === 'cs_test_abc123'
        );
        expect(hasStripeSessionIdCheck).toBe(true);

        // Verify booking insert used real price (450), not 50*4=200
        const insertCall = bookingInsert.insert.mock.calls[0][0];
        expect(insertCall).toBeDefined();
        expect(insertCall[0].service_price).toBe(450);
        expect(insertCall[0].service_price).not.toBe(200);
        expect(insertCall[0].notes).toContain('Deposit paid via Stripe');
        expect(insertCall[0].stripe_session_id).toBe('cs_test_abc123');
    });

    it('sets service_price to null and logs warning when price is missing', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        mockConstructEvent.mockReturnValue({
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'cs_test_def456',
                    metadata: {
                        session_id: 'session_002',
                        service: 'Executive Preservation',
                        customer_name: 'Jane Smith',
                        phone: '',
                        booking_date: '2026-07-21',
                        booking_time: '2:00 PM',
                        deposit_amount: '50',
                    },
                },
            },
        });

        // Chat session exists but NO price field
        const bookingCheck = makeChain({ maybeSingle: { data: null, error: null } });
        const sessionNoPrice = makeChain({
            maybeSingle: { data: { customer_data: { vehicle_type: 'sedan' } }, error: null },
        });
        const sessionUpdate = makeChain();
        const bookingInsert = makeChain({ insert: { data: null, error: null } });

        const chains = [bookingCheck, sessionNoPrice, sessionUpdate, bookingInsert];
        let idx = 0;
        mockFrom.mockImplementation(() => chains[idx++]);

        const response = await POST(mockRequest({}, 'test_sig'));
        expect(response.status).toBe(200);

        // Verify booking was created with null service_price
        const insertCall = bookingInsert.insert.mock.calls[0][0];
        expect(insertCall).toBeDefined();
        expect(insertCall[0].service_price).toBeNull();
        expect(insertCall[0].notes).toContain('price missing');

        // Verify warning was logged
        expect(warnSpy).toHaveBeenCalled();
        const warningArg = warnSpy.mock.calls[0][0];
        expect(warningArg).toContain('MISSING_REAL_PRICE');

        warnSpy.mockRestore();
    });

    it('returns 400 when stripe-signature header is missing', async () => {
        const response = await POST(mockRequest({}, null));
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('MISSING_SIGNATURE');
    });

    it('returns duplicate=true when booking with same stripe_session_id exists', async () => {
        mockConstructEvent.mockReturnValue({
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'cs_test_duplicate',
                    metadata: {
                        session_id: 'session_dup',
                        service: 'Executive Preservation',
                        customer_name: 'Duplicate User',
                        booking_date: '2026-08-01',
                        deposit_amount: '50',
                    },
                },
            },
        });

        // Idempotency check returns an existing booking
        const bookingCheck = makeChain({
            maybeSingle: { data: { id: 'existing_booking_123' }, error: null },
        });

        const chains = [bookingCheck];
        let idx = 0;
        mockFrom.mockImplementation(() => chains[idx++]);

        const response = await POST(mockRequest({}, 'test_sig'));
        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body.duplicate).toBe(true);

        // Verify the idempotency check used stripe_session_id
        const eqCalls = bookingCheck.eq.mock.calls;
        const hasStripeSessionIdCheck = eqCalls.some(
            ([field, value]) => field === 'stripe_session_id' && value === 'cs_test_duplicate'
        );
        expect(hasStripeSessionIdCheck).toBe(true);
    });
});
