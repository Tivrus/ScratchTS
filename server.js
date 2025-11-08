/**
 * Простой сервер для автосохранения workspace.json
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Отдаем статические файлы из корня проекта
app.use(express.static(__dirname));

// Endpoint для сохранения workspace
app.post('/api/save-workspace', async (req, res) => {
    try {
        const workspaceData = req.body;
        const filePath = path.join(__dirname, 'workspace.json');
        
        await fs.writeFile(filePath, JSON.stringify(workspaceData, null, 2), 'utf-8');
        
        console.log('[Server] Workspace saved to workspace.json');
        res.json({ success: true, message: 'Workspace saved successfully' });
    } catch (error) {
        console.error('[Server] Error saving workspace:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint для загрузки workspace
app.get('/api/load-workspace', async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'workspace.json');
        
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            const workspaceData = JSON.parse(data);
            
            console.log('[Server] Workspace loaded from workspace.json');
            res.json({ success: true, data: workspaceData });
        } catch (error) {
            // Файл не существует или пустой
            res.json({ success: true, data: { blocks: {} } });
        }
    } catch (error) {
        console.error('[Server] Error loading workspace:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
    console.log('[Server] API endpoints:');
    console.log(`  POST http://localhost:${PORT}/api/save-workspace`);
    console.log(`  GET  http://localhost:${PORT}/api/load-workspace`);
});
