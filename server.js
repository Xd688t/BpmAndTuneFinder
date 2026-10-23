// Servidor local sin dependencias (Node 18 o superior).
// Uso:  node server.js TU_CLAVE_API      (o con la variable GETSONGBPM_API_KEY)
const http = require('http');
const fs = require('fs');
const path = require('path');

const KEY = process.argv[2] || process.env.GETSONGBPM_API_KEY || '';
const PORT = process.env.PORT || 3000;
const API = 'https://api.getsong.co';
const cache = new Map(); // caché en memoria para ahorrar llamadas

async function upstream(endpoint, params) {
  const qs = new URLSearchParams({ api_key: KEY, ...params }).toString();
  const url = `${API}/${endpoint}/?${qs}`;
  if (cache.has(url)) return cache.get(url);
  const r = await fetch(url, { headers: { 'User-Agent': 'bpm-finder/1.0' } });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: 'Respuesta no válida de GetSongBPM' }; }
  if (r.ok) cache.set(url, data);
  return data;
}

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  try {
    if (u.pathname === '/') {
      return send(res, 200, fs.readFileSync(path.join(__dirname, 'index.html')), 'text/html; charset=utf-8');
    }
    if (u.pathname.startsWith('/api/')) {
      if (!KEY) return send(res, 500, { error: 'Falta la clave de API. Arranca con: node server.js TU_CLAVE' });
      if (u.pathname === '/api/search') {
        const q = (u.searchParams.get('q') || '').trim();
        if (!q) return send(res, 400, { error: 'Consulta vacía' });
        return send(res, 200, await upstream('search', { type: 'song', lookup: q, limit: '8' }));
      }
      if (u.pathname === '/api/song') {
        const id = (u.searchParams.get('id') || '').trim();
        if (!id) return send(res, 400, { error: 'Falta id' });
        return send(res, 200, await upstream('song', { id }));
      }
    }
    send(res, 404, { error: 'No encontrado' });
  } catch (e) {
    send(res, 502, { error: 'No se pudo contactar con GetSongBPM' });
  }
}).listen(PORT, () => {
  console.log(`Abre http://localhost:${PORT}`);
  if (!KEY) console.log('⚠ Falta la clave de API: node server.js TU_CLAVE');
});
