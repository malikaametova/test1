
const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const axios = require('axios'); // Импортируем axios
const app = express();
app.use(bodyParser.json());

// *** ВАЖНО: Замените эти данные на ваши данные! ***
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '1234',
  database: 'stock_db'
};

async function query(sql, params) {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const [results] = await connection.execute(sql, params);
    return results;
  } catch (error) {
    console.error("Ошибка SQL:", error);
    throw error;
  } finally {
    connection.end();
  }
}

// Функция для логирования событий в сервис истории
async function logEvent(event, data) {
    try {
        const response = await axios.post('http://localhost:5000/events', {
            event: event,
            timestamp: new Date().toISOString(),
            data: data
        });
        console.log('Event logged successfully:', response.data);
    } catch (error) {
        console.error('Error logging event:', error);
    }
}


// Создание товара
app.post('/products', async (req, res) => {
  const { plu, name } = req.body;
  try {
    const result = await query('INSERT INTO products (plu, name) VALUES (?, ?)', [plu, name]);
    res.status(201).json({ id: result.insertId, plu, name });
  } catch (error) {
    console.error("Ошибка при создании товара:", error);
    res.status(500).json({ error: 'Ошибка создания товара' });
  }
});

// Создание остатка
app.post('/stock', async (req, res) => {
  const { product_id, shop_id, shelf_quantity, order_quantity } = req.body;
  try {
    const result = await query(
      'INSERT INTO stock (product_id, shop_id, shelf_quantity, order_quantity) VALUES (?, ?, ?, ?)',
      [product_id, shop_id, shelf_quantity, order_quantity]
    );
    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (error) {
    console.error("Ошибка при создании остатка:", error);
    res.status(500).json({ error: 'Ошибка создания остатка' });
  }
});

// Увеличение остатка
app.put('/stock/increase/:id', async (req, res) => {
    const stockId = req.params.id;
    const { quantity } = req.body;
    try {
        const [rows] = await query('SELECT * FROM stock WHERE id = ?', [stockId]);
        if (rows.length === 0) {
            return res.status(404).json({error: 'Запись не найдена'});
        }
        const oldQuantity = rows[0].shelf_quantity;
        await query('UPDATE stock SET shelf_quantity = shelf_quantity + ? WHERE id = ?', [quantity, stockId]);
        const newQuantity = oldQuantity + quantity;
        await logEvent('stock_increased', {stockId, oldQuantity, newQuantity, quantity}); // Логируем событие
        res.status(200).json({ message: 'Остаток увеличен' });
    } catch (error) {
        console.error("Ошибка при увеличении остатка:", error);
        res.status(500).json({ error: 'Ошибка увеличения остатка' });
    }
});

// Уменьшение остатка
app.put('/stock/decrease/:id', async (req, res) => {
    const stockId = req.params.id;
    const { quantity } = req.body;
    try {
        const [rows] = await query('SELECT * FROM stock WHERE id = ?', [stockId]);
        if (rows.length === 0) {
            return res.status(404).json({error: 'Запись не найдена'});
        }
        const oldQuantity = rows[0].shelf_quantity;
        await query('UPDATE stock SET shelf_quantity = shelf_quantity - ? WHERE id = ?', [quantity, stockId]);
        const newQuantity = oldQuantity - quantity;
        await logEvent('stock_decreased', {stockId, oldQuantity, newQuantity, quantity}); // Логируем событие
        res.status(200).json({ message: 'Остаток уменьшен' });
    } catch (error) {
        console.error("Ошибка при уменьшении остатка:", error);
        res.status(500).json({ error: 'Ошибка уменьшения остатка' });
    }
});


// Получение остатков (пример - можно расширить фильтрацию)
app.get('/stock', async (req, res) => {
  try {
    const results = await query('SELECT * FROM stock');
    res.json(results);
  } catch (error) {
    console.error("Ошибка при получении остатков:", error);
    res.status(500).json({ error: 'Ошибка получения остатков' });
  }
});

app.listen(3000, () => console.log('Сервер запущен на порту 3000'));
