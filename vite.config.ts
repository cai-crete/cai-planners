import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import express from 'express';
import { GoogleGenAI } from '@google/genai';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'local-api-mock',
        configureServer(server) {
          const app = express();
          app.use(express.json());
          app.post('/api/generate', async (req, res) => {
            const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
            try {
              const { model, contents, config } = req.body;
              const response = await ai.models.generateContent({ model, contents, config });
              res.json({ text: response.text });
            } catch (e: any) {
              res.status(500).json({ error: String(e) });
            }
          });
          server.middlewares.use(app);
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
