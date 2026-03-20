@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "GIT_EXE=C:\Program Files\Git\bin\git.exe"
if exist "%GIT_EXE%" goto :GIT_OK
where git >nul 2>&1 && set "GIT_EXE=git" && goto :GIT_OK
echo [错误] 未找到 Git。请安装 Git for Windows 或加入 PATH。
exit /b 1

:GIT_OK
"%GIT_EXE%" remote >nul 2>&1
if errorlevel 1 (
  echo [错误] 未配置远程仓库，请先 git remote add origin ... 详见 GITHUB_UPLOAD.md
  exit /b 1
)

echo.
echo git add -A
"%GIT_EXE%" add -A

"%GIT_EXE%" diff --cached --quiet
if errorlevel 1 (
  if "%~1"=="" (
    "%GIT_EXE%" commit -m "chore: sync local changes"
  ) else (
    "%GIT_EXE%" commit -m "%*"
  )
  if errorlevel 1 (
    echo [错误] 提交失败，请配置 git user.name / user.email
    exit /b 1
  )
) else (
  echo 没有新的变更需要提交。
)

for /f "tokens=*" %%b in ('"%GIT_EXE%" branch --show-current') do set "BR=%%b"
echo.
echo git push -u origin %BR%
"%GIT_EXE%" push -u origin "%BR%"
if errorlevel 1 (
  echo [提示] 推送失败时请检查登录凭据或执行 gh auth login
  exit /b 1
)

echo.
echo 已推送到 origin/%BR%
exit /b 0
