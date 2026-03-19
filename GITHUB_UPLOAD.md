# 上传到 GitHub 指南

## 前置条件

1. **安装 Git**（若未安装）
   - 下载：https://git-scm.com/download/win
   - 安装后重启终端

2. **注册 GitHub 账号**（若未注册）
   - 访问：https://github.com
   - 注册并登录

## 步骤

### 1. 打开终端，进入项目目录

```powershell
cd d:\programing\ideaPorjects\all-view-front
```

### 2. 初始化 Git 仓库

```powershell
git init
```

### 3. 添加所有文件并提交

```powershell
git add .
git commit -m "Initial commit: All View 后台管理系统"
```

### 4. 在 GitHub 创建新仓库

1. 登录 GitHub，点击右上角 **+** → **New repository**
2. 填写：
   - **Repository name**：`all-view-front`（或自定义）
   - **Description**：All View 后台管理系统 - 视频/漫画/图片管理
   - 选择 **Public**
   - **不要**勾选 "Add a README file"（本地已有）
3. 点击 **Create repository**

### 5. 关联远程仓库并推送

将下面命令中的 `你的用户名` 替换为你的 GitHub 用户名：

```powershell
git remote add origin https://github.com/你的用户名/all-view-front.git
git branch -M main
git push -u origin main
```

若使用 SSH：

```powershell
git remote add origin git@github.com:你的用户名/all-view-front.git
git branch -M main
git push -u origin main
```

### 6. 首次推送可能需要登录

- HTTPS：会提示输入 GitHub 用户名和密码（密码使用 Personal Access Token）
- 若未配置凭据，可参考：https://docs.github.com/zh/authentication

## 后续更新

修改代码后，执行：

```powershell
git add .
git commit -m "描述本次修改"
git push
```
