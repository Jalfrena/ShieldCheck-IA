import { GoogleGenAI } from '@google/genai';

// Modelo vigente (ago 2026). gemini-2.5-flash ya NO acepta usuarios nuevos
// (la API responde 404 "no longer available to new users").
// gemini-3.6-flash verificado funcionando con llamada real el 24-ago-2026.
// Si Google lo retira, consultar modelos disponibles con:
//   GET https://generativelanguage.googleapis.com/v1beta/models?key=TU_CLAVE
export const MODEL_NAME = 'gemini-3.6-flash';

const SYSTEM_PROMPT = `
    Eres el motor de análisis de ShieldCheck IA. Analiza si el siguiente mensaje, imagen o audio es un intento de estafa o engaño.

    Si recibes un AUDIO, escúchalo con atención y evalúa dos cosas a la vez:
    1) Contenido/intención: ¿pide dinero, códigos, contraseñas o datos bancarios? ¿usa urgencia, amenazas o presión emocional (p. ej. un supuesto familiar en apuros, un supuesto banco, un supuesto premio)?
    2) Indicios de voz sintética o clonada: cadencia robótica o antinatural, respiración/pausas inconsistentes, ruido de fondo artificial o inexistente, entonación plana o repetitiva, cortes o empalmes extraños. Menciona estos indicios como "banderasRojas" cuando existan, en lenguaje sencillo (ej. "La voz suena artificial o robótica", "Pide una transferencia urgente sin dejar verificar").
    No puedes confirmar con certeza técnica si una voz fue clonada por IA; si escuchas señales sospechosas, comunícalo como una posibilidad razonable, no como un hecho absoluto.

    Responde exclusivamente en formato JSON estricto con esta estructura:
    {
        "nivelRiesgo": "ALTO", "MEDIO" o "BAJO",
        "titulo": "Título corto explícito",
        "explicacion": "Explicación sencilla adaptada para adultos mayores",
        "banderasRojas": ["Señal 1", "Señal 2"],
        "queHacer": "Recomendación de acción directa"
    }
`;

// Formatos de audio soportados (los típicos de notas de voz de WhatsApp y grabaciones comunes)
export const MIME_AUDIO_PERMITIDOS = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/ogg', 'audio/opus', 'audio/webm', 'audio/m4a', 'audio/mp4', 'audio/x-m4a', 'audio/aac'];

function getClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        const err = new Error('El servidor no tiene configurada la clave de Gemini (GEMINI_API_KEY).');
        err.status = 500;
        throw err;
    }
    return new GoogleGenAI({ apiKey });
}

function geminiError(message) {
    const err = new Error(message);
    err.status = 502;
    return err;
}

// Analiza un texto, imagen y/o audio y devuelve el objeto de análisis ya parseado.
// Lanza errores con .status (502) cuando Gemini no responde JSON válido.
export async function analyzeContent({ texto, imagenBase64, mimeType, audioBase64, audioMimeType }) {
    const parts = [{ text: SYSTEM_PROMPT }];

    // Se pueden enviar texto, imagen y/o audio juntos (p. ej. audio + comentario del usuario)
    if (texto) {
        parts.push({ text: `Texto a analizar: ${texto}` });
    }
    if (imagenBase64 && mimeType) {
        parts.push({ inlineData: { data: imagenBase64, mimeType } });
    }
    if (audioBase64 && audioMimeType) {
        parts.push({ text: 'Nota de voz / audio a analizar (escúchalo y evalúa contenido y naturalidad de la voz):' });
        parts.push({ inlineData: { data: audioBase64, mimeType: audioMimeType } });
    }

    const result = await getClient().models.generateContent({
        model: MODEL_NAME,
        contents: [{ role: 'user', parts }],
        config: { responseMimeType: 'application/json' }
    });

    const rawText = typeof result.text === 'string' ? result.text : '';
    if (!rawText.trim()) {
        throw geminiError('La IA no devolvió análisis (posible bloqueo por políticas de contenido). Intenta con otro mensaje.');
    }

    try {
        const cleanJson = rawText.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (parseError) {
        console.error('Respuesta no-JSON de Gemini:', rawText.slice(0, 300));
        throw geminiError('La IA devolvió una respuesta no válida. Intenta de nuevo.');
    }
}
