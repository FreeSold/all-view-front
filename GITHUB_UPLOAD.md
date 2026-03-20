# 上传到 GitHub 指南

## 已完成

- Git 已安装
- 仓库已初始化，首次提交已完成（58 个文件）
- GitHub CLI 已安装

## 剩余步骤（需你操作）

### 1. 登录 GitHub

在 PowerShell 中运行：

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" auth login
```

按提示选择：
- GitHub.com
- HTTPS
- 选择 "Login with a web browser"，复制验证码后在浏览器中完成登录

### 2. 首次在 GitHub 创建仓库并推送

若本地**还没有** `origin` 远程，登录 `gh` 后在项目根目录执行一次：

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" repo create all-view-front --public --source=. --remote=origin --push
```

若提示仓库名已占用，请在 GitHub 上换名或改用私有库，并相应修改命令中的仓库名。

### 3. 日常：提交并推送到 GitHub

本地已配置 `origin` 后，修改代码可用脚本**暂存全部变更 → 提交（有变更时）→ 推送当前分支**：

```powershell
# CMD（推荐，无执行策略限制）；可选：push-to-github.bat 本次说明文字
push-to-github.bat

# PowerShell；可自定义提交说明
.\push-to-github.ps1
.\push-to-github.ps1 -Message "描述本次修改"
```

脚本会自动查找 `git`（PATH 或常见安装路径）。

### 4. 若选择手动上传（不用 gh create）

1. 在 https://github.com/new 创建新仓库，名称 `all-view-front`，不要勾选 README
2. 运行：

```powershell
cd d:\programing\ideaPorjects\all-view-front
& "C:\Program Files\Git\bin\git.exe" remote add origin https://github.com/你的用户名/all-view-front.git
& "C:\Program Files\Git\bin\git.exe" branch -M main
& "C:\Program Files\Git\bin\git.exe" push -u origin main
```

### 5. 配置 Git 身份（推荐）

首次使用建议设置你的名字和邮箱：

```powershell
git config --global user.name "你的名字"
git config --global user.email "你的邮箱@example.com"
```

## 后续更新

与「日常推送」相同：运行 `push-to-github.bat` 或 `.\push-to-github.ps1`，或手动：

```powershell
git add -A
git commit -m "描述本次修改"
git push
```
