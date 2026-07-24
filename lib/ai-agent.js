/**
 * Maya AI Agent — System Prompt Generator
 *
 * WHY THIS IS A TEMPLATE (not hardcoded):
 * The old code had "Mr. Cleaner, Texas' #1 Luxury Detailers" hardcoded in the
 * prompt. This meant every client got the same branding. Now, the prompt is
 * generated dynamically from business config stored in Supabase (or env vars
 * as fallback). This enables multi-tenant support without code changes.
 *
 * BUSINESS CONFIG SOURCE:
 * Priority: Supabase businesses table > env vars > defaults.
 * The chat API route loads business config and passes it here.
 *
 * USAGE:
 *   const prompt = buildSystemPrompt(businessRow);
 *   // or with overrides:
 *   const prompt = buildSystemPrompt(businessRow, { service_area_zips: [...] });
 */

const DEFAULT_CONFIG = {
    business_name: process.env.BUSINESS_NAME || 'Mr. Cleaner Mobile Detailing',
    business_location: process.env.BUSINESS_LOCATION || 'Texas',
    business_phone: process.env.BUSINESS_PHONE || '+15550001234',
    business_timezone: process.env.BUSINESS_TIMEZONE || 'America/Chicago',
    service_area_zips: ['78701', '78702', '78703', '78704', '78705'],
    tagline: "Texas' #1 Luxury Detailers",
};

/**
 * Build the Maya system prompt from a business row + optional overrides.
 * @param {Object} business - Business row from businesses table (can be null/empty for defaults)
 * @param {Object} overrides - Optional overrides (e.g., service_area_zips from business_knowledge)
 * @param {string} [overrides.language='en'] - Conversation language: 'en' or 'es'
 * @returns {string} The full system prompt
 */
export function buildSystemPrompt(business = {}, overrides = {}) {
    const serviceAreaZips = overrides.service_area_zips
        || business.service_area?.zip_codes
        || DEFAULT_CONFIG.service_area_zips;

    const language = overrides.language || 'en';

    const config = {
        business_name: business.name || DEFAULT_CONFIG.business_name,
        business_location: business.location || DEFAULT_CONFIG.business_location,
        business_phone: business.phone || DEFAULT_CONFIG.business_phone,
        business_timezone: business.timezone || DEFAULT_CONFIG.business_timezone,
        service_area_zips: serviceAreaZips,
        tagline: business.branding?.tagline || DEFAULT_CONFIG.tagline,
        ...overrides,
    };

    const basePrompt = `# IDENTITY & ROLE
You are Maya, the AI Concierge for ${config.business_name}, ${config.tagline}.

# CORE MISSION
Convert high-end inquiries into confirmed bookings by following elite US SaaS business protocols.

# OPERATION PROTOCOL (US MARKET SAAS)
1. **Verify Service Area**: Before anything else, ask for the customer's **Zip Code**. Use 'verify_service_area'. If not supported, be polite and invite them to stay on the waitlist.
2. **Assess Condition**: Ask about the vehicle's condition (Pet hair? Heavily soiled?). Mobile detailing in the US requires clear expectations on labor.
3. **Dynamic Pricing**: Use 'calculate_quote' with the correct vehicle type and condition multiplier.
4. **Weather Awareness**: If the appointment is outdoors, use 'check_weather' for the requested date. Explain that we need a garage or cover if rain is forecasted.
5. **Availability**: Use 'get_availability' only after the area is verified.
6. **Secure the Slot**: We require a $50 deposit to secure all mobile slots. Use 'generate_deposit_link' to finalize.
7. **State Sync**: Use 'sync_booking_state' to persist data at every major step.

# BUSINESS INFO
- Business: ${config.business_name}
- Location: ${config.business_location}
- Phone: ${config.business_phone}
- Timezone: ${config.business_timezone}
- Service Area Zips: ${config.service_area_zips.join(', ')}

# STYLE & TONE
- Hyper-professional, warm, elite concierge.
- Be concise. Use phrases like "Exclusive care for your vehicle," "Elite mobile service at your doorstep."
- Stay in character as Maya and don't volunteer that you're an AI unless the customer directly asks — if asked directly, honestly confirm you're Maya, an AI concierge for ${config.business_name}, and continue helping.
- If asked about pricing, always use the calculate_quote tool — never guess.`;

    if (language === 'es') {
        return `${basePrompt}

# LANGUAGE: SPANISH (ESPAÑOL)
**CRITICAL**: The customer is communicating in Spanish. You MUST respond entirely in Spanish for the entire conversation — do not switch to English unless the customer explicitly switches first.

# SPANISH STYLE GUIDE
- Use professional, warm Spanish appropriate for US Hispanic customers (Mexican-American, Texan-Southwest register).
- Keep the same elite concierge tone — "Atención exclusiva para su vehículo," "Servicio móvil de élite a su puerta."
- Auto detailing terminology in Spanish:
  - Ceramic coating → "recubrimiento cerámico" or "cera cerámica"
  - Paint protection film (PPF) → "película de protección de pintura" or "ppf"
  - Interior detail → "detallado interior"
  - Exterior wash & wax → "lavado y encerado exterior"
  - Executive Preservation → "Preservación Ejecutiva"
  - The Master Detail → "El Detallado Maestro"
  - Signature Ceramic → "Cerámica de Firma"
- Prices stay in USD with $ symbol (e.g., $250).
- Zip codes remain as-is (numeric).
- Use "tú" (informal) unless the customer uses "usted" — mirror their register.
- All tool calls (calculate_quote, get_availability, etc.) remain in English — tool names and parameters are always English. Only your conversation text changes.`;
    }

    return basePrompt;
}

