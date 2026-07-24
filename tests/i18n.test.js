import { describe, it, expect } from 'vitest';
import { detectLanguage, buildSystemPrompt } from '../lib/ai-agent.js';

describe('detectLanguage()', () => {
    it('returns en for empty/null input', () => {
        expect(detectLanguage(null)).toBe('en');
        expect(detectLanguage('')).toBe('en');
        expect(detectLanguage(undefined)).toBe('en');
    });

    it('returns en for English messages', () => {
        expect(detectLanguage('Hi, I need a car wash')).toBe('en');
        expect(detectLanguage('What is the price for ceramic coating?')).toBe('en');
        expect(detectLanguage('Can I book an appointment for tomorrow?')).toBe('en');
    });

    it('returns es for Spanish messages', () => {
        expect(detectLanguage('Hola, necesito un lavado')).toBe('es');
        expect(detectLanguage('Buenos días, cuánto cuesta el servicio?')).toBe('es');
        expect(detectLanguage('Quiero reservar una cita para mañana')).toBe('es');
        expect(detectLanguage('¿Cuánto cuesta el detallado?')).toBe('es');
    });

    it('returns es for messages with accented characters', () => {
        expect(detectLanguage('Necesito una cotización para mi vehículo')).toBe('es');
        expect(detectLanguage('Tiene disponibilidad el lunes?')).toBe('es');
    });

    it('returns es for mixed Spanish/English messages', () => {
        expect(detectLanguage('Hola, what is the price?')).toBe('es');
        expect(detectLanguage('I need un lavado para mi carro')).toBe('es');
    });

    it('returns en for very short English messages', () => {
        expect(detectLanguage('ok')).toBe('en');
        expect(detectLanguage('yes')).toBe('en');
        expect(detectLanguage('price?')).toBe('en');
    });

    it('returns es for common Spanish short phrases', () => {
        expect(detectLanguage('gracias')).toBe('es');
        expect(detectLanguage('por favor')).toBe('es');
        expect(detectLanguage('dale')).toBe('es');
    });

    it('handles accented characters in Spanish detection', () => {
        expect(detectLanguage('¿Me puede dar un precio?')).toBe('es');
        expect(detectLanguage('Necesito agendar una cita')).toBe('es');
    });
});

describe('buildSystemPrompt() — language parameter', () => {
    const baseBusiness = { name: 'Test Business', location: 'Texas' };

    it('generates English prompt by default', () => {
        const prompt = buildSystemPrompt(baseBusiness);
        expect(prompt).toContain('You are Maya');
        expect(prompt).not.toContain('ESPAÑOL');
    });

    it('generates Spanish prompt when language=es', () => {
        const prompt = buildSystemPrompt(baseBusiness, { language: 'es' });
        expect(prompt).toContain('You are Maya');
        expect(prompt).toContain('LANGUAGE: SPANISH (ESPAÑOL)');
        expect(prompt).toContain('respond entirely in Spanish');
    });

    it('includes Spanish terminology in es mode', () => {
        const prompt = buildSystemPrompt(baseBusiness, { language: 'es' });
        expect(prompt).toContain('recubrimiento cerámico');
        expect(prompt).toContain('Preservación Ejecutiva');
        expect(prompt).toContain('El Detallado Maestro');
        expect(prompt).toContain('Cerámica de Firma');
    });

    it('includes English operation protocol in both languages', () => {
        const promptEn = buildSystemPrompt(baseBusiness, { language: 'en' });
        const promptEs = buildSystemPrompt(baseBusiness, { language: 'es' });
        expect(promptEn).toContain('OPERATION PROTOCOL');
        expect(promptEs).toContain('OPERATION PROTOCOL');
    });

    it('preserves business config in both languages', () => {
        const overrides = { language: 'es', service_area_zips: ['78701'] };
        const prompt = buildSystemPrompt(baseBusiness, overrides);
        expect(prompt).toContain('Test Business');
        expect(prompt).toContain('78701');
    });
});

describe('i18n — End-to-End Conversation Flow', () => {
    it('detects Spanish and builds correct prompt for entire flow', () => {
        // Step 1: Customer greets in Spanish
        const msg1 = 'Hola, buenas tardes';
        expect(detectLanguage(msg1)).toBe('es');

        // Step 2: Build prompt with Spanish
        const prompt = buildSystemPrompt(
            { name: 'Mr. Cleaner', location: 'Texas' },
            { language: 'es' }
        );
        expect(prompt).toContain('ESPAÑOL');
        expect(prompt).toContain('respond entirely in Spanish');

        // Step 3: Tool names remain English in both prompts
        expect(prompt).toContain('calculate_quote');
        expect(prompt).toContain('get_availability');
        expect(prompt).toContain('generate_deposit_link');
    });

    it('detects language switch mid-conversation', () => {
        expect(detectLanguage('Necesito un lavado')).toBe('es');
        expect(detectLanguage('Actually, what is the price?')).toBe('en');
        expect(detectLanguage('Ok, quiero reservar')).toBe('es');
    });
});
