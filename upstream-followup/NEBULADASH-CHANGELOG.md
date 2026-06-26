# NebulaDash 维护更新日志

本文件记录 NebulaDash 分支的实际维护改动，作为后续继续迭代、对比上游和排查回归的固定入口。

根目录 `CHANGELOG.md` 主要来自官方 Zashboard，不用于记录本分支的本地优化。

## 记录规则

每次修改后都必须在本文追加一条记录，至少包含：

- 日期
- 提交哈希或当前工作状态
- 修改目的
- 涉及文件
- 行为变化
- 验证命令
- 后续注意事项

涉及 OpenClash 慢接口、代理页、规则页、搜索、缓存、更新源和发布流程的改动，必须写清楚约束，避免后续同步上游时误删本地优化。

---

## 2026-06-26

### feat: warn before risky router updater installs

- 提交：当前工作区
- 类型：更新器风险提示 / 版本治理
- 目的：允许用户继续安装同版本或旧版本，但在前端触发路由器更新前明确提示风险，避免误以为 latest 一定比当前构建新。

涉及文件：

- `src/helper/version.ts`
- `src/helper/version.spec.ts`
- `src/components/settings/ZashboardSettings.vue`
- `src/i18n/en.ts`
- `src/i18n/zh.ts`
- `src/i18n/zh-tw.ts`
- `src/i18n/ru.ts`
- `upstream-followup/NEBULADASH-CHANGELOG.md`

行为变化：

- 新增 `compareReleaseVersion()`，可区分远端 Release 相对当前版本的新版本、同版本、旧版本和无法解析。
- 点击路由器更新器的“更新 NebulaDash”前会先查询 NebulaDash latest Release。
- 远端版本更新时直接继续。
- 远端版本相同、远端版本更旧或版本检查失败时，弹出确认提示；用户确认后仍可继续安装。
- 路由器脚本不硬拒绝旧版本，保留用户主动回退或覆盖安装能力。

验证：

- `pnpm test src/helper/version.spec.ts`：先失败于缺少 `compareReleaseVersion`，实现后 50/50 pass
- `pnpm test`：50/50 pass
- `pnpm type-check`：pass
- `pnpm lint`：pass
- `pnpm build`：pass
- `pnpm exec prettier --check upstream-followup/NEBULADASH-CHANGELOG.md src/helper/version.ts src/helper/version.spec.ts src/components/settings/ZashboardSettings.vue src/i18n/en.ts src/i18n/zh.ts src/i18n/zh-tw.ts src/i18n/ru.ts`：pass
- `git diff --check`：pass，仅提示 Windows 工作区换行转换

后续注意：

- 当前使用浏览器原生 `window.confirm()`，后续如需更统一的视觉体验，可替换为项目内 modal，但必须保留同版本、旧版本和未知版本三类风险提示。
- 版本检查依赖 GitHub Release API；如果路由器或浏览器无法访问 GitHub API，会进入“无法确认版本”的确认路径。

### feat: add router-side AB updater

- 提交：`96410915`、`3c8be8e4`、`dafbae80`、`f19cf352`、`a7433367`、`2070a6d1`，验证记录为当前工作区
- 类型：部署体验 / 更新器 / 设置页
- 目的：让 NebulaDash 前端按钮触发路由器端更新脚本，用 A/B 分区替代每次手工复制 `/www/nebuladash`。

涉及文件：

- `.gitattributes`
- `router-updater/config.example`
- `router-updater/updater.sh`
- `router-updater/nebuladash-updater.cgi`
- `router-updater/install.sh`
- `router-updater/smoke-test.sh`
- `router-updater/README.md`
- `src/helper/routerUpdater.ts`
- `src/helper/routerUpdater.spec.ts`
- `src/api/routerUpdater.ts`
- `src/store/settings.ts`
- `src/components/settings/ZashboardSettings.vue`
- `src/i18n/en.ts`
- `src/i18n/zh.ts`
- `src/i18n/zh-tw.ts`
- `src/i18n/ru.ts`
- `README.md`
- `PUBLICATION.md`
- `upstream-followup/AI-HANDOFF.md`
- `upstream-followup/NEBULADASH-ITERATION-PLAN.md`
- `upstream-followup/NEBULADASH-CHANGELOG.md`

行为变化：

