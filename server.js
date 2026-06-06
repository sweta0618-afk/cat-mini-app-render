const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const app = express();

// Настройки сервера
app.use(cors());
// Увеличиваем лимит, так как фото в base64 весят много
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Отдаем наш index.html как главную страницу
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Отдаем картинки (например, иконку) если они лежат рядом
app.use(express.static(__dirname));

// Инициализация Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Роут для распознавания еды
app.post('/api/recognize-food', async (req, res) => {
    try {
        const { imageBase64 } = req.body;
        
        if (!imageBase64) {
            return res.status(400).json({ error: 'Нет изображения' });
        }

        // Убираем префикс data:image/jpeg;base64,
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

        // Строгий промпт для получения четкого JSON от Gemini
        const prompt = `Ты эксперт-диетолог. Проанализируй это фото еды. 
Определи что это за блюдо, его примерный вес на тарелке, и рассчитай калории и БЖУ (белки, жиры, углеводы).
Верни результат СТРОГО в виде JSON объекта, без markdown разметки, без текста до и после. 
Формат:
{
    "name": "Название блюда (с заглавной)",
    "cals": число,
    "p": число,
    "f": число,
    "c": число
}`;

        // Отправка запроса в Gemini 2.5 Flash
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                prompt,
                { inlineData: { data: base64Data, mimeType: 'image/jpeg' } }
            ]
        });

        // Очистка ответа от возможных markdown-тегов (```json ... ```)
        const text = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(text);

        res.json(data);
    } catch (error) {
        console.error('Ошибка Gemini API:', error);
        res.status(500).json({ error: 'Не удалось распознать еду' });
    }
});
// --- ЧАТ С МАТВЕЕМ (GEMINI API) ---
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Нет сообщения' });
        }

        const systemPrompt = `Ты — рыжий кот Матвей, виртуальный помощник приложения «Легкость с Котом».

Твоя задача:
- помогать снижать вес без жестких диет;
- поддерживать мотивацию;
- объяснять простыми словами вопросы питания;
- советовать пить воду;
- напоминать о движении;
- поддерживать занятия йогой.

Стиль общения:
- добрый;
- теплый;
- с чувством юмора;
- иногда используй слова «мур», «лапки», «хвост трубой»;
- не осуждай пользователя;
- отвечай коротко, до 4 предложений.

Если пользователь расстроен — поддержи.
Если сорвался с питания — успокой.
Если спрашивает про йогу — дай мягкий совет.
Ты не врач и не ставишь диагнозы.

Сообщение пользователя: ${message}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: systemPrompt
        });

        res.json({ success: true, text: response.text });
    } catch (error) {
        console.error('Ошибка чата:', error);
        res.status(500).json({ success: false, error: 'Мяу... Связь прервалась.' });
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
