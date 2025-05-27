// import express from 'express';
// import fetch from 'node-fetch';
// import cors from 'cors';  // Importă pachetul CORS

// const app = express();
// const PORT = process.env.PORT || 3000;

// // Cheile tale
// const SECRET_KEY = '6Lf2IDErAAAAAHVCnzaokiqILuVuDaGDcRpSDpTP';

// // Permite CORS pentru toate originile
// app.use(cors());  // Aici activăm CORS pentru toate originile

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// app.post('/verify', async (req, res) => {
//     const token = req.body['g-recaptcha-response'];

//     if (!token) {
//         return res.status(400).json({ success: false, message: 'Captcha token lipseste' });
//     }

//     try {
//         const response = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//             body: `secret=${SECRET_KEY}&response=${token}`
//         });

//         const data = await response.json();
//         console.log(data);  // Verifică ce răspuns primești de la API-ul Google

//         if (!data.success) {
//             return res.status(400).json({ success: false, message: 'Captcha invalid', errorCodes: data['error-codes'] });
//         }

//         res.json({ success: true, message: 'Captcha verificat cu succes!' });
//     } catch (error) {
//         res.status(500).json({ success: false, message: 'Eroare server', error: error.message });
//     }
// });







// // Expune aplicația Express ca handler pentru Vercel
// export default app;











import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createHash } from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = '6Lddu0orAAAAAIanDcybJfILQlOLjTcLdDPcGTOX';

// Security headers
app.use(helmet());

// Stricter CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['POST'],
  allowedHeaders: ['Content-Type', 'User-Agent'],
  maxAge: 86400 // 24 hours
}));

// IP-based blocking
const blockedIPs = new Map();
const IP_BLOCK_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const MAX_FAILED_ATTEMPTS = 5;

// Enhanced rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 requests per minute
  message: {
    success: false,
    message: 'Prea multe cereri. Încearcă din nou mai târziu.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  }
});

app.use(express.json({ limit: '1kb' })); // Limit payload size
app.use('/verify', limiter);

const MIN_SCORE = 0.7; // Increased minimum score
const EXPECTED_ACTION = 'submit';
const MAX_REQUEST_TIME = 10000; // 10 seconds

// Enhanced suspicious user agent detection
function isSuspiciousUserAgent(ua) {
  const suspiciousPatterns = [
    /HeadlessChrome/i,
    /puppeteer/i,
    /phantom/i,
    /curl/i,
    /python/i,
    /axios/i,
    /Go-http/i,
    /bot/i,
    /spider/i,
    /crawl/i,
    /selenium/i,
    /playwright/i,
    /cypress/i,
    /nightmare/i,
    /automation/i,
    /scraper/i
  ];
  return suspiciousPatterns.some(p => p.test(ua));
}

// Request timing check
function isRequestTooFast(startTime) {
  const elapsed = Date.now() - startTime;
  return elapsed < 1000; // Less than 1 second is suspicious
}

// IP blocking check
function isIPBlocked(ip) {
  const blockInfo = blockedIPs.get(ip);
  if (blockInfo && Date.now() - blockInfo.timestamp < IP_BLOCK_DURATION) {
    return true;
  }
  if (blockInfo && Date.now() - blockInfo.timestamp >= IP_BLOCK_DURATION) {
    blockedIPs.delete(ip);
  }
  return false;
}

// Logging function
function logSecurityEvent(event, details) {
  const timestamp = new Date().toISOString();
  console.log(`[SECURITY][${timestamp}] ${event}:`, details);
}

app.post('/verify', async (req, res) => {
  const startTime = Date.now();
  const token = req.body.token;
  const userAgent = req.headers['user-agent'] || '';
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

  // Security logging
  logSecurityEvent('Request received', { ip, userAgent });

  // IP blocking check
  if (isIPBlocked(ip)) {
    logSecurityEvent('Blocked IP attempt', { ip });
    return res.status(403).json({
      success: false,
      message: 'Acces temporar blocat. Încearcă mai târziu.'
    });
  }

  // Request timing check
  if (isRequestTooFast(startTime)) {
    logSecurityEvent('Suspicious timing', { ip, elapsed: Date.now() - startTime });
    return res.status(403).json({
      success: false,
      message: 'Cerere suspectă detectată'
    });
  }

  if (isSuspiciousUserAgent(userAgent)) {
    logSecurityEvent('Suspicious user agent', { ip, userAgent });
    return res.status(403).json({
      success: false,
      message: 'Browser suspect detectat'
    });
  }

  if (!token || token.length < 20) {
    logSecurityEvent('Invalid token', { ip });
    return res.status(400).json({ success: false, message: 'Token reCAPTCHA invalid sau lipsă' });
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${SECRET_KEY}&response=${token}&remoteip=${ip}`
    });

    const data = await response.json();
    logSecurityEvent('reCAPTCHA response', { ip, score: data.score, action: data.action });

    if (!data.success) {
      const blockInfo = blockedIPs.get(ip) || { attempts: 0, timestamp: Date.now() };
      blockInfo.attempts++;
      blockedIPs.set(ip, blockInfo);

      if (blockInfo.attempts >= MAX_FAILED_ATTEMPTS) {
        logSecurityEvent('IP blocked', { ip, attempts: blockInfo.attempts });
      }

      return res.status(400).json({
        success: false,
        message: 'Token invalid sau expirat',
        'error-codes': data['error-codes']
      });
    }

    if (data.action !== EXPECTED_ACTION) {
      logSecurityEvent('Invalid action', { ip, expected: EXPECTED_ACTION, received: data.action });
      return res.status(400).json({
        success: false,
        message: `Acțiune invalidă. Expected: "${EXPECTED_ACTION}", primit: "${data.action}"`,
        action: data.action
      });
    }

    if (typeof data.score !== 'number') {
      logSecurityEvent('Invalid score', { ip });
      return res.status(400).json({
        success: false,
        message: 'Scor invalid primit de la Google'
      });
    }

    if (data.score < MIN_SCORE) {
      logSecurityEvent('Low score', { ip, score: data.score });
      return res.status(403).json({
        success: false,
        message: 'Scor prea mic. Acces refuzat.',
        score: data.score
      });
    }

    // Success - reset failed attempts
    blockedIPs.delete(ip);
    
    res.json({
      success: true,
      message: 'Token valid, scor acceptabil',
      score: data.score,
      action: data.action
    });

  } catch (error) {
    logSecurityEvent('Server error', { ip, error: error.message });
    res.status(500).json({
      success: false,
      message: 'Eroare server la validarea token-ului',
      error: error.message
    });
  }
});

// Cleanup blocked IPs periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, info] of blockedIPs.entries()) {
    if (now - info.timestamp >= IP_BLOCK_DURATION) {
      blockedIPs.delete(ip);
    }
  }
}, 60 * 60 * 1000); // Cleanup every hour

app.listen(PORT, () => {
  console.log(`✅ Serverul rulează pe http://localhost:${PORT}`);
});