- 新增可选路由器端更新器源码目录 `router-updater/`。
- 安装后运行目录为 `/usr/share/nebuladash-updater/`，CGI 入口为 `/www/cgi-bin/nebuladash-updater`。
- 更新器管理 `/www/nebuladash-a`、`/www/nebuladash-b` 和 `/www/nebuladash` symlink。
- 更新器只接受 `status`、`update`、`rollback`，并要求 `X-NebulaDash-Token`。
- 更新流程先部署 inactive 分区，验证 `index.html`、`assets/`、`manifest.webmanifest` 后再切换。
- 前端设置页新增 updater endpoint、token、检查、更新和回滚按钮。
- 默认 endpoint 会从当前地址推导为 `http://<router>/cgi-bin/nebuladash-updater`。

验证：

- `pnpm test src/helper/routerUpdater.spec.ts`：先失败于缺少 helper / 默认 endpoint 函数，实现后 49/49 pass
- `pnpm release:check`：pass，期望 tag 为 `v2.8.0-nebula.2`
- `pnpm test`：初次在 sandbox 内被 Windows ACL 拦截；提升权限重跑后 49/49 pass
- `pnpm type-check`：pass
- `pnpm lint`：pass
- `pnpm build`：pass
- `pnpm exec prettier --check README.md README-改动说明.md PUBLICATION.md router-updater/*.md upstream-followup/*.md docs/superpowers/plans/*.md`：pass
- `git diff --check`：pass
- `sh router-updater/smoke-test.sh`：当前 Windows 本机失败，原因是 `sh` 不存在；脚本文件已确认 LF，仍需在 OpenWrt、Linux、WSL 或 Git Bash 环境执行。

后续注意：

- 真实路由器验证前，不要把该更新器标记为已完成生产回归。
- 不能让前端传任意命令给 CGI；后续只能扩展固定 action。
- 更新器 token 是本地 updater token，不是 GitHub token、OpenClash secret 或 Mihomo API password。

### docs: plan router-side AB updater

- 提交：当前工作区
- 类型：部署体验规划
- 目的：规划一个可由 NebulaDash 前端触发的路由器端 AB 更新器，替代手工复制 `/www/nebuladash`。

涉及文件：

- `docs/superpowers/plans/2026-06-26-nebuladash-router-updater.md`
- `upstream-followup/NEBULADASH-CHANGELOG.md`

行为变化：

- 无运行时代码变化；这是实施计划。
- 计划约束了 updater 独立目录、token 校验、`status/update/rollback` 三个动作、A/B 分区、失败不切换和回滚路径。

验证：

- `pnpm exec prettier --check upstream-followup/NEBULADASH-CHANGELOG.md docs/superpowers/plans/*.md`：初次发现计划文档格式问题，已执行 `pnpm exec prettier --write docs/superpowers/plans/2026-06-26-nebuladash-router-updater.md` 修复。
- `git diff --check`：pass；仅提示 Windows 工作区换行转换。

后续注意：

- 实现时必须保留 token 校验，不能允许前端传任意 shell 命令。
- 实现时必须先部署到 inactive 分区并验证结构，再切换 `/www/nebuladash`。

### chore: add release preflight and bump nebula patch version

- 提交：当前工作区
- 类型：发布流程固化 / 版本治理
- 目的：把发布前版本检查固化为可本地复用的脚本，并明确 NebulaDash 不直接使用 Zashboard 官方风格版本号。

涉及文件：

- `package.json`
- `.github/workflows/release.yml`
- `tools/release-preflight.ts`
- `src/helper/releasePreflight.ts`
- `src/helper/releasePreflight.spec.ts`
- `README.md`
- `PUBLICATION.md`
- `upstream-followup/AI-HANDOFF.md`
- `upstream-followup/NEBULADASH-ITERATION-PLAN.md`
- `upstream-followup/NEBULADASH-CHANGELOG.md`

行为变化：

- 当前开发线版本从 `2.8.0-nebula.1` 推进到 `2.8.0-nebula.2`。
- 新增 `pnpm release:check`，校验包名、Nebula 版本格式和 tag/package 一致性。
- Release workflow 改为调用同一个 `pnpm release:check`，避免本地检查与 GitHub Actions 分叉。
- 明确版本策略：当前仍基于 Zashboard `2.8.0`，不使用纯 `3.2.0`；只有真正迁移到上游 3.x 基线后才考虑 `3.x.y-nebula.n`。

验证：

