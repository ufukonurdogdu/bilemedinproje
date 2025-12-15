const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const bcrypt = require('bcryptjs');
const db = require('./database');

module.exports = function(passport) {
    // Local Strategy
    passport.use(new LocalStrategy({
        usernameField: 'email',
        passwordField: 'sifre'
    }, async (email, password, done) => {
        try {
            const user = await db.getOne(
                'SELECT * FROM kullanicilar WHERE email = ?',
                [email.toLowerCase()]
            );
            
            if (!user) {
                return done(null, false, { message: 'Bu e-posta adresi kayıtlı değil' });
            }

            if (!user.sifre) {
                return done(null, false, { message: 'Bu hesap sosyal medya ile oluşturulmuş. Lütfen Google veya Facebook ile giriş yapın.' });
            }

            if (user.banlandi_mi) {
                return done(null, false, { message: 'Hesabınız askıya alınmıştır. Sebep: ' + (user.ban_sebebi || 'Belirtilmemiş') });
            }

            const isMatch = await bcrypt.compare(password, user.sifre);
            
            if (isMatch) {
                await db.execute(
                    'UPDATE kullanicilar SET son_giris = NOW() WHERE id = ?',
                    [user.id]
                );
                return done(null, user);
            } else {
                return done(null, false, { message: 'Şifre hatalı' });
            }
        } catch (err) {
            return done(err);
        }
    }));

    // Google Strategy
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        passReqToCallback: true
    }, async (req, accessToken, refreshToken, profile, done) => {
        try {
            // Kullanıcı zaten giriş yapmışsa, hesabı bağla
            if (req.user) {
                // Bu Google hesabı başka birine mi bağlı kontrol et
                const existingGoogleUser = await db.getOne(
                    'SELECT id FROM kullanicilar WHERE google_id = ? AND id != ?',
                    [profile.id, req.user.id]
                );

                if (existingGoogleUser) {
                    return done(null, false, { message: 'Bu Google hesabı başka bir kullanıcıya bağlı.' });
                }

                // Mevcut kullanıcıya Google hesabını bağla
                await db.execute(
                    'UPDATE kullanicilar SET google_id = ?, avatar = COALESCE(avatar, ?), son_giris = NOW() WHERE id = ?',
                    [profile.id, profile.photos[0]?.value || null, req.user.id]
                );

                const updatedUser = await db.getOne('SELECT * FROM kullanicilar WHERE id = ?', [req.user.id]);
                return done(null, updatedUser);
            }

            // Normal giriş akışı
            let user = await db.getOne(
                'SELECT * FROM kullanicilar WHERE google_id = ?',
                [profile.id]
            );

            if (user) {
                if (user.banlandi_mi) {
                    return done(null, false, { message: 'Hesabınız askıya alınmıştır.' });
                }
                await db.execute(
                    'UPDATE kullanicilar SET son_giris = NOW() WHERE id = ?',
                    [user.id]
                );
                return done(null, user);
            }

            const email = profile.emails[0].value;
            user = await db.getOne(
                'SELECT * FROM kullanicilar WHERE email = ?',
                [email]
            );

            if (user) {
                await db.execute(
                    'UPDATE kullanicilar SET google_id = ?, avatar = COALESCE(avatar, ?), son_giris = NOW() WHERE id = ?',
                    [profile.id, profile.photos[0]?.value || null, user.id]
                );
                user.google_id = profile.id;
                return done(null, user);
            }

            // ad_soyad'dan otomatik kullanıcı adı oluştur
            const username = await generateUsernameFromName(profile.displayName);

            const userId = await db.insert(
                `INSERT INTO kullanicilar (google_id, email, ad_soyad, kullanici_adi, avatar, dogrulanmis_mi, kullanici_adi_onaylandi, giris_yontemi, son_giris)
                 VALUES (?, ?, ?, ?, ?, 1, 1, 'google', NOW())`,
                [profile.id, email, profile.displayName, username, profile.photos[0]?.value || null]
            );

            user = await db.getOne('SELECT * FROM kullanicilar WHERE id = ?', [userId]);
            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }));

    // Facebook Strategy
    passport.use(new FacebookStrategy({
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL,
        profileFields: ['id', 'displayName', 'email', 'photos'],
        passReqToCallback: true
    }, async (req, accessToken, refreshToken, profile, done) => {
        try {
            // Kullanıcı zaten giriş yapmışsa, hesabı bağla
            if (req.user) {
                // Bu Facebook hesabı başka birine mi bağlı kontrol et
                const existingFacebookUser = await db.getOne(
                    'SELECT id FROM kullanicilar WHERE facebook_id = ? AND id != ?',
                    [profile.id, req.user.id]
                );

                if (existingFacebookUser) {
                    return done(null, false, { message: 'Bu Facebook hesabı başka bir kullanıcıya bağlı.' });
                }

                // Mevcut kullanıcıya Facebook hesabını bağla
                await db.execute(
                    'UPDATE kullanicilar SET facebook_id = ?, avatar = COALESCE(avatar, ?), son_giris = NOW() WHERE id = ?',
                    [profile.id, profile.photos[0]?.value || null, req.user.id]
                );

                const updatedUser = await db.getOne('SELECT * FROM kullanicilar WHERE id = ?', [req.user.id]);
                return done(null, updatedUser);
            }

            // Normal giriş akışı
            let user = await db.getOne(
                'SELECT * FROM kullanicilar WHERE facebook_id = ?',
                [profile.id]
            );

            if (user) {
                if (user.banlandi_mi) {
                    return done(null, false, { message: 'Hesabınız askıya alınmıştır.' });
                }
                await db.execute(
                    'UPDATE kullanicilar SET son_giris = NOW() WHERE id = ?',
                    [user.id]
                );
                return done(null, user);
            }

            const email = profile.emails ? profile.emails[0].value : `fb_${profile.id}@bilemezsin.com`;

            user = await db.getOne(
                'SELECT * FROM kullanicilar WHERE email = ?',
                [email]
            );

            if (user) {
                await db.execute(
                    'UPDATE kullanicilar SET facebook_id = ?, avatar = COALESCE(avatar, ?), son_giris = NOW() WHERE id = ?',
                    [profile.id, profile.photos[0]?.value || null, user.id]
                );
                user.facebook_id = profile.id;
                return done(null, user);
            }

            // ad_soyad'dan otomatik kullanıcı adı oluştur
            const username = await generateUsernameFromName(profile.displayName);

            const userId = await db.insert(
                `INSERT INTO kullanicilar (facebook_id, email, ad_soyad, kullanici_adi, avatar, dogrulanmis_mi, kullanici_adi_onaylandi, giris_yontemi, son_giris)
                 VALUES (?, ?, ?, ?, ?, 1, 1, 'facebook', NOW())`,
                [profile.id, email, profile.displayName, username, profile.photos[0]?.value || null]
            );

            user = await db.getOne('SELECT * FROM kullanicilar WHERE id = ?', [userId]);
            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }));

    // Serialize User
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize User
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await db.getOne('SELECT * FROM kullanicilar WHERE id = ?', [id]);
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    });
};

// ad_soyad'dan kullanıcı adı oluştur (Türkçe karakter desteği)
async function generateUsernameFromName(adSoyad) {
    // Türkçe karakterleri dönüştür
    const turkishMap = {
        'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
        'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u'
    };

    let username = (adSoyad || 'kullanici').toLowerCase();

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