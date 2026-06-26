# NebulaDash Router Updater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-managed router-side NebulaDash updater that can be triggered from the NebulaDash frontend and safely deploys releases with an A/B directory switch.

**Architecture:** The frontend never executes shell commands directly. It calls a small token-protected HTTP CGI endpoint on the router; the router updater downloads or receives release assets, deploys into the inactive partition, verifies the result, and atomically switches `/www/nebuladash` to the new partition. All router-side updater files live under one project folder and install into one runtime folder for easy management.

**Tech Stack:** Vue 3 + TypeScript frontend, Node built-in test runner for pure helpers, POSIX shell for OpenWrt/router scripts, `curl`/`wget`, `unzip`, `ln`, `mv`, and uHTTPd CGI under `/www/cgi-bin`.

## Global Constraints

- Do not depend on OpenClash's built-in Dashboard/Yacd/Metacubexd/Zashboard update buttons.
- Router-side service files must be managed from one source folder in the repo: `router-updater/`.
- Runtime updater files must install under `/usr/share/nebuladash-updater/`.
- The panel entry path remains `/www/nebuladash`.
- Use A/B partitions: `/www/nebuladash-a` and `/www/nebuladash-b`.
- `/www/nebuladash` is a symlink to the active partition whenever the updater manages the install.
- The updater accepts only `status`, `update`, and `rollback` actions.
- The updater requires a token; it is not a GitHub token or OpenClash password.
- The default download URL is `https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip`.
- The updater must reject non-NebulaDash GitHub release ZIP URLs.
- Failed update must not switch the active partition.
- New partition verification requires at least `index.html`, `assets/`, and `manifest.webmanifest`.
- Keep existing OpenClash/Mihomo direct frontend architecture; do not add Node, Docker, SQLite, or a long-running service.

---

## File Structure

- `router-updater/config.example`
  - Documents runtime variables: token, target link, A/B partition paths, release URL, log path, and work path.
- `router-updater/updater.sh`
  - Core shell implementation for `status`, `update`, and `rollback`.
  - Contains all A/B switch and validation logic.
- `router-updater/nebuladash-updater.cgi`
  - Minimal CGI wrapper. Parses HTTP method/action/token and delegates to `updater.sh`.
- `router-updater/install.sh`
  - Installs updater files to `/usr/share/nebuladash-updater/`, installs CGI wrapper to `/www/cgi-bin/nebuladash-updater`, generates token if config does not exist.
- `router-updater/README.md`
  - Router installation, frontend configuration, update, rollback, logs, and uninstall instructions.
- `src/helper/routerUpdater.ts`
  - Pure frontend helper for URL construction, token header construction, and updater response validation.
- `src/helper/routerUpdater.spec.ts`
  - Node tests for helper behavior.
- `src/api/routerUpdater.ts`
  - Small frontend API wrapper using `fetch` to call the updater CGI.
- `src/store/settings.ts`
  - Adds local storage settings for updater endpoint and token.
- `src/components/settings/ZashboardSettings.vue`
  - Adds NebulaDash updater controls near the current panel update area.
- `src/i18n/en.ts`, `src/i18n/zh.ts`, `src/i18n/zh-tw.ts`, `src/i18n/ru.ts`
  - Adds labels, statuses, and errors.
- `README.md`, `PUBLICATION.md`, `upstream-followup/AI-HANDOFF.md`, `upstream-followup/NEBULADASH-ITERATION-PLAN.md`, `upstream-followup/NEBULADASH-CHANGELOG.md`
  - Documents the new deployment path and maintenance implications.

---

### Task 1: Frontend Updater Helper

**Files:**

- Create: `src/helper/routerUpdater.ts`
- Create: `src/helper/routerUpdater.spec.ts`

**Interfaces:**

- Produces:
  - `type RouterUpdaterAction = 'status' | 'update' | 'rollback'`
  - `type RouterUpdaterStatus = 'idle' | 'updating' | 'ok' | 'error'`
  - `type RouterUpdaterResponse = { ok: boolean; status: RouterUpdaterStatus; active?: 'a' | 'b'; version?: string; message?: string; updatedAt?: string }`
  - `buildRouterUpdaterUrl(endpoint: string, action: RouterUpdaterAction): string`
  - `buildRouterUpdaterHeaders(token: string): Record<string, string>`
  - `parseRouterUpdaterResponse(value: unknown): RouterUpdaterResponse`
- Consumes: no project state.

- [ ] **Step 1: Write the failing helper tests**

