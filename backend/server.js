import http from 'node:http';
import { ApiError, recommendCommuteRoute } from './commuteService.js';

const PORT = Number(process.env.PORT ?? 3001);
const config = {
  googleRoutesApiKey: process.env.GOOGLE_ROUTES_API_KEY,
  googleMapsBrowserApiKey: process.env.GOOGLE_MAPS_BROWSER_API_KEY,
};

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (req.method === 'GET' && req.url === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        service: 'weather-aware-commute-api',
        googleRoutesConfigured: Boolean(config.googleRoutesApiKey),
        googleMapsBrowserConfigured: Boolean(config.googleMapsBrowserApiKey),
      });
      return;
    }

    if (req.method === 'GET' && req.url === '/api/maps-key') {
      if (!config.googleMapsBrowserApiKey) {
        sendJson(res, 500, { error: 'Google Maps API key is not configured.' });
        return;
      }
      sendJson(res, 200, { key: config.googleMapsBrowserApiKey });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/commute-routes') {
      const body = await readJsonBody(req);
      const result = await recommendCommuteRoute(body, config);
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    handleError(res, error);
  }
});

server.listen(PORT, () => {
  console.log(`Weather-aware commute API listening on http://127.0.0.1:${PORT}`);
});

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, 'Request body must be valid JSON.');
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload, null, 2));
}

function handleError(res, error) {
  const status = error instanceof ApiError ? error.status : 500;
  const message = error instanceof Error ? error.message : 'Unexpected server error.';
  const payload = { error: message };

  if (error instanceof ApiError && error.details) {
    payload.details = error.details;
  }

  sendJson(res, status, payload);
}
