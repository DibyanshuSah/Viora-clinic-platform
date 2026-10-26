/**
 * Lightweight In-Memory Rate Limiter Middleware
 * Protects public endpoints (like UUID bill viewing and WhatsApp callbacks) against abuse.
 */

const createRateLimiter = ({ windowMs = 60 * 1000, max = 60, message = 'Too many requests. Please try again later.' } = {}) => {
  const requests = new Map();

  // Periodically cleanup expired entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of requests.entries()) {
      if (now - entry.startTime > windowMs) {
        requests.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const key = `${ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();

    let entry = requests.get(key);
    if (!entry || now - entry.startTime > windowMs) {
      entry = { startTime: now, count: 1 };
      requests.set(key, entry);
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((windowMs - (now - entry.startTime)) / 1000));
      return res.status(429).json({
        success: false,
        message,
        error: { code: 'RATE_LIMIT_EXCEEDED' }
      });
    }

    next();
  };
};

module.exports = {
  createRateLimiter,
  publicBillLimiter: createRateLimiter({ windowMs: 60 * 1000, max: 40, message: 'Too many bill access requests from this IP. Please wait a moment.' }),
  webhookLimiter: createRateLimiter({ windowMs: 60 * 1000, max: 120, message: 'Webhook rate limit exceeded.' })
};
