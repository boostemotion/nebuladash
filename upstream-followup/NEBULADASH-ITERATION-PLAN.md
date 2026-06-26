# NebulaDash 后续迭代计划

> 基于当前 NebulaDash、本地 OpenClash 实测结果，以及 Zashboard `v3.11.0`
> （2026-06-24）整理。本文是后续迭代总计划；新对话或其他 AI 接手时先读
> `AI-HANDOFF.md`，再读本文。

## 1. 项目定位

NebulaDash 是面向 OpenClash / Mihomo 日常使用场景的 Zashboard 轻量增强分支。

当前架构原则：

- 浏览器直接连接 OpenClash / Mihomo API
- 不增加 Node、Docker 中转服务或 SQLite 持久化
- 优先保证低资源路由器上的首屏可用性
- 优先维护代理页、规则页和搜索这三条高频使用路径
- 上游功能按价值选择性移植，不以追平版本号为目标

当前 NebulaDash 包版本为 `2.8.0-nebula.3`，上游代码基线仍来自 Zashboard
2.8.0。代码已经包含多项本地增强，因此不能将它简单视为纯净的 Zashboard 2.8.0。

## 2. 已确认的性能根因

### 2.1 实测结论

代理页“加载慢”并不只是前端渲染慢。

在 OpenClash 多 provider 配置下：

- `/proxies` 通常仍能在可接受时间内返回
- `/providers/proxies` 经常需要十几秒到二十几秒
- 部分情况下 `/providers/proxies` 会直接超时

因此，Provider 页慢的主要根因位于 OpenClash 后端接口和多 provider 数据结构。前端可以隔离、缓存和降级，但不能保证把一个二十秒的后端请求优化成毫秒级。

### 2.2 不可破坏的约束

后续移植上游代码时必须遵守：

1. 策略组和节点组首屏不得等待 `/providers/proxies`
2. `/providers/proxies` 只能按需请求，不能恢复为应用启动时强制加载
3. Provider 请求失败或超时不能拖死代理主页
4. 已缓存的 `/proxies` 数据应优先用于快速起屏
5. Provider 数据缺失时，策略组、节点组、规则搜索等核心功能仍应尽可能工作
6. 不得为了显示 Provider 尾标而让所有代理卡片反复遍历完整 Provider 列表
7. 上游的代理文件夹、Provider 重构和搜索重构必须在保留这些约束的前提下手动融合

## 3. 当前已完成的环境特化优化

### 3.1 代理页三段视图

代理页已经拆分为：

- 策略组
- 节点组
- 代理商

三类内容分别渲染，避免旧逻辑混排，也使 Provider 慢请求能够被独立隔离。

关键文件：

- `src/views/ProxiesPage.vue`
- `src/components/sidebar/ProxiesCtrl.tsx`
- `src/composables/proxies.ts`

### 3.2 Provider 延迟加载

Provider 数据只在用户切换到“代理商”标签时请求，不再阻塞策略组和节点组首屏。

关键文件：

- `src/views/ProxiesPage.vue`
- `src/components/sidebar/ProxiesCtrl.tsx`
- `src/store/proxies.ts`

必须保留的行为：

- 初次进入策略组时只依赖 `/proxies`
- 切换到 Provider 标签后才调用 `fetchProxyProviders()`
- Provider 请求期间其他代理页标签仍可正常使用

### 3.3 本地缓存

当前使用以下缓存：

- `cache/proxy-data`
- `cache/proxy-providers`

缓存按后端 UUID 隔离，用于先显示上次有效数据，再在后台更新，降低慢后端带来的空白等待感。

关键文件：

- `src/store/proxies.ts`

后续可继续补充缓存过期提示和旧数据提示，但不能移除后端隔离。

### 3.4 Provider 请求去重

当前已经实现：

- `hasLoadedProxyProviders`
- `proxyProviderLoadingPromise`
- `force` 刷新参数

这些逻辑用于避免重复调用 `/providers/proxies`，并确保主动更新 Provider 后可以强制刷新。

### 3.5 节点到 Provider 的预映射

