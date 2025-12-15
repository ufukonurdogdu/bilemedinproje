const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Ana Sayfa
router.get('/', async (req, res) => {
    try {
        // Aktif tahminleri getir
        const tahminler = await db.getAll(`
            SELECT t.*, k.ad as kategori_adi, k.ikon as kategori_ikon, k.renk as kategori_renk
            FROM tahminler t
            LEFT JOIN kategoriler k ON t.kategori_id = k.id
            WHERE t.durum = 'aktif'
            ORDER BY t.olusturma_tarihi DESC
            LIMIT 10
        `);

        // Kategorileri getir
        const kategoriler = await db.getAll(
            'SELECT * FROM kategoriler WHERE aktif_mi = 1 ORDER BY sira'
        );

        res.render('index', {
            title: 'Bilemezsin - Tahmin Platformu',
            layout: 'layouts/main',
            tahminler,
            kategoriler
        });
    } catch (err) {
        console.error('Ana sayfa hatası:', err);
        res.render('index', {
            title: 'Bilemezsin - Tahmin Platformu',
            layout: 'layouts/main',
            tahminler: [],
            kategoriler: []
        });
    }
});

// Sıralama
router.get('/siralama', async (req, res) => {
    try {
        const kullanicilar = await db.getAll(`
            SELECT id, ad_soyad, kullanici_adi, avatar, bi_coin, seviye, 
                   toplam_tahmin, dogru_tahmin, seri, premium_mi,
                   ROUND((dogru_tahmin / NULLIF(toplam_tahmin, 0)) * 100, 1) as dogruluk_orani
            FROM kullanicilar
            WHERE banlandi_mi = 0
            ORDER BY bi_coin DESC
            LIMIT 100
        `);

        res.render('user/siralama', {
            title: 'Sıralama - Bilemezsin',
            layout: 'layouts/main',
            kullanicilar
        });
    } catch (err) {
        console.error('Sıralama hatası:', err);
        res.render('user/siralama', {
            title: 'Sıralama - Bilemezsin',
            layout: 'layouts/main',
            kullanicilar: []
        });
    }
});

// Hakkımızda
router.get('/hakkimizda', (req, res) => {
    res.render('pages/hakkimizda', {
        title: 'Hakkımızda - Bilemezsin',
        layout: 'layouts/main'
    });
});

// İletişim
router.get('/iletisim', (req, res) => {
    res.render('pages/iletisim', {
        title: 'İletişim - Bilemezsin',
        layout: 'layouts/main'
    });
});

// İletişim Formu Gönder
router.post('/iletisim', async (req, res) => {
    try {
        const { ad_soyad, email, konu, mesaj } = req.body;

        // Validasyon
        if (!ad_soyad || !email || !konu || !mesaj) {
            req.flash('error_msg', 'Lütfen tüm alanları doldurun');
            return res.redirect('/iletisim');
        }

        if (mesaj.length < 10) {
            req.flash('error_msg', 'Mesajınız en az 10 karakter olmalıdır');
            return res.redirect('/iletisim');
        }

        // İletişim mesajlarını veritabanına kaydet
        try {
            await db.insert(`
                INSERT INTO iletisim_mesajlari (ad_soyad, email, konu, mesaj, ip_adresi)
                VALUES (?, ?, ?, ?, ?)
            `, [ad_soyad, email, konu, mesaj, req.ip]);
        } catch (dbErr) {
            console.log('İletişim tablosu bulunamadı, email gönderiliyor...');
        }

        // Email gönder (nodemailer yapılandırması varsa)
        if (process.env.SMTP_HOST && process.env.SMTP_USER) {
            const nodemailer = require('nodemailer');

            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });

            await transporter.sendMail({
                from: `"Bilemezsin İletişim" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                to: process.env.CONTACT_EMAIL || process.env.SMTP_USER,
                replyTo: email,
                subject: `[İletişim] ${konu}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #6366f1;">Yeni İletişim Mesajı</h2>
                        <p><strong>Gönderen:</strong> ${ad_soyad}</p>
                        <p><strong>E-posta:</strong> ${email}</p>
                        <p><strong>Konu:</strong> ${konu}</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;">
                        <p><strong>Mesaj:</strong></p>
                        <p style="background: #f5f5f5; padding: 16px; border-radius: 8px;">${mesaj.replace(/\n/g, '<br>')}</p>
                    </div>
                `
            });
        }

        req.flash('success_msg', 'Mesajınız başarıyla gönderildi! En kısa sürede size dönüş yapacağız.');
        res.redirect('/iletisim');

    } catch (err) {
        console.error('İletişim formu hatası:', err);
        req.flash('error_msg', 'Mesaj gönderilirken bir hata oluştu. Lütfen tekrar deneyin.');
        res.redirect('/iletisim');
    }
});

// Gizlilik Politikası
router.get('/gizlilik', (req, res) => {
    res.render('pages/gizlilik', {
        title: 'Gizlilik Politikası - Bilemezsin',
        layout: 'layouts/main'
    });
});

// Kullanım Şartları
router.get('/kullanim-sartlari', (req, res) => {
    res.render('pages/kullanim-sartlari', {
        title: 'Kullanım Şartları - Bilemezsin',
        layout: 'layouts/main'
    });
});

module.exports = router;
