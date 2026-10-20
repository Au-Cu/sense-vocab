const { test, expect } = require("@playwright/test");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:4173/";
const CLOUD_URL = "https://chunk-test.supabase.co";

test.use({
  launchOptions: {
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  },
  viewport: { width: 1100, height: 850 },
});

function makeEnvelope() {
  const document = JSON.stringify({
    found: true,
    revision: 7,
    updatedAt: "2026-10-02T00:00:00.000Z",
    state: {
      activeBookId: "kaoyan",
      progress: { alpha: { interval: 3, mastery: 2 } },
    },
  });
  const splitAt = Math.ceil(document.length / 2);
  const chunks = [document.slice(0, splitAt), document.slice(splitAt)];
  return {
    document,
    chunks,
    bytes: Buffer.byteLength(document, "utf8"),
  };
}

async function installChunkRoutes(page, envelope, options = {}) {
  const requests = [];
  let staleReturned = false;
  let networkFailures = options.networkFailures ?? 0;
  await page.route(`${CLOUD_URL}/rest/v1/rpc/**`, async (route) => {
    const request = route.request();
    const procedure = new URL(request.url()).pathname.split("/").pop();
    const body = JSON.parse(request.postData() || "{}");
    requests.push({ procedure, body });

    if (networkFailures > 0 && procedure === options.failProcedure &&
        (options.failChunk === undefined || body.p_chunk_index === options.failChunk)) {
      networkFailures -= 1;
      await route.abort("failed");
      if (options.abortOnFailure) {
        await page.evaluate(() => window.__chunkReadController?.abort());
      }
      return;
    }
    if (options.denyChunk === body.p_chunk_index && procedure === "load_user_state_chunk") {
      await route.fulfill({
        status: 403, contentType: "application/json",
        body: JSON.stringify({ code: "42501", message: "permission denied", details: null, hint: null }),
      });
      return;
    }

    if (procedure === "load_user_state_manifest") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ found: true, revision: 7, bytes: envelope.bytes }),
      });
      return;
    }

    if (procedure === "load_user_state") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          found: true,
          revision: 7,
          updatedAt: "2026-10-02T00:00:00.000Z",
          state: null,
          chunked: true,
          chunks: envelope.chunks.length,
          bytes: envelope.bytes,
        }),
      });
      return;
    }

    if (procedure === "load_user_state_chunk") {
      const index = Number(body.p_chunk_index);
      if (options.staleOnce && !staleReturned) {
        staleReturned = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            found: false,
            revision: 8,
            stale: true,
          }),
        });
        return;
      }
      const data = envelope.chunks[index];
      if (data === undefined) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            found: false,
            revision: 7,
            chunkIndex: index,
            chunkCount: envelope.chunks.length,
          }),
        });
        return;
      }
      const declaredBytes = options.badBytes && index === 0
        ? Buffer.byteLength(data, "utf8") + 1
        : Buffer.byteLength(data, "utf8");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          found: true,
          revision: 7,
          chunkIndex: options.badIndex && index === 1 ? 0 : index,
          chunkCount: envelope.chunks.length,
          data,
          bytes: declaredBytes,
        }),
      });
      return;
    }

    await route.continue();
  });
  return requests;
}

async function loadThroughClient(page, { manifest = false, abortable = false } = {}) {
  return page.evaluate(async ({ cloudUrl, manifest, abortable }) => {
    const progress = [];
    const onProgress = (event) => {
      if (event.detail?.operation === "load-state") progress.push(event.detail);
    };
    window.addEventListener("sensevocab:cloud-progress", onProgress);
    try {
      const cloud = window.SenseVocabCloud.create({
        supabaseUrl: cloudUrl,
        supabaseAnonKey: "test-anon-key",
      });
      const controller = abortable ? new AbortController() : null;
      window.__chunkReadController = controller;
      const metadata = manifest ? await cloud.loadStateManifest(controller?.signal) : null;
      const document = await cloud.loadState(controller?.signal, metadata?.bytes);
      return { document, progress, error: null };
    } catch (error) {
      return {
        document: null,
        progress,
        error: String(error?.message ?? error),
        errorName: error?.name,
      };
    } finally {
      window.removeEventListener("sensevocab:cloud-progress", onProgress);
      delete window.__chunkReadController;
    }
  }, { cloudUrl: CLOUD_URL, manifest, abortable });
}

test("retries only a transiently failed read chunk without restarting the download", async ({ page }) => {
  const envelope = makeEnvelope();
  const requests = await installChunkRoutes(page, envelope, {
    failProcedure: "load_user_state_chunk", failChunk: 1, networkFailures: 1,
  });
  await page.goto(APP_URL);
  const result = await loadThroughClient(page);
  expect(result.error).toBeNull();
  expect(result.document).toEqual(JSON.parse(envelope.document));
  expect(requests.map(({ procedure, body }) => [procedure, body.p_chunk_index])).toEqual([
    ["load_user_state", undefined],
    ["load_user_state_chunk", 0],
    ["load_user_state_chunk", 1],
    ["load_user_state_chunk", 1],
  ]);
  expect(result.progress.at(-1)).toMatchObject({ received: envelope.bytes, done: true });
});

