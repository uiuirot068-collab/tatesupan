import { describe, expect, it } from "vitest";
import { referencedImages, ReusablePreviewWorker, type PreviewWorkerLike, type PreviewWorkerOutcome } from "./previewWorkerClient";
import { prepareImageResolver, type ImageResolutionCache } from "./imageResolverAdapter";

/** Phase 7 worker reuse contract, with a fake worker (no timing assertions). */
class FakeWorker implements PreviewWorkerLike {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: Array<{ type: string; requestId: number; input: unknown }> = [];
  terminated = false;
  postMessage(message: unknown) {
    this.posted.push(message as { type: string; requestId: number; input: unknown });
  }
  terminate() {
    this.terminated = true;
  }
  reply(data: Record<string, unknown>) {
    this.onmessage?.({ data } as MessageEvent);
  }
  crash(message = "boom") {
    this.onerror?.({ message } as ErrorEvent);
  }
  get lastRequestId() {
    return this.posted.at(-1)!.requestId;
  }
}

function setup() {
  const workers: FakeWorker[] = [];
  const client = new ReusablePreviewWorker(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  const outcomes: PreviewWorkerOutcome[] = [];
  const request = (input: unknown) => client.request(input, (outcome) => outcomes.push(outcome));
  return { client, workers, outcomes, request };
}

describe("ReusablePreviewWorker", () => {
  it("reuses an idle worker across compositions (one worker, many layouts)", () => {
    const { client, workers, outcomes, request } = setup();
    for (let i = 0; i < 5; i++) {
      request({ content: `v${i}` });
      workers[0].reply({ type: "complete", requestId: workers[0].lastRequestId, value: i });
    }
    expect(client.workersCreated).toBe(1);
    expect(workers[0].terminated).toBe(false);
    expect(outcomes.map((o) => (o.ok ? o.reply.value : null))).toEqual([0, 1, 2, 3, 4]);
  });

  it("request ids increase monotonically and are sent with the input", () => {
    const { workers, request } = setup();
    request({ a: 1 });
    workers[0].reply({ type: "complete", requestId: 1 });
    request({ a: 2 });
    expect(workers[0].posted.map((m) => [m.type, m.requestId])).toEqual([["compose", 1], ["compose", 2]]);
  });

  it("a newer request while one is composing terminates that worker; the stale reply can never land", () => {
    const { client, workers, outcomes, request } = setup();
    request({ content: "old" });
    const staleWorker = workers[0];
    const staleId = staleWorker.lastRequestId;
    request({ content: "new" });
    expect(staleWorker.terminated).toBe(true);
    expect(client.workersCreated).toBe(2);
    staleWorker.reply({ type: "complete", requestId: staleId, value: "OLD" }); // late message from the dead worker
    workers[1].reply({ type: "complete", requestId: staleId, value: "OLD-ID" }); // wrong id on the new worker
    expect(outcomes).toHaveLength(0);
    workers[1].reply({ type: "complete", requestId: workers[1].lastRequestId, value: "NEW" });
    expect(outcomes).toEqual([{ ok: true, reply: expect.objectContaining({ value: "NEW" }) }]);
  });

  it("a cancelled request (effect cleanup, e.g. document switch) is never delivered", () => {
    const { workers, outcomes, request } = setup();
    const cancel = request({ content: "document A" });
    cancel();
    workers[0].reply({ type: "complete", requestId: workers[0].lastRequestId });
    expect(outcomes).toHaveLength(0);
  });

  it("never reuses a worker that reported an error; the next request gets a fresh one", () => {
    const { client, workers, outcomes, request } = setup();
    request({ content: "x" });
    workers[0].reply({ type: "error", requestId: workers[0].lastRequestId, message: "HOLD" });
    expect(outcomes).toEqual([{ ok: false, message: "HOLD" }]);
    expect(workers[0].terminated).toBe(true);
    request({ content: "y" });
    expect(client.workersCreated).toBe(2);
    expect(workers[1].posted).toHaveLength(1);
  });

  it("a crashed worker fails the in-flight request and is replaced", () => {
    const { client, workers, outcomes, request } = setup();
    request({ content: "x" });
    workers[0].crash("worker died");
    expect(outcomes).toEqual([{ ok: false, message: "worker died" }]);
    request({ content: "y" });
    expect(client.workersCreated).toBe(2);
  });

  it("dispose (unmount) terminates the worker and drops the in-flight reply; StrictMode re-setup recreates lazily", () => {
    const { client, workers, outcomes, request } = setup();
    request({ content: "x" });
    const id = workers[0].lastRequestId;
    client.dispose();
    expect(workers[0].terminated).toBe(true);
    workers[0].reply({ type: "complete", requestId: id });
    expect(outcomes).toHaveLength(0);
    request({ content: "after remount" });
    expect(client.workersCreated).toBe(2);
    workers[1].reply({ type: "complete", requestId: workers[1].lastRequestId, value: "ok" });
    expect(outcomes).toHaveLength(1);
  });
});

describe("referencedImages: the worker receives only this manuscript's images", () => {
  const pool: Record<string, string> = {};
  for (let i = 0; i < 100; i++) pool[`img${i}`] = `data:image/png;base64,${i}`;

  it("keeps referenced ids that exist in the pool, nothing else", () => {
    const content = "本文【IMG:img3:40:30:center】本文【IMG:img42:10:10】【IMG:img3:40:30:top】【IMG:missing:1:1】";
    expect(referencedImages(pool, content)).toEqual({ img3: pool.img3, img42: pool.img42 });
  });

  it("text without markers sends no images", () => {
    expect(referencedImages(pool, "本文だけ")).toEqual({});
  });

  it("an id that is an Object.prototype key is not invented", () => {
    expect(referencedImages({}, "【IMG:constructor:1:1】【IMG:toString:1:1】")).toEqual({});
  });
});

describe("prepareImageResolver: robustness and per-worker decode cache", () => {
  it("malformed base64 is ONE corrupt image, not a failure of the whole layout", async () => {
    const resolve = await prepareImageResolver({ bad: "data:image/png;base64,%%%not-base64%%%", svg: "data:image/svg+xml;base64,PHN2Zz4=" });
    expect(resolve("bad")).toEqual({ kind: "CORRUPT" });
    expect(resolve("svg")).toMatchObject({ kind: "UNSUPPORTED_FORMAT", detectedFormat: "image/svg+xml" });
    expect(resolve("absent")).toEqual({ kind: "MISSING" });
  });

  it("reuses a cached resolution for an unchanged data URL and evicts ids no longer sent", async () => {
    const cache: ImageResolutionCache = new Map();
    const first = await prepareImageResolver({ a: "data:image/png;base64,%%", b: "data:image/gif;base64,R0lG" }, cache);
    const second = await prepareImageResolver({ a: "data:image/png;base64,%%" }, cache);
    expect(second("a")).toBe(first("a")); // same object: not re-parsed
    expect([...cache.keys()]).toEqual(["a"]);
    const changed = await prepareImageResolver({ a: "data:image/gif;base64,R0lG" }, cache);
    expect(changed("a")).toMatchObject({ kind: "UNSUPPORTED_FORMAT" }); // new data URL → recomputed
  });
});
