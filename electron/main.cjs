const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

const DATA_FILE = 'app-data.json'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.on('closed', () => {
    // no-op
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

ipcMain.handle('select-video-player', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '选择视频播放器',
    properties: ['openFile'],
    filters: [
      { name: '可执行文件', extensions: ['exe'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  })
  if (canceled || !filePaths.length) return null
  return filePaths[0]
})

ipcMain.handle('select-video-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '选择视频文件',
    properties: ['openFile'],
    filters: [
      { name: '视频文件', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  })
  if (canceled || !filePaths.length) return null
  return filePaths[0]
})

ipcMain.handle('select-image-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '选择封面图片',
    properties: ['openFile'],
    filters: [
      { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  })
  if (canceled || !filePaths.length) return null
  return filePaths[0]
})

/**
 * 数据存储路径：
 * - 打包后（exe）：存到 exe 所在目录，便于移动硬盘携带，插到任意电脑运行看到的都是同一份数据
 * - 开发模式：存到用户目录 userData
 */
function getDataPath() {
  if (app.isPackaged) {
    const exeDir = path.dirname(app.getPath('exe'))
    return path.join(exeDir, DATA_FILE)
  }
  return path.join(app.getPath('userData'), DATA_FILE)
}

ipcMain.handle('storage-read', async () => {
  const filePath = getDataPath()
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return raw
  } catch (e) {
    if (e.code === 'ENOENT') return null
    throw e
  }
})

ipcMain.handle('storage-write', async (_event, data) => {
  const filePath = getDataPath()
  fs.writeFileSync(filePath, data, 'utf-8')
})

ipcMain.handle('play-video', async (_event, playerPath, videoPath) => {
  return new Promise((resolve, reject) => {
    const child = spawn(playerPath, [videoPath], {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
    child.on('error', reject)
    child.on('spawn', () => resolve())
  })
})
