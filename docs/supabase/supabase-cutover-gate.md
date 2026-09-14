# TateSpun Supabase cutover gate

`scripts/verify-supabase-project.mjs` runs before both production build paths:

- `npm run build` through the `prebuild` hook
- Cloudflare Pages `npm run build:basepath` before `next build`

It invokes `scripts/verify-supabase-cutover.mjs --dry-run`. When the candidate
`NEXT_PUBLIC_SUPABASE_URL` ref equals the currently deployed ref, the cross-DB
audit is skipped. A ref change is blocked unless the directional manifest and
both server-only admin keys are present and every comparison passes.

The gate is read-only. It lists Auth users and selects only
`projects.id`, `projects.user_id`, `projects.content`, and `projects.settings`.
Content and settings are hashed in memory; emails are normalized with
`trim + NFKC + lower-case` and then hashed. Logs contain counts, issue codes,
project IDs, and truncated email hashes only. They never contain email values,
content, settings JSON, or admin keys.

## Directional manifest

The source is always the currently deployed Production ref. The destination is
always the candidate build ref. Reverse cutover therefore needs a new manifest
with the refs and mappings reversed.

```json
{
  "version": 1,
  "sourceRef": "aaaaaaaaaaaaaaaaaaaa",
  "destinationRef": "bbbbbbbbbbbbbbbbbbbb",
  "identityMappings": [
    {
      "emailSha256": "<sha256-of-normalized-email>",
      "sourceUserId": "<source-auth-uuid>",
      "destinationUserId": "<destination-auth-uuid>"
    }
  ],
  "projectMappings": [
    {
      "sourceProjectId": "<source-project-uuid>",
      "destinationProjectId": "<destination-project-uuid>"
    }
  ],
  "allowedDestinationOnlyProjects": [
    {
      "projectId": "<reviewed-destination-project-uuid>",
      "ownerUserId": "<destination-owner-uuid>",
      "contentSha256": "<sha256>",
      "settingsSha256": "<sha256-of-canonical-json>"
    }
  ]
}
```

Every source project must be listed in `projectMappings`. Every source project
owner must be listed in `identityMappings`. This makes a project or save created
after manifest preparation fail the gate instead of silently being stranded.

A destination-only project is not automatically data loss. It passes only when
it appears in `allowedDestinationOnlyProjects` and its owner, content hash, and
settings hash still match the reviewed baseline. An unlisted or changed
destination-only project is ambiguous and fails closed.

Keep the manifest under review as a migration audit artifact. It contains no
email/content/settings plaintext, but its UUIDs and hashes should still be
handled as internal metadata. Never put admin keys in the manifest.

## Cutover

1. Freeze cloud writes for the final migration window.
2. Copy Auth/project data without changing Production frontend configuration.
3. Prepare and review a source-to-destination manifest from the final snapshots.
4. In the protected Production build environment, set:
   - `TATESPUN_DEPLOYED_SUPABASE_REF` to the ref serving Production now.
   - `NEXT_PUBLIC_SUPABASE_URL` and its publishable key to the candidate.
   - `TATESPUN_CUTOVER_MANIFEST_PATH` to the reviewed manifest.
   - `TATESPUN_CUTOVER_SOURCE_ADMIN_KEY` and
     `TATESPUN_CUTOVER_DESTINATION_ADMIN_KEY` as server-only encrypted secrets.
5. Run `node scripts/verify-supabase-project.mjs`. Any issue or read/auth error
   must stop the deployment.
6. Deploy only from that passing build. After Production QA, update
   `TATESPUN_DEPLOYED_SUPABASE_REF` to the newly deployed ref. Remove the two
   temporary admin keys and manifest-path variable.

Do not update `TATESPUN_DEPLOYED_SUPABASE_REF` before the first successful
cutover build; doing so would make the refs appear unchanged and skip comparison.

## Reverse cutover

1. Freeze cloud writes again.
2. Treat the currently deployed environment as source and copy every new or
   changed project back to the rollback destination.
3. Create a new reverse-direction manifest. Do not reuse or merely swap the old
   file: hashes and destination-only baselines must be freshly reviewed.
4. Keep `TATESPUN_DEPLOYED_SUPABASE_REF` at the actual current Production ref;
   set `NEXT_PUBLIC_SUPABASE_URL` to the rollback candidate and run the same gate.
5. Deploy only after PASS, then update the deployed-ref variable after QA.

## Failure rules

The gate exits non-zero for legacy/source-only projects, incomplete UUID maps,
normalized-email duplicates, owner mismatch, content/settings mismatch, project
ID collision/duplicate, stale manifest entries, or unreviewed destination-only
projects. Missing configuration, malformed responses, authentication failure,
pagination/read failure, and any comparison exception also exit non-zero.
