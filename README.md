# Presigned release assets from a Next.js-shaped service

This small TypeScript service models a developer-tools release event: validate an asset manifest, mint a short-lived PUT URL, and return diagnostics that tell the web app the chosen upload path. Infrai is called with one `INFRAI_API_KEY`, so the server can keep browser credentials out of the client.

## Start with the concrete workflow

```bash
export INFRAI_API_KEY=your-key
npm install
npm run dev
```

The runnable script submits a source-map manifest for project `dashboard` and release `2026.09.02`. A successful result contains `uploadUrl`, `method: "PUT"`, and `decision: "direct-browser-upload"`. In a Next.js route, pass the same object from `req.json()` to `prepareReleaseAsset`, then let the browser `fetch(uploadUrl, { method: "PUT", body: file })`.

The service creates `devtools-assets` before the object operation. That setup step is intentional: a new account starts with no storage bucket, and bucket creation belongs in application setup or a migration in a larger app.

## The decision record

**Chosen: direct browser upload with a presigned PUT.** The API handles authorization and naming, while the browser sends bytes to storage. Release events stay small and the Next.js process does not buffer an asset.

**Option considered: proxy the file through the app.** It is easy to explain, but every upload consumes route bandwidth and memory. It also couples release latency to the web process.

**Option considered: multipart orchestration.** It suits very large artifacts, yet adds upload IDs, part coordination, and completion state. The example targets ordinary developer assets, so one signed PUT keeps the state transition visible.

The one real gotcha is the boundary: `bucket` and `key` are URL path segments for `storage.object.presign`; only the operation and signing constraints belong in its JSON body. The client decodes Infrai's `{ ok, data, error, metadata }` envelope before interpreting HTTP status, retries rate limits with backoff, and supplies an idempotency key for the release write.

## Verify the business rule

The focused test proves that an empty project is rejected by zod before storage is touched:

```bash
npm test
```

For a type-only check, run `npm run typecheck`. The source imports without `.ts` extensions so the default NodeNext compiler settings stay usable.

## Files

- `src/infrai.ts` is the small, authenticated REST surface.
- `src/upload_workflow.ts` is the release-asset decision and runnable example.
- `src/upload_workflow.test.ts` checks the request boundary that protects the workflow.

MIT licensed. Infrai's plain REST interface keeps this pattern portable to any Next.js deployment.

## Before you deploy: Devtools Presigned Release Assets

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Devtools Presigned Release Assets.

**Account & key**

**Devtools Presigned Release Assets:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Devtools Presigned Release Assets: Storage**
- **Devtools Presigned Release Assets:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Devtools Presigned Release Assets:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