test("recovers a transient manifest network failure before reading state", async ({ page }) => {
  const envelope = makeEnvelope();
  const requests = await installChunkRoutes(page, envelope, {
    failProcedure: "load_user_state_manifest", networkFailures: 1,
  });
  await page.goto(APP_URL);
  const result = await loadThroughClient(page, { manifest: true });
  expect(result.error).toBeNull();
  expect(result.document).toEqual(JSON.parse(envelope.document));
  expect(requests.filter(x => x.procedure === "load_user_state_manifest")).toHaveLength(2);
  expect(requests.filter(x => x.procedure === "load_user_state")).toHaveLength(1);
});

test("reports a persistent read network failure without claiming completion", async ({ page }) => {
  const envelope = makeEnvelope();
  const requests = await installChunkRoutes(page, envelope, {
    failProcedure: "load_user_state_chunk", failChunk: 1, networkFailures: 10,
  });
  await page.goto(APP_URL);
  const result = await loadThroughClient(page);
  expect(result.document).toBeNull();
  expect(result.error).toContain("分段 2");
  expect(requests.filter(x => x.body.p_chunk_index === 0)).toHaveLength(1);
  expect(requests.filter(x => x.body.p_chunk_index === 1)).toHaveLength(3);
  expect(result.progress.some(x => x.done && x.received === envelope.bytes)).toBe(false);
});

test("aborts a failed read before another retry can start", async ({ page }) => {
  const envelope = makeEnvelope();
  const requests = await installChunkRoutes(page, envelope, {
    failProcedure: "load_user_state_chunk", failChunk: 1, networkFailures: 10,
    abortOnFailure: true,
  });
  await page.goto(APP_URL);
  const result = await loadThroughClient(page, { abortable: true });
  expect(result.document).toBeNull();
  expect(result.errorName).toBe("AbortError");
  expect(requests.filter(x => x.body.p_chunk_index === 1)).toHaveLength(1);
  expect(result.progress.some(x => x.done && x.received === envelope.bytes)).toBe(false);
});

test("does not retry denied reads or interrupted writes", async ({ page }) => {
  const envelope = makeEnvelope();
  const requests = await installChunkRoutes(page, envelope, {
    denyChunk: 1, failProcedure: "save_user_state_delta", networkFailures: 1,
  });
  await page.goto(APP_URL);
  const denied = await loadThroughClient(page);
  expect(denied.error).toContain("permission denied");
  expect(requests.filter(x => x.body.p_chunk_index === 1)).toHaveLength(1);
  const writeError = await page.evaluate(async ({ cloudUrl }) => {
    const cloud = window.SenseVocabCloud.create({
      supabaseUrl: cloudUrl, supabaseAnonKey: "test-anon-key",
    });
    try {
      await cloud.saveStateDelta({ version: 1, books: {} }, 7);
      return null;
    } catch (error) {
      return String(error?.message ?? error);
    }
  }, { cloudUrl: CLOUD_URL });
  expect(writeError).toContain("Failed to fetch");
  expect(requests.filter(x => x.procedure === "save_user_state_delta")).toHaveLength(1);
});

test("reassembles chunked cloud state and reports byte progress", async ({ page }) => {
  const envelope = makeEnvelope();
  const requests = await installChunkRoutes(page, envelope);
  await page.goto(APP_URL);

  const result = await loadThroughClient(page);

  expect(result.error).toBeNull();
  expect(result.document).toEqual({
    found: true,
    revision: 7,
    updatedAt: "2026-10-02T00:00:00.000Z",
    state: {
      activeBookId: "kaoyan",
      progress: { alpha: { interval: 3, mastery: 2 } },
    },
  });
  expect(requests.map(({ procedure }) => procedure)).toEqual([
    "load_user_state",
    "load_user_state_chunk",
    "load_user_state_chunk",
  ]);
  const completed = result.progress.at(-1);
  expect(completed).toMatchObject({
    received: envelope.bytes,
    total: envelope.bytes,
    done: true,
  });
  expect(result.progress.some((entry) => entry.received > 0 && !entry.done)).toBe(true);
});

test("rejects a chunk with an invalid byte declaration without completing", async ({ page }) => {
  const envelope = makeEnvelope();
  await installChunkRoutes(page, envelope, { badBytes: true });
  await page.goto(APP_URL);

  const result = await loadThroughClient(page);

  expect(result.document).toBeNull();
  expect(result.error).toContain("长度校验失败");
  expect(result.progress.some((entry) => (
    entry.done && entry.received === envelope.bytes && entry.total === envelope.bytes
  ))).toBe(false);
});

test("rejects an out-of-order chunk without completing", async ({ page }) => {
  const envelope = makeEnvelope();
  await installChunkRoutes(page, envelope, { badIndex: true });
  await page.goto(APP_URL);

  const result = await loadThroughClient(page);

  expect(result.document).toBeNull();
  expect(result.error).toContain("无效");
  expect(result.progress.some((entry) => (
    entry.done && entry.received === envelope.bytes && entry.total === envelope.bytes
  ))).toBe(false);
});

test("restarts once when the cloud snapshot changes during chunk loading", async ({ page }) => {
  const envelope = makeEnvelope();
  const requests = await installChunkRoutes(page, envelope, { staleOnce: true });
  await page.goto(APP_URL);

  const result = await loadThroughClient(page);

  expect(result.error).toBeNull();
  expect(result.document?.revision).toBe(7);
  expect(requests.map(({ procedure }) => procedure)).toEqual([
    "load_user_state",
    "load_user_state_chunk",
    "load_user_state",
    "load_user_state_chunk",
    "load_user_state_chunk",
  ]);
});