- `pnpm test src/helper/releasePreflight.spec.ts`：先失败于缺少 `releasePreflight.ts`，实现后 44/44 pass
- `pnpm release:check`：pass，期望 tag 为 `v2.8.0-nebula.2`
- `$env:RELEASE_TAG='v3.2.0'; pnpm release:check`：按预期失败，拒绝 tag/package 不一致
- `pnpm test`：44/44 pass
- `pnpm type-check`：pass
- `pnpm exec prettier --check README.md README-改动说明.md PUBLICATION.md upstream-followup/*.md src/helper/releasePreflight.ts src/helper/releasePreflight.spec.ts tools/release-preflight.ts .github/workflows/release.yml package.json`：pass
- `pnpm lint`：pass
- `pnpm build`：pass
- `git diff --check`：pass，仅有 CRLF 提示

后续注意：

- 发布 `2.8.0-nebula.2` 时，必须创建并推送 tag `v2.8.0-nebula.2`。
- 不要因为本地补丁数量增加就改成纯上游版本号；版本号必须反映真实代码基线和分支身份。

### test: cover backend proxy cache cleanup

- 提交：当前工作区
- 类型：后端缓存隔离测试补强
- 目的：把后端 UUID 对应的代理缓存 key 和删除后端时的缓存清理规则集中到 `proxyCache` helper，并用自动测试防止后续新增缓存类型时漏清。

涉及文件：

- `src/helper/proxyCache.ts`
- `src/helper/proxyCache.spec.ts`
- `src/store/setup.ts`
- `upstream-followup/AI-HANDOFF.md`
- `upstream-followup/NEBULADASH-ITERATION-PLAN.md`
- `upstream-followup/NEBULADASH-CHANGELOG.md`

行为变化：

- 新增 `getProxyCacheKeysForBackend()`，统一返回指定后端的三类代理缓存 key。
- 新增 `clearProxyCacheForBackend()`，删除后端时集中清理 `/proxies`、Provider 数据和 Provider 元数据缓存。
- `removeBackend()` 改为调用清理 helper，不再在 Store 内手写三次 `localStorage.removeItem()`。
- 新增测试覆盖后端间 cache key 隔离，以及删除后端时应清理的全部代理缓存 key。

验证：

- `pnpm test src/helper/proxyCache.spec.ts`：先失败于缺少 `getProxyCacheKeysForBackend` / `clearProxyCacheForBackend`，实现后 40/40 pass
- `pnpm test`：40/40 pass
- `pnpm type-check`：pass
- `pnpm exec prettier --check README.md README-改动说明.md PUBLICATION.md upstream-followup/*.md src/helper/proxyCache.ts src/helper/proxyCache.spec.ts src/store/setup.ts`：pass
- `pnpm lint`：pass
- `pnpm build`：pass
- `git diff --check`：pass，仅有 CRLF 提示

后续注意：

- 本次不做真实浏览器后端切换实测；路由器空闲后仍需做多后端切换缓存不串的手动回归。
- 后续如新增代理相关缓存类型，必须同步更新 `PROXY_CACHE_KINDS`，删除后端时才能一起清理。

### feat: dedupe provider failure notifications

- 提交：当前工作区
- 类型：Provider 失败提示降噪
- 目的：在 `/providers/proxies` 超时或失败时给出可读提示，同时避免慢接口连续失败时反复刷通知。

涉及文件：

- `src/helper/proxyCache.ts`
- `src/helper/proxyCache.spec.ts`
- `src/store/proxies.ts`
- `src/i18n/en.ts`
- `src/i18n/zh.ts`
- `src/i18n/zh-tw.ts`
- `src/i18n/ru.ts`
- `upstream-followup/AI-HANDOFF.md`
- `upstream-followup/NEBULADASH-ITERATION-PLAN.md`
- `upstream-followup/NEBULADASH-CHANGELOG.md`

行为变化：

- 新增 Provider 失败通知去重判断，60 秒内只提示一次。
- `/providers/proxies` 超时或失败时显示本地化错误通知。
- 失败提示不清空已有 Provider 缓存，仍保留旧缓存展示和状态标记。
- 成功加载 Provider 或切换后端后重置失败通知去重窗口。

验证：

- `pnpm test src/helper/proxyCache.spec.ts`：先失败于缺少 `shouldNotifyProviderFailure`，实现后 37/37 pass
- `pnpm test`：37/37 pass
- `pnpm type-check`：pass
- `pnpm exec prettier --check README.md README-改动说明.md PUBLICATION.md upstream-followup/*.md src/helper/proxyCache.ts src/helper/proxyCache.spec.ts src/store/proxies.ts src/i18n/en.ts src/i18n/zh.ts src/i18n/zh-tw.ts src/i18n/ru.ts`：pass
- `pnpm lint`：pass
- `pnpm build`：pass
- `git diff --check`：pass，仅有 CRLF 提示

