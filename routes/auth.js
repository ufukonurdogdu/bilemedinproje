const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { ensureGuest, ensureAuthenticated, ensureLoggedIn } = require('../middleware/auth');

// Giriş Sayfası
router.get('/giris', ensureGuest, (req, res) => {
    res.render('auth/giris', {
        title: 'Giriş Yap - Bilemezsin',
        layout: 'layouts/auth'
    });
});

// Kayıt Sayfası
router.get('/kayit', ensureGuest, (req, res) => {
    res.render('auth/kayit', {
        title: 'Kayıt Ol - Bilemezsin',
        layout: 'layouts/auth'
    });
});

// Local Login POST
router.post('/giris', ensureGuest, (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            req.flash('error_msg', info.message || 'Giriş başarısız');
            return res.redirect('/auth/giris');
        }
        req.logIn(user, (err) => {
            if (err) {
                return next(err);
            }
            // Session'ı kaydet
            req.session.save((err) => {
                if (err) {
                    console.error('Session kaydetme hatası:', err);
                }
                // Kullanıcı adı onaylanmamışsa yönlendir
                if (!user.kullanici_adi_onaylandi) {
                    return res.redirect('/auth/kullanici-adi-belirle');
                }
                req.flash('success_msg', 'Hoş geldiniz!');
                res.redirect('/dashboard');
            });
        });
    })(req, res, next);
});

// Local Register POST
router.post('/kayit', ensureGuest, [
    body('ad_soyad')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('İsim 2-50 karakter arasında olmalıdır'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Geçerli bir e-posta adresi giriniz'),
    body('sifre')
        .isLength({ min: 6 })
        .withMessage('Şifre en az 6 karakter olmalıdır'),
    body('sifre_tekrar')
        .custom((value, { req }) => {
            if (value !== req.body.sifre) {
                throw new Error('Şifreler eşleşmiyor');
            }
            return true;
        })
], async (req, res) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        return res.render('auth/kayit', {
            title: 'Kayıt Ol - Bilemezsin',
            layout: 'layouts/auth',
            errors: errors.array(),
            ad_soyad: req.body.ad_soyad,
            email: req.body.email
        });
    }

    const { ad_soyad, email, sifre } = req.body;

    try {
        // E-posta kontrolü
        let user = await db.getOne('SELECT id FROM kullanicilar WHERE email = ?', [email.toLowerCase()]);
        if (user) {
            return res.render('auth/kayit', {
                title: 'Kayıt Ol - Bilemezsin',
                layout: 'layouts/auth',
                errors: [{ msg: 'Bu e-posta adresi zaten kayıtlı' }],
                ad_soyad,
                email
            });
        }

        // ad_soyad'dan önerilen kullanıcı adı oluştur
        const suggestedUsername = await generateUsernameFromName(ad_soyad);

        // Şifreyi hashle
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(sifre, salt);

        // Yeni kullanıcı oluştur
        const userId = await db.insert(
            `INSERT INTO kullanicilar (ad_soyad, kullanici_adi, email, sifre, giris_yontemi)
             VALUES (?, ?, ?, ?, 'local')`,
            [ad_soyad, suggestedUsername, email.toLowerCase(), hashedPassword]
        );

        // Kullanıcıyı getir
        const newUser = await db.getOne('SELECT * FROM kullanicilar WHERE id = ?', [userId]);

        // Otomatik giriş yap
        req.logIn(newUser, (err) => {
            if (err) {
                console.error('Otomatik giriş hatası:', err);
                req.flash('success_msg', 'Kayıt başarılı! Şimdi giriş yapabilirsiniz.');
                return res.redirect('/auth/giris');
            }
            
            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error('Session kaydetme hatası:', saveErr);
                }
                // Kullanıcı adı belirleme sayfasına yönlendir
                res.redirect('/auth/kullanici-adi-belirle');
            });
        });

    } catch (err) {
        console.error('Kayıt Hatası:', err);
        res.render('auth/kayit', {
            title: 'Kayıt Ol - Bilemezsin',
            layout: 'layouts/auth',
            errors: [{ msg: 'Bir hata oluştu, lütfen tekrar deneyin' }],
            ad_soyad,
            email
        });
    }
});

