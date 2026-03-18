Release a new version of the glop-cli npm package by creating a GitHub release.

Steps:
1. Run `git fetch --tags` to get the latest tags.
2. Find the latest `cli-v*` tag by running: `git tag --list 'cli-v*' --sort=-v:refname | head -1`
3. If no previous tag exists, use `cli-v0.1.0` as the new tag.
4. If a previous tag exists, increment the **minor** version. For example:
   - `cli-v0.1.0` → `cli-v0.2.0`
   - `cli-v0.5.0` → `cli-v0.6.0`
   - `cli-v1.3.0` → `cli-v1.4.0`
5. Update the `version` field in `apps/cli/package.json` to match the new version (without the `cli-v` prefix).
6. Commit the version bump: `git add apps/cli/package.json && git commit -m "Bump glop-cli to <new_version>"`
7. Push the commit to main: `git push`
8. Create a GitHub release using: `gh release create <new_tag> --title "glop-cli <new_version>" --generate-notes --target main`
9. Show the user the release URL and remind them the npm publish will happen automatically via GitHub Actions.
