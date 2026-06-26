# 节点名反查父级搜索计划

## 目标

在保留 NebulaDash 当前增强搜索能力的基础上，补齐“搜索节点名时显示其所属代理组 / Provider”的能力。

当前搜索已经支持代理组名、规则链路、规则反向关联、组内节点过滤和高亮。缺口是：如果搜索词只命中组内节点名，而不命中父级组名，父级组会先在 `getRenderGroups()` / `getProxySections()` 阶段被过滤掉，导致后续组内过滤没有机会执行。

## 非目标

- 不直接迁移官方 Zashboard 3.x 代理页结构。
- 不恢复应用启动时请求 `/providers/proxies`。
- 不增加必须切换的“官方节点搜索模式”开关。
- 不降低现有 NFKC、符号容错、多关键词 AND、域名 label 变体和规则链路搜索能力。

## 设计

### 搜索匹配边界

新增一个纯 helper，用于判断搜索词是否命中一个父级名称或它的子节点名称：

- 父级名称命中：保持现有行为。
- 子节点名称命中：父级也视为命中。
- 多关键词继续使用 AND 语义。
- 每个关键词继续使用现有 `getSearchTermVariants()` 和 `matchesSearchTerm()`。

### 代理组行为

在 `src/composables/proxies.ts` 的 `getRenderGroups()` 中：

- 保留规则反向关联命中。
- 保留代理组名命中。
- 增加 `proxyMap.value[groupName].all` 的节点名命中。

这样搜索 `HK 01` 时，可以显示包含 `HK 01` 的策略组或节点组。

### Provider 行为

在 `src/composables/proxies.ts` 的 provider section 过滤中：

- Provider 名命中时显示 Provider。
- Provider 内节点名命中时显示 Provider。
- 只使用 `proxyProviederList.value` 中已有数据。
- 不在搜索时调用 `fetchProxyProviders()`。

这样不会破坏 OpenClash 多 provider 环境下的慢接口隔离。

### 组内节点列表行为

`src/composables/renderProxies.ts` 继续负责组内节点过滤：

- 父级组名命中时，显示该组所有节点。
- 节点名命中时，只显示命中的节点。
- 如果组名未命中但节点命中，不会回退显示全部节点。
- 如果搜索词来自规则链路 / 规则 payload 反向关联，仍允许保留原有全量节点回退，避免规则命中后出现空卡片。

## 实施步骤

1. 给 `src/helper/search.ts` 补充纯函数和单元测试。
2. 将 `src/composables/proxies.ts` 的代理组 / Provider 过滤改为调用该 helper。
3. 调整 `src/composables/renderProxies.ts` 中节点名匹配方式，让组内过滤复用同一套搜索 helper。
4. 运行验证：
   - `pnpm test`
   - `pnpm type-check`
   - `pnpm lint`
   - `pnpm build`

## 风险控制

- 搜索逻辑集中在 helper，避免多个组件重复实现。
- 不改 Provider 加载时机。
- 不改代理页三段结构。
- 不改缓存 key 和后端请求流程。