Create `src/helper/routerUpdater.spec.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildRouterUpdaterHeaders,
  buildRouterUpdaterUrl,
  parseRouterUpdaterResponse,
} from './routerUpdater.ts'

test('builds updater action URLs without duplicating slashes', () => {
  assert.equal(
    buildRouterUpdaterUrl('http://192.168.6.1/cgi-bin/nebuladash-updater/', 'status'),
    'http://192.168.6.1/cgi-bin/nebuladash-updater?action=status',
  )
})

test('sends the updater token in a fixed header', () => {
  assert.deepEqual(buildRouterUpdaterHeaders('secret-token'), {
    'X-NebulaDash-Token': 'secret-token',
  })
})

test('parses valid updater responses', () => {
  assert.deepEqual(
    parseRouterUpdaterResponse({
      ok: true,
      status: 'ok',
      active: 'b',
      version: '2.8.0-nebula.2',
      message: 'updated',
      updatedAt: '2026-06-26T09:00:00Z',
    }),
    {
      ok: true,
      status: 'ok',
      active: 'b',
      version: '2.8.0-nebula.2',
      message: 'updated',
      updatedAt: '2026-06-26T09:00:00Z',
    },
  )
})

test('normalizes malformed updater responses into an error response', () => {
  assert.deepEqual(parseRouterUpdaterResponse({ ok: true, status: 'broken' }), {
    ok: false,
    status: 'error',
    message: 'Invalid updater response',
  })
})
```

- [ ] **Step 2: Run helper tests and verify RED**

Run:

```bash
pnpm test src/helper/routerUpdater.spec.ts
```

Expected: fails because `src/helper/routerUpdater.ts` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/helper/routerUpdater.ts`:

```ts
export type RouterUpdaterAction = 'status' | 'update' | 'rollback'
export type RouterUpdaterStatus = 'idle' | 'updating' | 'ok' | 'error'

export type RouterUpdaterResponse = {
  ok: boolean
  status: RouterUpdaterStatus
  active?: 'a' | 'b'
  version?: string
  message?: string
  updatedAt?: string
}

const VALID_STATUSES: RouterUpdaterStatus[] = ['idle', 'updating', 'ok', 'error']

export const buildRouterUpdaterUrl = (endpoint: string, action: RouterUpdaterAction) => {
  const url = new URL(endpoint.replace(/\/+$/, ''))
  url.searchParams.set('action', action)
  return url.toString()
}

export const buildRouterUpdaterHeaders = (token: string) => ({
  'X-NebulaDash-Token': token,
})

export const parseRouterUpdaterResponse = (value: unknown): RouterUpdaterResponse => {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, status: 'error', message: 'Invalid updater response' }
  }

  const candidate = value as Partial<RouterUpdaterResponse>
  if (
    typeof candidate.ok !== 'boolean' ||
    !VALID_STATUSES.includes(candidate.status as RouterUpdaterStatus)
  ) {
    return { ok: false, status: 'error', message: 'Invalid updater response' }
  }

  return {
    ok: candidate.ok,
    status: candidate.status as RouterUpdaterStatus,
    active: candidate.active === 'a' || candidate.active === 'b' ? candidate.active : undefined,
    version: typeof candidate.version === 'string' ? candidate.version : undefined,
    message: typeof candidate.message === 'string' ? candidate.message : undefined,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : undefined,
  }
}
```

- [ ] **Step 4: Run helper tests and verify GREEN**

Run:

```bash
pnpm test src/helper/routerUpdater.spec.ts
```

Expected: all `routerUpdater` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/helper/routerUpdater.ts src/helper/routerUpdater.spec.ts
git commit -m "feat: add router updater frontend helper"
```

---

### Task 2: Router Updater Shell Core

**Files:**

- Create: `router-updater/config.example`
- Create: `router-updater/updater.sh`

**Interfaces:**

- Consumes: POSIX shell, `curl` or `wget`, `unzip`, `ln`, `mv`, `rm`, `mkdir`.
- Produces:
  - `router-updater/updater.sh status`
  - `router-updater/updater.sh update`
  - `router-updater/updater.sh rollback`
  - JSON output for every action.

- [ ] **Step 1: Write a shell smoke test script**

Create `router-updater/smoke-test.sh` for local shell verification:

```sh
#!/bin/sh
set -eu

ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT

mkdir -p "$ROOT/runtime" "$ROOT/www" "$ROOT/source/assets"
printf '<html>NebulaDash</html>' > "$ROOT/source/index.html"
printf '{}' > "$ROOT/source/manifest.webmanifest"
(cd "$ROOT/source" && zip -qr "$ROOT/dist.zip" .)

cat > "$ROOT/runtime/config" <<EOF
NEBULADASH_TOKEN=test-token
TARGET_LINK=$ROOT/www/nebuladash
PARTITION_A=$ROOT/www/nebuladash-a
PARTITION_B=$ROOT/www/nebuladash-b
RELEASE_URL=file://$ROOT/dist.zip
WORK_DIR=$ROOT/runtime/work
LOG_DIR=$ROOT/runtime/logs
STATE_FILE=$ROOT/runtime/state.json
EOF

NEBULADASH_UPDATER_CONFIG="$ROOT/runtime/config" sh router-updater/updater.sh update
test -L "$ROOT/www/nebuladash"
test -f "$ROOT/www/nebuladash/index.html"
test -d "$ROOT/www/nebuladash/assets"

NEBULADASH_UPDATER_CONFIG="$ROOT/runtime/config" sh router-updater/updater.sh status
NEBULADASH_UPDATER_CONFIG="$ROOT/runtime/config" sh router-updater/updater.sh rollback
```

- [ ] **Step 2: Run smoke test and verify RED**

Run:

```bash
sh router-updater/smoke-test.sh
```

Expected: fails because `router-updater/updater.sh` does not exist.

- [ ] **Step 3: Add config example**

Create `router-updater/config.example`:

```sh
NEBULADASH_TOKEN="replace-with-generated-token"
TARGET_LINK="/www/nebuladash"
PARTITION_A="/www/nebuladash-a"
PARTITION_B="/www/nebuladash-b"
RELEASE_URL="https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip"
WORK_DIR="/usr/share/nebuladash-updater/work"
LOG_DIR="/usr/share/nebuladash-updater/logs"
STATE_FILE="/usr/share/nebuladash-updater/state.json"
```

- [ ] **Step 4: Implement updater core**

Create `router-updater/updater.sh` with these exact behaviors:

```sh
#!/bin/sh
set -eu

CONFIG="${NEBULADASH_UPDATER_CONFIG:-/usr/share/nebuladash-updater/config}"
ACTION="${1:-status}"

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

respond() {
  ok="$1"
  status="$2"
  message="$(json_escape "${3:-}")"
  active="${4:-}"
  version="${5:-}"
  updated_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf '{"ok":%s,"status":"%s","message":"%s","active":"%s","version":"%s","updatedAt":"%s"}\n' \
    "$ok" "$status" "$message" "$active" "$version" "$updated_at"
}

load_config() {
  if [ ! -f "$CONFIG" ]; then
    respond false error "Missing updater config: $CONFIG" "" ""
    exit 1
  fi
  # shellcheck disable=SC1090
  . "$CONFIG"
  mkdir -p "$WORK_DIR" "$LOG_DIR"
}

validate_release_url() {
  case "$RELEASE_URL" in
    https://github.com/boostemotion/nebuladash/releases/*/download/*.zip|file://*) ;;
    *)
      respond false error "Refusing non-NebulaDash release URL" "" ""
      exit 1
      ;;
  esac
}

active_partition() {
  target="$(readlink "$TARGET_LINK" 2>/dev/null || true)"
  case "$target" in
    "$PARTITION_A") printf 'a' ;;
    "$PARTITION_B") printf 'b' ;;
    *) printf '' ;;
  esac
}

inactive_partition_path() {
  active="$(active_partition)"
  if [ "$active" = "a" ]; then
    printf '%s' "$PARTITION_B"
  else
    printf '%s' "$PARTITION_A"
  fi
}

inactive_partition_name() {
  active="$(active_partition)"
  if [ "$active" = "a" ]; then
    printf 'b'
  else
    printf 'a'
  fi
}

download_release() {
  zip_path="$WORK_DIR/dist.zip"
  rm -f "$zip_path"
  case "$RELEASE_URL" in
    file://*) cp "${RELEASE_URL#file://}" "$zip_path" ;;
    *)
      if command -v curl >/dev/null 2>&1; then
        curl -L --fail -o "$zip_path" "$RELEASE_URL"
      else
        wget -O "$zip_path" "$RELEASE_URL"
      fi
      ;;
  esac
  printf '%s' "$zip_path"
}

verify_partition() {
  partition="$1"
  test -f "$partition/index.html"
  test -d "$partition/assets"
  test -f "$partition/manifest.webmanifest"
}

write_state() {
  active="$1"
  status="$2"
  message="$(json_escape "$3")"
  updated_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf '{"active":"%s","status":"%s","message":"%s","updatedAt":"%s"}\n' \
    "$active" "$status" "$message" "$updated_at" > "$STATE_FILE"
}

do_status() {
  active="$(active_partition)"
  if [ -f "$STATE_FILE" ]; then
    cat "$STATE_FILE"
  else
    respond true idle "No update has run yet" "$active" ""
  fi
}

do_update() {
  validate_release_url
  inactive_path="$(inactive_partition_path)"
  inactive_name="$(inactive_partition_name)"
  zip_path="$(download_release)"
  rm -rf "$inactive_path"
  mkdir -p "$inactive_path"
  unzip -oq "$zip_path" -d "$inactive_path"
  verify_partition "$inactive_path"
  ln -sfn "$inactive_path" "$TARGET_LINK"
  write_state "$inactive_name" ok "Updated NebulaDash"
  respond true ok "Updated NebulaDash" "$inactive_name" ""
}

do_rollback() {
  active="$(active_partition)"
  if [ "$active" = "a" ] && [ -d "$PARTITION_B" ]; then
    ln -sfn "$PARTITION_B" "$TARGET_LINK"
    write_state b ok "Rolled back to partition b"
    respond true ok "Rolled back to partition b" b ""
    exit 0
  fi
  if [ "$active" = "b" ] && [ -d "$PARTITION_A" ]; then
    ln -sfn "$PARTITION_A" "$TARGET_LINK"
    write_state a ok "Rolled back to partition a"
    respond true ok "Rolled back to partition a" a ""
    exit 0
  fi
  respond false error "No rollback partition available" "$active" ""
  exit 1
}

load_config
case "$ACTION" in
  status) do_status ;;
  update) do_update ;;
  rollback) do_rollback ;;
  *) respond false error "Unsupported action" "$(active_partition)" ""; exit 1 ;;
esac
```