`proxyNodeProviderMap` 会预先建立“节点名 -> Provider 名”映射，供规则直通尾标和 Provider 分组复用。

关键文件：

- `src/store/proxies.ts`

该映射只能依赖已取得的 Provider 数据。Provider 尚未加载时，界面应允许尾标暂时缺失，不能因此触发阻塞式请求。

### 3.6 统一搜索能力

当前搜索能力包括：

- NFKC 规范化
- 符号容错
- 空格、逗号、竖线等多分隔符
- 多关键词 AND 匹配
- 域名 label 变体
- 规则代理组下游链路匹配
- 规则关键词反向映射到代理组

关键文件：

- `src/helper/search.ts`
- `src/store/rules.ts`
- `src/composables/proxies.ts`
- `src/composables/renderProxies.ts`

后续引入官方正则搜索或节点搜索模式时，应扩展当前公共搜索工具，不得直接用官方实现覆盖，否则会丢失域名反向映射和链路感知能力。

### 3.7 规则按需加载

代理页首次出现有效搜索词时才补拉 `/rules`，用于规则联动搜索；进入代理页时不额外强制请求。

关键文件：

- `src/components/sidebar/ProxiesCtrl.tsx`

规则接口不可用时，应回退到代理组名和节点名搜索。

### 3.8 规则列表渲染优化

规则列表已经去掉逐项 `indexOf` 查找，避免长规则列表出现额外的重复遍历。

关键文件：

- `src/views/RulesPage.vue`

### 3.9 规则直通与链路导航

策略组卡片已经支持：

- 展开完整规则链路
- 跳转规则页并带入筛选词
- 点击链路节点后切换到对应代理分段
- 定位并展开目标卡片
- 显示最终节点所属 Provider

关键文件：

- `src/components/proxies/ProxyGroup.vue`
- `src/views/ProxiesPage.vue`
- `src/store/proxies.ts`

### 3.10 搜索高亮

当前已经接入搜索结果高亮，覆盖：

- 代理组
- 节点卡片
- Provider
- 规则卡片
- Rule Provider
- 规则链路

关键文件：

- `src/components/common/HighlightedText.vue`
- `src/helper/search.ts`
- `src/components/proxies/ProxyName.vue`
- `src/components/proxies/ProxyGroup.vue`
- `src/components/proxies/ProxyNodeCard.vue`
- `src/components/proxies/ProxyProvider.vue`
- `src/components/rules/RuleCard.vue`
- `src/components/rules/RuleProvider.vue`

后续如果扩展搜索模式，必须同时确认高亮与实际匹配规则一致。

### 3.11 首包和构建优化

当前已经实现：

- 路由页面动态导入
- Vue、ECharts、表格、拖拽、图标等依赖手动拆包

关键文件：

- `src/router/index.ts`
- `vite.config.ts`

后续上游同步不得轻易恢复全部页面静态导入。

## 4. 与官方 Zashboard 3.11.0 的差异

官方版本基准：

- 本地上游代码基线：`2.8.0`
- 当前 NebulaDash 包版本：`2.8.0-nebula.3`
- 官方最新稳定版：`3.11.0`
- 官方发布时间：2026-06-24
- 当前已拉取的 `upstream/main`：`9150a53e`
- `upstream/main` 相比 `v3.11.0` 额外包含 11 个提交
- 2026-06-26 再次执行 `git fetch upstream --tags` 后确认 `upstream/main` 仍为 `9150a53e`
- 当前 NebulaDash `main` 与 `upstream/main` 无可用 merge-base，不能直接 rebase 或 merge upstream
- 官方发布页：<https://github.com/Zephyruso/zashboard/releases/tag/v3.11.0>
- 官方版本差异：<https://github.com/Zephyruso/zashboard/compare/v2.8.0...v3.11.0>

本地并不是简单落后若干版本，而是已经在代理页和搜索领域形成了独立实现。官方与本地的能力关系如下。

### 4.1 本地已有、官方不能直接替换

