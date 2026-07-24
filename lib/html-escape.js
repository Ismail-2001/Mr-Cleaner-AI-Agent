/**
 * HTML entity escaping utility.
 *
 * WHY THIS EXISTS:
 * Customer-supplied data (names, addresses, service notes) is interpolated
 * into HTML email templates. Without escaping, a malicious customer name
 * like <script>alert(1)</script> executes in the email client — an XSS
 * vector for phishing and credential theft.
 *
 * USAGE:
 *   import { escapeHtml } from '@/lib/html-escape';
 *   html: `<p>Hello ${escapeHtml(customerName)}</p>`
 */

const ENTITY_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

const ENTITY_REGEX = /[&<>"']/g;

/**
 * Escape HTML entities in a string to prevent injection.
 * @param {*} value - The value to escape (coerced to string if not null/undefined)
 * @returns {string} Escaped string safe for HTML interpolation
 */
export function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(ENTITY_REGEX, (char) => ENTITY_MAP[char]);
}
