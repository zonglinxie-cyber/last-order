import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { deepSeekProxyPlugin } from './server/deepseekProxy.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'DEEPSEEK_API_KEY');
  const deepSeekApiKey = process.env.DEEPSEEK_API_KEY || env.DEEPSEEK_API_KEY;
  return {
    plugins: [react(), deepSeekProxyPlugin(deepSeekApiKey)],
  };
});