- 策略组 / 节点组 / 代理商三段分类
- 节点组命名聚类和排序
- 域名规则反向关联代理组
- 规则链路感知搜索
- OpenClash 慢 Provider 接口隔离
- Provider 本地缓存和请求去重
- 规则直通、跨分段定位和 Provider 尾标
- 设置导入兼容清洗
- 当前的首包拆分策略

### 4.2 官方已有、本地值得吸收

#### 稳定性与移动端

- 代理页滚动引用为空时的防护
- iOS 视口平移限制
- 动态视口高度处理
- 软键盘 inset 处理
- 移动端代理组布局和遮罩修复
- 输入框和 Toggle 的可用性修复

#### 搜索与交互

- 代理节点搜索模式（当前不作为主线，智能搜索已够用）
- 正则搜索能力（当前不作为主线，避免增加 UI 模式和维护成本）
- 连接页和日志页搜索高亮
- Provider 搜索交互（已做 Provider 标签搜索目标增强，后续只做真实数据回归）
- 规则卡片展开动画（当前不作为主线）
- 多后端时标题显示当前后端地址

#### 设置维护

- 设置同步
- 更完整的导入、导出和重置能力
- 后端配置界面的校验与布局改进

#### 可选代理页能力

- 代理文件夹管理（仅独立 spike，当前主线不做）
- 文件夹模式（仅独立 spike，当前主线不做）
- 官方统一分段控件 `SegmentedControl`（已有插件补界面，当前主线不做）

### 4.3 当前不建议吸收

- sing-box Native API 整条适配链
- goroutines 监控
- USB/IP 面板
- Tailscale 管理面板
- 内置终端
- 快捷键体系
- Zashboard 3.x 全套视觉重构

### 4.4 2026-06-26 差异状态

当前 NebulaDash `main` 是独立公开历史，`origin` 指向
`boostemotion/nebuladash`，`upstream` 指向 `Zephyruso/zashboard`。

2026-06-26 复查结论：

- `git fetch upstream --tags` 后，`upstream/main` 没有超过既有 `9150a53e`。
- `git merge-base HEAD upstream/main` 无结果，当前公开 fork 与 upstream 不能按普通共同祖先方式同步。
- 后续上游审计边界固定为：`v2.8.0..v3.11.0` 看大版本差异，`v3.11.0..upstream/main`
  看最新未发布或未打新 tag 的增量提交。
- 只允许按单个修复或单个能力手工移植；不得直接用 upstream 文件覆盖本地代理页、搜索、Provider 缓存、更新器和发布治理文件。

`upstream/main@9150a53e` 相比官方 `v3.11.0` 的新增提交主要分三类：

- 可跟进：设置项 label/select 宽度修复、select 默认外观修复、后端运行时间/连接状态展示这类低风险体验补丁。
- 需要适配后再跟进：代理图标映射增强、连接快照接口、连接状态延迟图表。它们可能有价值，但上游已经进入 `assembly/*` 分层，本地不能整文件覆盖。
- 暂不跟进：sing-box Native 连接关闭判断、跨标签 sing-box gRPC 流共享、统一日志流累积器、USB/IP、Tailscale、终端和工具页链路。

当前已落地的 NebulaDash 更新治理：

- Release 检查源指向 `boostemotion/nebuladash`
- OpenClash / Mihomo 下载地址统一为 `https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip`
- 设置页会检查后端 `external-ui-download-url` 或 `external-ui-url`
- 下载地址不指向 NebulaDash Release ZIP 时，禁用“更新面板”和自动更新

下一批建议跟进顺序：

1. 路由器空闲后补做自管理更新器 rollback 实测。
2. 路由器空闲后做真实 OpenClash / Mihomo Provider 超时、缓存和后端切换回归。
3. 多后端标题、后端 uptime 等非视觉核心信息展示按需评估。

原因：

- 用户已有插件补界面，NebulaDash 主线不再追 UI/交互类上游功能。
- 当前智能搜索已满足使用，不做搜索模式切换。
- 后续优先处理不依赖路由器实时环境的稳定性、缓存、发布和测试补强。
- 大范围上游 UI 或架构重构容易掩盖真正需要保护的 Provider 慢请求隔离。

