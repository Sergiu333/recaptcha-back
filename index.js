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

// Cheia secretă reCAPTCHA v3 (nu partaja această cheie public)
const SECRET_KEY = '6Lddu0orAAAAAIanDcybJfILQlOLjTcLdDPcGTOX';

// Configurare limitare acces (max 3 cereri / minut / IP)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: {
    success: false,
    message: 'Prea multe cereri. Încearcă din nou mai târziu.'
  }
});

// Configurare CORS și parser JSON
app.use(cors());
app.use(express.json());
app.use('/verify', limiter); // aplicăm rate limiting DOAR pe ruta /verify

// Scor minim acceptabil
const MIN_SCORE = 0.7;
const EXPECTED_ACTION = 'submit';

app.post('/verify', async (req, res) => {
  const token = req.body.token;
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // Log pentru analiză
  console.log(`[${new Date().toISOString()}] Verificare de la IP: ${ip}`);
  console.log(`User-Agent: ${userAgent}`);

  // Detectare browser/headless suspect
  if (/HeadlessChrome|puppeteer|phantom|curl|python|axios|Go-http/i.test(userAgent)) {
    return res.status(403).json({
      success: false,
      message: 'Browser suspect detectat (probabil bot)',
      score: null
    });
  }

  if (!token) {
    return res.status(400).json({ success: false, message: 'Token reCAPTCHA lipsă' });
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${SECRET_KEY}&response=${token}`
    });

    const data = await response.json();
    console.log('Răspuns Google:', data);

    if (!data.success) {
      return res.status(400).json({
        success: false,
        message: 'Token invalid',
        'error-codes': data['error-codes']
      });
    }

    if (data.action !== EXPECTED_ACTION) {
      return res.status(400).json({
        success: false,
        message: `Acțiune greșită. Expected: "${EXPECTED_ACTION}", primit: "${data.action}"`,
        action: data.action
      });
    }

    if (data.score < MIN_SCORE) {
      return res.status(403).json({
        success: false,
        message: 'Scor prea mic. Posibil bot.',
        score: data.score
      });
    }

    // Totul e ok
    res.json({
      success: true,
      message: 'Token valid și scor acceptabil',
      score: data.score,
      action: data.action
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Eroare server',
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Serverul rulează pe http://localhost:${PORT}`);
});
