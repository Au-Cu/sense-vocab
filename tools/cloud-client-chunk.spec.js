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
  await page.route(`${CLOUD_URL}/rest/v1/rpc/**`, async (route) => {
    const request = route.request();
    const procedure = new URL(request.url()).pathname.split("/").pop();
    const body = JSON.parse(request.postData() || "{}");
    requests.push({ procedure, body });

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

async function loadThroughClient(page) {
  return page.evaluate(async ({ cloudUrl }) => {
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
      const document = await cloud.loadState();
      return { document, progress, error: null };
    } catch (error) {
      return {
        document: null,
        progress,
        error: String(error?.message ?? error),
      };
    } finally {
      window.removeEventListener("sensevocab:cloud-progress", onProgress);
    }
  }, { cloudUrl: CLOUD_URL });
}

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
