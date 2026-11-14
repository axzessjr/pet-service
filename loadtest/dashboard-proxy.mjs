// Serves the k6 dashboard to the browser on http://localhost:5665, forwarding to k6 on 5666.
// k6 does not exit while a browser tab still holds the dashboard's event stream open, and it
// writes summary.json only after that. run.ps1 stops this proxy once the report is exported,
// which drops the browser's connection so k6 can finish on its own.
//   node loadtest/dashboard-proxy.mjs [k6 port, default 5666] [browser port, default 5665]
import http from 'node:http';

const TARGET_PORT = Number(process.argv[2] ?? 5666);
const LISTEN_PORT = Number(process.argv[3] ?? 5665);

http.createServer((req, res) => {
    const upstream = http.request(
        { host: '127.0.0.1', port: TARGET_PORT, path: req.url, method: req.method, headers: req.headers },
        (reply) => {
            res.writeHead(reply.statusCode ?? 502, reply.headers);
            reply.pipe(res);
        },
    );
    upstream.on('error', () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
    });
    req.pipe(upstream);
}).listen(LISTEN_PORT, '127.0.0.1');
