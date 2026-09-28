// Adaptador Netlify: POST /api/analizar -> /.netlify/functions/analizar
// La lógica real vive en _lib/api.mjs (compartida con server.js).
import { analizar } from './_lib/api.mjs';

const json = (status, payload) => new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
});

export default async (req) => {
    if (req.method !== 'POST') {
        return json(405, { error: 'Método no permitido.' });
    }

    const body = await req.json().catch(() => ({}));
    const result = await analizar(body);
    return json(result.status, result.body);
};
