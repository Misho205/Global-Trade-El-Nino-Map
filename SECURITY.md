# Security policy

## Status

Pre-release software. The full security-audit workflow is **incomplete**;
functional tests and builds are not a security certification. No release currently
has a promised security-support period or response SLA. Reviews must identify the
exact commit and local changes; older reviews do not automatically cover new code.

## Reporting

Do not disclose credentials, exploit details or private data in public issues.
Use GitHub **Security > Advisories > Report a vulnerability** when the owner has
enabled private vulnerability reporting. No verified dedicated security email is
currently declared. If private reporting is unavailable, establish a verified
private maintainer channel before sending sensitive details.

Include the affected commit/files, trust boundary, preconditions, minimal local
reproduction, observed impact and suggested remediation. Use dummy data. Do not
probe third-party APIs or other users, load-test production or publish exploit
details while coordinating disclosure.

## Deployment

- Protect initial deployments with Cloudflare Access.
- Keep secrets out of Git, client bundles and hosting manifests; use runtime secrets.
- Standalone Workers must not enable `UPDATE_AUTH_MODE=sites-owner-private`.
- Cron calls the collector internally. Manual HTTP writes require `UPDATE_TOKEN`
  of at least 32 characters; token-less writes are denied by default.
- The private-Sites exception relies on that platform's access boundary. Remove
  it before changing the audience or moving to standalone hosting.
- Preserve input validation, last-valid snapshots, retry limits and source errors.
- Apply reviewed migrations and monitor CPU, quotas and collector failures.

## Audit completion

Use the exact installed skill revision and all companions. Test execution needs
verified OS isolation: no external network, allowlisted environment, read-only
target/toolchain, scratch-only writes, resource/time limits and safe evidence
extraction. A VM/container alone does not prove these controls work.

Read prior findings and coverage, verify current source independently and run both
report validators. Record unresolved controls as incomplete. Keep sensitive audit
details outside the public repository. Revalidate fixes separately.
