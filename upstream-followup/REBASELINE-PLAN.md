# NebulaDash 重基线方案（以官方最新版为基线重建）

## 1. 为什么改策略

「选择性移植」的问题：

- 每个上游重构（3.x 起代理页、连接、日志都进入 `assembly/*` 分层）都要再做一次适配。
- 本地 `main` 与 `upstream/main` **没有 merge-base**，差异只能靠人工 diff 维护，成本随上游提交量线性增长。
- 越晚重基线，本地实现的「上游影子代码」越多，最终无法判断哪段是本地增强、哪段是过时复制。

**新策略**：以官方最新版本为代码基线，把 NebulaDash 特色按清单重放。

顺带收益：

- 直接获得上游 3.x 全部能力（代理文件夹、搜索模式、多后端标题、连接延迟统计、移动端修复、视觉体系）。
- 本地代码量大幅下降，只剩「上游没有且解决 OpenClash 痛点」的部分。
- 之后每次跟进上游只需 `git merge upstream/main`（因为共享上游历史），不再需要人工 diff。

## 1.5 已核实的基线事实（2026-06-29 实测）

| 项 | 值 |
| --- | --- |
| 上游最新 tag | **v3.30.0**（2026-10-28） |
| `upstream/main` | `bf4f00b` |
| 相比上次审计点 `9150a53e` 新增提交 | **207 个** |
| `v3.11.0..v3.30.0` 变更规模 | 369 文件，+34252 / −19586 |
| 提交类型分布 | fix 84 / feat 74 / refactor 33 / chore 25 / perf 1 |
| 本仓 `main` 与 `upstream/main` | 仍无 merge-base |

**基线选择：`v3.30.0`**（用 tag 而非 `upstream/main`，保证可复现；`main` 相对该 tag 只多一个 release 提交）。

上游这轮的架构变化：

- 引入 `src/assembly/` 分层与 `driver/{clash,dae}` 多核抽象，**sing-box 已移除**，新增 dae。
- `src/store/proxies.ts` 从 500+ 行降到 12 行，数据层全部搬到 `src/assembly/proxies/*`。
- 代理页改为 `VirtualColumn` 虚拟滚动 + 列式布局，新增代理文件夹。
- 新增 Earth 地球视图 / GeoIP、Taildrop、自定义 CSS、toast、SegmentedControl、规则与日志表格视图、连接分组与过滤、后端可达性诊断。
- 工具链升级：`vite ^8.1.5`、`typescript ~6.0.3`、`@types/node ^26`。
- 自带测试环境 `test/`（mock-server / mock-dae-server / verify / bench）。

**上游仍未解决的关键问题**（也就是 NebulaDash 的存在理由）：

- `/proxies` 与 `/providers/proxies` 仍用 `Promise.all` 同时请求。
- `/providers/proxies` 请求仍**无超时**。
- 无 Provider 缓存、无降级、无失败去重。

## 2. 前置条件

| 项 | 状态 | 说明 |
| --- | --- | --- |
| Git | ✅ 可用 | `D:\Git\bin\bash.exe`，git 2.55.0 |
| bash | ✅ 可用 | pi `shellPath` 已指向 `D:\Git\bin\bash.exe` |
| node / pnpm | ✅ 可用 | node v24.18.1，pnpm 10.15.0 |
| `upstream` 远程 | ✅ 已配置且只拉取 | push URL 已设为 `DISABLED` |
| 上游 tag | ✅ 已 fetch | `v3.30.0` |

原先的“必须先装 Git for Windows”阻塞已解除。

## 3. 关键决策点（执行前必须确认）

### 3.1 公开仓库历史形态

当前 `origin/boostemotion/nebuladash` 是**独立干净历史**（`b28546ab` 初始化）。

以官方最新版为基线后，分支会**包含上游完整历史**。三个选项：