// ad_soyad'dan kullanıcı adı oluştur
async function generateUsernameFromName(adSoyad) {
    // Türkçe karakterleri dönüştür
    const turkishMap = {
        'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
        'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u'
    };
    
    let username = adSoyad.toLowerCase();
    
    // Türkçe karakterleri değiştir
    for (const [tr, en] of Object.entries(turkishMap)) {
        username = username.replace(new RegExp(tr, 'g'), en);
    }
    
    // Sadece harf ve rakam bırak, boşlukları kaldır
    username = username.replace(/[^a-z0-9]/g, '');
    
    // Minimum 3 karakter
    if (username.length < 3) {
        username = 'kullanici';
    }
    
    // Maximum 15 karakter
    username = username.substring(0, 15);
    
    // Benzersiz olup olmadığını kontrol et
    let finalUsername = username;
    let counter = 1;
    
    while (await db.getOne('SELECT id FROM kullanicilar WHERE kullanici_adi = ?', [finalUsername])) {
        finalUsername = `${username}${counter}`;
        counter++;
    }
    
    return finalUsername;
}

// Google Auth (normal giriş veya hesap bağlama)
router.get('/google', (req, res, next) => {
    // Kullanıcı zaten giriş yapmışsa, hesap bağlama modunda
    if (req.user) {
        req.session.isLinking = true;
    }
    passport.authenticate('google', {
        scope: ['profile', 'email']
    })(req, res, next);
});

// Google Callback
router.get('/google/callback', passport.authenticate('google', {
    failureRedirect: '/auth/giris',
    failureFlash: true
}), (req, res) => {
    console.log('✅ Google OAuth başarılı, user:', req.user?.id, req.user?.kullanici_adi);

    // Session'ı kaydet ve sonra yönlendir
    req.session.save((err) => {
        if (err) {
            console.error('❌ Session kaydetme hatası:', err);
            return res.redirect('/auth/giris');
        }

        console.log('✅ Session kaydedildi, yönlendiriliyor...');

        // Hesap bağlama işlemi mi kontrol et (session'da isLinking var mı)
        if (req.session.isLinking) {
            delete req.session.isLinking;
            req.flash('success_msg', 'Google hesabınız başarıyla bağlandı!');
            return res.redirect('/gorevler');
        }

        req.flash('success_msg', 'Google ile giriş başarılı!');
        res.redirect('/dashboard');
    });
});

// Facebook Auth (normal giriş veya hesap bağlama)
router.get('/facebook', (req, res, next) => {
    // Kullanıcı zaten giriş yapmışsa, hesap bağlama modunda
    if (req.user) {
        req.session.isLinking = true;
    }
    passport.authenticate('facebook', {
        scope: ['email']
    })(req, res, next);
});

// Facebook Callback
router.get('/facebook/callback', passport.authenticate('facebook', {
    failureRedirect: '/auth/giris',
    failureFlash: true
}), (req, res) => {
    console.log('✅ Facebook OAuth başarılı, user:', req.user?.id, req.user?.kullanici_adi);

    // Session'ı kaydet ve sonra yönlendir
    req.session.save((err) => {
        if (err) {
            console.error('❌ Session kaydetme hatası:', err);
            return res.redirect('/auth/giris');
        }

        console.log('✅ Session kaydedildi, yönlendiriliyor...');

        // Hesap bağlama işlemi mi kontrol et (session'da isLinking var mı)
        if (req.session.isLinking) {
            delete req.session.isLinking;
            req.flash('success_msg', 'Facebook hesabınız başarıyla bağlandı!');
            return res.redirect('/gorevler');
        }

        req.flash('success_msg', 'Facebook ile giriş başarılı!');
        res.redirect('/dashboard');
    });
});

// Çıkış
router.get('/cikis', ensureAuthenticated, (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Çıkış hatası:', err);
            return res.redirect('/dashboard');
        }
        req.flash('success_msg', 'Başarıyla çıkış yaptınız');
        res.redirect('/auth/giris');
    });
});

// Şifremi Unuttum Sayfası
router.get('/sifremi-unuttum', ensureGuest, (req, res) => {
    res.render('auth/sifremi-unuttum', {
        title: 'Şifremi Unuttum - Bilemezsin',
        layout: 'layouts/auth'
    });
});

