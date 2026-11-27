#!/usr/bin/env node
"use strict";
const fs = require("fs");
const raw = fs.readFileSync(process.argv[2], "utf8");
const klass = process.argv[3];
const principal = process.argv[4];
let i = 0;
const ws = () => { while (/\s/.test(raw[i])) i++; };
const string = () => {
  const start = i++;
  for (; i < raw.length; i++) {
    if (raw[i] === "\\") i++;
    else if (raw[i] === '"') { i++; return JSON.parse(raw.slice(start, i)); }
  }
  throw Error("unterminated string");
};
const value = () => {
  ws();
  if (raw[i] === "{") {
    i++; const seen = new Set(); ws();
    if (raw[i] === "}") { i++; return; }
    for (;;) {
      ws(); if (raw[i] !== '"') throw Error("object key");
      const key = string(); if (seen.has(key)) throw Error("duplicate key"); seen.add(key);
      ws(); if (raw[i++] !== ":") throw Error("colon"); value(); ws();
      if (raw[i] === ",") { i++; continue; }
      if (raw[i++] !== "}") throw Error("object end"); return;
    }
  }
  if (raw[i] === "[") {
    i++; ws(); if (raw[i] === "]") { i++; return; }
    for (;;) { value(); ws(); if (raw[i] === ",") { i++; continue; } if (raw[i++] !== "]") throw Error("array end"); return; }
  }
  if (raw[i] === '"') { string(); return; }
  const start = i; while (i < raw.length && !/[\s,}\]]/.test(raw[i])) i++;
  if (start === i) throw Error("value");
};
value(); ws(); if (i !== raw.length) throw Error("trailing");
const x = JSON.parse(raw);
const uuid = v => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const jobId = v => uuid(v) || /^c[a-z0-9]{24}$/i.test(v);
const keys = Object.keys(x).sort().join(",");
const base = "attemptId,backupClass,generation,jobId,leaseId,outcome,principalId,recordedAt,resultIdempotencyKey,state";
const success = "attemptId,backupClass,canonicalStorageKey,generation,jobId,leaseId,localSetId,manifestSha256,outcome,principalId,recordedAt,resultIdempotencyKey,state";
const successfulEnvelope = x.outcome === "succeeded" && typeof x.localSetId === "string" && /^[0-9]{8}T[0-9]{6}Z-(daily|weekly|monthly)$/.test(x.localSetId) && typeof x.canonicalStorageKey === "string" && /^backup-canonical\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(x.canonicalStorageKey) && !x.canonicalStorageKey.includes("..") && !x.canonicalStorageKey.includes("\\") && typeof x.manifestSha256 === "string" && /^[a-f0-9]{64}$/i.test(x.manifestSha256);
if (!([base, success].includes(keys)) || !jobId(x.jobId) || !uuid(x.leaseId) || !uuid(x.attemptId) || !Number.isInteger(x.generation) || x.generation < 1 || x.backupClass !== klass || x.principalId !== principal || x.resultIdempotencyKey !== x.attemptId || !["succeeded", "uncertain", "failed"].includes(x.outcome) || typeof x.state !== "string" || typeof x.recordedAt !== "string" || (x.outcome === "succeeded" ? !successfulEnvelope : keys !== base)) process.exit(64);
process.stdout.write(JSON.stringify(x));