- [ ] **Step 5: Run shell smoke test and verify GREEN**

Run:

```bash
sh router-updater/smoke-test.sh
```

Expected: exits `0`; printed JSON includes `"status":"ok"` after update.

- [ ] **Step 6: Commit**

```bash
git add router-updater/config.example router-updater/updater.sh router-updater/smoke-test.sh
git commit -m "feat: add router updater core"
```

---

### Task 3: CGI Wrapper And Installer

**Files:**

- Create: `router-updater/nebuladash-updater.cgi`
- Create: `router-updater/install.sh`
- Modify: `router-updater/smoke-test.sh`

**Interfaces:**

- Consumes: `router-updater/updater.sh`.
- Produces:
  - CGI endpoint installed at `/www/cgi-bin/nebuladash-updater`
  - Runtime folder `/usr/share/nebuladash-updater/`

- [ ] **Step 1: Extend smoke test for CGI token rejection**

Append to `router-updater/smoke-test.sh`:

```sh
REQUEST_METHOD=POST QUERY_STRING='action=status' HTTP_X_NEBULADASH_TOKEN=wrong \
  NEBULADASH_UPDATER_CONFIG="$ROOT/runtime/config" sh router-updater/nebuladash-updater.cgi > "$ROOT/cgi-denied.json"
grep '"ok":false' "$ROOT/cgi-denied.json"
```

- [ ] **Step 2: Run smoke test and verify RED**

Run:

```bash
sh router-updater/smoke-test.sh
```

Expected: fails because `router-updater/nebuladash-updater.cgi` does not exist.

- [ ] **Step 3: Implement CGI wrapper**

Create `router-updater/nebuladash-updater.cgi`:

```sh
#!/bin/sh
set -eu

CONFIG="${NEBULADASH_UPDATER_CONFIG:-/usr/share/nebuladash-updater/config}"
printf 'Content-Type: application/json\r\n\r\n'

if [ ! -f "$CONFIG" ]; then
  printf '{"ok":false,"status":"error","message":"Missing updater config"}\n'
  exit 1
fi

# shellcheck disable=SC1090
. "$CONFIG"

ACTION="$(printf '%s' "${QUERY_STRING:-}" | sed -n 's/^.*action=\([^&]*\).*$/\1/p')"
TOKEN="${HTTP_X_NEBULADASH_TOKEN:-}"

if [ "$TOKEN" != "$NEBULADASH_TOKEN" ]; then
  printf '{"ok":false,"status":"error","message":"Unauthorized updater request"}\n'
  exit 1
fi

case "$ACTION" in
  status|update|rollback)
    NEBULADASH_UPDATER_CONFIG="$CONFIG" /usr/share/nebuladash-updater/updater.sh "$ACTION"
    ;;
  *)
    printf '{"ok":false,"status":"error","message":"Unsupported action"}\n'
    exit 1
    ;;
esac
```

- [ ] **Step 4: Implement installer**

Create `router-updater/install.sh`:

