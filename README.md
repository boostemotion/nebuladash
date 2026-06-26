# NebulaDash

NebulaDash 是基于 Zashboard 的轻量增强分支，重点优化 OpenClash / Mihomo
多 Provider 场景下的代理页可用性、搜索、规则链路定位和低资源设备体验。

本项目保持浏览器直连后端，不增加常驻中转服务或数据库。

<p align="center">
  <img src="./readme/pc.png" height="300">
  <img src="./readme/mobile.png" height="300">
</p>

## **Requirement**

Browser support

- Chrome 111 (released March 2023)
- Firefox 128 (released July 2024)
- Safari 16.4 (released March 2023)
- Not supported on iOS 16.4 jailbroken version.

## **Download**

You can download NebulaDash release archives here:

release:

- [dist.zip](https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip) — bundled fonts
- [dist-no-fonts.zip](https://github.com/boostemotion/nebuladash/releases/latest/download/dist-no-fonts.zip) — system fonts only
- [dist-cdn-fonts.zip](https://github.com/boostemotion/nebuladash/releases/latest/download/dist-cdn-fonts.zip) — CDN fonts
- [dist-firasans-only.zip](https://github.com/boostemotion/nebuladash/releases/latest/download/dist-firasans-only.zip)
- [dist-misans-only.zip](https://github.com/boostemotion/nebuladash/releases/latest/download/dist-misans-only.zip)
- [dist-pingfang-only.zip](https://github.com/boostemotion/nebuladash/releases/latest/download/dist-pingfang-only.zip)
- [dist-sarasa-only.zip](https://github.com/boostemotion/nebuladash/releases/latest/download/dist-sarasa-only.zip)

Releases are generated from public version tags by GitHub Actions. See
[PUBLICATION.md](./PUBLICATION.md) for repository and release safety rules.

## **OpenClash Update URL**

```yaml
external-ui-download-url: https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip
```

## Tips

1. The connection table can be dragged with the left mouse button, and right-clicking can copy cell content.
2. Right-clicking on a node / node group card will perform a speedtest for the node / node group.
3. The proxy group sorting is based on the node order in the GLOBAL group. In Mihomo, it follows the configuration file order, while in sing-box, route.final is placed first, with the rest following the configuration file order. If you need custom ordering, you can specify the order by overriding the GLOBAL group.
4. The dashboard supports PWA (Progressive Web App), which can provide a native app-like experience on mobile devices through "Add to Home Screen".
5. The dashboard's upgrade button and auto-upgrade functionality require the core's UI download path to point to NebulaDash. If it points elsewhere, NebulaDash disables dashboard upgrades to avoid replacing itself with another panel.

## 提示

1. 连接表格可被鼠标左键拖动，右键可复制单元格内容。
2. 右键点击节点/节点组卡片可对节点/节点组进行测速。
3. 面板的节点组排序是根据GLOBAL组中的节点顺序排序的，在Mihomo中会是按配置文件的顺序，在sing-box中会把route.final放到第一位，其余按照配置文件顺序，如果你需要自定义顺序，可通过覆盖GLOBAL组指定顺序
4. 面板支持PWA（Progressive Web App），可以在移动设备上通过"添加到主屏幕"获得类原生app的体验
5. 面板的更新按钮和自动更新功能要求核心的 UI 下载地址指向 NebulaDash；如果指向其他面板，NebulaDash 会禁用面板更新，避免把自己替换成别的面板。

## URL params format

#### basic example

http://host:port/#/setup?hostname=ipordomain&port=9090&secret=123456

1. **`http` / `https`**
   - Determines the protocol (`http` or `https`).
   - Default: current page protocol

2. **`hostname`**
   - The Clash API's IP or domain.

3. **`port`**
   - The Clash API port.

4. **`secondaryPath`**
   - Optional path appended to the base URL.
   - Default: An empty string.

5. **`secret`**
   - Password for authentication.

6. **`disableUpgradeCore`**
   - Set '1' or 'true' to hide upgrade core button

### I code just for fun, not for money. If you really want to donate, please consider donating to [UNICEF](https://www.unicef.org/) to help hungry children.