后续注意：

- 本次未做真实 OpenClash / Mihomo 路由器测试，后续路由器空闲后仍需验证 Provider 超时通知、缓存展示和重试体验。
- 后续若调整 Provider 重试策略，应继续保留通知限流，避免慢接口连续失败时刷屏。

### feat: mark stale provider cache state

- 提交：当前工作区
- 类型：Provider 缓存状态增强
- 目的：区分“可用缓存”和“旧缓存”，避免 Provider 数据已经超过建议新鲜期时仍只显示普通缓存状态。

涉及文件：

- `src/helper/proxyCache.ts`
- `src/helper/proxyCache.spec.ts`
- `src/store/proxies.ts`
- `src/components/sidebar/ProxiesCtrl.tsx`
- `src/i18n/en.ts`
- `src/i18n/zh.ts`
- `src/i18n/zh-tw.ts`
- `src/i18n/ru.ts`
- `upstream-followup/AI-HANDOFF.md`
- `upstream-followup/NEBULADASH-ITERATION-PLAN.md`
- `upstream-followup/NEBULADASH-CHANGELOG.md`

行为变化：

- 新增 `stale` Provider 加载状态。
- Provider 缓存未超过新鲜期时继续显示“缓存数据”。
- Provider 缓存超过新鲜期时显示“旧缓存”。
- 旧缓存仍可用于展示，但不会标记为已加载；切到 Provider 标签时仍会尝试刷新。
- 继续遵守慢接口隔离：状态判断不主动请求 `/providers/proxies`。

验证：

- `pnpm test src/helper/proxyCache.spec.ts`：先失败于缺少 `getCachedProviderLoadStatus`，实现后 34/34 pass
- `pnpm test`：34/34 pass
- `pnpm type-check`：pass
- `pnpm exec prettier --check README.md README-改动说明.md PUBLICATION.md upstream-followup/*.md src/helper/proxyCache.ts src/helper/proxyCache.spec.ts`：pass
- `pnpm lint`：pass
- `pnpm build`：pass

后续注意：

- 后续如果增加缓存过期策略，应继续允许旧缓存展示，不能因为过期直接清空 Provider 页面。

### docs: narrow upstream follow-up scope

- 提交：当前工作区
- 类型：维护路线调整
- 目的：根据当前使用方式更新上游跟进策略，明确搜索模式和 UI/交互类上游功能不再作为当前主线，避免后续 AI 重复建议偏离方向的功能。

涉及文件：

- `upstream-followup/UPSTREAM-FEATURES.md`
- `upstream-followup/NEBULADASH-ITERATION-PLAN.md`
- `upstream-followup/AI-HANDOFF.md`
- `upstream-followup/NEBULADASH-CHANGELOG.md`

行为变化：

- 搜索模式切换标记为暂不推进，原因是当前智能搜索已满足主要使用场景。
- 规则卡片动画、`SegmentedControl`、代理页视觉/交互增强标记为当前主线不跟，原因是用户已有插件补界面。
- 后续优先级改为 Provider 缓存旧数据提示、错误通知去重、后端切换 / 缓存清理测试和 Release 发布前检查固化。
- `AI-HANDOFF.md` 增加“当前明确不推进”小节，方便新对话接手时快速避开低价值方向。

验证：

- `pnpm exec prettier --check README.md README-改动说明.md PUBLICATION.md upstream-followup/*.md src/helper/proxyProviderSearch.ts src/helper/proxyProviderSearch.spec.ts`：pass

后续注意：

- 只有出现明确痛点时，才重新评估搜索模式、代理文件夹或 UI/交互类上游功能。

### feat: enhance provider tab search targets

- 提交：当前工作区
- 类型：Provider 搜索增强
- 目的：补齐 Provider 标签内搜索目标，让已加载 Provider 可以按 Provider 元数据和订阅信息筛选，同时继续遵守慢接口隔离。

涉及文件：

- `src/helper/proxyProviderSearch.ts`
- `src/helper/proxyProviderSearch.spec.ts`
- `src/composables/proxies.ts`
- `README-改动说明.md`
- `upstream-followup/AI-HANDOFF.md`
- `upstream-followup/NEBULADASH-ITERATION-PLAN.md`
- `upstream-followup/NEBULADASH-CHANGELOG.md`

行为变化：

