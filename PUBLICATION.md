# NebulaDash 公开发布说明

本文说明公开仓库中允许提交的内容、必须排除的本地文件，以及 GitHub Release 的发布方式。

## 可以提交

- `src/`、`public/`、`test/`、`tools/` 和构建配置
- `README.md`、`README-改动说明.md`、`PUBLICATION.md`、`upstream-followup/`
- `router-updater/`（不含真实 token）
- `.github/workflows/` 与 Issue 模板
- `package.json`、`pnpm-lock.yaml`
- Docker、Caddy、启动脚本
- 不含真实地址、密码和 Token 的示例配置（如 `router-updater/config.example`）

## 禁止提交

- OpenClash / Mihomo 后端密码
- GitHub Token、API Key、私钥和证书私钥
- 更新器真实 token（`/usr/share/nebuladash-updater/config` 的内容）
- `.env`、`.npmrc` 等本地凭据文件
- 浏览器导出的真实面板设置
- OpenClash 实际配置和订阅链接
- `node_modules/`、`.pnpm-store/`、`dist/`
- 手工生成的 ZIP、TAR、日志、临时文件和备份

Release 工作流带一步 `Audit tracked public files`，命中上述禁项会直接失败。

## 仓库历史形态

自 `3.30.0-nebula.1` 起，本仓以官方 Zashboard `v3.30.0` 为基线重建，**包含上游完整提交历史**。

这意味着：

- 仓库中保留上游 `LICENSE`、版权声明与作者信息，不得移除。
- 上游跟进可以正常 `git merge upstream/main`。
- 旧的独立历史版本保留在 tag `legacy/nebula-2.8.0`，仍可下载与回退。

## 发布模型

源码仓库公开，构建产物通过 GitHub Release 公开下载。
发布由 tag 触发（`.github/workflows/release.yml`）：

1. `pnpm release:check`：校验包名、Nebula 版本格式、tag 一致性
2. `pnpm exec eslint .` / `pnpm test` / `pnpm type-check`
3. 构建 7 种字体变体 ZIP + `router-updater.zip`
4. 上传 Release 附件

上游的 `deploy.yml`（release-please + PAT + gh-pages 多字体分支）已禁用，不要恢复。

## 版本号策略

版本格式：`<上游基线版本>-nebula.<轮次>[.<功能>[.<修复>]]`

- `3.30.0-nebula.1`：基于上游 v3.30.0 的第一轮 NebulaDash 发布
- `3.30.0-nebula.2`：同基线的第二轮，修复更新器下载 TLS 兼容并补齐 Provider 搜索字段
- `nebula.1` 表示大功能轮次，`.1.2` 表示该轮次下的第 2 个小功能增量，`.1.2.3` 为 bugfix 计数
- 纯 `3.30.0` 这类官方风格版本号禁止使用，避免用户误判为 Zashboard 官方发布
- Release tag 必须等于 `v<package.json version>`，例如 `v3.30.0-nebula.2`

`pnpm release:check` 会强制以上约束。

## 上下载地址约定

- 面板更新源固定：`https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip`
- 更新器默认 `RELEASE_URL` 与上面一致
- 后端 `external-ui-download-url` 不指向该 ZIP 时，面板内“更新面板”会被禁用（防止误装官方 Zashboard）

## 发布检查清单

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
pnpm release:check
```

界面相关改动额外执行：

```bash
pnpm test:nebula
```

路由器更新器改动额外在 POSIX 环境执行：

```bash
sh router-updater/smoke-test.sh
```

## 发布后确认

```bash
# latest 是否指向新版本
curl -s https://api.github.com/repos/boostemotion/nebuladash/releases/latest | grep tag_name

# 下载链路是否可用（应 200）
curl -sIL -o /dev/null -w '%{http_code}\n' \
  https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip
curl -sIL -o /dev/null -w '%{http_code}\n' \
  https://github.com/boostemotion/nebuladash/releases/latest/download/router-updater.zip
```

发布后同步更新 `README.md`、`upstream-followup/AI-HANDOFF.md`、
`upstream-followup/NEBULADASH-CHANGELOG.md` 中的“当前版本 / 当前 Release”。
