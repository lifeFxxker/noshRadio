const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');

const PROXY_HOST = 'localhost';
const PROXY_PORT = 8081;
const BASE_URL = `http://${PROXY_HOST}:${PROXY_PORT}`;

const ALLOWED_SOURCES = ['kugou', 'kuwo', 'bodian', 'migu', 'joox', 'pyncmd'];

/**
 * Helper: make an HTTP GET request and return { status, headers, body }.
 */
function fetchJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: JSON.parse(data),
          });
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}, raw: ${data}`));
        }
      });
    }).on('error', (e) => reject(e));
  });
}

describe('/api/resolve-url', () => {
  it('should resolve a known song id (185709)', { timeout: 30000 }, async () => {
    const result = await fetchJson('/api/resolve-url?id=185709');
    assert.strictEqual(result.status, 200, 'Expected HTTP 200');
    assert.strictEqual(result.body.success, true, 'Expected success: true');
    assert.ok(result.body.url, 'Expected a non-empty url');
    assert.ok(
      result.body.url.startsWith('http'),
      `Expected url to start with http, got: ${result.body.url}`
    );
    assert.ok(
      ALLOWED_SOURCES.includes(result.body.source),
      `Expected source to be one of ${ALLOWED_SOURCES.join(', ')}, got: ${result.body.source}`
    );
    assert.ok(
      typeof result.body.br === 'number' && result.body.br > 0,
      `Expected br to be a positive number, got: ${result.body.br}`
    );
  });

  it('should return 400 when id parameter is missing', { timeout: 10000 }, async () => {
    const result = await fetchJson('/api/resolve-url');
    assert.strictEqual(result.status, 400, 'Expected HTTP 400');
    assert.strictEqual(result.body.success, false, 'Expected success: false');
    assert.ok(
      result.body.error && result.body.error.toLowerCase().includes('id'),
      `Expected error to mention "id", got: ${result.body.error}`
    );
  });

  it('should return success:false + fallback:true for non-existent id', { timeout: 30000 }, async () => {
    const result = await fetchJson('/api/resolve-url?id=9999999999');
    assert.strictEqual(result.status, 200, 'Expected HTTP 200');
    assert.strictEqual(result.body.success, false, 'Expected success: false');
    assert.strictEqual(result.body.fallback, true, 'Expected fallback: true');
    assert.ok(result.body.error, 'Expected an error message');
  });

  it('should include CORS headers', { timeout: 10000 }, async () => {
    const result = await fetchJson('/api/resolve-url?id=185709');
    assert.strictEqual(result.status, 200, 'Expected HTTP 200');
    assert.strictEqual(
      result.headers['access-control-allow-origin'],
      '*',
      'Expected Access-Control-Allow-Origin: *'
    );
  });
});
