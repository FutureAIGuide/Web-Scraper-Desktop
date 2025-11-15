import { contextBridge } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Add any APIs you need to expose to the renderer here
  // Example: send: (channel: string, data: any) => ipcRenderer.send(channel, data)
});
