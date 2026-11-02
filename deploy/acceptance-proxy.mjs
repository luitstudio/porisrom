// Synthetic local acceptance ingress only; never a production proxy template.
import https from "node:https";
import http from "node:http";
import { readFileSync } from "node:fs";
const targets = {
  "api.porisrom.test": "api-a:4000", "api-a.porisrom.test": "api-a:4000", "api-b.porisrom.test": "api-b:4000",
  "marketplace.porisrom.test": "frontend:3000", "admin.porisrom.test": "admin:3001",
};
function upstream(request) {
  const host = String(request.headers.host ?? "").split(":")[0];
  if (!targets[host]) return null;
  const [hostname, port] = targets[host].split(":");
  return { hostname, port, path: request.url, method: request.method,
    headers: { ...request.headers, "x-forwarded-host": request.headers.host, "x-forwarded-proto": "https", "x-forwarded-for": request.socket.remoteAddress } };
}
const server = https.createServer({ key: readFileSync("/tls/key.pem"), cert: readFileSync("/tls/cert.pem") }, (request, response) => {
  const options = upstream(request);
  if (!options) { response.writeHead(421).end(); return; }
  const outgoing = http.request(options, (incoming) => {
    response.writeHead(incoming.statusCode, incoming.headers); incoming.pipe(response);
  });
  outgoing.on("error", () => { if (!response.headersSent) response.writeHead(502); response.end(); });
  request.pipe(outgoing);
});
server.on("upgrade", (request, socket, head) => {
  const options = upstream(request); if (!options) { socket.destroy(); return; }
  const outgoing = http.request(options);
  outgoing.on("upgrade", (incoming, peer, peerHead) => {
    socket.write(`HTTP/1.1 ${incoming.statusCode} ${incoming.statusMessage}\r\n`);
    for (const [key, value] of Object.entries(incoming.headers)) socket.write(`${key}: ${value}\r\n`);
    socket.write("\r\n"); if (peerHead.length) socket.write(peerHead); if (head.length) peer.write(head);
    socket.pipe(peer); peer.pipe(socket); socket.on("error", () => peer.destroy()); peer.on("error", () => socket.destroy());
  });
  outgoing.on("error", () => socket.destroy()); outgoing.end();
});
server.listen(8443, "0.0.0.0");
process.on("SIGTERM", () => server.close(() => process.exit(0)));