// Şifre Sıfırlama İsteği (Email Gönder)
router.post('/sifremi-unuttum', ensureGuest, [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Geçerli bir e-posta adresi giriniz')
], async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.render('auth/sifremi-unuttum', {
            title: 'Şifremi Unuttum - Bilemezsin',
            layout: 'layouts/auth',
            errors: errors.array(),
            email: req.body.email
        });
    }

    const { email } = req.body;

    try {
        // Kullanıcıyı bul
        const kullanici = await db.getOne('SELECT id, ad_soyad, email FROM kullanicilar WHERE email = ?', [email.toLowerCase()]);

        // Güvenlik için her durumda aynı mesajı göster
        if (!kullanici) {
            req.flash('success_msg', 'Eğer bu e-posta adresi sistemimizde kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.');
            return res.redirect('/auth/sifremi-unuttum');
        }

        // Token oluştur
        const { v4: uuidv4 } = require('uuid');
        const token = uuidv4();
        const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 saat geçerli

        // Token'ı veritabanına kaydet
        await db.execute(
            'UPDATE kullanicilar SET sifre_sifirlama_token = ?, sifre_sifirlama_son = ? WHERE id = ?',
            [token, tokenExpiry, kullanici.id]
        );

        // Email gönder (nodemailer yapılandırması .env'de tanımlıysa)
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

            const resetUrl = `${process.env.BASE_URL}/auth/sifre-sifirla/${token}`;

            await transporter.sendMail({
                from: `"Bilemezsin" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                to: kullanici.email,
                subject: 'Şifre Sıfırlama - Bilemezsin',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #6366f1;">Şifre Sıfırlama</h2>
                        <p>Merhaba ${kullanici.ad_soyad},</p>
                        <p>Bilemezsin hesabınız için şifre sıfırlama talebinde bulundunuz.</p>
                        <p>Şifrenizi sıfırlamak için aşağıdaki butona tıklayın:</p>
                        <a href="${resetUrl}" style="display: inline-block; background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Şifremi Sıfırla</a>
                        <p style="color: #666; font-size: 14px;">Bu bağlantı 1 saat geçerlidir.</p>
                        <p style="color: #666; font-size: 14px;">Eğer bu talebi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
                        <p style="color: #999; font-size: 12px;">Bilemezsin - Tahmin Platformu</p>
                    </div>
                `
            });
        }

        req.flash('success_msg', 'Eğer bu e-posta adresi sistemimizde kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.');
        res.redirect('/auth/sifremi-unuttum');

    } catch (err) {
        console.error('Şifre sıfırlama hatası:', err);
        req.flash('error_msg', 'Bir hata oluştu, lütfen tekrar deneyin');
        res.redirect('/auth/sifremi-unuttum');
    }
});

// Şifre Sıfırlama Sayfası (Token ile)
router.get('/sifre-sifirla/:token', ensureGuest, async (req, res) => {
    try {
        const { token } = req.params;

        // Token'ı kontrol et
        const kullanici = await db.getOne(
            'SELECT id FROM kullanicilar WHERE sifre_sifirlama_token = ? AND sifre_sifirlama_son > NOW()',
            [token]
        );

        if (!kullanici) {
            req.flash('error_msg', 'Geçersiz veya süresi dolmuş bağlantı');
            return res.redirect('/auth/sifremi-unuttum');
        }

        res.render('auth/sifre-sifirla', {
            title: 'Yeni Şifre Belirle - Bilemezsin',
            layout: 'layouts/auth',
            token
        });

    } catch (err) {
        console.error('Şifre sıfırlama sayfası hatası:', err);
        req.flash('error_msg', 'Bir hata oluştu');
        res.redirect('/auth/sifremi-unuttum');
    }
});

