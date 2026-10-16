import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

const icons = {
  16: 'icons/icon-16.png',
  32: 'icons/icon-32.png',
  48: 'icons/icon-48.png',
  128: 'icons/icon-128.png',
};

export default defineManifest({
  manifest_version: 3,
  name: 'NoteWeb',
  description: pkg.description,
  version: pkg.version,
  icons,
  action: {
    default_title: 'NoteWeb',
    default_popup: 'src/popup/index.html',
    default_icon: icons,
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/main.ts'],
      run_at: 'document_idle',
      all_frames: false,
    },
  ],
  permissions: ['storage', 'unlimitedStorage', 'contextMenus'],
  host_permissions: ['<all_urls>'],
  commands: {
    'create-note': {
      suggested_key: { default: 'Alt+Shift+N' },
      description: 'Criar uma nota nesta página',
    },
  },
});
