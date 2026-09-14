// TSP-SUPABASE-CUTOVER-GATE-001
// Read-only pre-deploy audit for a Supabase backend ref change.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditCutover } from "./lib/supabase-cutover-audit.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CURRENT_CANONICAL_REF = "rgvqquuthovqjqfogfra";
const REF_RE = /^[a-z0-9]{20}$/;
const PAGE_SIZE = 1000;
const REQUEST_TIMEOUT_MS = 30000;

class GateFailure extends Error {
  constructor(code) {
    super(code);
    this.name = "GateFailure";
    this.code = code;
  }
}

function readEnvLocalVar(name) {
  const envPath = path.join(repoRoot, ".env.local");
  if (!fs.existsSync(envPath)) return "";
  const pattern = new RegExp(`^\\s*${name}\\s*=`);
  const line = fs.readFileSync(envPath, "utf8").split(/\r?\n/).find((entry) => pattern.test(entry));
  return line ? line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "") : "";
}

export function refFromUrl(url) {
  return (url.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/i) ?? [])[1]?.toLowerCase() ?? "";
}

function requiredSecret(env, name) {
  const value = (env[name] ?? "").trim();
  if (!value || value.startsWith("your-")) throw new GateFailure(`MISSING_${name}`);
  return value;
}

function loadManifest(manifestPath, sourceRef, destinationRef) {
  try {
    const absolutePath = path.resolve(repoRoot, manifestPath);
    const stat = fs.statSync(absolutePath);
    if (!stat.isFile() || stat.size > 5 * 1024 * 1024) throw new GateFailure("MANIFEST_INVALID");
    const manifest = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
    if (manifest.sourceRef !== sourceRef || manifest.destinationRef !== destinationRef) {
      throw new GateFailure("MANIFEST_DIRECTION_MISMATCH");
    }
    return manifest;
  } catch (error) {
    if (error instanceof GateFailure) throw error;
    throw new GateFailure("MANIFEST_UNREADABLE");
  }
}

async function loadProjectSnapshot(ref, adminKey, side) {
  let createClient;
  try {
    ({ createClient } = await import("@supabase/supabase-js"));
  } catch {
    throw new GateFailure("SUPABASE_CLIENT_UNAVAILABLE");
  }

  const fetchWithTimeout = async (input, init = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const upstreamSignal = init.signal;
    const abortFromUpstream = () => controller.abort();
    upstreamSignal?.addEventListener?.("abort", abortFromUpstream, { once: true });
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
      upstreamSignal?.removeEventListener?.("abort", abortFromUpstream);
    }
  };

  const client = createClient(`https://${ref}.supabase.co`, adminKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { fetch: fetchWithTimeout },
  });
  const users = [];
  const projects = [];

  try {
    for (let page = 1; ; page += 1) {
      if (page > 100000) throw new GateFailure(`${side}_AUTH_PAGINATION_LIMIT`);
      const { data, error } = await client.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
      if (error || !Array.isArray(data?.users)) throw new GateFailure(`${side}_AUTH_READ_FAILED`);
      users.push(...data.users.map((user) => ({ id: user.id, email: user.email ?? "" })));
      if (data.users.length < PAGE_SIZE) break;
    }

    let expectedProjectCount = null;
    for (let from = 0; ; from += PAGE_SIZE) {
      if (from > 100000000) throw new GateFailure(`${side}_PROJECT_PAGINATION_LIMIT`);
      const { data, error, count } = await client
        .from("projects")
        .select("id,user_id,content,settings", { count: "exact" })
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error || !Array.isArray(data) || !Number.isSafeInteger(count)) {
        throw new GateFailure(`${side}_PROJECT_READ_FAILED`);
      }
      if (expectedProjectCount === null) expectedProjectCount = count;
      if (count !== expectedProjectCount) throw new GateFailure(`${side}_PROJECT_CHANGED_DURING_READ`);
      projects.push(...data);
      if (projects.length >= expectedProjectCount) break;
      if (data.length === 0) throw new GateFailure(`${side}_PROJECT_PAGINATION_INCOMPLETE`);
    }
    if (projects.length !== expectedProjectCount) throw new GateFailure(`${side}_PROJECT_COUNT_MISMATCH`);
  } catch (error) {
    if (error instanceof GateFailure) throw error;
    throw new GateFailure(`${side}_COMPARISON_FAILED`);
  }

  return { users, projects };
}