## 5. 后续迭代优先级

## P0：稳定性和版本治理

### P0-1 固化当前稳定线

目标：

- 保持 `main` 为当前可用稳定线
- 后续所有上游移植从功能分支开始
- 每次本地改动都同步维护日志，避免接手者依赖聊天记录

建议分支：

- `main`：稳定使用线
- `feat/mobile-stability`
- `feat/search-modes`
- `feat/provider-cache-v2`
- `spike/proxy-folders`

### P0-2 修正版本和更新来源

实施状态（2026-06-25）：

- 已使用独立版本号 `2.8.0-nebula.1`
- 更新检测已改查 `boostemotion/nebuladash`
- 仓库没有 Release 时按“无可用更新”处理，不影响页面启动
- 设置页链接已改为 NebulaDash 仓库
- 界面继续显示 NebulaDash 版本、提交号和构建时间

实施状态补充（2026-06-26）：

- 已建立 NebulaDash GitHub Release 发布流程。
- `v2.8.0-nebula.1` Release 已生成，`latest/download/dist.zip` 已验证可访问。
- 面板内更新源保护已要求 OpenClash / Mihomo 下载地址指向 NebulaDash Release ZIP。
- 当前发布版本已推进到 `2.8.0-nebula.3`；仍保持 Zashboard `2.8.0` 基线，未冒充上游 3.x。
- 发布前检查已固化为 `pnpm release:check`，用于校验 Nebula 版本格式和 tag/package 一致性。
- `v2.8.0-nebula.3` Release 已完成，`latest/download/dist.zip` 已确认跳转到该版本。

关键文件：

- `package.json`
- `src/api/index.ts`
- `src/composables/settings.ts`
- `src/components/common/BackendVersion.vue`
- `vite.config.ts`

### P0-6 NebulaDash 自管理更新器

实施状态（2026-06-26）：

- 已新增 `router-updater/`，作为可选路由器端更新器源码目录。
- 已新增 `/usr/share/nebuladash-updater/` 运行目录约定。
- 已新增 `/www/cgi-bin/nebuladash-updater` CGI 入口约定。
- 已新增 `/www/nebuladash-a`、`/www/nebuladash-b` 和 `/www/nebuladash` symlink A/B 部署约定。
- 前端设置页已新增更新器 endpoint、token、检查、更新和回滚按钮。
- 更新器只接受 `status`、`update`、`rollback` 三个动作，并要求 updater token。
- 前端同时发送 `X-NebulaDash-Token` header 和 `token` query 参数；CGI 优先读 header，缺失时回退读 query token，以兼容 OpenWrt/uHTTPd。
- 安装器会清理 CRLF，避免 Windows 打包后脚本或配置中的 `\r` 造成 token 比较失败。
- 默认下载源仍为 `https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip`。
- 已在真实路由器上完成安装、status 检查和 update 更新链路验证，状态从 `No update has run yet` 到成功更新。

后续注意：

- 不能把前端做成可传任意 shell 命令的入口。
- 更新器失败时不得切换 active 分区。
- rollback 还需要在真实路由器上补测。
- 本机 Windows 环境当前没有可用 `sh`，`router-updater/smoke-test.sh` 需要在 OpenWrt、Linux、WSL 或 Git Bash 环境运行。

关键文件：

- `router-updater/updater.sh`
- `router-updater/nebuladash-updater.cgi`
- `router-updater/install.sh`
- `router-updater/smoke-test.sh`
- `src/helper/routerUpdater.ts`
- `src/api/routerUpdater.ts`
- `src/components/settings/ZashboardSettings.vue`
- `src/store/settings.ts`

### P0-3 移植代理页空引用防护

需要检查：

- `proxiesRef.value` 在滚动、切换标签和页面卸载期间可能为空
- `scrollHeight`、`scrollTop`、`scrollTo()` 调用前必须检查引用
- `requestAnimationFrame` 循环在页面卸载后必须停止

关键文件：

