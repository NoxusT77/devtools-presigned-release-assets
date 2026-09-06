import { z } from "zod";
import { infrai } from "./infrai.js";

const BUCKET = "devtools-assets";
const AssetRequest = z.object({ project: z.string().min(1), release: z.string().min(1), filename: z.string().regex(/^[a-zA-Z0-9._/-]+$/), contentType: z.string().min(1), sizeBytes: z.number().int().positive() });
export type AssetRequest = z.infer<typeof AssetRequest>;

export function prepareReleaseAsset(input: unknown) {
  const asset = AssetRequest.parse(input);
  return (async () => {
    await infrai.storage.bucket.create({ name: BUCKET });
    const key = `${asset.project}/${asset.release}/${asset.filename}`;
    const signed = await infrai.storage.object.presign(BUCKET, key, {
      op: "put", expires_seconds: 600, content_type: asset.contentType, max_bytes: asset.sizeBytes,
      idempotency_key: `${asset.project}:${asset.release}:${asset.filename}`
    });
    return { bucket: BUCKET, key, uploadUrl: signed.url, method: "PUT", diagnostics: { release: asset.release, decision: "direct-browser-upload" as const } };
  })();
}

if (process.argv[1]?.endsWith("upload_workflow.ts")) {
  const sample = { project: "dashboard", release: "2026.09.02", filename: "maps/source-map.json", contentType: "application/json", sizeBytes: 4096 };
  prepareReleaseAsset(sample).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