- 新增 Provider 搜索 helper，集中生成 Provider 搜索目标。
- Provider 标签内搜索继续支持 Provider 名和节点名。
- Provider 标签内搜索新增支持测试 URL、更新时间、Provider 类型、订阅下载量、上传量、总量、到期时间戳和到期日期。
- Provider 搜索只使用已加载的 `proxyProviederList` 数据，不主动触发 `/providers/proxies`。
- 多关键词仍保持现有 AND 语义，且不会把关键词拆到无关 Provider 目标之间误命中。

验证：

- `pnpm test src/helper/proxyProviderSearch.spec.ts`：先失败于缺少 `proxyProviderSearch.ts`，实现后 pass
- `pnpm test`：31/31 pass
- `pnpm type-check`：pass
- `pnpm exec prettier --check README.md README-改动说明.md PUBLICATION.md upstream-followup/*.md src/helper/proxyProviderSearch.ts src/helper/proxyProviderSearch.spec.ts`：pass
- `pnpm lint`：pass
- `pnpm build`：pass

后续注意：

- 后续若增加显式搜索模式，Provider 搜索仍应复用 `src/helper/proxyProviderSearch.ts`，不要在组件中散落重复过滤逻辑。
- Provider 搜索不得成为触发 `/providers/proxies` 慢请求的理由。

### docs: consolidate maintenance handoff documents

- 提交：当前工作区
- 类型：维护文档整理
- 目的：降低后续 AI 或新对话接手时的文档噪音，明确文档职责、阅读顺序和过时计划的处理规则。

涉及文件：

- `README.md`
- `upstream-followup/README.md`
- `upstream-followup/AI-HANDOFF.md`
- `upstream-followup/NEBULADASH-ITERATION-PLAN.md`
- `upstream-followup/SOP.md`
- `upstream-followup/PLAN.md`
- `upstream-followup/NODE-PARENT-SEARCH-PLAN.md`
- `upstream-followup/NEBULADASH-CHANGELOG.md`

行为变化：

- 新增 `AI-HANDOFF.md`，作为新开对话、其他 AI 或维护者接手 NebulaDash 时的首读入口。
- `upstream-followup/README.md` 改为维护文档导航，明确每份文档职责和阅读顺序。
- `NEBULADASH-ITERATION-PLAN.md` 修正过时状态：搜索高亮、缓存按后端隔离、Release 发布流程和更新源保护均已落地。
- `SOP.md` 增加文档职责和文档验证规则。
- 删除已合并进总计划的旧 `PLAN.md`。
- 删除已完成并记录到维护日志的 `NODE-PARENT-SEARCH-PLAN.md`。

验证：

- `pnpm exec prettier --check README.md README-改动说明.md PUBLICATION.md upstream-followup/*.md`：pass

后续注意：

- 接手者应先读 `upstream-followup/AI-HANDOFF.md`，再读维护日志和迭代计划。
- 新增或删除维护文档时，要同步更新 `upstream-followup/README.md` 的文档职责说明。

### docs: refresh public README

- 提交：`a04a355e`
- 类型：公开文档整理
- 目的：把根目录 README 从简单下载说明更新为面向公开仓库的项目首页，明确 NebulaDash 定位、核心二改、OpenClash 更新配置、开发命令和上游同步入口。

涉及文件：

- `README.md`
- `upstream-followup/NEBULADASH-CHANGELOG.md`

行为变化：

- README 增加项目定位、主要增强、下载、OpenClash / Mihomo 更新配置、浏览器要求、本地开发、维护与上游同步、验证基线和致谢。
- README 保留并精简旧版 URL 参数说明和常用操作提示，避免公开首页丢失基础使用信息。
- 下载入口收敛到已确认的 `dist.zip`，避免首页列出未确认存在的 Release 资产。
- 增加维护文档入口，后续查看二改功能、迭代计划、上游差异和维护日志更直接。

验证：

- `pnpm exec prettier --check README.md upstream-followup\NEBULADASH-CHANGELOG.md`：pass
- `pnpm test`：26/26 pass

后续注意：

- README 只作为公开入口，详细二改说明仍维护在 `README-改动说明.md`。
- 后续新增重要功能时，应同步更新 README 的“主要增强”或文档入口。

### fix: sync upstream settings select styling

- 提交：`2ce69469`
- 类型：上游低风险样式同步
- 来源：
  - `upstream/main` `6f65c3bf`：`fix: remove default appearance for select utility to enhance styling`
  - `upstream/main` `83dda306`：`fix: adjust setting item label flex properties and update select width in ProxiesSettings component`
