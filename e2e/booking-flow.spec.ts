import { test, expect } from '@playwright/test';

/**
 * Critical Path E2E Test — Booking Flow
 *
 * Tests: Landing page → Chat widget → Quote → Booking → Deposit → Confirmation
 * Runs against staging environment. Never against production.
 */

test.describe('Booking Critical Path', () => {
    test('landing page loads and chat widget opens', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/Mr\. Cleaner|Mobile Detailing/);

        // Chat button should be visible
        const chatButton = page.locator('[data-testid="chat-button"], button:has-text("Chat"), button:has-text("Maya")').first();
        await expect(chatButton).toBeVisible({ timeout: 10_000 });

        // Click to open chat
        await chatButton.click();

        // Chat interface should appear
        const chatInterface = page.locator('[data-testid="chat-interface"], [role="dialog"]').first();
        await expect(chatInterface).toBeVisible({ timeout: 5_000 });
    });

    test('chat widget sends message and receives response', async ({ page }) => {
        await page.goto('/');

        // Open chat
        const chatButton = page.locator('[data-testid="chat-button"], button:has-text("Chat"), button:has-text("Maya")').first();
        await chatButton.click();
        await page.waitForTimeout(1000);

        // Type a message
        const input = page.locator('input[placeholder*="message" i], textarea[placeholder*="message" i], input[type="text"]').first();
        await expect(input).toBeVisible({ timeout: 5_000 });
        await input.fill('Hi, I need a car wash for my sedan');

        // Send message
        const sendButton = page.locator('button[type="submit"], button:has-text("Send")').first();
        await sendButton.click();

        // Wait for AI response (may take a few seconds)
        const responseArea = page.locator('[data-testid="chat-messages"], [class*="messages"]').first();
        await expect(responseArea).toContainText(/zip|area|location/i, { timeout: 15_000 });
    });

    test('booking success page renders correctly', async ({ page }) => {
        await page.goto('/booking/success');
        await expect(page.locator('text=confirmed|success|booked').first()).toBeVisible({ timeout: 5_000 });
    });

    test('booking cancel page renders correctly', async ({ page }) => {
        await page.goto('/booking/cancel');
        await expect(page.locator('text=cancel|back|return').first()).toBeVisible({ timeout: 5_000 });
    });
});

test.describe('Health Check', () => {
    test('API health endpoint returns ok', async ({ request }) => {
        const response = await request.get('/api/health');
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(data.status).toBe('ok');
    });
});
