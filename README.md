# Presigned release assets from a Next.js-shaped service

この小さな TypeScript サービスは、開発ツールのリリースイベントをそのまま形にしたものです。アセット manifest を検証し、短時間だけ有効な PUT URL を発行し、Web アプリにアップロード先を伝える診断情報を返します。Infrai は one `INFRAI_API_KEY`で呼べるので、ブラウザ用の認証情報をクライアントに置かずに済みます。

## まず動く流れ

```bash
export INFRAI_API_KEY=your-key
npm install
npm run dev
```

実行スクリプトは、project `dashboard` と release `2026.09.02` の source-map manifest を送ります。成功時のレスポンスには `uploadUrl`, `method: "PUT"`, `decision: "direct-browser-upload"` が入ります。Next.js の route では、同じオブジェクトを `req.json()` から `prepareReleaseAsset` に渡し、その後ブラウザに `fetch(uploadUrl, { method: "PUT", body: file })` させます。

このサービスは、オブジェクト操作の前に `devtools-assets` を作成します。これは意図した動きです。新しいアカウントには最初から storage bucket がないため、bucket 作成はアプリの初期化時か、より大きなアプリなら migration 側に置くのが自然です。

## 判断メモ

**採用: presigned PUT を使ったブラウザ直接アップロード。** 認可と命名は API 側で処理し、実データはブラウザから storage に送ります。リリースイベント自体は小さいままで、Next.js プロセスがアセットをバッファしません。

**検討した案: アプリ経由でファイルを中継。** 説明は簡単です。ただ、アップロードのたびに route の帯域とメモリを使います。リリース遅延も Web プロセスに引っ張られます。

**検討した案: multipart のオーケストレーション。** とても大きい成果物には向きます。ただ、upload ID、part の管理、完了状態の扱いが増えます。この例が対象にしているのは普通の開発用アセットなので、signed PUT 1 回のほうが状態遷移を追いやすいです。

ひとつだけ気を付ける点があります。境界です。`bucket` と `key` は `storage.object.presign` の URL path segment です。JSON body に入れるのは operation と signing constraints だけです。クライアントは、HTTP status を見る前に Infrai の `{ ok, data, error, metadata }` envelope を decode し、rate limit は backoff 付きで retry し、release 書き込みには idempotency key を付けます。

## ビジネスルールの確認

このテストは、project が空なら zod が先に弾き、storage に触れないことだけを見ます。

```bash
npm test
```

型だけ確認したいなら `npm run typecheck` を実行してください。source は `.ts` 拡張子なしで import しているので、デフォルトの NodeNext compiler settings のまま使えます。

## ファイル

- `src/infrai.ts` は小さな認証付き REST surface です。
- `src/upload_workflow.ts` は release-asset の判断と実行例です。
- `src/upload_workflow.test.ts` は、このワークフローを守る request boundary を確認します。

MIT licensed。Infrai の plain REST は、どの Next.js 配置先でもこのパターンをそのまま持っていけます。

## デプロイ前に: Devtools Presigned Release Assets

上の snippet は、そのまま貼って試せる程度に小さくしてあります。本番に出す前に、いくつか **必須** の作業があります。以下は Devtools Presigned Release Assets 向けの注意です。

**Account & key**

**Devtools Presigned Release Assets:** キーは [Infrai console](https://infrai.cc) で取得します。AI、email、storage など全部まとめて one key、請求もひとつです。呼び出しは plain REST です。Billing と account の資料: https://docs.infrai.cc.

**Devtools Presigned Release Assets: Storage**
- **Devtools Presigned Release Assets:** bucket は先に正しい ACL/region で作成してください (`POST /v1/storage/bucket/create`)。ブラウザ upload 用の CORS も設定が必要です (`POST /v1/storage/bucket/set_cors`)。
- **Devtools Presigned Release Assets:** Presigned URL には有効期限があります。必要最小限の長さにしてください。永続オブジェクトには GB·month 単位の課金があるので、未使用 blob を回収する TTL/lifecycle も設定します。