- 目的：同步官方 post-v3.11.0 中与设置页 select 外观、设置项 label 伸缩和代理设置下拉宽度相关的小修复。

涉及文件：

- `src/assets/main.css`
- `src/components/settings/ProxiesSettings.vue`
- `upstream-followup/NEBULADASH-CHANGELOG.md`

行为变化：

- `.select` utility 增加 `appearance: none`，减少浏览器默认 select 外观对 daisyUI 样式的干扰。
- `.setting-item-label` 从 `flex-1` 调整为 `shrink-0 grow`，降低设置项 label 被挤压的概率。
- `customGlobalNode` 下拉框从 `min-w-24` 改为 `w-32`，对齐官方代理设置页宽度修复。

验证：

- `pnpm test`：26/26 pass
- `pnpm type-check`：pass
- `pnpm lint`：pass
- `pnpm build`：pass

后续注意：

- 该同步只涉及样式，不触碰代理数据流、Provider 请求、搜索、缓存和更新源。
- 本地没有官方 `src/assets/styles/*` 目录，因此采用手动映射到 `src/assets/main.css`。

### 本地二改基线：OpenClash 环境特化优化

- 提交：历史二改整合，已包含在公开仓库初始提交 `b28546ab`
- 类型：本地功能基线 / 上游同步保护
- 目的：记录 NebulaDash 相比官方 Zashboard 的核心本地改动，后续同步上游时不得误删。

核心约束：

- 不引入 Node / Docker 中转服务或 SQLite 持久化。
- 浏览器继续直连 OpenClash / Mihomo API。
- 优先保障低资源路由器上的首屏可用性。
- 代理页、规则页、搜索是本分支优先维护路径。
- `/providers/proxies` 在多 provider OpenClash 环境下很慢，不能让它阻塞策略组 / 节点组首屏。

#### 代理页三段视图

涉及文件：

- `src/views/ProxiesPage.vue`
- `src/components/sidebar/ProxiesCtrl.tsx`
- `src/composables/proxies.ts`

行为：

- 代理页拆分为“策略组 / 节点组 / 代理商”三段。
- 三类内容独立渲染，不再混排。
- 节点组按命名变体聚类排序，例如“香港手动 / 香港自动 / 香港故转”相邻。
- 节点聚类词表通过 `config/node-cluster-variants` 配置。

后续注意：

- 不能直接用官方 3.x 的代理页结构覆盖本地三段视图。
- 上游代理文件夹 / Provider 重构只能手动融合。

#### Provider 慢接口隔离

涉及文件：

- `src/views/ProxiesPage.vue`
- `src/components/sidebar/ProxiesCtrl.tsx`
- `src/store/proxies.ts`

行为：

- 初次进入代理页只依赖 `/proxies`。
- 只有切换到“代理商”标签时才调用 `fetchProxyProviders()`。
- Provider 请求失败、超时或仍在加载时，不影响策略组 / 节点组使用。
- “全部更新 Provider”后会强制刷新 Provider 数据，但普通搜索和普通切 tab 不重复打慢接口。

后续注意：

- 任何上游同步都不能恢复“页面启动即请求 `/providers/proxies`”。
- 搜索 Provider 内节点时也只能使用已有缓存 / 已加载数据，不能主动触发 Provider 慢请求。

#### 代理数据与 Provider 缓存

涉及文件：

- `src/store/proxies.ts`
- `src/helper/proxyCache.ts`
- `src/helper/proxyCache.spec.ts`

行为：

- 使用 `cache/proxy-data` 缓存 `/proxies`。
- 使用 `cache/proxy-providers` 缓存 `/providers/proxies`。
- 先用缓存快速起屏，再后台刷新。
- 缓存按后端 UUID 隔离，避免不同后端之间复用错误数据。
- Provider 状态记录加载状态、最后更新时间和请求耗时。

后续注意：

- 不同后端的缓存隔离不能移除。
- Provider 缓存可以用于展示，但不能作为触发阻塞式请求的理由。

#### Provider 请求去重与强制刷新

涉及文件：

- `src/store/proxies.ts`

行为：

- `hasLoadedProxyProviders` 避免已加载后重复请求。
- `proxyProviderLoadingPromise` 避免并发重复请求。
- `force` 参数用于用户主动刷新 Provider 后重新拉取。

后续注意：

- 上游 provider 相关改动必须保留请求去重和 `force` 语义。

#### 节点到 Provider 的预映射

涉及文件：

- `src/store/proxies.ts`
- `src/components/proxies/ProxyGroup.vue`

