# Development workflow

The project owner requests that subsequent completed development work be pushed
to this GitHub repository after the relevant validation succeeds.

1. Inspect the current branch and uncommitted changes; preserve other work.
2. Implement the requested scope, then run `npm ci`, `npm test`, `npm run build`
   and the protocol dictionary check as applicable. Run the actual C core tests and
   full firmware build for firmware changes. Sync native resources after web changes.
3. Update the development log with the change, test commands/results, date and
   remaining limitations. Do not label an unrun native or physical test as passing.
4. Review the staged file list. The root allowlist intentionally excludes course
   handbooks, interview data, feedback, shared-drive snapshots, local evidence,
   credentials, SDKs, dependencies and generated build trees.
5. Commit and push the validated source changes using the available authorised
   GitHub connection or Git authentication. Do not force-push or overwrite unrelated
   changes. Report the resulting commit link and any checks that could not run.

The public repository is a development preview until actual hardware and phone
acceptance tests have been completed. A new release must state the exact tested
scope and retain outstanding device-test limitations.
