# Windows Cloud Build Design

## Goal

Add a GitHub Actions workflow that manually builds the Tauri app on a Windows cloud runner and uploads the installer bundle as a downloadable Actions artifact.

## Scope

- Trigger only through `workflow_dispatch`.
- Build on `windows-latest`.
- Run the existing Tauri build command: `npm run tauri build`.
- Upload generated Windows bundle files from `src-tauri/target/release/bundle`.
- Do not create GitHub Releases, tags, or commits from the workflow.

## Architecture

The workflow lives in `.github/workflows/build-windows.yml`. It checks out the repository, sets up Node.js, installs npm dependencies from `package-lock.json`, installs Rust stable, caches Rust build output, builds the Tauri package, and uploads the bundle directory using `actions/upload-artifact`.

## Validation

Local validation checks that the workflow file is valid YAML and that the existing frontend build still succeeds. The actual Windows installer build is validated when the workflow runs on GitHub's Windows runner.