| 选项 | 做法 | 后果 |
| --- | --- | --- |
| A（推荐） | 新分支基于上游 tag，`origin/main` 直接指向它 | 后续可 `merge upstream/main`；仓库含上游历史，需保留 MIT 版权与作者信息 |
| B | 保留旧仓，新建仓库承载新基线 | 旧 Release 链接不断，但维护两套 |
| C | 仍然只发布构建产物，仓库内部用上游基线 | 需要重写 `PUBLICATION.md` 的公开内容边界 |

**推荐 A**：这是唯一能让后续上游跟进变成普通 `git merge` 的方案。需要同步修改 `PUBLICATION.md`（说明仓库已包含上游历史、保留上游 LICENSE 与版权声明）。

### 3.2 版本号起点

新基线不再继续 `2.8.0-nebula.x`，建议：

```text
<上游最新版本>-nebula.<轮次>
例如上游 v3.11.0 → 3.11.0-nebula.1
```

好处：一眼能看出「基线是哪个上游版本」。需同步更新 `src/helper/releasePreflight.ts` 的正则（当前已支持 `x.y.z-nebula.a[.b[.c]]`，无需改）。

### 3.3 旧线保留

旧版本保留为 tag 与分支，便于回退：

```bash
git tag -a legacy/nebula-2.8.0 -m "NebulaDash legacy baseline (Zashboard 2.8.0)"
git push origin legacy/nebula-2.8.0
```

若担心风险，先发布一个「最终 legacy 版本」Release 再开始。

## 4. 执行流程

### 阶段 0：快照与备份

```bash
git status --short                     # 必须干净，否则先提交或 stash
git fetch origin --tags
git tag -a legacy/nebula-2.8.0 -m "NebulaDash legacy baseline"
git push origin legacy/nebula-2.8.0
```

### 阶段 1：建立上游基线分支

```bash
git remote add upstream https://github.com/Zephyruso/zashboard.git   # 已补，可跳过
git remote set-url --push upstream DISABLED                        # 已设置
git fetch upstream --tags                                            # 已 fetch 到 v3.30.0
git tag -l 'v3*' | sort -V | tail -5
git log --oneline -20 upstream/main

# 以最新 tag 为基线（推荐 tag 而非 main，理由：可复现）
git switch -c rebase/upstream-v3.30.0 v3.30.0
```

记录基线信息写入本文与 `UPSTREAM-FEATURES.md`：

- 基线 tag / commit
- 拉取日期
- 与 `upstream/main` 的差异提交数

### 阶段 2：清理上游产物，确认本地起点

在 `rebase/upstream-vX.Y.Z` 上确认：

```bash
pnpm install
pnpm type-check
pnpm build          # 先确认上游自己能跑通
```

如果上游本身在此环境跑不通，先解决（或记录已知问题），否则后续无法区分「上游问题」和「移植问题」。

### 阶段 3：按依赖顺序重放 NebulaDash 特色

严格按 `NEBULADASH-FEATURE-INVENTORY.md` §23 的顺序，每完成一组单独提交并跑一遍完整验收。

| 提交组 | 内容 | 依据 |
| --- | --- | --- |
| `feat(infra)` | 品牌、版本格式、构建拆包、路由懒加载、PWA 名称 | 清单 §13 §16 |
| `feat(provider)` | `helper/proxyCache`、`store/proxies` 缓存/去重/降级、api 15s 超时、i18n 状态 | 清单 §3 §4 §5 |
| `feat(proxies)` | 三段视图、聚类排序、首屏上限、滚动恢复 | 清单 §1 §2 §11 |
| `feat(search)` | 上游搜索骨架 + 本地语义注入、Provider 搜索、规则联动、链路感知、高亮一致性 | 清单 §6 §7 §8 §10 |
| `feat(rule-shortcut)` | 链式展开、跳转规则、跨分段定位、Provider 尾标 | 清单 §9 |
| `feat(release)` | `helper/version`、更新源保护、设置页检查、`releasePreflight`、`release.yml` | 清单 §14 §17 |
| `feat(updater)` | `router-updater/` 整块搬运 + 前端按钮/轮询 | 清单 §15 |
| `chore(misc)` | 设置导入清洗、Setup 提示、移动端视口（以上游为主）、启动脚本 | 清单 §12 §18 §19 §21 |

