# Pizza Board（披萨画板）

55 寸会议平板用的单机披萨涂鸦墙 · Electron 试玩版。

## 目录

| 路径 | 说明 |
|------|------|
| `prototype.html` | 当前主原型（画墙 / 榜单 / 待机幽灵笔 / 打印） |
| `prototype-v*.html` | 早期方案原型 |
| `desktop/` | Electron 包装：kiosk、本地持久化、静默打印 |
| `desktop/scripts/` | 打包后辅助启动脚本生成 |

## 本地跑桌面版

```bash
cd desktop
npm install
npm run dev          # 窗口模式
npm run dist         # 打出 win-unpacked 到 dist-release/
```

启动打包结果：打开 `desktop/dist-release/win-unpacked/1-Start-Fullscreen.bat`。

## 浏览器预览原型

用任意静态服务器打开根目录的 `prototype.html` 即可（打印 / 部分 kiosk 能力仅桌面版可用）。
