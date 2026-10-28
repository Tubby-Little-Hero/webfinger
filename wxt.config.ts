import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  outDir: 'dist',

  manifest: {
    name: 'WebFinger - 网站技术指纹与漏洞分析',
    description: '自动识别网站技术栈(CMS/框架/服务器/CDN/WAF)，关联历史漏洞(CVE/CNVD)，支持AI辅助验证',
    version: '1.0.0',
    permissions: [
      'storage',
      'tabs',
      'webRequest',
      'webNavigation',
      'scripting',
      'cookies',
    ],
    host_permissions: ['*://*/*'],
    action: {
      default_title: 'WebFinger',
      default_popup: 'popup/index.html',
    },
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },

  vite: () => ({
    plugins: [react(), tailwindcss()],
  }),
});
