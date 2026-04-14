const { contextBridge, ipcRenderer } = require('electron')

const ALLOWED_CHANNELS = ['get-config', 'save-config', 'select-directory', 'read-file', 'write-file']

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel, ...args) => {
    if (!ALLOWED_CHANNELS.includes(channel)) {
      throw new Error(`IPC channel "${channel}" is not allowed`)
    }
    return ipcRenderer.invoke(channel, ...args)
  }
})
