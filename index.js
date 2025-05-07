import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';  // Importă pachetul CORS

const app = express();
const PORT = process.env.PORT || 3000;

// Cheile tale
const SECRET_KEY = '6Lcm_TArAAAAANZKNfs5CD44OBF6eZqZmp1b0g_f';

// Permite CORS pentru toate originile
app.use(cors());  // Aici activăm CORS pentru toate originile

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/verify', async (req, res) => {
    const token = req.body['g-recaptcha-response'];

    if (!token) {
        return res.status(400).json({ success: false, message: 'Captcha token lipseste' });
    }

    try {
        const response = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${SECRET_KEY}&response=${token}`
        });

        const data = await response.json();

        if (data.success) {
            res.json({ success: true, message: 'Captcha verificat cu succes!' });
        } else {
            res.status(400).json({ success: false, message: 'Captcha invalid!' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Eroare server', error: error.message });
    }
});

// Expune aplicația Express ca handler pentru Vercel
export default app;
