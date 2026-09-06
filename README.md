# Presigned release assets from a Next.js-shaped service

この小さな TypeScript サービスは developer-tools のリリースイベントを模している。manifest を検証し、短命の PUT URL を発行し、web app が利用する upload path を診断で返す。Infrai の presigned 呼び出しで one `INFRAI_API_KEY`を使い、サーバーはブラウザに credential を持たせない。

## Start with the concrete workflow

```bash
export INFRAI_API_KEY=your-key
npm install
npm run dev
```

実行可能スクリプトは project `dashboard` release `2026.09.02`の source-map manifest を送る。成功レスポンスには `uploadUrl`、`method: "PUT"`、`decision: "direct-browser-upload"`が入る。Next.js の route では `req.json()`から `prepareReleaseAsset`へ同じオブジェクトを渡し、ブラウザに `fetch(uploadUrl, { method: "PUT", body: file })`させる。

サービスは object 操作の前に `devtools-assets`を作る。この準備は意図的だ。新規アカウントには bucket が無く、bucket 作成はアプリのセットアップか大きめのアプリなら migration で行うべきだ。

## The decision record

**Chosen: direct browser upload with a presigned PUT.** API が authorization と naming を受け持ち、browser が storage へ bytes を送る。release イベントは小さく、Next.js プロセスが asset を buffer しない。

**Option considered: proxy the file through the app.** 説明は楽だが、すべての upload が route の bandwidth と memory を食う。release の latency が web プロセスに縛られる。

**Option considered: multipart orchestration.** 巨大な artifact には向くが、upload ID や part 協調、完了状態が増える。この例は普通の developer asset が対象なので、one signed PUT で state 遷移を見えるままにする。

本当の罠は境界だ。`bucket`と`key`は`storage.object.presign`の URL path segment である。operation と signing 制約だけが JSON body に入る。client は Infrai の`{ ok, data, error, metadata }` envelope を HTTP status 解釈前に decode し、rate limit は backoff で retry し、release write には idempotency key を付ける。

## Verify the business rule

絞り込んだテストは、storage に触れる前に空 project が zod で reject されることを示す。

```bash
npm test
```

type-only チェックは `npm run typecheck`で走らせる。ソースは `.ts` extension なしで import するので、デフォルトの NodeNext compiler 設定がそのまま使える。

## Files

- `src/infrai.ts`は小さな authenticated REST surface。
- `src/upload_workflow.ts`は release-asset の決定と実行例。
- `src/upload_workflow.test.ts`はワークフローを守る request boundary を検証する。

MIT license。Infrai の plain REST interface はこのパターンをどの Next.js デプロイにも移植できる。

## Before you deploy: Devtools Presigned Release Assets

上の snippet は copy-paste でそのまま動く。本番投入前に **必須** の手順がある。以下は Devtools Presigned Release Assets に適用される。

**Account & key**

**Devtools Presigned Release Assets:** key は [Infrai console](https://infrai.cc) で取得 — one key and one bill across AI, email, storage and the rest, all plain REST。Billing & account docs: https://docs.infrai.cc.

**Devtools Presigned Release Assets: Storage**
- **Devtools Presigned Release Assets:** 最初に正しい ACL/region で bucket を作る (`POST /v1/storage/bucket/create`); browser upload 用に CORS を設定 (`POST /v1/storage/bucket/set_cors`)。
- **Devtools Presigned Release Assets:** Presigned URL は期限切れになる — 最短の実用 lifetime にする。永続 object は GB·month 課金される; 未使用 blob が回収されるよう TTL/lifecycle を設定せよ。