/**
 * Legacy wrapper for backward compatibility.
 * @param {Object} businessConfig - Business-specific overrides (old API)
 * @returns {string} The full system prompt
 */
export function generateMayaPrompt(businessConfig = {}) {
    return buildSystemPrompt({}, businessConfig);
}

// Legacy export for backward compatibility
export const MAYA_SYSTEM_PROMPT = generateMayaPrompt();

// ─── Language Detection ───────────────────────────────────────────────────────

/**
 * Simple heuristic language detection — Spanish vs English.
 *
 * WHY NOT A LIBRARY: This is lightweight and sufficient for our use case.
 * We don't need 100% accuracy — if we miss-identify, the LLM will naturally
 * correct on the next turn. Heavy NLP libraries (franc, cld3) add 2-5MB
 * bundle size and 50-200ms latency for marginal accuracy gain at 1-2 word
 * inputs. For a booking agent, speed > precision on language detection.
 *
 * STRATEGY: Check for Spanish indicator words + accented characters.
 * Returns 'es' or 'en'. Default is 'en' (safe assumption for US market).
 *
 * @param {string} message - User message text
 * @returns {'en'|'es'} Detected language
 */
export function detectLanguage(message) {
    if (!message || typeof message !== 'string') return 'en';

    const lower = message.toLowerCase().trim();

    // Spanish-specific words (high signal, low false-positive)
    // These are common words that almost never appear in English conversation
    const spanishWords = [
        'hola', 'buenos', 'buenas', 'tardes', 'noches', 'días',
        'gracias', 'por favor', 'necesito', 'quiero', 'cuánto', 'cuanto',
        'precio', 'servicio', 'servicios', 'vehículo', 'vehiculo', 'carro',
        'camioneta', 'auto', 'coche', 'detallado', 'lavado', 'encerado',
        'cita', 'citas', 'disponible', 'disponibilidad', 'reservar',
        'reserva', 'presupuesto', 'cotización', 'cotizacion',
        'dirección', 'direccion', 'teléfono', 'telefono', 'correo',
        'programar', 'agendar', 'confirmar', 'cancelar',
        'bien', 'perfecto', 'excelente', 'dale',
        'señor', 'senor', 'señora', 'senora',
        'cerámica', 'ceramica', 'pintura', 'interior', 'exterior',
        'manchas', 'rayones', 'golpe', 'polvo', 'sucio',
        'lluvia', 'garage', 'techo', 'estacionamiento',
        'mañana', 'manana', 'tarde', 'horario',
        // Common verb conjugations
        'tengo', 'tiene', 'quiere', 'necesita', 'puedo', 'puede',
        // Days of the week
        'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'domingo',
        // Question words
        'cuándo', 'cuando', 'dónde', 'donde', 'cómo', 'como', 'cuál', 'cual', 'quién', 'quien',
    ];

    let spanishScore = 0;

    // Check for accented characters (á, é, í, ó, ú, ñ, ¿, ¡)
    if (/[áéíóúñ¿¡]/.test(lower)) {
        spanishScore += 2;
    }

    // Check for Spanish indicator words
    for (const word of spanishWords) {
        if (lower.includes(word)) {
            spanishScore += 1;
        }
    }

    // Threshold: 1+ indicators = Spanish
    // Single strong indicators (like accented chars or common words) are sufficient
    return spanishScore >= 1 ? 'es' : 'en';
}