- `src/views/ProxiesPage.vue`
- `src/composables/proxiesScroll.ts`

实施状态（2026-06-25）：

- 已为代理页滚动引用增加空值防护
- 已将滚动恢复条件抽为可测试纯函数
- 页面快速切换或挂载未完成时不会直接访问空元素

### P0-4 Provider 请求可观测性

在不增加服务端的前提下记录：

- `/proxies` 请求耗时
- `/providers/proxies` 请求耗时
- 请求成功、失败、超时和缓存命中状态
- 最近一次有效 Provider 更新时间

界面只需要轻量提示，不需要引入完整监控系统。

建议状态：

- `idle`
- `loading`
- `cached`
- `fresh`
- `timeout`
- `error`

关键文件：

- `src/store/proxies.ts`
- `src/components/sidebar/ProxiesCtrl.tsx`
- `src/components/proxies/ProxyProvider.vue`

实施状态（2026-06-25）：

- 已记录 Provider 请求状态、耗时和最近成功更新时间
- Provider 标签已显示缓存、成功、超时或失败状态

### P0-5 Provider 超时和降级

当前请求未显式设置 Provider 专用超时。建议：

- `/providers/proxies` 使用独立超时，例如 15 秒
- 超时后继续展示旧缓存
- 不清空已有 Provider 数据
- 提供用户主动重试按钮
- 错误通知去重，避免慢接口连续刷屏

关键文件：

- `src/api/index.ts`
- `src/store/proxies.ts`
- `src/helper/notification.ts`

实施状态（2026-06-25）：

- `/providers/proxies` 已使用 15 秒独立超时
- 超时或失败时保留已有 Provider 缓存
- Provider 失败已在 Store 内降级处理，不向页面抛出未处理 Promise
- 缓存键已按后端 UUID 隔离
- 删除后端时同步清理对应代理缓存

实施状态补充（2026-06-26）：

- Provider 失败通知已增加 60 秒去重窗口。
- Provider 超时或失败时显示本地化提示，并继续保留可用缓存。
- Provider 成功加载或切换后端后会重置失败通知窗口。
- 后端代理缓存 key 已由 `proxyCache` helper 统一生成。
- 删除后端时的 `/proxies`、Provider 数据和 Provider 元数据缓存清理已有自动测试覆盖。

## P1：高价值、低到中风险升级

### P1-1 移动端视口稳定性

选择性移植官方：

- `useViewportHeight`
- `useKeyboardInset`
- iOS 页面固定和视口平移防护
- 移动端代理组遮罩与宽度修复

验收设备至少覆盖：

- Android Chrome
- iOS Safari
- OpenClash WebUI 内嵌浏览器
- KSU WebUI

实施状态（2026-06-25）：

- 已使用 `visualViewport.height` 同步 `--app-height`
- 已监听视口 resize / scroll，并在卸载时清理监听
- 已增加 iOS 垂直边界滚动锁，同时保留横向手势
- 仍需在 iOS Safari、OpenClash WebUI 和 KSU WebUI 实机验证

### P1-2 搜索模式扩展（暂不推进）

在现有搜索能力上增加显式模式：

- 智能搜索：保持当前 NFKC、符号容错和链路感知逻辑
- 节点搜索：只搜索节点，不使用规则反向关联
- 正则搜索：由用户显式启用，正则非法时给出可读提示

设计要求：

- 默认仍为当前智能搜索
- 不允许用户普通输入被自动解释为正则
- Provider 未加载时，节点搜索仍能搜索 `/proxies` 已返回的节点
- 搜索高亮必须与实际匹配规则一致

关键文件：

- `src/helper/search.ts`
- `src/composables/proxySearch.ts`，如采用官方模块则需重新适配
- `src/composables/proxies.ts`
- `src/composables/renderProxies.ts`
- `src/components/sidebar/ProxiesCtrl.tsx`
- `src/store/rules.ts`

当前决策（2026-06-26）：

- 暂不做搜索模式切换。
- 原因是当前智能搜索已满足主要使用场景，新增 `smart / node / regex` 模式会增加 UI 和维护成本。
- 后续仅在出现明确搜索误命中或性能问题时重新评估。

