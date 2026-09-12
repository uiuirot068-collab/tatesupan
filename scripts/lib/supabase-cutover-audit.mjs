import crypto from "node:crypto";

const SHA256_RE = /^[a-f0-9]{64}$/;

export function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export function normalizeEmail(email) {
  return typeof email === "string"
    ? email.trim().normalize("NFKC").toLowerCase()
    : "";
}

export function emailSha256(email) {
  const normalized = normalizeEmail(email);
  return normalized ? sha256(normalized) : "";
}

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

export function projectSignature(project) {
  if (!project || typeof project !== "object") throw new TypeError("invalid project row");
  if (typeof project.id !== "string" || typeof project.user_id !== "string") {
    throw new TypeError("invalid project identifiers");
  }
  if (typeof project.content !== "string" || !("settings" in project)) {
    throw new TypeError("project content/settings unavailable");
  }
  return {
    id: project.id,
    ownerUserId: project.user_id,
    contentSha256: sha256(project.content),
    settingsSha256: sha256(canonicalJson(project.settings)),
  };
}

function issue(code, subject = "audit") {
  return { code, subject };
}

function duplicateValues(items, keyOf) {
  const seen = new Set();
  const duplicates = new Set();
  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return duplicates;
}

function validateArray(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  return value;
}

function prepareSnapshot(snapshot, side) {
  if (!snapshot || typeof snapshot !== "object") throw new TypeError(`${side} snapshot missing`);
  const users = validateArray(snapshot.users, `${side}.users`).map((user) => {
    if (!user || typeof user.id !== "string") throw new TypeError(`${side} user id missing`);
    return { id: user.id, emailSha256: emailSha256(user.email) };
  });
  const projects = validateArray(snapshot.projects, `${side}.projects`).map(projectSignature);
  const issues = [];

  for (const id of duplicateValues(users, (user) => user.id)) {
    issues.push(issue("DUPLICATE_AUTH_UUID", `${side}:user:${id}`));
  }
  for (const hash of duplicateValues(users, (user) => user.emailSha256)) {
    issues.push(issue("DUPLICATE_NORMALIZED_EMAIL", `${side}:email#${hash.slice(0, 12)}`));
  }
  for (const id of duplicateValues(projects, (project) => project.id)) {
    issues.push(issue("DUPLICATE_PROJECT_ID", `${side}:project:${id}`));
  }

  const usersById = new Map(users.map((user) => [user.id, user]));
  const usersByEmail = new Map(users.filter((user) => user.emailSha256).map((user) => [user.emailSha256, user]));
  const projectsById = new Map(projects.map((project) => [project.id, project]));

  for (const project of projects) {
    if (!usersById.has(project.ownerUserId)) {
      issues.push(issue("PROJECT_OWNER_AUTH_MISSING", `${side}:project:${project.id}`));
    }
  }

  return { users, projects, usersById, usersByEmail, projectsById, issues };
}

function validateManifest(manifest, sourceRef, destinationRef) {
  if (!manifest || typeof manifest !== "object") throw new TypeError("manifest missing");
  if (manifest.version !== 1) throw new TypeError("unsupported manifest version");
  if (manifest.sourceRef !== sourceRef || manifest.destinationRef !== destinationRef) {
    throw new TypeError("manifest direction does not match cutover direction");
  }

  const identityMappings = validateArray(manifest.identityMappings, "manifest.identityMappings");
  const projectMappings = validateArray(manifest.projectMappings, "manifest.projectMappings");
  const allowedDestinationOnlyProjects = validateArray(
    manifest.allowedDestinationOnlyProjects,
    "manifest.allowedDestinationOnlyProjects",
  );

  for (const mapping of identityMappings) {
    if (
      !mapping ||
      !SHA256_RE.test(mapping.emailSha256 ?? "") ||
      typeof mapping.sourceUserId !== "string" ||
      typeof mapping.destinationUserId !== "string"
    ) {
      throw new TypeError("invalid identity mapping");
    }
  }
  for (const mapping of projectMappings) {
    if (
      !mapping ||
      typeof mapping.sourceProjectId !== "string" ||
      typeof mapping.destinationProjectId !== "string"
    ) {
      throw new TypeError("invalid project mapping");
    }
  }
  for (const baseline of allowedDestinationOnlyProjects) {
    if (
      !baseline ||
      typeof baseline.projectId !== "string" ||
      typeof baseline.ownerUserId !== "string" ||
      !SHA256_RE.test(baseline.contentSha256 ?? "") ||
      !SHA256_RE.test(baseline.settingsSha256 ?? "")
    ) {
      throw new TypeError("invalid destination-only baseline");
    }
  }

  return { identityMappings, projectMappings, allowedDestinationOnlyProjects };
}