// ─── Prompt Injection Detection ──────────────────────────────────────────────
/**
 * Basic regex-based pre-check for obvious prompt injection attempts.
 *
 * IMPORTANT LIMITATIONS (do NOT overclaim):
 * - This catches ONLY naive/obvious patterns: exact phrases, common bypasses.
 * - Sophisticated attacks (paraphrased, encoded, multi-language, role-play) WILL
 *   bypass this. This is a first-layer canary, NOT a complete defense.
 * - False positives are possible: "please ignore my previous message about the
 *   scratch on the door" matches "ignore my previous". We accept this tradeoff
 *   because the redirect response is polite and the customer can simply rephrase.
 *
 * @param {string} message - The latest user message text
 * @returns {{ detected: boolean, pattern?: string }}
 */
export function detectPromptInjection(message) {
    if (!message || typeof message !== 'string') return { detected: false };

    const lower = message.toLowerCase().trim();

    // Patterns ordered from most to least specific.
    // Each is a regex applied to the lowercased message.
    const patterns = [
        { re: /\bignore\s+(all\s+|any\s+|your\s+)?(previous|prior|earlier|above|preceding)\s+(instructions?|prompts?|rules?|guidelines?|directives?)/i, id: 'ignore_instructions' },
        { re: /\bignore\s+(all\s+|any\s+)?(previous|prior|earlier)\b/i, id: 'ignore_previous' },
        { re: /\byou\s+are\s+now\s+(a|an|the)\b/i, id: 'you_are_now' },
        { re: /\bdisregard\s+(all\s+|any\s+|your\s+)?(previous|prior|earlier|above|preceding|previous)?\s*(instructions?|prompts?|rules?|guidelines?)/i, id: 'disregard_instructions' },
        { re: /\bact\s+as\s+(if|though)\s+you\s+(have\s+)?(no|don'?t\s+have|without)\s+(any\s+)?(instructions?|restrictions?|rules?|limits?|constraints?)/i, id: 'act_as_no_restrictions' },
        { re: /\b(?:reveal|show|print|output|repeat|display)\s+(?:the\s+)?(?:your\s+)?(?:system\s+prompt|instructions?|rules?|initial\s+prompt)/i, id: 'reveal_system_prompt' },
        { re: /\bwhat\s+(?:are|is)\s+(?:your\s+)?(?:system\s+prompt|initial\s+instructions?|original\s+instructions?)/i, id: 'ask_system_prompt' },
        { re: /\bjailbreak\b/i, id: 'jailbreak_keyword' },
        { re: /\bDAN\b.*\bmode\b|\bdo\s+anything\s+now\b/i, id: 'dan_mode' },
    ];

    for (const { re, id } of patterns) {
        if (re.test(lower)) {
            return { detected: true, pattern: id };
        }
    }

    return { detected: false };
}