```sh
#!/bin/sh
set -eu

RUNTIME_DIR="${RUNTIME_DIR:-/usr/share/nebuladash-updater}"
CGI_PATH="${CGI_PATH:-/www/cgi-bin/nebuladash-updater}"
TARGET_LINK="${TARGET_LINK:-/www/nebuladash}"

mkdir -p "$RUNTIME_DIR" "$RUNTIME_DIR/work" "$RUNTIME_DIR/logs" /www/cgi-bin
cp "$(dirname "$0")/updater.sh" "$RUNTIME_DIR/updater.sh"
chmod +x "$RUNTIME_DIR/updater.sh"
cp "$(dirname "$0")/nebuladash-updater.cgi" "$CGI_PATH"
chmod +x "$CGI_PATH"

if [ ! -f "$RUNTIME_DIR/config" ]; then
  token="$(dd if=/dev/urandom bs=16 count=1 2>/dev/null | hexdump -v -e '/1 "%02x"')"
  cat > "$RUNTIME_DIR/config" <<EOF
NEBULADASH_TOKEN="$token"
TARGET_LINK="$TARGET_LINK"
PARTITION_A="/www/nebuladash-a"
PARTITION_B="/www/nebuladash-b"
RELEASE_URL="https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip"
WORK_DIR="$RUNTIME_DIR/work"
LOG_DIR="$RUNTIME_DIR/logs"
STATE_FILE="$RUNTIME_DIR/state.json"
EOF
  echo "Generated NebulaDash updater token: $token"
else
  echo "Existing config kept: $RUNTIME_DIR/config"
fi

echo "NebulaDash updater installed."
echo "Endpoint: /cgi-bin/nebuladash-updater"
echo "Target: $TARGET_LINK"
```

- [ ] **Step 5: Run smoke test and verify GREEN**

Run:

```bash
sh router-updater/smoke-test.sh
```

Expected: exits `0`; unauthorized CGI call returns `"ok":false`.

- [ ] **Step 6: Commit**

```bash
git add router-updater/nebuladash-updater.cgi router-updater/install.sh router-updater/smoke-test.sh
git commit -m "feat: add router updater installer"
```

---

### Task 4: Frontend API And Settings State

**Files:**

- Create: `src/api/routerUpdater.ts`
- Modify: `src/store/settings.ts`
- Test: `src/helper/routerUpdater.spec.ts`

**Interfaces:**

- Consumes:
  - `buildRouterUpdaterHeaders(token)`
  - `buildRouterUpdaterUrl(endpoint, action)`
  - `parseRouterUpdaterResponse(value)`
- Produces:
  - `fetchRouterUpdaterStatus(endpoint: string, token: string): Promise<RouterUpdaterResponse>`
  - `runRouterUpdaterAction(endpoint: string, token: string, action: 'update' | 'rollback'): Promise<RouterUpdaterResponse>`
  - `routerUpdaterEndpoint` storage key: `config/router-updater-endpoint`
  - `routerUpdaterToken` storage key: `config/router-updater-token`

- [ ] **Step 1: Write a failing test for default endpoint normalization**

Add to `src/helper/routerUpdater.spec.ts`:

```ts
import { getDefaultRouterUpdaterEndpoint } from './routerUpdater.ts'

test('uses the current origin for the default router updater endpoint', () => {
  assert.equal(
    getDefaultRouterUpdaterEndpoint('http://192.168.6.1:9090/ui/nebuladash/'),
    'http://192.168.6.1/cgi-bin/nebuladash-updater',
  )
})
```

- [ ] **Step 2: Run helper tests and verify RED**

Run:

```bash
pnpm test src/helper/routerUpdater.spec.ts
```

Expected: fails because `getDefaultRouterUpdaterEndpoint` is not exported.

- [ ] **Step 3: Implement default endpoint helper**

Add to `src/helper/routerUpdater.ts`:

```ts
export const getDefaultRouterUpdaterEndpoint = (href: string) => {
  const url = new URL(href)
  url.port = ''
  url.pathname = '/cgi-bin/nebuladash-updater'
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}
```

- [ ] **Step 4: Create frontend API wrapper**

Create `src/api/routerUpdater.ts`:

```ts
import {
  buildRouterUpdaterHeaders,
  buildRouterUpdaterUrl,
  parseRouterUpdaterResponse,
  type RouterUpdaterAction,
} from '@/helper/routerUpdater'

const callRouterUpdater = async (endpoint: string, token: string, action: RouterUpdaterAction) => {
  const response = await fetch(buildRouterUpdaterUrl(endpoint, action), {
    method: action === 'status' ? 'GET' : 'POST',
    headers: buildRouterUpdaterHeaders(token),
  })
  const payload = await response.json().catch(() => null)
  const parsed = parseRouterUpdaterResponse(payload)

  if (!response.ok || !parsed.ok) {
    throw new Error(parsed.message || `Router updater ${action} failed`)
  }

  return parsed
}

export const fetchRouterUpdaterStatus = (endpoint: string, token: string) => {
  return callRouterUpdater(endpoint, token, 'status')
}

export const runRouterUpdaterAction = (
  endpoint: string,
  token: string,
  action: Exclude<RouterUpdaterAction, 'status'>,
) => {
  return callRouterUpdater(endpoint, token, action)
}
```

