import '@testing-library/jest-dom';

// Guard: only set up browser mocks when running in jsdom (window is defined)
if (typeof window === 'undefined') {
  // Node environment - no window setup needed
} else {

// Mock the Electron API for renderer tests
const mockElectronAPI = {
  file: {
    read: vi.fn().mockResolvedValue({ success: true, data: '' }),
    write: vi.fn().mockResolvedValue({ success: true }),
    exists: vi.fn().mockResolvedValue({ success: true, data: false }),
    delete: vi.fn().mockResolvedValue({ success: true }),
  },
  json: {
    read: vi.fn().mockResolvedValue({ success: true, data: null }),
    write: vi.fn().mockResolvedValue({ success: true }),
  },
  dir: {
    list: vi.fn().mockResolvedValue({ success: true, data: [] }),
    create: vi.fn().mockResolvedValue({ success: true }),
    exists: vi.fn().mockResolvedValue({ success: true, data: false }),
  },
  config: {
    getAgents: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getClaudeSettings: vi.fn().mockResolvedValue({ success: true, data: { path: '', exists: false, data: null } }),
    saveClaudeSettings: vi.fn().mockResolvedValue({ success: true }),
    getClaudePlugins: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getGeminiSettings: vi.fn().mockResolvedValue({ success: true, data: { path: '', exists: false, data: null } }),
    saveGeminiSettings: vi.fn().mockResolvedValue({ success: true }),
    getGeminiExtensions: vi.fn().mockResolvedValue({ success: true, data: { extensions: [], enablement: {} } }),
    deleteGeminiExtension: vi.fn().mockResolvedValue({ success: true }),
    getCopilotConfig: vi.fn().mockResolvedValue({ success: true, data: { path: '', exists: false, data: null } }),
    saveCopilotConfig: vi.fn().mockResolvedValue({ success: true }),
    getMcp: vi.fn().mockResolvedValue({ success: true, data: { path: '', exists: false, data: { mcpServers: {} } } }),
    saveMcp: vi.fn().mockResolvedValue({ success: true }),
    getSkills: vi.fn().mockResolvedValue({ success: true, data: [] }),
    saveSkill: vi.fn().mockResolvedValue({ success: true }),
    deleteSkill: vi.fn().mockResolvedValue({ success: true }),
    getMarkdown: vi.fn().mockResolvedValue({ success: true, data: { path: '', exists: false, data: null } }),
    saveMarkdown: vi.fn().mockResolvedValue({ success: true }),
    getSessions: vi.fn().mockResolvedValue({ success: true, data: [] }),
    deleteSession: vi.fn().mockResolvedValue({ success: true }),
    setPluginEnabled: vi.fn().mockResolvedValue({ success: true }),
    deletePlugin: vi.fn().mockResolvedValue({ success: true }),
  },
  dialog: {
    openDir: vi.fn().mockResolvedValue({ success: true, data: null }),
    openFile: vi.fn().mockResolvedValue({ success: true, data: null }),
    saveFile: vi.fn().mockResolvedValue({ success: true, data: null }),
  },
  app: {
    getUserDataPath: vi.fn().mockResolvedValue({ success: true, data: '/mock/userdata' }),
    getHomePath: vi.fn().mockResolvedValue({ success: true, data: '/mock/home' }),
    openExternal: vi.fn().mockResolvedValue({ success: true }),
  },
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});
} // end if typeof window !== 'undefined'
