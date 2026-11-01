# 上游跟进 SOP

> 当前模型：**共享历史 + 直接合并**。重基线（`v3.30.0`）之后本仓与上游有共同祖先，
> 不再需要“逐个提交 cherry-pick”。旧 SOP 的 cherry-pick 流程已作废。

## 一、三条线

| 线       | 做法                                            | 频率       |
| -------- | ----------------------------------------------- | ---------- |
| 上游跟进 | `git merge upstream/main`（或合并某个上游 tag） | 上游发版后 |
| 本地增强 | 直接提交到 `main`，走自动发版                   | 有需求时   |
| 紧急修复 | 直接提交到 `main`，走自动发版                   | 按需       |

## 二、上游同步流程

```bash
# 1. 拉取上游（upstream 只读，push URL 已设为 DISABLED）
git fetch upstream --tags

# 2. 看差了多少
git log --oneline HEAD..upstream/main | head -30
git diff --stat HEAD..upstream/main -- src/

# 3. 合并（推荐带 --no-ff 保留合并点）
git switch main
git merge --no-ff upstream/main

# 4. 解决冲突（见下方高冲突文件）

# 5. 全量验证
pnpm install
pnpm test && pnpm type-check && pnpm lint && pnpm build
pnpm test:nebula && pnpm test:verify
pnpm release:check

# 6. 提交并推送（会自动发一版）
git push origin main
```

只跟某个稳定点：`git merge v3.31.0`（tag 名按上游实际）。

### 高冲突文件与判定要点

| 文件                                          | 合并后必须确认                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/assembly/proxies/actions.ts`、`state.ts` | 按需加载、缓存键、去重、代际校验、`refreshProxyData` 仍在                     |
| `src/assembly/driver/clash.ts`                | `fetch()` 只取 `/proxies`；`fetchProviders()` 存在；超时来自设置              |
| `src/helper/proxies.ts`                       | 三段拆分 + 聚类排序 + 反向映射未被上游搜索实现覆盖                            |
| `src/components/controls/ProxiesCtrl.tsx`     | 三段 Tab、状态徽标、按需拉取、`data-proxy-search` 锚点                        |
| `src/views/ProxiesPage.vue`                   | 空状态提示、文件夹 UI 判定                                                    |
| `src/helper/search.ts`                        | 智能匹配（NFKC / 符号容错 / 域名变体）与上游正则共存                          |
| `src/store/proxy-folders.ts`                  | 上游内置文件夹不会被重新预置                                                  |
| `vite.config.ts`、`src/router/index.ts`       | 品牌、`APP_VERSION`、`manualChunks`、路由懒加载                               |
| `.github/workflows/*`                         | auto-release / release 的路径过滤、Chrome 回归步骤、`tools/build-archives.sh` |

判定原则：**不整文件覆盖**；先看上游那次提交想解决什么，再手工融合；一次只同步一个能力。

合并后跑 `test:nebula` 是关键闸门：它直接守着“首屏不拉 Provider / 切换只拉一次 /
反向映射 / 链路尾标 / 更新源保护”这些本地契约。

## 三、发布流程

推 `main` 即自动发版（`.github/workflows/auto-release.yml`）：

1. 按上一个 `v*-nebula.*` tag 递增版本
2. `eslint` → `test` → `type-check` → `test:nebula` → `test:verify`
3. `tools/build-archives.sh` 构建 7 种字体变体 + `router-updater.zip`
4. 打 tag → 发布 Release

关键约定：

- **版本号由 tag 决定**，构建时注入 `APP_VERSION`，**不回写 `package.json`**
  （所以发版不会让本地与远端分叉）
- 只改文档不触发发布
- 跳过某次自动发布：commit message 带 `[skip release]`
- 需要手工指定版本 / 全量 7 变体：手动 `git tag v<x.y.z>-nebula.<n> && git push origin <tag>`，
  走 `release.yml`
- 发布失败时工作流会把诊断写到 `ci-diagnostics` 分支：
  `git show origin/ci-diagnostics:.ci/last-failure.txt`

## 四、文档与验证规范

- 每次改动追加 `NEBULADASH-CHANGELOG.md`（日期 / 目的 / 文件 / 行为 / 验证 / 注意）
- 影响路线 → `NEBULADASH-ITERATION-PLAN.md`
- 影响接手路径 → `AI-HANDOFF.md`
- 影响用户用法 → `README.md` / `README-改动说明.md`
- 影响路由器部署 → `router-updater/README.md` / `PUBLICATION.md`
- 不要把本地改动写进根目录 `CHANGELOG.md`（它来自上游）
- 纯文档改动至少跑：`pnpm exec prettier --check README.md README-改动说明.md PUBLICATION.md upstream-followup/*.md`

## 五、提交信息约定

```
feat(proxies): ...
fix(provider): ...
ci: ...
docs: ...
refactor(provider): ...
```

括号里用受影响域（proxies / provider / search / rules / release / updater / ci / docs），
便于回溯“哪一类能力被改了”。
