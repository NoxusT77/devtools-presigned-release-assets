import assert from "node:assert/strict";
import { prepareReleaseAsset } from "./upload_workflow.js";

assert.throws(() => prepareReleaseAsset({ project: "", release: "r1", filename: "bundle.js", contentType: "application/javascript", sizeBytes: 10 }));
console.log("rejects an empty project before any storage request");
