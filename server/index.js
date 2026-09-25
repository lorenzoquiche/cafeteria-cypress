import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const dataFile = path.resolve(process.env.DATA_FILE ?? path.join(root, 'data', 'cafeteria.json'));
const port = Number(process.env.PORT ?? 3000);
const seedProducts = [
  { id: 'espresso', name: 'Espresso', priceCents: 1800, stock: 8, icon: '☕' },
  { id: 'capuchino', name: 'Capuchino', priceCents: 2800, stock: 6, icon: '🥛' },
  { id: 'croissant', name: 'Croissant', priceCents: 2200, stock: 5, icon: '🥐' },
  { id: 'brownie', name: 'Brownie', priceCents: 2500, stock: 0, icon: '🍫' }
];
const initialData = () => ({ products: structuredClone(seedProducts), orders: [] });
function save(data) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  const tmp = `${dataFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, dataFile);
}
function read() {
  if (!fs.existsSync(dataFile)) save(initialData());
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
async function body(req) {
  let input = '';
  for await (const chunk of req) {
    input += chunk;
    if (input.length > 10_000) throw new Error('PAYLOAD_TOO_LARGE');
  }
  try { return JSON.parse(input); } catch { throw new Error('INVALID_JSON'); }
}
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/products' && req.method === 'GET') return json(res, 200, read().products);
    if (url.pathname === '/api/test/reset' && req.method === 'POST') {
      if (process.env.ENABLE_TEST_RESET !== '1') return json(res, 404, { error: 'No encontrado' });
      save(initialData());
      return json(res, 200, { reset: true });
    }
    if (url.pathname === '/api/orders' && req.method === 'POST') {
      const payload = await body(req);
      const items = payload?.items;
      if (!Array.isArray(items) || items.length === 0 || items.some(i => !i || typeof i.productId !== 'string' || !Number.isSafeInteger(i.quantity) || i.quantity < 1 || i.quantity > 20) || new Set(items.map(i => i.productId)).size !== items.length) {
        return json(res, 400, { error: 'El pedido debe contener productos con cantidades válidas (1 a 20).' });
      }
      const data = read();
      const lines = [];
      for (const item of items) {
        const product = data.products.find(p => p.id === item.productId);
        if (!product) return json(res, 400, { error: 'Uno de los productos no existe.' });
        if (item.quantity > product.stock) return json(res, 409, { error: `No hay suficientes existencias de ${product.name}.` });
        lines.push({ productId: product.id, name: product.name, quantity: item.quantity, unitPriceCents: product.priceCents, subtotalCents: product.priceCents * item.quantity });
      }
      const order = { id: randomUUID(), items: lines, totalCents: lines.reduce((sum, line) => sum + line.subtotalCents, 0), createdAt: new Date().toISOString() };
      for (const item of items) data.products.find(p => p.id === item.productId).stock -= item.quantity;
      data.orders.push(order);
      save(data);
      return json(res, 201, order);
    }
    const match = url.pathname.match(/^\/api\/orders\/([0-9a-f-]+)$/);
    if (match && req.method === 'GET') {
      const order = read().orders.find(o => o.id === match[1]);
      return json(res, order ? 200 : 404, order ?? { error: 'Pedido no encontrado.' });
    }
    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'No encontrado' });
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!['index.html', 'app.js', 'style.css'].includes(file) || req.method !== 'GET') return json(res, 404, { error: 'No encontrado' });
    const fullPath = path.join(publicDir, file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)], 'Cache-Control': 'no-store' });
    fs.createReadStream(fullPath).pipe(res);
  } catch (error) {
    json(res, error.message === 'INVALID_JSON' ? 400 : error.message === 'PAYLOAD_TOO_LARGE' ? 413 : 500, { error: error.message === 'INVALID_JSON' ? 'JSON inválido.' : error.message === 'PAYLOAD_TOO_LARGE' ? 'Solicitud demasiado grande.' : 'Error interno.' });
  }
});
server.listen(port, () => console.log(`Cafetería en http://localhost:${port}`));