- [ ] **Step 5: Add settings storage**

Modify `src/store/settings.ts` by adding:

```ts
import { getDefaultRouterUpdaterEndpoint } from '@/helper/routerUpdater'

export const routerUpdaterEndpoint = useStorage(
  'config/router-updater-endpoint',
  getDefaultRouterUpdaterEndpoint(window.location.href),
)
export const routerUpdaterToken = useStorage('config/router-updater-token', '')
```

If `src/store/settings.ts` already has imports from helpers and `useStorage`, merge with the existing import blocks.

- [ ] **Step 6: Run tests and type check**

Run:

```bash
pnpm test src/helper/routerUpdater.spec.ts
pnpm type-check
```

Expected: helper tests pass; type check passes.

- [ ] **Step 7: Commit**

```bash
git add src/helper/routerUpdater.ts src/helper/routerUpdater.spec.ts src/api/routerUpdater.ts src/store/settings.ts
git commit -m "feat: add router updater frontend api"
```

---

### Task 5: Frontend Settings Controls

**Files:**

- Modify: `src/components/settings/ZashboardSettings.vue`
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/zh.ts`
- Modify: `src/i18n/zh-tw.ts`
- Modify: `src/i18n/ru.ts`

**Interfaces:**

- Consumes:
  - `fetchRouterUpdaterStatus(endpoint, token)`
  - `runRouterUpdaterAction(endpoint, token, 'update' | 'rollback')`
  - `routerUpdaterEndpoint`
  - `routerUpdaterToken`
- Produces: visible settings controls for endpoint, token, status, update, rollback.

- [ ] **Step 1: Add i18n keys**

Add these keys to every language file near `upgradeUI`:

```ts
routerUpdater: 'NebulaDash updater',
routerUpdaterEndpoint: 'Updater endpoint',
routerUpdaterToken: 'Updater token',
routerUpdaterStatus: 'Updater status',
routerUpdaterCheck: 'Check updater',
routerUpdaterUpdate: 'Update NebulaDash',
routerUpdaterRollback: 'Rollback NebulaDash',
routerUpdaterTokenMissing: 'Set the updater token before running this action',
routerUpdaterSuccess: 'NebulaDash updater action completed',
routerUpdaterFailed: 'NebulaDash updater action failed',
```

Use Chinese text in `zh.ts`:

```ts
routerUpdater: 'NebulaDash 更新器',
routerUpdaterEndpoint: '更新器地址',
routerUpdaterToken: '更新器密钥',
routerUpdaterStatus: '更新器状态',
routerUpdaterCheck: '检查更新器',
routerUpdaterUpdate: '更新 NebulaDash',
routerUpdaterRollback: '回滚 NebulaDash',
routerUpdaterTokenMissing: '请先填写更新器密钥',
routerUpdaterSuccess: 'NebulaDash 更新器操作完成',
routerUpdaterFailed: 'NebulaDash 更新器操作失败',
```

- [ ] **Step 2: Wire imports in `ZashboardSettings.vue`**

Add imports:

```ts
import { fetchRouterUpdaterStatus, runRouterUpdaterAction } from '@/api/routerUpdater'
import { routerUpdaterEndpoint, routerUpdaterToken } from '@/store/settings'
```

Add refs:

```ts
const routerUpdaterBusy = ref(false)
const routerUpdaterMessage = ref('')

const assertRouterUpdaterToken = () => {
  if (!routerUpdaterToken.value.trim()) {
    showNotification({ content: 'routerUpdaterTokenMissing', type: 'alert-warning' })
    return false
  }
  return true
}

const checkRouterUpdater = async () => {
  if (!assertRouterUpdaterToken()) return
  routerUpdaterBusy.value = true
  try {
    const result = await fetchRouterUpdaterStatus(
      routerUpdaterEndpoint.value,
      routerUpdaterToken.value,
    )
    routerUpdaterMessage.value = result.message || result.status
    showNotification({ content: 'routerUpdaterSuccess', type: 'alert-success' })
  } catch (error) {
    routerUpdaterMessage.value = error instanceof Error ? error.message : ''
    showNotification({ content: 'routerUpdaterFailed', type: 'alert-error' })
  } finally {
    routerUpdaterBusy.value = false
  }
}

