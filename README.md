# All View - 后台管理系统

基于 Vite + React + TypeScript + Ant Design 的后台管理系统，支持深浅主题、用户登录、层级菜单、系统配置。

## 功能

- **深浅主题**：顶栏切换浅色/深色，偏好持久化到 localStorage
- **用户登录**：Demo 账号 `admin/admin123` 或 `operator/operator123`
- **层级菜单**：系统管理 > 账号管理、系统配置
- **系统配置**：视频播放器配置，可从资源管理器选择程序，配置后可用指定播放器播放本地视频（桌面端应用支持）
- **数据持久化**：
  - **桌面端（exe）**：数据保存在用户目录 JSON 文件（`%APPDATA%/All View/app-data.json`），清除网站数据、重启、重装均不影响
  - **浏览器**：使用 localStorage，支持导出备份 / 导入恢复，清除数据后可手动恢复
- **简约 Logo**：All View 品牌标识

## 启动

### 浏览器模式

```bash
npm install
npm run dev
```

浏览器访问 http://localhost:5173

### 桌面端模式（Electron，可选）

需先安装 Electron：`npm install -D electron electron-builder`（若网络不畅可稍后重试）

```bash
npm run dev:electron
```

以桌面应用形式运行，支持系统配置中的「选择程序」「选择视频」「播放」功能。

## 构建

```bash
npm run build
```

产物在 `dist/` 目录，可部署到任意静态托管。

## 打包为 Windows exe

需先安装 Electron：`npm install -D electron electron-builder`

```bash
npm run build:exe
```

产物在 `release/` 目录，可生成 Windows 安装包。打包后双击 exe 即可运行，无需启动服务。
