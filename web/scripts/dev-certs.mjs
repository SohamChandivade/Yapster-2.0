#!/usr/bin/env node
/**
 * Local HTTPS for development. Creates a tiny certificate authority once, then a
 * server certificate for localhost plus this machine's LAN addresses, so a phone
 * on the same network gets a secure context (microphone!) and trusts the API too.
 *
 *   node scripts/dev-certs.mjs            # detect LAN IPs
 *   node scripts/dev-certs.mjs 10.0.0.5   # or name them
 *
 * Output: ../certs/{yapster-dev-ca.pem, dev-cert.pem, dev-key.pem}. The CA is also
 * copied to public/yapster-dev-ca.pem so a phone can download and install it.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = path.resolve(process.cwd(), "..", "certs");
mkdirSync(dir, { recursive: true });

const requested = process.argv.slice(2);
const ips = requested.length ? requested : detectLanIps();
const caKey = path.join(dir, "yapster-dev-ca.key");
const caCrt = path.join(dir, "yapster-dev-ca.pem");
const key = path.join(dir, "dev-key.pem");
const crt = path.join(dir, "dev-cert.pem");
const csr = path.join(dir, "dev.csr");
const ext = path.join(dir, "dev.ext");

function openssl(args) {
  execFileSync("openssl", args, { stdio: ["ignore", "ignore", "inherit"] });
}

function detectLanIps() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === "IPv4" && !net.internal) out.push(net.address);
    }
  }
  return out;
}

if (!existsSync(caCrt)) {
  openssl(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", caKey, "-out", caCrt,
    "-days", "3650", "-subj", "/CN=Yapster dev CA"]);
  console.log("created CA", caCrt);
}

const sans = ["DNS:localhost", "IP:127.0.0.1", ...ips.map((ip) => `IP:${ip}`)].join(",");
writeFileSync(ext, `subjectAltName=${sans}\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n`);
openssl(["req", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", csr, "-subj", "/CN=yapster-dev"]);
openssl(["x509", "-req", "-in", csr, "-CA", caCrt, "-CAkey", caKey, "-CAcreateserial", "-out", crt,
  "-days", "825", "-extfile", ext]);
mkdirSync("public", { recursive: true });
copyFileSync(caCrt, path.join("public", "yapster-dev-ca.pem"));

console.log(`server certificate for: ${sans}`);
console.log("web:  npm run dev:https");
console.log("api:  uv run uvicorn app.main:app --host 0.0.0.0 --port 8443 --ssl-keyfile ../certs/dev-key.pem --ssl-certfile ../certs/dev-cert.pem");
console.log("phone: open https://<ip>:3443/yapster-dev-ca.pem, install it as a CA certificate, then https://<ip>:3443");
