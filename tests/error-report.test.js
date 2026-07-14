import { describe, it, expect, beforeEach, vi } from 'vitest';

const ERROR_LEVELS = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    CRITICAL: 'critical',
};

function reportError(error, context = {}, level = ERROR_LEVELS.ERROR) {
    const report = {
        level,
        message: error?.message || 'Unknown error',
        code: error?.code || error?.name || 'UNKNOWN',
        timestamp: new Date().toISOString(),
        ...context,
    };

    if (process.env.NODE_ENV !== 'production' && error?.stack) {
        report.stack = error.stack.split('\n').slice(0, 5).join('\n');
    }

    const prefix = `[${level.toUpperCase()}]`;
    if (level === ERROR_LEVELS.CRITICAL || level === ERROR_LEVELS.ERROR) {
        console.error(prefix, JSON.stringify(report));
    } else if (level === ERROR_LEVELS.WARN) {
        console.warn(prefix, JSON.stringify(report));
    } else {
        console.log(prefix, JSON.stringify(report));
    }

    return report;
}

function reportWarning(message, context = {}) {
    return reportError(new Error(message), context, ERROR_LEVELS.WARN);
}

function reportCritical(message, context = {}) {
    return reportError(new Error(message), context, ERROR_LEVELS.CRITICAL);
}

describe('Error Reporting', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('reports error with message and code', () => {
        const error = new Error('Something broke');
        const report = reportError(error);
        expect(report.message).toBe('Something broke');
        expect(report.code).toBe('Error');
        expect(report.level).toBe('error');
    });

    it('includes context in report', () => {
        const error = new Error('DB failed');
        const report = reportError(error, { requestId: 'req-123', route: '/api/bookings' });
        expect(report.requestId).toBe('req-123');
        expect(report.route).toBe('/api/bookings');
    });

    it('handles error without message', () => {
        const report = reportError({});
        expect(report.message).toBe('Unknown error');
    });

    it('handles string error', () => {
        const report = reportError(new Error('string error'));
        expect(report.message).toBe('string error');
    });

    it('reports warning with WARN level', () => {
        const report = reportWarning('Disk space low');
        expect(report.level).toBe('warn');
        expect(report.message).toBe('Disk space low');
    });

    it('reports critical with CRITICAL level', () => {
        const report = reportCritical('Auth bypass detected');
        expect(report.level).toBe('critical');
        expect(report.message).toBe('Auth bypass detected');
    });

    it('includes timestamp', () => {
        const report = reportError(new Error('test'));
        expect(report.timestamp).toBeDefined();
        expect(() => new Date(report.timestamp)).not.toThrow();
    });

    it('includes stack trace in non-production', () => {
        const origEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        const error = new Error('test');
        const report = reportError(error);
        expect(report.stack).toBeDefined();
        process.env.NODE_ENV = origEnv;
    });

    it('strips stack trace in production', () => {
        const origEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        const error = new Error('test');
        const report = reportError(error);
        expect(report.stack).toBeUndefined();
        process.env.NODE_ENV = origEnv;
    });

    it('logs error to console.error for ERROR level', () => {
        reportError(new Error('test'));
        expect(console.error).toHaveBeenCalled();
    });

    it('logs warning to console.warn for WARN level', () => {
        reportWarning('test');
        expect(console.warn).toHaveBeenCalled();
    });

    it('logs info to console.log for DEBUG level', () => {
        const report = reportError(new Error('test'), {}, ERROR_LEVELS.DEBUG);
        expect(console.log).toHaveBeenCalled();
    });
});
