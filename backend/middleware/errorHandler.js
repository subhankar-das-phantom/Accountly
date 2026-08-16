const errorHandler = (err, req, res, next) => {
  console.error('Global error handler:', err);

  const status = err.status || 500;

  // Many existing routes return { error: err.message } on 500.
  // We preserve this format to maintain frontend compatibility.
  if (status === 500) {
    return res.status(500).json({ error: err.message });
  }

  // Default format previously present in server.js
  res.status(status).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message,
    error: process.env.NODE_ENV === 'development' ? err.stack : {},
  });
};

module.exports = errorHandler;