const updateNebulaDashViaRouter = async () => {
  if (!assertRouterUpdaterToken()) return
  routerUpdaterBusy.value = true
  try {
    const result = await runRouterUpdaterAction(
      routerUpdaterEndpoint.value,
      routerUpdaterToken.value,
      'update',
    )
    routerUpdaterMessage.value = result.message || result.status
    showNotification({ content: 'routerUpdaterSuccess', type: 'alert-success' })
    setTimeout(() => window.location.reload(), 1000)
  } catch (error) {
    routerUpdaterMessage.value = error instanceof Error ? error.message : ''
    showNotification({ content: 'routerUpdaterFailed', type: 'alert-error' })
  } finally {
    routerUpdaterBusy.value = false
  }
}

const rollbackNebulaDashViaRouter = async () => {
  if (!assertRouterUpdaterToken()) return
  routerUpdaterBusy.value = true
  try {
    const result = await runRouterUpdaterAction(
      routerUpdaterEndpoint.value,
      routerUpdaterToken.value,
      'rollback',
    )
    routerUpdaterMessage.value = result.message || result.status
    showNotification({ content: 'routerUpdaterSuccess', type: 'alert-success' })
    setTimeout(() => window.location.reload(), 1000)
  } catch (error) {
    routerUpdaterMessage.value = error instanceof Error ? error.message : ''
    showNotification({ content: 'routerUpdaterFailed', type: 'alert-error' })
  } finally {
    routerUpdaterBusy.value = false
  }
}
```

- [ ] **Step 3: Add template controls**

Add a compact section below the existing “更新面板 / 导出设置 / 导入设置” controls:

```vue
<div class="mt-4 grid max-w-3xl grid-cols-1 gap-2 md:grid-cols-2">
  <div class="setting-item">
    <div class="setting-item-label">{{ $t('routerUpdaterEndpoint') }}</div>
    <TextInput
      class="w-64"
      v-model="routerUpdaterEndpoint"
      :clearable="false"
    />
  </div>
  <div class="setting-item">
    <div class="setting-item-label">{{ $t('routerUpdaterToken') }}</div>
    <TextInput
      class="w-64"
      v-model="routerUpdaterToken"
      :clearable="true"
    />
  </div>
  <div class="col-span-1 flex gap-2 md:col-span-2">
    <button
      class="btn btn-sm"
      :disabled="routerUpdaterBusy"
      @click="checkRouterUpdater"
    >
      {{ $t('routerUpdaterCheck') }}
    </button>
    <button
      class="btn btn-primary btn-sm"
      :disabled="routerUpdaterBusy"
      @click="updateNebulaDashViaRouter"
    >
      {{ $t('routerUpdaterUpdate') }}
    </button>
    <button
      class="btn btn-warning btn-sm"
      :disabled="routerUpdaterBusy"
      @click="rollbackNebulaDashViaRouter"
    >
      {{ $t('routerUpdaterRollback') }}
    </button>
  </div>
  <p
    v-if="routerUpdaterMessage"
    class="text-base-content/70 col-span-1 text-xs md:col-span-2"
  >
    {{ routerUpdaterMessage }}
  </p>
</div>
```

- [ ] **Step 4: Run verification**

Run:

```bash
pnpm type-check
pnpm lint
pnpm build
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/ZashboardSettings.vue src/i18n/en.ts src/i18n/zh.ts src/i18n/zh-tw.ts src/i18n/ru.ts
git commit -m "feat: add router updater settings controls"
```

---

### Task 6: Documentation And Maintenance Log

**Files:**

- Create: `router-updater/README.md`
- Modify: `README.md`
- Modify: `PUBLICATION.md`
- Modify: `upstream-followup/AI-HANDOFF.md`
- Modify: `upstream-followup/NEBULADASH-ITERATION-PLAN.md`
- Modify: `upstream-followup/NEBULADASH-CHANGELOG.md`

**Interfaces:**

- Consumes: completed router updater scripts and frontend controls.
- Produces: deploy/run/rollback instructions and handoff context.

- [ ] **Step 1: Write router updater README**

Create `router-updater/README.md`:

````md
# NebulaDash Router Updater

This folder contains the optional router-side updater used by NebulaDash.

## Runtime Layout

```text
/usr/share/nebuladash-updater/
  config
  updater.sh
  state.json
  logs/
  work/

