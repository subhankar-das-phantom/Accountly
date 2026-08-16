// server.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
// const { ipKeyGenerator } = require('express-rate-limit'); // Only if you need a custom key (see note below)
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// If you’re behind a reverse proxy/CDN (Render, Nginx, Cloudflare, etc.)
app.set('trust proxy', 1);

// CORS (single-origin; change to a whitelist function if you have multiple)
const allowedOrigin =
  process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL || 'http://localhost:5173'
    : 'http://localhost:5173';

const corsOptions = {
  origin: allowedOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
};
app.use(cors(corsOptions));

// Core middleware
app.use(express.json({ limit: '10mb' }));
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting (express-rate-limit v7+ uses `limit`; if v6, use `max`)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,     // 1 minute
  limit: 1000,             // adjust to your needs (100–600 typical for public APIs)
  standardHeaders: true,   // RateLimit-* headers
  legacyHeaders: false,    // disable X-RateLimit-* headers
  skip: (req) => req.path === '/health', // don’t rate-limit health
  message: { error: 'Too many requests, please try again later.' },
  // If you want per-user or per-API-key limiting, uncomment keyGenerator below.
  // Ensure IPv6 safety using ipKeyGenerator fallback.
  // keyGenerator: (req, res) => {
  //   if (req.user?.id) return `user:${req.user.id}`;
  //   if (req.headers['x-api-key']) return `key:${req.headers['x-api-key']}`;
  //   return ipKeyGenerator(req); // safe IPv6-normalized fallback
  // },
});

// Apply limiter to API routes only
app.use('/api', apiLimiter);

// MongoDB connection
const uri = process.env.ATLAS_URI;
if (!uri) {
  console.error('ATLAS_URI environment variable is not defined');
  process.exit(1);
}

mongoose
  .connect(uri) // modern mongoose: no need for useNewUrlParser/useUnifiedTopology
  .then(() => console.log('MongoDB database connection established successfully'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const connection = mongoose.connection;
connection.on('error', (err) => console.error('MongoDB connection error:', err));
connection.on('disconnected', () => console.log('MongoDB disconnected. Attempting to reconnect...'));
connection.on('reconnected', () => console.log('MongoDB reconnected successfully'));

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('Error closing MongoDB connection:', err);
    process.exit(1);
  }
});

// Routers
const usersRouter = require('./routes/users');
const transactionsRouter = require('./routes/transactions');
const budgetRouter = require('./routes/budget');


app.use('/api/users', usersRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/budgetGoals', budgetRouter);
app.use('/api/budget', budgetRouter);

// Health route (keep outside /api so limiter skip works)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Root metadata
app.get('/', (req, res) => {
  res.json({
    message: 'Personal Finance Tracker API',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      transactions: '/api/transactions',
      budgetGoals: '/api/budgetGoals',
      budget: '/api/budget',
      health: '/health',
    },
  });
});

// Serve frontend in production (Vite/React build in ../frontend/dist)
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(distPath));
  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// 404 handler (must be after all routes)
app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    requestedUrl: req.originalUrl,
  });
});

// Global error handler (keep last)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'Something went wrong!'
        : err.message,
    error: process.env.NODE_ENV === 'development' ? err.stack : {},
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check available at: http://localhost:${port}/health`);
});

module.exports = app;