### P1-3 搜索高亮回归

需要验证：

- 多关键词分别高亮
- 域名拆分变体不会把整个无关文本全部高亮
- 符号容错命中时高亮结果不会误导
- 中文、英文、Emoji 和全角字符显示正常
- 大量规则和节点下不会出现明显卡顿

### P1-4 Provider 搜索增强

Provider 搜索必须继续遵守延迟加载约束：

- 未切到 Provider 标签时不拉 Provider 数据
- Provider 标签内可搜索 Provider 名、节点名和订阅信息
- 搜索不触发重复 Provider 请求
- 搜索结果为空时显示缓存状态和最后更新时间

实施状态（2026-06-26）：

- 已新增 `src/helper/proxyProviderSearch.ts`，集中处理 Provider 搜索目标。
- Provider 标签内搜索已覆盖 Provider 名、节点名、测试 URL、更新时间、Provider 类型和订阅信息。
- 搜索仍只使用已加载 Provider 数据，不触发 `/providers/proxies`。

剩余事项：

- 在真实 OpenClash / Mihomo Provider 数据上复查订阅字段格式。
- 如需要更明确空结果提示，可在不扩大请求面的前提下补页面空状态。

### P1-6 Provider 旧缓存状态

实施状态（2026-06-26）：

- 已新增 `stale` Provider 加载状态。
- 30 分钟内的 Provider 缓存显示为“缓存数据”。
- 超过 30 分钟的 Provider 缓存显示为“旧缓存”。
- 旧缓存仍可展示，但不会阻止进入 Provider 标签后的刷新请求。

后续注意：

- 不能因为缓存过旧直接清空 Provider 页面。
- 如果后续做缓存过期策略，应优先提示旧数据，而不是破坏缓存起屏能力。

### P1-5 设置同步和导入导出

选择性吸收官方设置同步能力时：

- 保留无效历史键过滤
- 本地 NebulaDash 专用设置必须进入白名单
- 不同版本导入时显示被忽略的键数量
- 不同步后端密码，除非用户明确选择

## P2：代理页专项升级

### P2-1 代理文件夹可行性验证

代理文件夹不能直接照搬官方实现，需要先验证它与三段视图的关系。

推荐设计：

- 文件夹只管理策略组和节点组
- Provider 标签保持独立，不进入文件夹
- 文件夹作用域区分“策略组”和“节点组”
- 文件夹配置保存在浏览器本地
- 文件夹功能关闭时恢复当前三段视图，不改变原排序

必须验证：

- 文件夹是否会破坏节点聚类排序
- 搜索时是跨文件夹显示结果，还是只过滤当前文件夹
- 链路跳转能否自动打开目标文件夹
- 隐藏组与文件夹配置冲突时采用何种优先级

建议仅在 `spike/proxy-folders` 分支试验，不直接进入 `main`。

### P2-2 分段控件统一

可评估用官方 `SegmentedControl` 替换当前 Tabs，但必须保持：

- 三段数量显示
- Provider 按需加载
- 每个标签独立滚动位置
- 链路跳转时自动切换标签
- 移动端宽度可用

当前决策（2026-06-26）：

- 暂不移植。
- 用户已有插件补界面，NebulaDash 主线优先保持轻量稳定。
- 如果统一控件只带来视觉变化而增加维护面，则不移植。

### P2-3 规则卡片交互

可低风险移植：

- 展开、收起动画
- 移动端间距修复
- 更明确的禁用状态

不得覆盖现有规则直通和链路跳转逻辑。

当前决策（2026-06-26）：

- 暂不移植规则卡片动画和纯交互增强。
- 用户已有插件补界面，当前主线优先稳定性和 OpenClash 适配。

## P3：长期观察

以下内容只有出现明确使用需求时再评估：

- sing-box Native API
- goroutines 状态流
- Tailscale 管理
- USB/IP
- 内置终端
- Zashboard 3.x 设置页全量重构
- 全套主题和视觉体系迁移

