// ============================================================
// SERVIDOR LOCAL DE DESARROLLO - ShieldCheck IA
// ============================================================
// El backend solo existe para proteger la clave de Gemini.
// El historial se guarda solo en este dispositivo (localStorage del navegador).
//
// Uso: npm start  ->  http://localhost:3000
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { analizar, health } from './netlify/functions/_lib/api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carga explícita del archivo .env (debe llamarse ".env", CON el punto)
dotenv.config({ path: path.join(__dirname, '.env') });

if (!process.env.GEMINI_API_KEY) {
    console.error('\n❌ ERROR: No se encontró GEMINI_API_KEY.');
    console.error('   Verifica que exista un archivo ".env" en la raíz del proyecto con:');
    console.error('   GEMINI_API_KEY=tu_clave_aqui\n');
    process.exit(1);
}

const app = express();
app.use(express.json({ limit: '12mb' })); // margen para audios en Base64 (ver AUDIO_BASE64_MAX_CHARS en _lib/api.mjs

// Interfaz: un único index.html con todo inline.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Diagnóstico rápido
app.get('/api/health', (req, res) => {
    res.json(health());
});

// Análisis (misma lógica que la función de Netlify)
app.post('/api/analizar', async (req, res) => {
    const result = await analizar(req.body || {});
    res.status(result.status).json(result.body);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor de ShieldCheck IA corriendo en http://localhost:${PORT}`));
