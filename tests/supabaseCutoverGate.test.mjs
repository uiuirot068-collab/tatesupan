import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  auditCutover,
  emailSha256,
  projectSignature,
} from "../scripts/lib/supabase-cutover-audit.mjs";
import { runCutoverGate } from "../scripts/verify-supabase-cutover.mjs";

const SOURCE_REF = "aaaaaaaaaaaaaaaaaaaa";
const DESTINATION_REF = "bbbbbbbbbbbbbbbbbbbb";
const SOURCE_USER = "11111111-1111-4111-8111-111111111111";
const DESTINATION_USER = "22222222-2222-4222-8222-222222222222";
const OTHER_DESTINATION_USER = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_PROJECT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EMAIL = " Writer@Example.COM ";
const CONTENT = "sensitive manuscript fixture";

function baseFixture() {
  const sourceProject = {
    id: PROJECT_ID,
    user_id: SOURCE_USER,
    content: CONTENT,
    settings: { page: { lines: 20, chars: 40 }, vertical: true },
  };
  const destinationProject = {
    ...sourceProject,
    user_id: DESTINATION_USER,
    settings: { vertical: true, page: { chars: 40, lines: 20 } },
  };
  return {
    source: { users: [{ id: SOURCE_USER, email: EMAIL }], projects: [sourceProject] },
    destination: {
      users: [{ id: DESTINATION_USER, email: "writer@example.com" }],
      projects: [destinationProject],
    },
    manifest: {
      version: 1,
      sourceRef: SOURCE_REF,
      destinationRef: DESTINATION_REF,
      identityMappings: [
        {
          emailSha256: emailSha256(EMAIL),
          sourceUserId: SOURCE_USER,
          destinationUserId: DESTINATION_USER,
        },
      ],
      projectMappings: [
        { sourceProjectId: PROJECT_ID, destinationProjectId: PROJECT_ID },
      ],
      allowedDestinationOnlyProjects: [],
    },
  };
}

function audit(fixture) {
  return auditCutover({
    sourceRef: SOURCE_REF,
    destinationRef: DESTINATION_REF,
    ...fixture,
  });
}

function hasIssue(result, code) {
  return result.issues.some((item) => item.code === code);
}

test("complete directional migration passes without exposing sensitive values", () => {
  const fixture = baseFixture();
  const result = audit(fixture);
  assert.equal(result.ok, true);
  const report = JSON.stringify(result);
  assert.equal(report.includes(CONTENT), false);
  assert.equal(report.includes(EMAIL.trim().toLowerCase()), false);
  assert.equal(report.includes(JSON.stringify(fixture.source.projects[0].settings)), false);
});

test("legacy-only project fails", () => {
  const fixture = baseFixture();
  fixture.destination.projects = [];
  const result = audit(fixture);
  assert.equal(result.ok, false);
  assert.equal(hasIssue(result, "LEGACY_ONLY_PROJECT"), true);
});

test("required UUID mapping missing fails", () => {
  const fixture = baseFixture();
  fixture.manifest.identityMappings = [];
  const result = audit(fixture);
  assert.equal(result.ok, false);
  assert.equal(hasIssue(result, "UUID_MAPPING_MISSING"), true);
});

test("owner mismatch fails", () => {
  const fixture = baseFixture();
  fixture.destination.users.push({ id: OTHER_DESTINATION_USER, email: "other@example.com" });
  fixture.destination.projects[0].user_id = OTHER_DESTINATION_USER;
  const result = audit(fixture);
  assert.equal(result.ok, false);
  assert.equal(hasIssue(result, "OWNER_MISMATCH"), true);
});

test("same mapped project content and settings hash mismatches fail", () => {
  const contentFixture = baseFixture();
  contentFixture.destination.projects[0].content += " changed";
  assert.equal(hasIssue(audit(contentFixture), "CONTENT_HASH_MISMATCH"), true);

  const settingsFixture = baseFixture();
  settingsFixture.destination.projects[0].settings.page.lines = 21;
  assert.equal(hasIssue(audit(settingsFixture), "SETTINGS_HASH_MISMATCH"), true);
});

