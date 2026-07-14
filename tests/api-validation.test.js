import { describe, it, expect } from 'vitest';
import { z } from 'zod';

function validateBody(schema, body) {
    const result = schema.safeParse(body);
    if (result.success) {
        return { success: true, data: result.data };
    }
    const issues = result.error.issues || result.error.errors || [];
    const message = issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    return { success: false, message };
}

const ChatRequestSchema = z.object({
    messages: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system', 'tool']),
        content: z.string().max(10000, 'Message too long'),
    })).min(1, 'At least one message required').max(50, 'Too many messages'),
});

const BookingRequestSchema = z.object({
    customer_name: z.string().min(1).max(200).optional(),
    phone: z.string().max(20).optional(),
    vehicle_type: z.string().max(50).optional(),
    service: z.string().max(100).optional(),
    service_price: z.number().positive().max(10000).optional(),
    booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    booking_time: z.string().max(20).optional(),
    address: z.string().max(500).optional(),
    zip_code: z.string().max(10).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    time: z.string().max(20).optional(),
    price: z.number().positive().max(10000).optional(),
    status: z.enum(['inquiring', 'qualified', 'confirmed', 'pending']).optional(),
}).refine(
    data => data.booking_date || data.date,
    { message: 'Either booking_date or date is required' }
);

const AuthRequestSchema = z.object({
    password: z.string().min(1, 'Password is required').max(500),
});

describe('Chat Request Validation', () => {
    it('accepts valid chat request', () => {
        const result = validateBody(ChatRequestSchema, {
            messages: [{ role: 'user', content: 'Hello' }],
        });
        expect(result.success).toBe(true);
    });

    it('rejects empty messages', () => {
        const result = validateBody(ChatRequestSchema, { messages: [] });
        expect(result.success).toBe(false);
        expect(result.message).toContain('At least one message required');
    });

    it('rejects too many messages', () => {
        const messages = Array.from({ length: 51 }, (_, i) => ({
            role: 'user', content: `msg${i}`,
        }));
        const result = validateBody(ChatRequestSchema, { messages });
        expect(result.success).toBe(false);
        expect(result.message).toContain('Too many messages');
    });

    it('rejects invalid role', () => {
        const result = validateBody(ChatRequestSchema, {
            messages: [{ role: 'admin', content: 'Hello' }],
        });
        expect(result.success).toBe(false);
        expect(result.message).toContain('role');
    });

    it('rejects oversized content', () => {
        const result = validateBody(ChatRequestSchema, {
            messages: [{ role: 'user', content: 'x'.repeat(10001) }],
        });
        expect(result.success).toBe(false);
        expect(result.message).toContain('Message too long');
    });

    it('accepts all valid roles', () => {
        for (const role of ['user', 'assistant', 'system', 'tool']) {
            const result = validateBody(ChatRequestSchema, {
                messages: [{ role, content: 'test' }],
            });
            expect(result.success).toBe(true);
        }
    });
});

describe('Booking Request Validation', () => {
    it('accepts valid booking with booking_date', () => {
        const result = validateBody(BookingRequestSchema, {
            customer_name: 'John',
            vehicle_type: 'sedan',
            service: 'Basic Wash',
            service_price: 80,
            booking_date: '2026-03-15',
            booking_time: '10:00 AM',
        });
        expect(result.success).toBe(true);
    });

    it('accepts valid booking with date field', () => {
        const result = validateBody(BookingRequestSchema, {
            date: '2026-03-15',
            time: '10:00 AM',
        });
        expect(result.success).toBe(true);
    });

    it('rejects missing both date fields', () => {
        const result = validateBody(BookingRequestSchema, {
            customer_name: 'John',
        });
        expect(result.success).toBe(false);
        expect(result.message).toContain('booking_date or date is required');
    });

    it('rejects negative price', () => {
        const result = validateBody(BookingRequestSchema, {
            service_price: -10,
            booking_date: '2026-03-15',
        });
        expect(result.success).toBe(false);
        expect(result.message).toContain('>0');
    });

    it('rejects excessive price', () => {
        const result = validateBody(BookingRequestSchema, {
            service_price: 99999,
            booking_date: '2026-03-15',
        });
        expect(result.success).toBe(false);
        expect(result.message).toContain('10000');
    });

    it('rejects invalid date format', () => {
        const result = validateBody(BookingRequestSchema, {
            booking_date: '03-15-2026',
        });
        expect(result.success).toBe(false);
        expect(result.message).toContain('date');
    });

    it('rejects invalid status', () => {
        const result = validateBody(BookingRequestSchema, {
            status: 'cancelled',
            booking_date: '2026-03-15',
        });
        expect(result.success).toBe(false);
        expect(result.message).toContain('status');
    });
});

describe('Auth Request Validation', () => {
    it('accepts valid password', () => {
        const result = validateBody(AuthRequestSchema, { password: 'mypassword' });
        expect(result.success).toBe(true);
    });

    it('rejects empty password', () => {
        const result = validateBody(AuthRequestSchema, { password: '' });
        expect(result.success).toBe(false);
        expect(result.message).toContain('Password is required');
    });

    it('rejects missing password field', () => {
        const result = validateBody(AuthRequestSchema, {});
        expect(result.success).toBe(false);
    });
});
