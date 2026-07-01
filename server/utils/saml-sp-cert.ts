import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import selfsigned from "selfsigned";
import { createLogger } from "./logger.ts";

const log = createLogger("saml");

const moduleDir = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(moduleDir, "..");

export interface SpCertificate {
  cert: string;
  key: string;
  fingerprint: string;
}

function computeFingerprint(certPem: string): string {
  const body = certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s/g, "");
  return createHash("sha256").update(Buffer.from(body, "base64")).digest("hex");
}

function resolveCertDir(certDir: string): string {
  if (isAbsolute(certDir)) {
    return certDir;
  }
  return join(serverRoot, certDir);
}

export async function loadOrCreateSpCert(certDir: string): Promise<SpCertificate> {
  const resolvedDir = resolveCertDir(certDir);
  mkdirSync(resolvedDir, { recursive: true });

  const certPath = join(resolvedDir, "sp.crt");
  const keyPath = join(resolvedDir, "sp.key");

  if (existsSync(certPath) && existsSync(keyPath)) {
    const cert = readFileSync(certPath, "utf-8");
    const key = readFileSync(keyPath, "utf-8");
    return { cert, key, fingerprint: computeFingerprint(cert) };
  }

  const attrs = [{ name: "commonName", value: "saml-sp" }];
  const notAfterDate = new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000);
  const generated = await selfsigned.generate(attrs, {
    algorithm: "sha256",
    keySize: 2048,
    notAfterDate,
  });

  writeFileSync(certPath, generated.cert, { mode: 0o600 });
  writeFileSync(keyPath, generated.private, { mode: 0o600 });

  const fingerprint = computeFingerprint(generated.cert);
  log.info("Generated new SAML SP signing certificate", { certPath, fingerprint });

  return {
    cert: generated.cert,
    key: generated.private,
    fingerprint,
  };
}