test("destination-only project is fail-closed unless exact baseline is approved", () => {
  const fixture = baseFixture();
  const destinationOnly = {
    id: OTHER_PROJECT_ID,
    user_id: OTHER_DESTINATION_USER,
    content: "destination-only manuscript",
    settings: { chars: 50 },
  };
  fixture.destination.users.push({ id: OTHER_DESTINATION_USER, email: "other@example.com" });
  fixture.destination.projects.push(destinationOnly);

  const unreviewed = audit(fixture);
  assert.equal(unreviewed.ok, false);
  assert.equal(hasIssue(unreviewed, "DESTINATION_ONLY_PROJECT_UNREVIEWED"), true);

  const signature = projectSignature(destinationOnly);
  fixture.manifest.allowedDestinationOnlyProjects.push({
    projectId: signature.id,
    ownerUserId: signature.ownerUserId,
    contentSha256: signature.contentSha256,
    settingsSha256: signature.settingsSha256,
  });
  assert.equal(audit(fixture).ok, true);

  fixture.destination.projects[1].content += " changed after baseline";
  assert.equal(hasIssue(audit(fixture), "DESTINATION_BASELINE_CONTENT_MISMATCH"), true);
});

test("project ID collision and duplicate normalized email fail", () => {
  const fixture = baseFixture();
  fixture.manifest.projectMappings[0].destinationProjectId = OTHER_PROJECT_ID;
  fixture.destination.projects.push({
    ...fixture.destination.projects[0],
    id: OTHER_PROJECT_ID,
  });
  fixture.destination.users.push({ id: OTHER_DESTINATION_USER, email: "WRITER@example.com" });
  const result = audit(fixture);
  assert.equal(result.ok, false);
  assert.equal(hasIssue(result, "PROJECT_ID_COLLISION"), true);
  assert.equal(hasIssue(result, "DUPLICATE_NORMALIZED_EMAIL"), true);
});

test("malformed comparison input fails instead of producing a pass", () => {
  const fixture = baseFixture();
  fixture.source.projects[0].content = undefined;
  assert.throws(() => audit(fixture), /content\/settings unavailable/);
});

test("changed-ref dry run passes a complete migration and rejects a read failure", async () => {
  const fixture = baseFixture();
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: `https://${DESTINATION_REF}.supabase.co`,
    TATESPUN_DEPLOYED_SUPABASE_REF: SOURCE_REF,
    TATESPUN_CUTOVER_MANIFEST_PATH: "fixture.json",
    TATESPUN_CUTOVER_SOURCE_ADMIN_KEY: "source-test-admin-key",
    TATESPUN_CUTOVER_DESTINATION_ADMIN_KEY: "destination-test-admin-key",
  };
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    const passed = await runCutoverGate({
      env,
      argv: ["--dry-run"],
      manifestLoader: () => fixture.manifest,
      snapshotLoader: async (ref) => (ref === SOURCE_REF ? fixture.source : fixture.destination),
    });
    assert.equal(passed.ok, true);
    assert.equal(passed.skipped, false);

    await assert.rejects(
      runCutoverGate({
        env,
        argv: ["--dry-run"],
        manifestLoader: () => fixture.manifest,
        snapshotLoader: async () => {
          throw new Error("simulated API error");
        },
      }),
      /simulated API error/,
    );
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
});

test("CLI skips cross-DB reads for unchanged refs and fails closed on unconfigured ref change", () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const gate = path.join(repoRoot, "scripts", "verify-supabase-cutover.mjs");
  const cleanEnv = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: `https://${SOURCE_REF}.supabase.co`,
    TATESPUN_DEPLOYED_SUPABASE_REF: SOURCE_REF,
  };
  delete cleanEnv.TATESPUN_CUTOVER_MANIFEST_PATH;
  delete cleanEnv.TATESPUN_CUTOVER_SOURCE_ADMIN_KEY;
  delete cleanEnv.TATESPUN_CUTOVER_DESTINATION_ADMIN_KEY;

  const unchanged = spawnSync(process.execPath, [gate, "--dry-run"], {
    cwd: repoRoot,
    env: cleanEnv,
    encoding: "utf8",
  });
  assert.equal(unchanged.status, 0, unchanged.stderr);
  assert.match(unchanged.stdout, /backend ref unchanged; cross-database audit skipped/);

  const changed = spawnSync(process.execPath, [gate, "--dry-run"], {
    cwd: repoRoot,
    env: {
      ...cleanEnv,
      NEXT_PUBLIC_SUPABASE_URL: `https://${DESTINATION_REF}.supabase.co`,
    },
    encoding: "utf8",
  });
  assert.notEqual(changed.status, 0);
  assert.match(changed.stderr, /FAIL CLOSED: CUTOVER_MANIFEST_REQUIRED/);
  assert.doesNotMatch(`${changed.stdout}\n${changed.stderr}`, /sensitive manuscript fixture/);
});
