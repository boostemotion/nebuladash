# NebulaDash（基于 Zashboard 原版的轻量增强版）

本项目在 **不引入服务端中转/SQLite 持久化** 的前提下，对原版 Zashboard 做了针对日常使用的前端增强，重点是：分组可读性、搜索可用性、规则定位效率、以及低资源设备（如路由器）友好。

当前工作区版本：`2.8.0-nebula.4.2.0`。
当前已发布 Release：`v2.8.0-nebula.4`。

---

## 设计目标

- 保持原版轻量架构：浏览器直连后端（OpenClash/Nikki）
- 不增加 Docker/Node 常驻中转服务负担
- 优先提升高频交互体验（代理页、规则页、搜索）

---

## 相比原版的主要改动

## 1) 代理页结构升级

- 顶部切换改为三段 Tab（替代原先“代理 / 代理提供商”）：
  - **策略组**
  - **节点组**
  - **代理商**
- 三个 Tab 各自只展示对应内容（不再混排）
- 节点组聚类排序：同前缀项自动相邻（例如：香港手动 / 香港自动 / 香港故转）
- 节点聚类词表可配置：新增设置项 `config/node-cluster-variants`

## 2) 策略组「规则直通」增强

- 在策略组卡片内新增：
  - **规则直通**（展开显示完整链路）
  - **跳转规则**（一键切换到规则页并自动填入筛选词）
- 规则直通链路点击增强：
  - 点击链路节点时，自动切换到目标分段并定位到对应卡片
  - 自动展开目标卡片，避免只切换到分段顶部
- 规则直通链路末尾新增：
  - **当前最终节点所属提供商**（`代理提供商: xxx`）
- 便于从策略组快速定位规则并修改

## 3) 搜索能力增强（规则页 + 代理页）

- 搜索从简单 `includes` 升级为：
  - NFKC 规范化
  - 符号容错匹配
  - 多关键词 AND 匹配
- 支持多分隔符：**空格 / 逗号 / `|`**
- 典型改进：`google.com` 等关键词在规则与代理检索中命中更稳定

### 代理搜索（新增规则联动匹配）

- 代理页搜索不再只匹配组名/节点名
- 现在支持“域名/规则关键词 → 规则命中 → 反向映射到策略组与链路组”
- 示例：在代理页输入 `google.com`，会显示与 Google 相关规则实际指向的策略组/节点链路
- 首次在代理页输入搜索词时会自动拉取规则数据；若规则接口不可用则回退为组名匹配
- 代理商标签内搜索会使用已加载 Provider 数据匹配 Provider 名、节点名、测试 URL、更新时间、类型和订阅信息，不会为了搜索主动请求慢速 Provider 接口

### 规则搜索（新增链路感知匹配）

- 规则匹配不再只看 `type / payload / proxy`
- 现在会额外匹配规则代理组的**下游链路节点**（例如：`ChatGPT -> 香港-故转 -> 香港-自动`）
- 这意味着：搜索 `香港-故转` / `香港-自动` 也能筛出上游 `ChatGPT`、`Gemini` 等对应规则

## 4) 设置导入兼容清洗（图标相关）

- 导入设置时增加键过滤，忽略历史遗留无效键：
  - `config/icon-size`
  - `config/icon-margin-right`
  - `config/use-large-proxy-group-icon`
- 仅保留当前版本有效设置键，降低“二改配置直接导入”带来的污染风险

## 5) 品牌与启动体验

- 面板名称统一为：**NebulaDash**
  - 页面标题
  - 运行时路由标题
  - PWA manifest 名称
- 新增一键启动脚本：
  - `start-za.ps1`（自动检查、首次安装依赖、自动打开浏览器、启动 dev）
  - `start-za.cmd`（兼容双击，内部转 PowerShell）

## 6) 设置页连接失败体验优化

- 首次进入设置页时，仍会静默尝试默认后端 `127.0.0.1:9090`
- 手动点击“提交”后，如果后端不可达，不再弹出浏览器原生 `TypeError: Failed to fetch`
- 改为显示面板内错误通知：`后端连接失败，请检查配置信息`
- 提交检测期间按钮显示“检查中...”并临时禁用，避免重复请求
- 必填项缺失时显示本地化提示（已覆盖简体中文、繁体中文、英文、俄文）

## 7) 构建体积与首包加载优化

- 路由页面改为动态导入，避免代理页、规则页、设置页、概览页等全部进入首包
- Vite/Rollup 按依赖域拆分 chunk：
  - `vue-vendor`
  - `vendor`
  - `echarts`
  - `zrender`
  - `table`
  - `drag`
  - `icons`
- 构建时不再出现 Vite 的 `Some chunks are larger than 500 kB` 警告
- 当前最大 JS chunk 为 `echarts`，约 `388 kB`

