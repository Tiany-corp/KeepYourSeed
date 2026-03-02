const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3005;
const BASE_PATH = '/kys-web-app';
const DIST_DIR = path.join(__dirname, '..', 'dist');

http.createServer((req, res) => {
    let url = req.url.split('?')[0];

    if (!url.startsWith(BASE_PATH)) {
        res.writeHead(302, { 'Location': BASE_PATH + '/' });
        return res.end();
    }

    let relativePath = url.substring(BASE_PATH.length);
    if (relativePath === '' || relativePath === '/') {
        relativePath = '/index.html';
    }

    let filePath = path.join(DIST_DIR, relativePath);

    if (!fs.existsSync(filePath)) {
        filePath = path.join(DIST_DIR, 'index.html');
    } else {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            filePath = path.join(DIST_DIR, 'index.html');
        }
    }

    const extMap = {
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.json': 'application/json',
        '.ico': 'image/x-icon'
    };

    const ext = path.extname(filePath);
    const contentType = extMap[ext] || 'text/plain';

    if (fs.existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    } else {
        res.writeHead(404);
        res.end('404 Not Found');
    }
}).listen(PORT, () => {
    console.log(`\n\n✅ Serveur de test prêt !`);
    console.log(`👉 Va sur http://localhost:${PORT}${BASE_PATH}/\n\n`);
});