// Yeni Şifre Kaydet
router.post('/sifre-sifirla/:token', ensureGuest, [
    body('sifre')
        .isLength({ min: 6 })
        .withMessage('Şifre en az 6 karakter olmalıdır'),
    body('sifre_tekrar')
        .custom((value, { req }) => {
            if (value !== req.body.sifre) {
                throw new Error('Şifreler eşleşmiyor');
            }
            return true;
        })
], async (req, res) => {
    const errors = validationResult(req);
    const { token } = req.params;

    if (!errors.isEmpty()) {
        return res.render('auth/sifre-sifirla', {
            title: 'Yeni Şifre Belirle - Bilemezsin',
            layout: 'layouts/auth',
            errors: errors.array(),
            token
        });
    }

    try {
        // Token'ı kontrol et
        const kullanici = await db.getOne(
            'SELECT id FROM kullanicilar WHERE sifre_sifirlama_token = ? AND sifre_sifirlama_son > NOW()',
            [token]
        );

        if (!kullanici) {
            req.flash('error_msg', 'Geçersiz veya süresi dolmuş bağlantı');
            return res.redirect('/auth/sifremi-unuttum');
        }

        // Yeni şifreyi hashle
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(req.body.sifre, salt);

        // Şifreyi güncelle ve token'ı temizle
        await db.execute(
            'UPDATE kullanicilar SET sifre = ?, sifre_sifirlama_token = NULL, sifre_sifirlama_son = NULL WHERE id = ?',
            [hashedPassword, kullanici.id]
        );

        req.flash('success_msg', 'Şifreniz başarıyla değiştirildi! Şimdi giriş yapabilirsiniz.');
        res.redirect('/auth/giris');

    } catch (err) {
        console.error('Şifre kaydetme hatası:', err);
        req.flash('error_msg', 'Bir hata oluştu, lütfen tekrar deneyin');
        res.redirect('/auth/sifremi-unuttum');
    }
});

// Kullanıcı Adı Belirleme Sayfası
router.get('/kullanici-adi-belirle', ensureLoggedIn, (req, res) => {
    // Zaten onaylanmışsa dashboard'a yönlendir
    if (req.user.kullanici_adi_onaylandi) {
        return res.redirect('/dashboard');
    }
    
    res.render('auth/kullanici-adi-belirle', {
        title: 'Kullanıcı Adı Belirle - Bilemezsin',
        layout: 'layouts/auth',
        suggestedUsername: req.user.kullanici_adi // Önerilen kullanıcı adı
    });
});

// Kullanıcı Adı Belirleme/Onaylama İşlemi
router.post('/kullanici-adi-belirle', ensureLoggedIn, [
    body('kullanici_adi')
        .trim()
        .isLength({ min: 3, max: 20 })
        .withMessage('Kullanıcı adı 3-20 karakter arasında olmalıdır')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir')
        .toLowerCase()
], async (req, res) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        return res.render('auth/kullanici-adi-belirle', {
            title: 'Kullanıcı Adı Belirle - Bilemezsin',
            layout: 'layouts/auth',
            errors: errors.array(),
            kullanici_adi: req.body.kullanici_adi,
            suggestedUsername: req.user.kullanici_adi
        });
    }

    const { kullanici_adi } = req.body;

    try {
        // Kullanıcı adı müsait mi kontrol et
        const mevcutKullanici = await db.getOne(
            'SELECT id FROM kullanicilar WHERE kullanici_adi = ? AND id != ?',
            [kullanici_adi.toLowerCase(), req.user.id]
        );

        if (mevcutKullanici) {
            return res.render('auth/kullanici-adi-belirle', {
                title: 'Kullanıcı Adı Belirle - Bilemezsin',
                layout: 'layouts/auth',
                errors: [{ msg: 'Bu kullanıcı adı zaten kullanılıyor' }],
                kullanici_adi,
                suggestedUsername: req.user.kullanici_adi
            });
        }

        // Kullanıcı adını güncelle ve onayla (ilk onay ücretsiz)
        await db.execute(
            'UPDATE kullanicilar SET kullanici_adi = ?, kullanici_adi_onaylandi = 1 WHERE id = ?',
            [kullanici_adi.toLowerCase(), req.user.id]
        );

        req.flash('success_msg', 'Kullanıcı adınız başarıyla belirlendi!');
        res.redirect('/dashboard');

    } catch (err) {
        console.error('Kullanıcı adı belirleme hatası:', err);
        res.render('auth/kullanici-adi-belirle', {
            title: 'Kullanıcı Adı Belirle - Bilemezsin',
            layout: 'layouts/auth',
            errors: [{ msg: 'Bir hata oluştu, lütfen tekrar deneyin' }],
            kullanici_adi
        });
    }
});

module.exports = router;