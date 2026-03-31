const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3777;
const VIPER_HOST = 'api.viperchecker.cc';

const server = http.createServer((req, res) => {
    // CORS headers for local file://
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Forward to Viper API
    const viperPath = req.url;
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        const options = {
            hostname: VIPER_HOST,
            path: viperPath,
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            },
            timeout: 300000
        };

        // Forward Authorization header
        if (req.headers.authorization) {
            options.headers['Authorization'] = req.headers.authorization;
        }
        if (body) options.headers['Content-Length'] = Buffer.byteLength(body);

        const proxy = https.request(options, (proxyRes) => {
            let data = '';
            proxyRes.on('data', chunk => data += chunk);
            proxyRes.on('end', () => {
                res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
                res.end(data);
            });
        });

        proxy.on('error', (e) => {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ Error: 'Proxy error: ' + e.message }));
        });

        if (body) proxy.write(body);
        proxy.end();
    });
});

server.listen(PORT, () => {
    console.log(`\n  🐍 Viper Proxy running at http://localhost:${PORT}`);
    console.log(`  Forwarding to https://${VIPER_HOST}\n`);
    console.log(`  Keep this terminal open while using Card Tracker.\n`);
});