行为：

- `proxyNodeProviderMap` 预先建立“节点名 -> Provider 名”映射。
- 策略组规则直通末尾可以显示最终节点所属 Provider。
- 界面层不再为每个卡片反复遍历完整 provider 列表。

后续注意：

- Provider 尚未加载时，Provider 尾标允许暂时缺失，不能因此阻塞加载。

#### 统一搜索增强

涉及文件：

- `src/helper/search.ts`
- `src/store/rules.ts`
- `src/composables/proxies.ts`
- `src/composables/renderProxies.ts`

行为：

- 搜索支持 NFKC 规范化。
- 支持符号容错。
- 支持空格、逗号、竖线等多分隔符。
- 多关键词使用 AND 匹配。
- 域名关键词会拆 label 变体，例如 `google.com` 可命中 `google`。
- 规则搜索会匹配 `type / payload / proxy` 和规则代理组下游链路。
- 代理页搜索会通过规则 payload / 规则链路反向映射到策略组。
- 代理页首次输入有效搜索词时才按需拉取 `/rules`。

后续注意：

- 官方正则搜索或节点搜索模式不能直接覆盖本地 `src/helper/search.ts`。
- 新搜索能力必须扩展公共 helper，保留域名反向映射和链路感知能力。

#### 规则直通、链路导航和规则页优化

涉及文件：

- `src/components/proxies/ProxyGroup.vue`
- `src/views/ProxiesPage.vue`
- `src/views/RulesPage.vue`
- `src/store/rules.ts`
- `src/store/proxies.ts`

行为：

- 策略组卡片支持“规则直通”展开完整链路。
- 支持一键跳转规则页并带入筛选词。
- 点击链路节点后自动切换到对应代理分段。
- 自动定位并展开目标卡片。
- 规则页列表渲染去掉逐项 `indexOf` 的低效写法。

后续注意：

- 不得移除链路点击定位、规则页跳转和最终 Provider 尾标。

#### 搜索高亮

涉及文件：

- `src/components/common/HighlightedText.vue`
- `src/components/proxies/ProxyName.vue`
- `src/components/proxies/ProxyGroup.vue`
- `src/components/proxies/ProxyNodeCard.vue`
- `src/components/proxies/ProxyProvider.vue`
- `src/components/rules/RuleCard.vue`
- `src/components/rules/RuleProvider.vue`
- `src/helper/search.ts`

行为：

- 代理组名、当前节点、最终出口、规则链路、Provider 名、节点卡片、规则卡片和 Rule Provider 接入搜索高亮。
- 高亮复用统一搜索分词和符号容错逻辑。

后续注意：

- 如果调整搜索分词，必须同时检查高亮是否仍能对应命中项。

#### 设置导入兼容清洗

涉及文件：

- `src/helper/autoImportSettings.ts`
- `src/components/common/ImportSettings.vue`

行为：

- 导入设置时过滤历史遗留图标配置键：
  - `config/icon-size`
  - `config/icon-margin-right`
  - `config/use-large-proxy-group-icon`
- 降低旧二改配置直接导入导致设置污染的风险。

后续注意：

- 设置同步 / 导入导出增强时，要保留兼容清洗。

#### 品牌与启动体验

涉及文件：

- `src/router/index.ts`
- `index.html`
- `vite.config.ts`
- `start-za.ps1`
- `start-za.cmd`

行为：

- 面板名称统一为 NebulaDash。
- 页面标题、运行时路由标题和 PWA manifest 使用 NebulaDash。
- Windows 下提供一键启动脚本，支持首次安装依赖、启动 dev server 和打开浏览器。

后续注意：

- 上游同步后检查品牌名是否被恢复为 Zashboard。

#### 设置页连接失败体验

涉及文件：

- `src/views/SetupPage.vue`
- `src/i18n/zh.ts`
- `src/i18n/zh-tw.ts`
- `src/i18n/en.ts`
- `src/i18n/ru.ts`

行为：

- 首次进入设置页仍可静默尝试默认后端 `127.0.0.1:9090`。
- 手动提交后端不可达时，不再弹浏览器原生 `TypeError: Failed to fetch`。
- 改为面板内错误通知。
- 提交检测期间按钮显示检查状态并临时禁用。
- 必填项缺失有本地化提示。

后续注意：

- 后端连接流程重构时不能恢复原生 alert。

#### 构建体积与首包优化

涉及文件：

- `src/router/index.ts`
- `vite.config.ts`

行为：

