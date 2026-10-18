/**
 * Shared paths and endpoints for the verification suites.
 *
 * Everything is derived from this file's own location, so the suites run from
 * any checkout — locally via check.ps1 and in CI on GitHub Actions — with no
 * edit. Hard-coded `C:/Users/Asus/...` paths made the suites local-only, which
 * meant CI could not gate on them.
 *
 * Environment overrides (all optional):
 *   API_BASE     FastAPI backend          (default http://localhost:8000)
 *   STATIC_BASE  static preview server    (default http://localhost:4180)
 *   DIST_DIR     built bundle assets dir  (default <repo>/frontend/dist/assets)
 */
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

/** Repo root, resolved from tests/ so the CWD never matters. */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const FRONTEND = join(ROOT, 'frontend')
export const SRC = join(FRONTEND, 'src')
export const DIST = process.env.DIST_DIR || join(FRONTEND, 'dist', 'assets')

export const API = process.env.API_BASE || 'http://localhost:8000'
export const STATIC = process.env.STATIC_BASE || 'http://localhost:4180'