**每组提交必须满足**：

1. `pnpm test && pnpm type-check && pnpm lint && pnpm build` 全绿。
2. 清单 §24 中对应域的回归项逐条勾选。
3. 追加 `NEBULADASH-CHANGELOG.md` 记录。

**严禁**：

- 一次性把旧 `src/` 整目录拷到新基线上（会带回全部过时上游代码，等于没重基线）。
- 在没有跑通验收的情况下继续下一组。

### 阶段 4：差异复核

全部重放完成后，对比旧实现确认「没有丢掉约束」：

```bash
git diff legacy/nebula-2.8.0..HEAD --stat
# 逐项核对清单 §23 的每一组是否都有对应落点
```

同时核对**新增**内容：上游带来的能力是否被本地代码无意覆盖（例如本地旧实现把上游新组件替换回旧版）。

### 阶段 5：发布

```bash
# package.json version → <upstream>-nebula.1
pnpm release:check
git tag v<version>
git push origin <branch> --tags
```

`release.yml` 会产出 `dist.zip` 与 `router-updater.zip`。

发布后更新：

- `README.md` / `README-改动说明.md`（版本号、Release 链接、能力清单）
- `AI-HANDOFF.md`（新基线、新审计点、新约束）
- `UPSTREAM-FEATURES.md`（审计点重置为新基线）
- `NEBULADASH-ITERATION-PLAN.md`（第 4/7/8 章按新基线重写）
- `PUBLICATION.md`（若采用 §3.1 选项 A）

### 阶段 6：切换主线

```bash
git switch main
git reset --hard rebase/upstream-vX.Y.Z      # 或 merge（fast-forward）
git push origin main
```

之后的上游跟进改为：

```bash
git fetch upstream --tags
git merge upstream/main        # 现在有共同祖先，可以正常合并
```

## 5. 风险与回退

| 风险 | 表现 | 应对 |
| --- | --- | --- |
| 重放遗漏本地约束 | 代理页首屏重新被 `/providers/proxies` 阻塞 | 每阶段执行清单 §24；用 `legacy` tag 对照 |
| 上游基线自身不稳 | 构建失败 / 功能回退 | 阶段 2 先验证上游可用；必要时换用上一个 tag |
| 上游 3.x 与 OpenClash 不兼容 | 某些接口字段变化（如 sing-box 分支判断） | 逐项核对 `isSingBox` 分支与 API 字段；只保留 Mihomo 路径可用即可 |
| 历史形态变化影响发布 | Release 链接、`PUBLICATION.md` 失效 | 阶段 5 统一核对下载地址与 latest 跳转 |
| 中途放弃 | 分支未完成 | 主线一直保持 `legacy/nebula-2.8.0`，随时可回退发布 |

**回退**：

```bash
git switch main
git reset --hard legacy/nebula-2.8.0
```

## 6. 时间与工作量预估

| 阶段 | 内容 | 相对工作量 |
| --- | --- | --- |
| 0-2 | 备份、拉基线、验证上游可跑 | 小（依赖网络与环境） |
| 3 | 8 组重放 | **主要工作量**，其中 ② Provider 层 与 ④ 搜索 最难 |
| 4 | 差异复核 | 中 |
| 5-6 | 发布与切主线 | 小 |

最容易被低估的两块：

- **搜索**：上游已有搜索内核，需要判断「哪些语义是本地独有必须注入」，而不是重写一套。
- **代理页分段**：上游 3.x 已重构代理页与移动端布局，需要把「按角色分段 + Provider 独立按需加载」嵌进上游结构，而不是恢复旧页面。

## 7. 不做的事

- 不做 `git rebase upstream/main` / `git merge upstream/main`（当前无 merge-base，阶段 1 之后才可以）。
- 不整目录拷贝旧 `src/`。
- 不为了保留旧实现而复制上游文件。
- 不在重放过程中引入新功能（重基线只做等价重建，新功能另开分支）。
