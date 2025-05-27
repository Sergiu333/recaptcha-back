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

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = '6Lddu0orAAAAAIanDcybJfILQlOLjTcLdDPcGTOX';

// Limitare cereri stricte - max 3 cereri/minut/IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: {
    success: false,
    message: 'Prea multe cereri. Încearcă din nou mai târziu.'
  }
});

app.use(cors());
app.use(express.json());
app.use('/verify', limiter);

const MIN_SCORE = 0.5;
const EXPECTED_ACTION = 'submit';

// Funcție pentru verificare user-agent foarte strictă
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
    /crawl/i
  ];
  return suspiciousPatterns.some(p => p.test(ua));
}

app.post('/verify', async (req, res) => {
  const token = req.body.token;
  const userAgent = req.headers['user-agent'] || '';
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

  console.log(`[${new Date().toISOString()}] IP: ${ip}, User-Agent: ${userAgent}`);

  if (isSuspiciousUserAgent(userAgent)) {
    console.warn('Browser suspect detectat!');
    return res.status(403).json({
      success: false,
      message: 'Browser suspect detectat (probabil bot)',
      score: null
    });
  }

  if (!token || token.length < 20) {
    return res.status(400).json({ success: false, message: 'Token reCAPTCHA invalid sau lipsă' });
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${SECRET_KEY}&response=${token}&remoteip=${ip}`
    });

    const data = await response.json();
    console.log('Răspuns Google:', data);

    if (!data.success) {
      return res.status(400).json({
        success: false,
        message: 'Token invalid sau expirat',
        'error-codes': data['error-codes']
      });
    }

    if (data.action !== EXPECTED_ACTION) {
      return res.status(400).json({
        success: false,
        message: `Acțiune invalidă. Expected: "${EXPECTED_ACTION}", primit: "${data.action}"`,
        action: data.action
      });
    }

    if (typeof data.score !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Scor invalid primit de la Google'
      });
    }

    if (data.score < MIN_SCORE) {
      console.warn(`Scor prea mic: ${data.score} (posibil bot)`);
      return res.status(403).json({
        success: false,
        message: 'Scor prea mic. Acces refuzat.',
        score: data.score
      });
    }

    // Totul ok
    res.json({
      success: true,
      message: 'Token valid, scor acceptabil',
      score: data.score,
      action: data.action
    });

  } catch (error) {
    console.error('Eroare la verificarea token-ului:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare server la validarea token-ului',
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Serverul rulează pe http://localhost:${PORT}`);
});
