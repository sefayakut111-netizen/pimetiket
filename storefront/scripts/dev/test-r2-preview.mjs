#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env.agent"]) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const key =
  process.argv[2] ||
  "customer-cutlines/260520265554/488eff38-96f9-4fb0-986d-b531fd34bd25/1779821763127-preview.png";

const { S3Client, HeadObjectCommand, GetObjectCommand } = await import(
  "@aws-sdk/client-s3"
);
const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

const bucket = process.env.R2_BUCKET ?? "pim-etiket-archive";
const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  forcePathStyle: true,
});

try {
  const head = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key })
  );
  console.log("R2 OK:", head.ContentLength, "bytes", head.ContentType);

  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 60 }
  );
  const res = await fetch(url);
  console.log("Signed URL fetch:", res.status, res.headers.get("content-type"));
} catch (e) {
  console.error("R2 FAIL:", e.message);
}
