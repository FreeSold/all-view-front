const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  selectVideoPlayer: () => ipcRenderer.invoke('select-video-player'),
  selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
  selectImageFile: () => ipcRenderer.invoke('select-image-file'),
  playVideo: (playerPath, videoPath) => ipcRenderer.invoke('play-video', playerPath, videoPath),
  storageRead: () => ipcRenderer.invoke('storage-read'),
  storageWrite: (data) => ipcRenderer.invoke('storage-write', data),
})