function printAuditResult(result) {
  console.log(`source counts: auth=${result.source.authUsers}, projects=${result.source.projects}`);
  console.log(`destination counts: auth=${result.destination.authUsers}, projects=${result.destination.projects}`);
  console.log(`manifest mappings: identities=${result.mappedIdentities}, projects=${result.mappedProjects}`);
  console.log(`approved destination-only baseline: ${result.allowedDestinationOnlyProjects}`);
  if (result.ok) {
    console.log("PASS: Supabase cutover audit found no unsafe differences.");
    return;
  }
  for (const item of result.issues) console.error(`FAIL: ${item.code} (${item.subject})`);
  console.error(`FAIL: Supabase cutover audit found ${result.issues.length} unsafe difference(s).`);
}

export async function runCutoverGate({
  env = process.env,
  argv = process.argv.slice(2),
  snapshotLoader = loadProjectSnapshot,
  manifestLoader = loadManifest,
} = {}) {
  const candidateUrl = (env.NEXT_PUBLIC_SUPABASE_URL || readEnvLocalVar("NEXT_PUBLIC_SUPABASE_URL") || "").trim();
  const candidateRef = refFromUrl(candidateUrl);
  const explicitDeployedRef = (env.TATESPUN_DEPLOYED_SUPABASE_REF ?? "").trim().toLowerCase();
  const deployedRef = explicitDeployedRef || CURRENT_CANONICAL_REF;
  const dryRun = argv.includes("--dry-run");

  if (!candidateRef) throw new GateFailure("CANDIDATE_REF_INVALID");
  if (!REF_RE.test(deployedRef)) throw new GateFailure("DEPLOYED_REF_INVALID");

  console.log(`Supabase cutover gate: ${dryRun ? "DRY RUN / READ ONLY" : "READ ONLY"}`);
  console.log(`deployed ref: ${deployedRef}`);
  console.log(`candidate ref: ${candidateRef}`);

  if (candidateRef === deployedRef) {
    console.log("PASS: backend ref unchanged; cross-database audit skipped.");
    return { skipped: true, ok: true };
  }

  if (!explicitDeployedRef) throw new GateFailure("DEPLOYED_REF_REQUIRED_FOR_CUTOVER");
  const manifestPath = (env.TATESPUN_CUTOVER_MANIFEST_PATH ?? "").trim();
  if (!manifestPath) throw new GateFailure("CUTOVER_MANIFEST_REQUIRED");
  const sourceKey = requiredSecret(env, "TATESPUN_CUTOVER_SOURCE_ADMIN_KEY");
  const destinationKey = requiredSecret(env, "TATESPUN_CUTOVER_DESTINATION_ADMIN_KEY");
  const manifest = manifestLoader(manifestPath, deployedRef, candidateRef);

  const [source, destination] = await Promise.all([
    snapshotLoader(deployedRef, sourceKey, "SOURCE"),
    snapshotLoader(candidateRef, destinationKey, "DESTINATION"),
  ]);

  let result;
  try {
    result = auditCutover({
      sourceRef: deployedRef,
      destinationRef: candidateRef,
      source,
      destination,
      manifest,
    });
  } catch {
    throw new GateFailure("COMPARISON_UNAVAILABLE");
  }
  printAuditResult(result);
  if (!result.ok) throw new GateFailure("UNSAFE_CUTOVER_DIFF");
  return { skipped: false, ok: true, result };
}

async function main() {
  try {
    await runCutoverGate();
  } catch (error) {
    const code = error instanceof GateFailure ? error.code : "UNEXPECTED_AUDIT_FAILURE";
    console.error(`FAIL CLOSED: ${code}. No content, settings, email, or secret values were logged.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