## 6. Provider 缓存第二阶段设计

当前缓存可以快速起屏，并已按后端 UUID 隔离，避免多后端污染。

当前缓存键：

```text
cache/proxy-data/<backend-uuid>
cache/proxy-providers/<backend-uuid>
cache/proxy-provider-meta/<backend-uuid>
```

元数据至少包含：

```ts
type ProviderCacheMeta = {
  fetchedAt: number
  durationMs: number
  status: 'fresh' | 'cached' | 'stale' | 'timeout' | 'error'
}
```

已实现策略：

- `/proxies` 成功后立即更新代理缓存
- `/providers/proxies` 成功后原子更新 Provider 数据和元数据
- Provider 请求失败时保留旧缓存
- 切换后端时只读取对应 UUID 的缓存
- 删除后端时同步清理其缓存

后续可补充：

- Provider 真实数据字段和超时提示需在路由器空闲后做回归。

## 7. 高冲突文件

同步上游时必须人工审阅：

| 文件                                       | 本地职责                          | 上游同步风险 |
| ------------------------------------------ | --------------------------------- | ------------ |
| `src/store/proxies.ts`                     | 缓存、请求去重、Provider 映射     | 极高         |
| `src/composables/proxies.ts`               | 三段分类、聚类排序、规则联动搜索  | 极高         |
| `src/components/sidebar/ProxiesCtrl.tsx`   | 三段 Tab、按需拉规则和 Provider   | 极高         |
| `src/views/ProxiesPage.vue`                | 分段渲染、滚动恢复、延迟加载      | 极高         |
| `src/components/proxies/ProxyGroup.vue`    | 规则直通、链路定位、Provider 尾标 | 极高         |
| `src/helper/search.ts`                     | 本地统一搜索和高亮                | 极高         |
| `src/store/rules.ts`                       | 链路感知规则搜索                  | 高           |
| `src/composables/renderProxies.ts`         | 节点过滤                          | 高           |
| `src/components/proxies/ProxyProvider.vue` | Provider 卡片与刷新               | 高           |
| `src/views/RulesPage.vue`                  | 长列表渲染优化                    | 中           |
| `src/router/index.ts`                      | NebulaDash 品牌和路由懒加载       | 中           |
| `vite.config.ts`                           | 品牌、构建信息、手动拆包          | 中           |

处理原则：

- 不直接接受整文件覆盖
- 先拆解上游提交的真实意图
- 稳定性修复优先手动移植
- 视觉重构与功能改动分开处理
- 每次只同步一个独立能力

## 8. 推荐实施阶段

### 阶段 A：稳定线固化

1. 保持 `main` 为当前可用稳定线
2. 维护 `AI-HANDOFF.md` 和 `NEBULADASH-CHANGELOG.md`
3. 保存路由器实测基线

### 阶段 B：稳定性补丁

1. 代理页空引用防护
2. Provider 专用超时和缓存降级
3. 请求耗时与缓存状态提示
4. 按后端隔离缓存
5. 移动端视口修复

### 阶段 C：搜索升级

1. 回归当前智能搜索高亮
2. 增加节点搜索模式
3. 增加显式正则模式
4. 增加连接和日志搜索高亮
5. Provider 标签内搜索增强

### 阶段 D：交互增强

1. 规则卡片动画
2. 多后端标题
3. 设置同步和导入导出增强
4. 评估 `SegmentedControl`

### 阶段 E：代理文件夹试验

1. 建立独立试验分支
2. 定义文件夹与三段视图关系
3. 验证搜索、链路跳转和聚类排序
4. 路由器实测
5. 达不到性能和可用性标准则放弃合入

## 9. 性能基线和验收标准

由于后端性能受路由器硬件、Provider 数量和订阅规模影响，不应只规定固定毫秒数。建议同时记录绝对时间和相对变化。

每轮测试记录：

```text
设备：
浏览器：
OpenClash / Mihomo 版本：
Provider 数量：
节点总数：
规则数量：
/proxies 耗时：
/providers/proxies 耗时：
缓存起屏耗时：
策略组首屏可交互耗时：
Provider 页可交互耗时：
```

