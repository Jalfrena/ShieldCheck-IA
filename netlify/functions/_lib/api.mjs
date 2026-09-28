// ============================================================
// LÓGICA DE NEGOCIO COMPARTIDA - ShieldCheck IA
// ============================================================
// Única fuente de verdad del backend. Los adaptadores
// (server.js en local, netlify/functions/analizar.mjs en
// producción) solo traducen { status, body } a HTTP.
//
// El HISTORIAL no pasa por aquí: el navegador lo guarda
// directo en localStorage (clave shieldcheck_historial).
import { analyzeContent, MODEL_NAME, MIME_AUDIO_PERMITIDOS } from './gemini.mjs';

// Límite de tamaño del audio en Base64. Netlify Functions (AWS Lambda por debajo)
// rechaza cuerpos de solicitud de más de ~6 MB; dejamos margen para el resto del
// payload JSON. Si necesitas audios más largos, hay que subir el archivo directo
// a un storage (ej. Cloud Storage) y pasarle a Gemini una URL en vez del Base64.
const AUDIO_BASE64_MAX_CHARS = 7_000_000; // ~5 MB de audio original aprox.

// POST /api/analizar — analiza texto, imagen y/o audio con Gemini.
export async function analizar({ texto, imagenBase64, mimeType, audioBase64, audioMimeType } = {}) {
    const tieneImagen = Boolean(imagenBase64 && mimeType);
    const tieneAudio = Boolean(audioBase64 && audioMimeType);

    if (!texto && !tieneImagen && !tieneAudio) {
        return { status: 400, body: { error: "Debes enviar 'texto', 'imagenBase64' + 'mimeType', o 'audioBase64' + 'audioMimeType'." } };
    }

    if (tieneAudio) {
        if (!MIME_AUDIO_PERMITIDOS.includes(audioMimeType)) {
            return { status: 400, body: { error: `Formato de audio no soportado (${audioMimeType}). Usa MP3, WAV, OGG/OPUS o M4A.` } };
        }
        if (audioBase64.length > AUDIO_BASE64_MAX_CHARS) {
            return { status: 413, body: { error: 'El audio es demasiado grande. Intenta con una nota de voz más corta (máx. ~5 MB).' } };
        }
    }

    try {
        return { status: 200, body: await analyzeContent({ texto, imagenBase64, mimeType, audioBase64, audioMimeType }) };
    } catch (error) {
        console.error('Error en /api/analizar:', error.message || error);
        return {
            status: error.status || 500,
            body: { error: error.status ? error.message : 'No se pudo realizar el análisis.' }
        };
    }
}

// GET /api/health — diagnóstico (solo se expone en server.js local).
export function health() {
    return { ok: true, modelo: MODEL_NAME };
}
