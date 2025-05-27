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

















app.post('/verify', async (req, res) => {
  const token = req.body.token;
  const userAgent = req.headers['user-agent'] || '';
  // În caz că sunt mai mulți IP-uri în x-forwarded-for, luăm primul
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

  console.log(`[${new Date().toISOString()}] --- Începe verificare reCAPTCHA ---`);
  console.log(`IP: ${ip}`);
  console.log(`User-Agent: ${userAgent}`);
  console.log(`Token primit: ${token ? 'Da' : 'Nu'}`);

  if (/HeadlessChrome|puppeteer|phantom|curl|python|axios|Go-http/i.test(userAgent)) {
    console.log(`Respins: Browser suspect detectat.`);
    return res.status(403).json({
      success: false,
      message: 'Browser suspect detectat (probabil bot)',
      score: null
    });
  }

  if (!token) {
    console.log(`Respins: Token lipsă.`);
    return res.status(400).json({ success: false, message: 'Token reCAPTCHA lipsă' });
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${SECRET_KEY}&response=${token}`
    });

    const data = await response.json();
    console.log('Răspuns Google complet:', JSON.stringify(data, null, 2));

    if (!data.success) {
      console.log(`Respins: Token invalid, erori: ${data['error-codes']}`);
      return res.status(400).json({
        success: false,
        message: 'Token invalid',
        'error-codes': data['error-codes']
      });
    }

    if (data.action !== EXPECTED_ACTION) {
      console.log(`Respins: Acțiune greșită. Expected: "${EXPECTED_ACTION}", primit: "${data.action}"`);
      return res.status(400).json({
        success: false,
        message: `Acțiune greșită. Expected: "${EXPECTED_ACTION}", primit: "${data.action}"`,
        action: data.action
      });
    }

    if (data.score < MIN_SCORE) {
      console.log(`Respins: Scor prea mic (${data.score}). Posibil bot.`);
      return res.status(403).json({
        success: false,
        message: 'Scor prea mic. Posibil bot.',
        score: data.score
      });
    }

    console.log(`Acceptat: Token valid, scor ${data.score}, acțiune "${data.action}"`);
    res.json({
      success: true,
      message: 'Token valid și scor acceptabil',
      score: data.score,
      action: data.action,
      challenge_ts: data.challenge_ts,
      hostname: data.hostname
    });

  } catch (error) {
    console.error(`Eroare la verificare reCAPTCHA: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Eroare server',
      error: error.message
    });
  }
});
