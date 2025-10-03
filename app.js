require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const createError = require('http-errors');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(
  cors({
    origin: 'http://localhost:5173',
    methods: ['CREATE', 'GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);
// Middleware umum
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Serve file statis jika dibutuhkan (misalnya untuk pas foto)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Tambahkan router utama
const indexRouter = require('./routes/index');
app.use('/', indexRouter);

// Error 500 handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    status: false,
    message: err.message,
    data: null,
  });
});

// Error 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    status: false,
    message: `are you lost? ${req.method} ${req.url} is not registered!`,
    data: null,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;