## 8) 更新源保护与自管理更新器

- 面板更新源固定到 `boostemotion/nebuladash` 的 GitHub Release，避免误拉官方 Zashboard 覆盖本地版。
- 当前 latest 下载地址：
  `https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip`
- 设置页新增 NebulaDash 自管理更新器：
  - 更新器地址
  - 更新器密钥
  - 检查更新器
  - 更新 NebulaDash
  - 回滚 NebulaDash
- 路由器端更新器位于 `router-updater/`，默认安装到：
  - `/usr/share/nebuladash-updater/`
  - `/www/cgi-bin/nebuladash-updater`
  - `/www/nebuladash-a`
  - `/www/nebuladash-b`
  - `/www/nebuladash`
- 更新采用 A/B 分区：先写入 inactive 分区，验证 `index.html`、`assets/`、`manifest.webmanifest` 后再切换 symlink。
- 支持回滚到另一分区。
- OpenWrt/uHTTPd 可能不转发自定义 header，前端会同时发送 header token 和 query token，CGI 会自动兼容。
- 更新前会检查 NebulaDash latest Release；如果无法确认版本、同版本或远端更旧，会先弹出风险确认。

---

## 快速启动

### 推荐（Windows）

直接运行：

```powershell
.\start-za.ps1
```

或双击：

```cmd
start-za.cmd
```

仅做环境检查：

```powershell
.\start-za.ps1 -Check
```

### 手动方式

```bash
corepack pnpm install
corepack pnpm dev
```

---

## 关键实现文件（便于审阅）

- 代理分段与聚类：
  - `src/composables/proxies.ts`
  - `src/views/ProxiesPage.vue`
- 策略组规则直通：
  - `src/components/proxies/ProxyGroup.vue`
- 搜索增强：
  - `src/store/rules.ts`
  - `src/composables/renderProxies.ts`
- 导入兼容清洗：
  - `src/helper/autoImportSettings.ts`
  - `src/components/common/ImportSettings.vue`
- 节点聚类设置项：
  - `src/store/settings.ts`
  - `src/components/settings/ProxiesSettings.vue`
  - `src/config/settingsItems.ts`
- 品牌名：
  - `src/router/index.ts`
  - `index.html`
  - `vite.config.ts`
- 设置页连接失败体验：
  - `src/views/SetupPage.vue`
  - `src/i18n/zh.ts`
  - `src/i18n/zh-tw.ts`
  - `src/i18n/en.ts`
  - `src/i18n/ru.ts`
- 路由懒加载与构建拆包：
  - `src/router/index.ts`
  - `vite.config.ts`
- 路由器自管理更新器：
  - `router-updater/updater.sh`
  - `router-updater/nebuladash-updater.cgi`
  - `router-updater/install.sh`
  - `src/helper/routerUpdater.ts`
  - `src/api/routerUpdater.ts`
  - `src/components/settings/ZashboardSettings.vue`

---

## 验证

已执行：

```bash
pnpm type-check
pnpm test
pnpm exec eslint .
pnpm build
```

均通过。`pnpm build` 不再输出大 chunk 警告。

---

## 手动实测清单（建议）

### A. 代理页三段切换

1. 打开代理页，确认顶部为：`策略组 / 节点组 / 代理提供商`
2. 点“策略组”仅显示策略组卡片
3. 点“节点组”仅显示节点组卡片（如香港-手动/自动/故转相邻）
4. 点“代理提供商”仅显示提供商卡片

**预期结果：** 三段内容互相独立显示，不再是旧版二选一逻辑。

### B. 规则搜索（你的配置场景）

在规则页搜索框依次输入：

- `ChatGPT`
- `ChatGPT / Domain`
- `香港-故转`
- `香港-自动`
- `Gemini,香港-故转`（多关键词）

**预期结果：**

- 能命中 `RULE-SET,ChatGPT / Domain,ChatGPT` 等对应规则
- 对于 `香港-故转/香港-自动`，可命中上游策略规则（链路感知匹配生效）
- 多关键词按 AND 逻辑过滤（都满足才显示）

### C. 代理搜索

在代理搜索输入：`香港 自动`、`香港|故转`、`香港,手动`

**预期结果：** 支持空格/逗号/`|` 分词，命中稳定。

再输入：`google.com`

**预期结果：** 能显示与该域名相关规则所映射的策略组/链路组，而不是空结果。

### D. 规则直通跳转与提供商

1. 在策略组卡片点击“规则直通”展开完整链路
2. 点击链路中的某个节点（如 `香港-故转` / `香港-手动`）
3. 观察是否切换到目标分段并定位到对应卡片（且卡片自动展开）
4. 观察链路末尾是否显示 `代理提供商: xxx`

**预期结果：**

