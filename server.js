const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Middleware для парсинга JSON
app.use(express.json());

// Статические файлы
app.use(express.static('.'));

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Эндпоинт для сохранения JSON в project.json
app.post('/api/save-json', (req, res) => {
  try {
    const jsonData = req.body;
    const jsonString = JSON.stringify(jsonData, null, 4);
    fs.writeFileSync(path.join(__dirname, 'project.json'), jsonString);
    res.json({ success: true, message: 'JSON saved successfully' });
  } catch (error) {
    console.error('Error saving JSON:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`📁 Статические файлы обслуживаются из: ${__dirname}`);
  console.log(`🔄 Для автоматической перезагрузки используйте: npm run dev`);
  console.log(`💾 API endpoint: POST /api/save-json`);
});
