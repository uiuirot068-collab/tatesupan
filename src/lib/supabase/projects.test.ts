import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * TSP-SAFE-002 (TSP-REVIEW-001 3の4・3の5): the cloud side of saving.
 * A small stand-in for the Supabase client keeps a `projects` table with the
 * production behaviour that matters here: rows of other users are invisible
 * (RLS), and the projects_set_updated_at trigger sets updated_at to the
 * database's own clock on every update.
 */

type Row = { id: string; user_id: string; title: string; content: string; settings: unknown; created_at: string; updated_at: string };

const state = {
  rows: [] as Row[],
  user: { id: "me" } as { id: string } | null,
  authError: null as { message: string; name?: string } | null,
  readError: null as { message: string } | null,
  clock: 0,
  rlsOff: false,
};

function nextTime(): string {
  state.clock += 1;
  return new Date(Date.UTC(2026, 9, 17, 0, 0, 0, state.clock)).toISOString().replace("Z", "123+00:00");
}

class Query {
  private filters: Array<(row: Row) => boolean> = [];
  constructor(private op: "select" | "update", private patch?: Partial<Row>) {}
  eq(column: keyof Row, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  is(column: keyof Row, value: null) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  private visible(): Row[] {
    // RLS: only the signed-in user's rows exist for this client (unless a
    // test turns it off to check the app's own filter).
    return state.rows.filter(
      (row) => (state.rlsOff || (state.user && row.user_id === state.user.id)) && this.filters.every((f) => f(row))
    );
  }
  select() {
    if (this.op === "update") {
      const hit = this.visible();
      for (const row of hit) Object.assign(row, this.patch, { updated_at: nextTime() });
      return Promise.resolve({ data: hit.map((row) => ({ ...row })), error: null });
    }
    return this;
  }
  order() {
    return Promise.resolve({ data: this.visible().map((row) => ({ ...row })), error: null });
  }
  maybeSingle() {
    if (state.readError) return Promise.resolve({ data: null, error: state.readError });
    const hit = this.visible();
    return Promise.resolve({ data: hit[0] ? { ...hit[0] } : null, error: null });
  }
}

vi.mock("./client", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: state.authError ? null : state.user }, error: state.authError }),
    },
    from: () => ({
      select: () => new Query("select"),
      update: (patch: Partial<Row>) => new Query("update", patch),
    }),
  }),
}));

const { getProjectsResult, lookupProject, updateProject, CLOUD_PROJECT_CHANGED_ERROR, CLOUD_PROJECT_MISSING_ERROR } = await import("./projects");

function seed(id: string, content: string, user_id = "me"): Row {
  const row: Row = { id, user_id, title: "題", content, settings: {}, created_at: nextTime(), updated_at: nextTime() };
  state.rows.push(row);
  return { ...row };
}

beforeEach(() => {
  state.rows = [];
  state.user = { id: "me" };
  state.authError = null;
  state.readError = null;
  state.rlsOff = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("lookupProject: could not read ≠ deleted (3の5)", () => {
  it("finds the user's own work", async () => {
    seed("p1", "本文");
    const found = await lookupProject("p1");
    expect(found.status).toBe("found");
  });

  it("says missing only when signed in, the read worked, and there is no such work", async () => {
    expect(await lookupProject("gone")).toEqual({ status: "missing" });
  });

  it("a network error is unreachable, not missing", async () => {
    seed("p1", "本文");
    state.readError = { message: "TypeError: Failed to fetch" };
    expect(await lookupProject("p1")).toMatchObject({ status: "unreachable", loggedOut: false });
  });

  it("a lost login is unreachable (signed out), not missing — RLS would hide the row", async () => {
    seed("p1", "本文");
    state.authError = { message: "Auth session missing!", name: "AuthSessionMissingError" };
    expect(await lookupProject("p1")).toMatchObject({ status: "unreachable", loggedOut: true });
  });

  it("an auth request that failed on the network is not reported as signed out", async () => {
    state.authError = { message: "Failed to fetch", name: "AuthRetryableFetchError" };
    expect(await lookupProject("p1")).toMatchObject({ status: "unreachable", loggedOut: false });
  });

  it("another user's work is missing for this user", async () => {
    seed("theirs", "本文", "someone-else");
    expect(await lookupProject("theirs")).toEqual({ status: "missing" });
  });
});

describe("updateProject: the database checks the version it overwrites (3の4)", () => {
  it("overwrites when the cloud is still at the version that was read", async () => {
    const read = seed("p1", "前");
    const result = await updateProject("p1", { title: "題", content: "後", settings: {} as never }, read.updated_at);
    expect(result.error).toBeNull();
    expect(result.data?.content).toBe("後");
    expect(result.data?.updated_at).not.toBe(read.updated_at);
  });

  it("refuses when another device saved after the read, and keeps that device's text", async () => {
    const read = seed("p1", "前");
    // another device saves between our read and our write
    await updateProject("p1", { title: "題", content: "別の端末", settings: {} as never }, read.updated_at);
    const result = await updateProject("p1", { title: "題", content: "この端末", settings: {} as never }, read.updated_at);
    expect(result).toEqual({ data: null, error: CLOUD_PROJECT_CHANGED_ERROR });
    expect(state.rows[0].content).toBe("別の端末");
  });

  it("a write that changed no row is never a success: deleted meanwhile", async () => {
    const read = seed("p1", "前");
    state.rows = [];
    const result = await updateProject("p1", { title: "題", content: "後", settings: {} as never }, read.updated_at);
    expect(result).toEqual({ data: null, error: CLOUD_PROJECT_MISSING_ERROR });
  });

  it("cannot overwrite another user's work", async () => {
    const theirs = seed("theirs", "前", "someone-else");
    const result = await updateProject("theirs", { title: "題", content: "後", settings: {} as never }, theirs.updated_at);
    expect(result.data).toBeNull();
    expect(state.rows[0].content).toBe("前");
  });

  it("signed out: not saved, and says so", async () => {
    const read = seed("p1", "前");
    state.authError = { message: "Auth session missing!", name: "AuthSessionMissingError" };
    const result = await updateProject("p1", { title: "題", content: "後", settings: {} as never }, read.updated_at);
    expect(result.data).toBeNull();
    expect(result.error).toMatch(/Auth session missing/);
    expect(state.rows[0].content).toBe("前");
  });
});

describe("getProjectsResult: the list asks for this user's works itself (3の6)", () => {
  it("even with the database's row security off, another user's works are not listed", async () => {
    seed("mine", "本文");
    seed("theirs", "本文", "someone-else");
    state.rlsOff = true;
    const { data } = await getProjectsResult();
    expect(data.map((row) => row.id)).toEqual(["mine"]);
  });

  it("signed out: an empty list and a reason", async () => {
    state.authError = { message: "Auth session missing!", name: "AuthSessionMissingError" };
    expect(await getProjectsResult()).toEqual({ data: [], error: "Auth session missing!" });
  });
});
