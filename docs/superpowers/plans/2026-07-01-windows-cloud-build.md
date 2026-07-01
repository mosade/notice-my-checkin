# Windows Cloud Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manually triggered GitHub Actions workflow that builds the Tauri Windows installer in GitHub's cloud runner and uploads it as an artifact.

**Architecture:** Create one workflow file under `.github/workflows`. The workflow uses `windows-latest`, installs the existing Node and Rust toolchains, caches Rust build output, runs `npm run tauri build`, and uploads `src-tauri/target/release/bundle/**/*` as a GitHub Actions artifact.

**Tech Stack:** GitHub Actions, Node.js/npm, Rust stable, Tauri v2, `actions/upload-artifact`.

---

### Task 1: Add Windows Build Workflow

**Files:**
- Create: `.github/workflows/build-windows.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
name: Build Windows

on:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  build-windows:
    name: Build Windows installer
    runs-on: windows-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: npm

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: ./src-tauri -> target

      - name: Install frontend dependencies
        run: npm ci

      - name: Build Tauri app
        run: npm run tauri build

      - name: Upload Windows bundle
        uses: actions/upload-artifact@v7
        with:
          name: notice-my-checkin-windows
          path: src-tauri/target/release/bundle/**/*
          if-no-files-found: error
```

- [ ] **Step 2: Validate workflow YAML**

Run: `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/build-windows.yml'); puts 'workflow yaml ok'"`

Expected: prints `workflow yaml ok`.

- [ ] **Step 3: Validate existing frontend build**

Run: `npm run build`

Expected: TypeScript and Vite build exit with code 0.
