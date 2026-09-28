# Contexto Técnico: ShieldCheck IA

App SPA para detectar estafas con Google Gemini. Frontend 100% en `index.html`. El backend existe **únicamente como intermediario de la IA** (protege `GEMINI_API_KEY`). El **historial se guarda solo en el navegador** (`localStorage`): cada usuario ve únicamente su propio historial, sin logins ni nube.

---

## Estructura

```
/home/manuel/Documentos/IA/
├── index.html                  # SPA completa: pantallas + JS + CSS (sin frameworks)
├── server.js                   # Express local: sirve index.html + /api/*
├── netlify.toml                # Deploy Netlify
├── package.json                # deps: @google/genai, express, dotenv
├── .env                        # GEMINI_API_KEY, PORT
└── netlify/functions/
    ├── analizar.mjs            # Adaptador Netlify de /api/analizar
    └── _lib/
        ├── api.mjs             # Lógica compartida: analizar(), health()
        └── gemini.mjs          # MODEL_NAME, SYSTEM_PROMPT, analyzeContent()
```

## Endpoints

| Endpoint | Dónde | Qué hace |
|----------|-------|----------|
| `POST /api/analizar` | `api.mjs → analizar()` | `{texto}` y/o `{imagenBase64, mimeType}` → análisis Gemini |
| `GET /api/health` | `api.mjs → health()` | Solo local: `{ok, modelo}` |

Contrato Gemini (`gemini.mjs`; cambiar modelo ahí si Google lo retira):
```json
{ "nivelRiesgo": "ALTO|MEDIO|BAJO", "titulo": "...", "explicacion": "...",
  "banderasRojas": ["..."], "queHacer": "..." }
```

## Historial Local (localStorage)

Claves en el navegador:
- `shieldcheck_historial` — array JSON de entradas (máx. 50, más recientes primero)
- `shieldcheck_fuente` / `shieldcheck_voz` — preferencias de accesibilidad
- `shieldcheck_cliente_id` — identificador anónimo visible en Ajustes (no se envía a ningún servidor)

Formato de entrada:
```json
{ "id": "h-1724...", "date": "24/8/2026, 10:30", "title": "...",
  "risk": "ALTO|MEDIO|BAJO", "explanation": "..." }
```
Nota: entradas viejas pueden tener `risk: HIGH|SAFE|MEDIUM` y el campo `redFlags`;
`renderHistoryList()` acepta ambas convenciones al renderizar.

Funciones (en index.html):
| Función | Qué hace |
|---------|----------|
| `leerHistorialLocal()` | Lee y parsea con tolerancia a datos corruptos |
| `guardarHistorialLocal()` | Persiste `historyData` recortado a 50 |
| `cargarHistorial()` | Carga al iniciar la app |
| `entradaDesdeAnalisis(item)` | Respuesta IA → entrada del historial |
| `saveToHistory(item)` | Agrega + persiste + renderiza |
| `clearHistory()` | Confirm + vaciado |

**Privacidad**: el historial nunca sale del dispositivo; no hay login, cuentas ni sincronización.

## Flujo Principal

1. `startAIAnalysis()` arma payload → `POST /api/analizar`
2. Pinta resultado: `applyRiskTheme()`, `renderRedFlags()`, `speakText()` (TTS es-ES)
3. `saveToHistory()` guarda local y renderiza
4. `cargarHistorial()` llena la pantalla Historial al arrancar (`window.onload`)

Render seguro: siempre `createElement` + `textContent`; **nunca interpolar datos externos en innerHTML** (XSS).

## Pantallas (`switchScreen(id)`)

`screen-welcome` · `screen-analyze` · `screen-history` · `screen-info` · `screen-config` (al entrar dispara `refreshConfigScreen()`).

Pantalla Ajustes muestra: estado de Gemini (`checkSystemStatus` vía `/api/health`, solo disponible en local), tarjeta "Historial guardado solo en este dispositivo", tamaño de fuente, voz, id anónimo, conteo de análisis y borrado total.

Utilidades: `showToast(msg)` · `applyFontSize/changeFontSize` · `toggleVoiceAssistant/speakText` · `savePrefs/loadPrefs` · `setStatusCard(el, tipo, msg)`.

Ejemplos de prueba: objeto `PRESETS` (texto plano) + botones `loadPreset('clave')`.

---

## Configuración y Deploy

```bash
npm install && npm start   # .env mínimo: GEMINI_API_KEY=... -> http://localhost:3000
```
Netlify: única variable de entorno `GEMINI_API_KEY`. El build copia `index.html` a `dist/`.

## Modificaciones Frecuentes

| Quiero... | Edito |
|-----------|-------|
| Modelo o prompt IA | `_lib/gemini.mjs` (`MODEL_NAME`, `SYSTEM_PROMPT`) |
| Reglas del endpoint analizar | `_lib/api.mjs` |
| Campo nuevo en historial | `entradaDesdeAnalisis()` + `renderHistoryList()` (+ migrar entradas viejas si importa) |
| Límite de entradas | Constante `HISTORIAL_MAX` |
| Nueva pantalla | `<section hidden>` + botón nav + entrada en `navMap` |
| Ejemplos | `PRESETS` |

## Errores Comunes

| Síntoma | Causa | Solución |
|---------|-------|----------|
| Alert HTTP 404 al analizar | Backend caído / funciones no deployadas | `npm start` local; revisar logs Netlify |
| `GEMINI_API_KEY` faltante | `.env` ausente o variable Netlify sin definir | Crear `.env` junto a server.js / configurar en dashboard |
| 404 de modelo | Google retiró gemini-3.6-flash | Actualizar `MODEL_NAME` (ver comentario en gemini.mjs) |
| Historial no persiste | Navegador en modo privado o borra datos al cerrar | Usar ventana normal; los datos viven en localStorage |
| Historial distinto en otro dispositivo | Es local por diseño | Comportamiento esperado (sin cuentas) |

## Respaldo pre-refactor

- `/tmp/opencode/shieldcheck-backup-20260824.tar.gz` — estado original (backend Admin SDK)
- `/tmp/opencode/shieldcheck-backup-pre-local-20260824.tar.gz` — versión con Firestore directo
(archivos temporales: se pierden al reiniciar la PC)
