# All View - 后台管理系统

基于 Vite + React + TypeScript + Ant Design 的后台管理系统，支持深浅主题、用户登录、层级菜单、系统配置。

## 功能

- **深浅主题**：顶栏切换浅色/深色，偏好持久化到 localStorage
- **用户登录**：Demo 账号 `admin/admin123` 或 `operator/operator123`
- **层级菜单**：系统管理 > 账号管理、系统配置
- **系统配置**：视频播放器配置，可从资源管理器选择程序，配置后可用指定播放器播放本地视频（桌面端应用支持）；**清除保存数据** 会删除应用 JSON、**递归清空数据目录下 `library/` 与 `thumbs/`**、Electron 侧 `app-data.json`、localStorage 与已选目录句柄，并刷新页面（不可恢复，请先导出备份）
- **数据持久化**：
  - **桌面端（打包 exe）**：默认从 **exe 同目录** 的 `app-data.json` 读作品/账号（`storage-read`）；**图片 +「选择数据目录」** 仍走 File System API（目录句柄只能存 IndexedDB）。启动时会尝试从已记住的数据目录读取 `app-data.json` 并写回 exe 旁，与便携文件夹对齐。与网页版共用同一数据文件夹时，在 exe 里点 **「选择数据目录」** 选该文件夹即可合并。导入若提示无权限，再选一次同一文件夹。
  - **浏览器**：未选数据目录时用 localStorage；选了目录则优先目录中的 `app-data.json`。目录权限不会在后台自动续期，换环境后需再次点「选择数据目录」选同一文件夹。
- **图片管理（引用模式）**：导入时只保存 **IndexedDB 中的文件句柄**（与视频本地源相同机制）及数据目录下 **缩略图**（`thumbs/*.webp`），**不再把原图复制进 `library/`**，便于快速汇总索引；历史数据中已存在于 `library/` 的图片仍可正常浏览与移动导出。
- **作品库通用能力（视频 / 漫画）**：与图片管理一致的「筛选与排序」折叠面板、分类/标签/创建时间筛选、排序、列表搜索与分页；`app-data.json` 中 `mediaUi.video` / `mediaUi.comic` 存视图模式与筛选偏好（与 `videos` / `comics` 业务数组分离，结构见 `MediaLibraryUiState`）
- **移动当前结果（图片，Chrome / Edge）**：在图片列表选择目标文件夹后，将**当前筛选结果**的文件**移动**到子文件夹（先写入目标再删除数据目录内原图或 IndexedDB 句柄，并从索引移除）；旧版曾复制到 `library/` 的图片仍按原路径删除源文件。视频 / 漫画仍为**导出（复制）**可解析资源（网络 URL、`local-handle:` 等），纯桌面路径需自行复制
- **简约 Logo**：All View 品牌标识

## 启动

### 浏览器模式

```bash
npm install
npm run dev
```

浏览器访问 http://localhost:5173

### 桌面端模式（Electron）

依赖已写在 `package.json` 的 `devDependencies` 中，安装项目即可：

```bash
npm install
npm run dev:electron
```

若安装时 **Electron 二进制下载超时**（PowerShell / CMD 先执行再 `npm install`）：

```bat
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
npm install
```

以桌面应用形式运行，支持系统配置中的「选择程序」「选择视频」「播放」功能。

打包后的 exe 使用 `file://` 打开页面，路由采用 **Hash 模式**（地址栏为 `#/app/...`），避免 `BrowserRouter` 在本地文件协议下全部落到 404。

## 构建

```bash
npm run build
```

产物在 `dist/` 目录，可部署到任意静态托管。

## 打包为 Windows 便携版（单体 exe）

使用 **electron-builder** 的 `portable` 目标：生成**单个可执行文件**，无需安装向导，双击即可运行（内含前端静态资源）。

```bash
npm install
npm run build:exe
```

**若 PowerShell 提示「禁止运行脚本」**（无法加载 `npm.ps1`），任选其一：

- 用 **CMD** 打开项目目录后执行：`npm run build:exe`
- 或在 PowerShell 里显式调用：`npm.cmd run build:exe`
- 或双击 / 在 CMD 中运行项目里的 **`build-exe.bat`**
- 或放宽当前用户策略（一次即可）：`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

- **产物路径**：`release/All Play-1.0.0-portable.exe`（版本号随 `package.json` 的 `version` 变化）
- **体积**：约百 MB 量级（内含 Chromium）
- **数据文件**：首次运行后会在 **exe 同目录** 生成 `app-data.json`

**若日志停在** `building target=portable` **很久没有新输出**：多半是在压缩打包便携 exe（CPU/磁盘会持续有占用），**等 5～15 分钟** 属正常。项目已设 **`compression: store`** 以加快此步骤；若仍极慢，可对 `release` 目录与项目路径关闭实时杀毒扫描。任务管理器里若 **`Node` / `app-builder` / `7za`** 仍在工作，请勿强制结束。

**若此时 CPU 长期为 0**（不像在压缩）：说明 portable 这一步可能已卡死，请 **结束该次命令**，改打 **文件夹版**（不生成单文件，功能相同）：

```bat
npm.cmd run build:win-dir
```

或双击 **`build-win-folder.bat`**。完成后运行：

`release\win-unpacked\All Play.exe`

请 **保留 `win-unpacked` 整个文件夹**（与 exe 同级的 `resources` 等不能删），可把整个文件夹拷到 U 盘或别的电脑使用。

若需 **NSIS 安装包**，可执行：

```bash
npm run build && cross-env CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --win nsis --x64
```

安装包同样输出在 `release/` 目录。

### 打包报错：7-Zip / winCodeSign / 无法创建符号链接

若出现 `Cannot create symbolic link`、`客户端没有所需的特权`（解压 `winCodeSign` 失败）：

1. **本项目已默认关闭 Windows 代码签名**（`CSC_IDENTITY_AUTO_DISCOVERY=false` + `package.json` 中 `forceCodeSigning` / `signDlls`），请先执行 **`npm install`** 以安装 **`cross-env`**，再运行 **`npm run build:exe`**。
2. 仍失败时，删除缓存后重试：删掉目录  
   `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign`  
   （资源管理器地址栏粘贴回车即可进入）。
3. 或在本机打开 **Windows 设置 → 系统 → 开发者选项 → 开发人员模式**，允许创建符号链接；或用 **以管理员身份运行** 终端再打包。