function addDuplicateManifestIssues(issues, manifest) {
  const checks = [
    [manifest.identityMappings, (x) => x.emailSha256, "DUPLICATE_MANIFEST_EMAIL"],
    [manifest.identityMappings, (x) => x.sourceUserId, "DUPLICATE_MANIFEST_SOURCE_USER"],
    [manifest.identityMappings, (x) => x.destinationUserId, "DUPLICATE_MANIFEST_DESTINATION_USER"],
    [manifest.projectMappings, (x) => x.sourceProjectId, "DUPLICATE_MANIFEST_SOURCE_PROJECT"],
    [manifest.projectMappings, (x) => x.destinationProjectId, "DUPLICATE_MANIFEST_DESTINATION_PROJECT"],
    [manifest.allowedDestinationOnlyProjects, (x) => x.projectId, "DUPLICATE_DESTINATION_BASELINE_PROJECT"],
  ];
  for (const [items, keyOf, code] of checks) {
    for (const value of duplicateValues(items, keyOf)) issues.push(issue(code, value));
  }
}

export function auditCutover({ sourceRef, destinationRef, source, destination, manifest }) {
  const sourceData = prepareSnapshot(source, "source");
  const destinationData = prepareSnapshot(destination, "destination");
  const checkedManifest = validateManifest(manifest, sourceRef, destinationRef);
  const issues = [...sourceData.issues, ...destinationData.issues];
  addDuplicateManifestIssues(issues, checkedManifest);

  const identityBySourceId = new Map(
    checkedManifest.identityMappings.map((mapping) => [mapping.sourceUserId, mapping]),
  );
  const identityByDestinationId = new Map(
    checkedManifest.identityMappings.map((mapping) => [mapping.destinationUserId, mapping]),
  );

  for (const mapping of checkedManifest.identityMappings) {
    const sourceUser = sourceData.usersById.get(mapping.sourceUserId);
    const destinationUser = destinationData.usersById.get(mapping.destinationUserId);
    const subject = `email#${mapping.emailSha256.slice(0, 12)}`;
    if (!sourceUser || !destinationUser) {
      issues.push(issue("UUID_MAPPING_MISSING", subject));
      continue;
    }
    if (
      sourceUser.emailSha256 !== mapping.emailSha256 ||
      destinationUser.emailSha256 !== mapping.emailSha256
    ) {
      issues.push(issue("NORMALIZED_EMAIL_MAPPING_MISMATCH", subject));
    }
    const destinationForEmail = destinationData.usersByEmail.get(sourceUser.emailSha256);
    if (!destinationForEmail || destinationForEmail.id !== mapping.destinationUserId) {
      issues.push(issue("UUID_MAPPING_MISMATCH", subject));
    }
  }

  const projectBySourceId = new Map(
    checkedManifest.projectMappings.map((mapping) => [mapping.sourceProjectId, mapping]),
  );
  const mappedDestinationIds = new Set(
    checkedManifest.projectMappings.map((mapping) => mapping.destinationProjectId),
  );
  const allowedDestinationById = new Map(
    checkedManifest.allowedDestinationOnlyProjects.map((baseline) => [baseline.projectId, baseline]),
  );

  for (const project of sourceData.projects) {
    const mapping = projectBySourceId.get(project.id);
    if (!mapping) {
      issues.push(issue("LEGACY_ONLY_PROJECT", `source:project:${project.id}`));
      continue;
    }

    const sourceOwnerMapping = identityBySourceId.get(project.ownerUserId);
    if (!sourceOwnerMapping) {
      issues.push(issue("UUID_MAPPING_MISSING", `source:project:${project.id}`));
    }

    const destinationProject = destinationData.projectsById.get(mapping.destinationProjectId);
    if (!destinationProject) {
      issues.push(issue("LEGACY_ONLY_PROJECT", `source:project:${project.id}`));
      continue;
    }

    if (sourceOwnerMapping && destinationProject.ownerUserId !== sourceOwnerMapping.destinationUserId) {
      issues.push(issue("OWNER_MISMATCH", `destination:project:${destinationProject.id}`));
    }
    if (!identityByDestinationId.has(destinationProject.ownerUserId)) {
      issues.push(issue("DESTINATION_OWNER_MAPPING_MISSING", `destination:project:${destinationProject.id}`));
    }
    if (project.contentSha256 !== destinationProject.contentSha256) {
      issues.push(issue("CONTENT_HASH_MISMATCH", `project:${project.id}`));
    }
    if (project.settingsSha256 !== destinationProject.settingsSha256) {
      issues.push(issue("SETTINGS_HASH_MISMATCH", `project:${project.id}`));
    }

    if (
      mapping.sourceProjectId !== mapping.destinationProjectId &&
      destinationData.projectsById.has(mapping.sourceProjectId)
    ) {
      issues.push(issue("PROJECT_ID_COLLISION", `destination:project:${mapping.sourceProjectId}`));
    }
  }

  for (const mapping of checkedManifest.projectMappings) {
    if (!sourceData.projectsById.has(mapping.sourceProjectId)) {
      issues.push(issue("MANIFEST_SOURCE_PROJECT_MISSING", `source:project:${mapping.sourceProjectId}`));
    }
  }

  for (const destinationProject of destinationData.projects) {
    if (mappedDestinationIds.has(destinationProject.id)) continue;
    const baseline = allowedDestinationById.get(destinationProject.id);
    if (!baseline) {
      issues.push(issue("DESTINATION_ONLY_PROJECT_UNREVIEWED", `destination:project:${destinationProject.id}`));
      continue;
    }
    if (baseline.ownerUserId !== destinationProject.ownerUserId) {
      issues.push(issue("DESTINATION_BASELINE_OWNER_MISMATCH", `destination:project:${destinationProject.id}`));
    }
    if (baseline.contentSha256 !== destinationProject.contentSha256) {
      issues.push(issue("DESTINATION_BASELINE_CONTENT_MISMATCH", `destination:project:${destinationProject.id}`));
    }
    if (baseline.settingsSha256 !== destinationProject.settingsSha256) {
      issues.push(issue("DESTINATION_BASELINE_SETTINGS_MISMATCH", `destination:project:${destinationProject.id}`));
    }
  }

  for (const baseline of checkedManifest.allowedDestinationOnlyProjects) {
    if (mappedDestinationIds.has(baseline.projectId)) {
      issues.push(issue("DESTINATION_BASELINE_COLLIDES_WITH_MAPPING", `destination:project:${baseline.projectId}`));
    } else if (!destinationData.projectsById.has(baseline.projectId)) {
      issues.push(issue("DESTINATION_BASELINE_PROJECT_MISSING", `destination:project:${baseline.projectId}`));
    }
  }

  const issueCounts = {};
  for (const item of issues) issueCounts[item.code] = (issueCounts[item.code] ?? 0) + 1;

  return {
    ok: issues.length === 0,
    source: { authUsers: sourceData.users.length, projects: sourceData.projects.length },
    destination: { authUsers: destinationData.users.length, projects: destinationData.projects.length },
    mappedIdentities: checkedManifest.identityMappings.length,
    mappedProjects: checkedManifest.projectMappings.length,
    allowedDestinationOnlyProjects: checkedManifest.allowedDestinationOnlyProjects.length,
    issueCounts,
    issues,
  };
}