- 路由页面动态导入。
- Vite/Rollup 手动拆分 `vue-vendor`、`vendor`、`echarts`、`zrender`、`table`、`drag`、`icons` 等 chunk。
- 避免首屏一次加载所有视图和大依赖。

后续注意：

- 上游同步不能恢复全部页面静态导入。
- 新增重依赖时要检查首包大小和 chunk 归属。

### feat: match proxy parents by node search

- 提交：`7384f7ab`
- 类型：搜索增强
- 目的：补齐“节点名反查父级组 / Provider”的搜索缺口，避免搜索节点名时父级代理组先被过滤掉。

涉及文件：

- `src/helper/search.ts`
- `src/helper/search.spec.ts`
- `src/composables/proxies.ts`
- `src/composables/renderProxies.ts`
- `upstream-followup/NODE-PARENT-SEARCH-PLAN.md`

行为变化：

- 搜索词命中代理组名时，保持原有行为。
- 搜索词命中组内节点名时，父级策略组 / 节点组也会显示。
- 搜索词命中已加载 Provider 内节点名时，对应 Provider 会显示。
- Provider 搜索只使用已有 `proxyProviederList` 数据，不会主动触发 `/providers/proxies`。
- 继续复用本地增强搜索能力：NFKC、符号容错、多关键词 AND、域名 label 变体。
- 规则链路 / 规则 payload 反向关联搜索保留，避免规则命中后出现空卡片。

验证：

- `pnpm test`：26/26 pass
- `pnpm type-check`：pass
- `pnpm lint`：pass
- `pnpm build`：pass

后续注意：

- 不能直接用官方 Zashboard 3.x 的 `proxySearch.ts` 覆盖本地搜索逻辑。
- 后续如果加正则搜索，应扩展 `src/helper/search.ts`，不要绕过本地统一搜索 helper。

### fix: guard dashboard upgrade source

- 提交：`29dd6ff1`
- 类型：更新源保护 / 发布流程
- 目的：确保面板内“检查更新 / 更新面板”只指向 NebulaDash 自己的 release，避免误拉官方 Zashboard 覆盖本地改版。

涉及文件：

- `src/helper/uiUpdateSource.ts`
- `src/helper/uiUpdateSource.spec.ts`
- `src/helper/version.ts`
- `src/helper/version.spec.ts`
- `src/components/settings/ZashboardSettings.vue`
- `src/composables/settings.ts`
- `src/types/index.d.ts`
- `src/i18n/en.ts`
- `src/i18n/zh.ts`
- `src/i18n/zh-tw.ts`
- `src/i18n/ru.ts`
- `README.md`
- `PUBLICATION.md`
- `upstream-followup/NEBULADASH-ITERATION-PLAN.md`
- `upstream-followup/UPSTREAM-FEATURES.md`

行为变化：

- 版本检查仓库改为 `boostemotion/nebuladash`。
- 默认 UI 下载地址改为 `https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip`。
- 面板更新按钮会检查后端配置中的 `external-ui-download-url` / `external-ui-url`。
- 如果配置仍指向官方 `Zephyruso/zashboard`，面板内更新会被禁用。
- 自动更新同样加保护，不会自动拉官方版本。

发布状态：

- 已推送 tag：`v2.8.0-nebula.1`
- Release 已生成：`https://github.com/boostemotion/nebuladash/releases/tag/v2.8.0-nebula.1`
- `latest/download/dist.zip` 已验证可访问。

验证：

- `pnpm test`：21/21 pass
- `pnpm type-check`：pass
- `pnpm lint`：pass
- `pnpm build`：pass

后续注意：

- OpenClash / 后端配置必须使用 NebulaDash release 地址，否则面板内更新按钮会按设计禁用。
- 新发布版本时，`package.json` 版本必须和 tag `v<version>` 完全匹配，否则 release workflow 会失败。

### chore: initialize NebulaDash public history

- 提交：`b28546ab`
- 类型：仓库公开化 / 历史清理
- 目的：清除旧历史后，以干净公开仓库重新发布 NebulaDash。

涉及内容：

- 远程仓库：`https://github.com/boostemotion/nebuladash`
- `origin` 指向 `boostemotion/nebuladash`
- `upstream` 指向 `Zephyruso/zashboard`
- 清理公开仓库风险文件，保留项目源码和维护文档。

后续注意：

- 从官方同步时只 fetch / compare `upstream`。
- 推送只推 `origin`。
- 发布前继续检查 `.env`、密钥、生成包、缓存目录和本地临时文件不得进入 Git。