/www/cgi-bin/nebuladash-updater
/www/nebuladash -> /www/nebuladash-a or /www/nebuladash-b
/www/nebuladash-a
/www/nebuladash-b
```
````

## Install

Copy this folder to the router and run:

```sh
sh router-updater/install.sh
```

The installer prints a generated token. Save that token in NebulaDash settings.

## Frontend Settings

Endpoint:

```text
http://192.168.6.1/cgi-bin/nebuladash-updater
```

Token:

```text
Use the generated NEBULADASH_TOKEN value.
```

## Safety

The updater deploys into the inactive partition first. It switches `/www/nebuladash`
only after the new partition contains `index.html`, `assets/`, and
`manifest.webmanifest`.

## Rollback

Use the NebulaDash settings rollback button or run:

```sh
NEBULADASH_UPDATER_CONFIG=/usr/share/nebuladash-updater/config \
  /usr/share/nebuladash-updater/updater.sh rollback
```

```

```

- [ ] **Step 2: Update public README**

Add a short section after “OpenClash / Mihomo 更新配置”:

```md
## NebulaDash 自管理更新器

OpenClash LuCI 内置按钮不包含 NebulaDash。若希望在 NebulaDash 前端里一键更新，
可安装本仓的可选路由器端更新器：

- 源码目录：`router-updater/`
- 运行目录：`/usr/share/nebuladash-updater/`
- 面板目录：`/www/nebuladash`
- 部署策略：A/B 分区，失败不切换，支持回滚

安装和配置见 `router-updater/README.md`。
```

- [ ] **Step 3: Update maintenance docs**

Append to `upstream-followup/NEBULADASH-CHANGELOG.md`:

```md
### feat: plan router-side AB updater

- 提交：当前工作区
- 类型：部署体验规划
- 目的：规划一个可由 NebulaDash 前端触发的路由器端 AB 更新器，替代手工复制 `/www/nebuladash`。
- 涉及文件：`docs/superpowers/plans/2026-06-26-nebuladash-router-updater.md`
- 行为变化：无运行时代码变化；这是实施计划。
- 验证：文档格式检查。
- 后续注意：实现时必须保留 token、防止任意命令执行，并确保失败不切换 active 分区。
```

After actual implementation tasks, replace this planning-only entry with concrete implementation entries.

- [ ] **Step 4: Run doc formatting**

Run:

```bash
pnpm exec prettier --check README.md PUBLICATION.md router-updater/README.md upstream-followup/*.md docs/superpowers/plans/*.md
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add README.md PUBLICATION.md router-updater/README.md upstream-followup/AI-HANDOFF.md upstream-followup/NEBULADASH-ITERATION-PLAN.md upstream-followup/NEBULADASH-CHANGELOG.md
git commit -m "docs: document router updater workflow"
```

---

### Task 7: Final Verification And Release Prep

**Files:**

- Modify: `upstream-followup/NEBULADASH-CHANGELOG.md`

**Interfaces:**

- Consumes: all previous tasks.
- Produces: verified branch ready for next NebulaDash release.

- [ ] **Step 1: Run full local verification**

Run:

```bash
pnpm release:check
pnpm test
pnpm type-check
pnpm lint
pnpm build
sh router-updater/smoke-test.sh
pnpm exec prettier --check README.md README-改动说明.md PUBLICATION.md router-updater/*.md upstream-followup/*.md docs/superpowers/plans/*.md
git diff --check
```

Expected:

- `pnpm release:check` passes.
- All Node tests pass.
- Type check passes.
- Lint exits `0`.
- Build exits `0`.
- Router updater smoke test exits `0`.
- Prettier check passes.
- `git diff --check` exits `0`, allowing only CRLF warnings on Windows.

- [ ] **Step 2: Update changelog validation lines**

Add the exact commands and results from Step 1 to the latest `upstream-followup/NEBULADASH-CHANGELOG.md` entry.

- [ ] **Step 3: Commit verification log**

```bash
git add upstream-followup/NEBULADASH-CHANGELOG.md
git commit -m "docs: record router updater verification"
```

- [ ] **Step 4: Decide release version**

If this feature is shipped after `2.8.0-nebula.2`, bump to `2.8.0-nebula.3` in `package.json` and docs using the existing `pnpm release:check` workflow.

---

## Self-Review

- Spec coverage: The plan covers a router-side service folder, token protection, frontend-triggered update, A/B deployment, rollback, failure safety, install docs, and maintenance documentation.
- Placeholder scan: No `TBD`, `TODO`, or “fill in later” placeholders remain.
- Type consistency: `RouterUpdaterAction`, `RouterUpdaterStatus`, and `RouterUpdaterResponse` are defined in Task 1 and reused consistently by later frontend tasks.
- Scope check: The plan intentionally avoids modifying OpenClash LuCI internals and avoids a long-running Node/Docker service.