最低验收标准：

- 策略组首屏不等待 `/providers/proxies`
- Provider 请求超时后策略组和节点组仍可使用
- 有缓存时能够先显示缓存
- 没有缓存时有明确加载状态，不显示误导性的“0 组”
- 快速切换三个标签不会并发发起多个相同 Provider 请求
- 切换后端不会显示其他后端的缓存
- 搜索 `google.com` 能反向显示相关策略组
- 搜索 `香港 自动`、`香港|故转`、`Gemini,香港-故转` 保持 AND 语义
- 规则直通能够跳到目标卡片
- Provider 未加载时规则直通不会卡死

## 10. 固定回归清单

### 自动检查

```bash
pnpm type-check
pnpm lint
pnpm build
```

说明：`pnpm lint` 带有自动修复行为，运行前应确认工作区状态并审阅差异。

### 代理页

- 策略组、节点组、代理商三段数量正确
- 默认进入策略组时不请求 Provider
- 首次进入 Provider 标签只请求一次
- 强制刷新可以重新请求 Provider
- Provider 超时后缓存仍存在
- 各标签滚动位置独立恢复
- 节点同簇顺序保持 `故转 > 手动 > 自动`

### 搜索

- 普通关键词
- 多关键词 AND
- 全角字符
- 标点容错
- 域名 label
- 规则链路节点
- 无效正则
- 搜索高亮

### 规则直通

- 展开完整链路
- 跳转规则页
- 点击链路节点切换分段
- 定位并展开目标组
- Provider 已加载时显示尾标
- Provider 未加载时不阻塞

### 后端和设置

- 后端不可达时显示面板通知
- 多后端切换后缓存不串
- 设置导入忽略无效历史键
- NebulaDash 专用设置可正确导出和恢复

### 移动端

- 底部导航正常
- 软键盘弹出后输入框可见
- 页面不会横向漂移
- 代理组展开、折叠和滚动正常
- OpenClash 内嵌 WebUI 可用

## 11. 上游跟进流程

本仓远程约定：

- `upstream`：`Zephyruso/zashboard`
- `origin`：`boostemotion/nebuladash`

每次跟进：

```bash
git fetch upstream --tags
git log --oneline main..upstream/main
git diff --stat main..upstream/main
git log --oneline v3.11.0..upstream/main
```

不要默认执行：

```bash
git rebase upstream/main
git merge upstream/main
```

推荐方式：

- 单一 Bug Fix：手动移植或 cherry-pick
- 单一独立功能：功能分支适配
- 大规模代理页或设置页重构：独立 spike 分支
- 纯视觉变化：默认不跟

提交信息建议：

```text
fix(upstream): port proxy scroll null guard from zashboard
adapt(upstream): integrate proxy node search mode with NebulaDash search
perf(provider): isolate slow OpenClash provider requests
```

## 12. 当前明确决策

### 保留

- OpenClash / Mihomo 前端直连
- Provider 延迟加载
- Provider 缓存和请求去重
- 三段代理视图
- 规则联动搜索
- 规则直通
- 构建拆包

### 优先升级

- 真实路由器 rollback 回归
- Provider 超时、缓存和后端切换实测回归

### 单独评估

- 后端 uptime / 多后端标题等非视觉核心信息展示
- 代理图标映射增强
- 代理文件夹
- 设置同步

### 暂不跟进

- 搜索模式切换
- 规则卡片动画和纯交互增强
- 统一分段控件
- sing-box Native API
- goroutines
- USB/IP
- Tailscale
- 内置终端
- 快捷键
- 全量视觉重构

## 13. 下一步建议

下一轮开发建议从以下顺序开始：

1. 补做路由器更新器 rollback 实测，并记录 A/B 分区状态。
2. 路由器空闲后，再做真实 OpenClash / Mihomo Provider 超时、缓存和后端切换回归。

在以上稳定性任务完成前，不建议开始代理文件夹、搜索模式或 Zashboard 3.x 视觉重构。