- 跳转能落到具体目标卡片，不停在分段顶部
- 链路末尾可见当前最终落点的提供商名称

### E. 设置页后端不可达

1. 不启动 OpenClash / Mihomo 后端
2. 打开 `#/setup`
3. 使用默认 `127.0.0.1:9090` 点击“提交”

**预期结果：**

- 不出现浏览器原生 alert
- 页面显示“后端连接失败，请检查配置信息”
- 按钮在检测期间短暂显示“检查中...”

---

## 架构说明

本版本刻意不引入二改中的 server 中转与持久化链路，原因是面向低资源设备场景（如 512MB 级路由器）时，保持前端直连后端能显著减少常驻资源占用与维护复杂度。

---

## 上游 Zashboard 更新快速对接指南（关键）

目标：当上游 `zashboard` 发布新版本时，用最短路径把本仓改动重新对接上去。

### 1) 对接原则（先看）

- 只保留本项目已确认的增强点，不引入额外改造
- 优先保持“搜索、分组、规则直通”三条主线功能完整
- 若上游已内置同类能力，优先复用上游实现，避免重复补丁

### 2) 高冲突文件清单（升级时优先检查）

- `src/composables/proxies.ts`
  - 代理页三段分组、节点组排序、规则联动搜索
- `src/store/rules.ts`
  - 规则搜索（域名别名、链路感知）
- `src/composables/renderProxies.ts`
  - 节点列表搜索逻辑（已统一到公共搜索工具）
- `src/components/proxies/ProxyGroup.vue`
  - 规则直通、链路跳转、提供商尾标
- `src/views/ProxiesPage.vue`
  - Tab 切换滚动恢复与跳转协同
- `src/components/sidebar/ProxiesCtrl.tsx`
  - 代理页搜索触发规则预加载、三段 tab 数量展示
- `src/views/RulesPage.vue`
  - 规则列表序号渲染优化（避免 `indexOf`）
- `src/store/proxies.ts`
  - `proxyNodeProviderMap`（提供商映射缓存）
- `src/helper/search.ts`
  - 公共搜索工具（规则/代理/节点统一匹配逻辑）

### 3) 推荐对接流程（可直接执行）

1. 先同步上游代码到本地（不改业务）
2. 按“高冲突文件清单”逐个对比
3. 优先恢复 `src/helper/search.ts` 与其三处调用关系：
   - `src/store/rules.ts`
   - `src/composables/proxies.ts`
   - `src/composables/renderProxies.ts`
4. 恢复代理页与规则直通能力：
   - `ProxyGroup.vue`、`ProxiesPage.vue`、`ProxiesCtrl.tsx`
5. 恢复性能/稳定性补丁：
   - `RulesPage.vue` 序号计算
   - `store/proxies.ts` 提供商映射缓存
6. 完成后统一验证（见下方验收）

### 4) 升级后验收清单（最小闭环）

- 规则页：`google.com`、`ChatGPT / Domain`、`香港-故转` 可命中
- 代理页：`google.com` 可联动显示相关策略组/链路组
- 规则直通：点击链路节点能切分段并定位到具体卡片（非仅顶部）
- 规则直通尾部：显示 `代理提供商: xxx`
- 节点排序：同簇顺序 `故转 > 手动 > 自动`

### 5) 升级后固定命令

```bash
corepack pnpm exec vue-tsc --build --force
corepack pnpm exec vite build
```

通过标准：类型检查通过、构建成功、上述“升级后验收清单”全部通过。

### 6) Git 双远程固定工作流（官方拉取 + 自仓推送）

本仓约定：

- `upstream` = 官方仓库（只拉取）
- `origin` = 个人仓库（只推送）

常用流程：

```bash
# 查看远程
git remote -v

# 从官方拉取最新并更新本地 main
git fetch upstream
git checkout main
git rebase upstream/main

# 从最新 main 切功能分支开发
git checkout -b feat/my-change

# 提交并推到个人仓库
git add .
git commit -m "feat: your change"
git push -u origin feat/my-change
```

如果你直接在 `main` 维护，同步官方后可直接：

```bash
git push origin main
```

原则：**只从 upstream 拉更新，只往 origin 推修改**。

### 7) OpenClash UI 切换注意点（NebulaDash / Zashboard 共存）

部署 NebulaDash 后，建议配置为：

```yaml
external-ui: /usr/share/openclash/ui
external-ui-name: nebuladash
```

如果需要切回原版 Zashboard，只改一行：

```yaml
external-ui-name: zashboard
```

然后重启 OpenClash 即可生效。

说明：`nebuladash` 与 `zashboard` 可以共存于同一 UI 目录下，通过 `external-ui-name` 在两者间切换。

直接访问方式（示例）：

```
http://10.0.0.1:9090/ui/nebuladash/
```
