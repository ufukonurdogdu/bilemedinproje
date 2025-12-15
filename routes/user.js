const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../config/database');
const { ensureAuthenticated } = require('../middleware/auth');

// Multer ayarları - profil resmi yükleme
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads/avatars');
        // Klasör yoksa oluştur
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
        // Benzersiz dosya adı: user_id_timestamp.ext
        const ext = path.extname(file.originalname).toLowerCase();
        const filename = `user_${req.user.id}_${Date.now()}${ext}`;
        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    // Sadece resim dosyaları
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Sadece resim dosyaları yüklenebilir (JPG, PNG, GIF, WebP)'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB limit
    }
});

// Kullanıcı adı değiştirme ücreti (bi! coin)
const KULLANICI_ADI_DEGISTIRME_UCRETI = 180;

// Profil Sayfası
router.get('/profil', ensureAuthenticated, async (req, res) => {
    try {
        console.log('📄 Profil sayfası yükleniyor, user:', req.user?.id);

        // Kullanıcı bilgilerini getir
        const kullanici = await db.getOne(`
            SELECT id, ad_soyad, kullanici_adi, email, avatar, bio, rol, bi_coin, seviye, xp,
                   toplam_tahmin, dogru_tahmin, seri, max_seri, premium_mi, premium_bitis,
                   dogrulanmis_mi, giris_yontemi, olusturma_tarihi, son_giris, ayarlar
            FROM kullanicilar
            WHERE id = ?
        `, [req.user.id]);

        if (!kullanici) {
            console.error('❌ Kullanıcı bulunamadı:', req.user.id);
            req.flash('error_msg', 'Kullanıcı bulunamadı');
            return res.redirect('/');
        }

        console.log('✅ Kullanıcı bulundu:', kullanici.kullanici_adi);

        // Sıralama
        const siralama = await db.getOne(`
            SELECT COUNT(*) + 1 as siralama
            FROM kullanicilar
            WHERE bi_coin > ? AND banlandi_mi = 0
        `, [kullanici.bi_coin || 0]);

        kullanici.siralama = siralama?.siralama || 0;
        kullanici.dogruluk_orani = kullanici.toplam_tahmin > 0
            ? Math.round((kullanici.dogru_tahmin / kullanici.toplam_tahmin) * 100)
            : 0;

        // Rozetleri getir
        const rozetler = await db.getAll(`
            SELECT r.*, kr.kazanilma_tarihi
            FROM kullanici_rozetleri kr
            JOIN rozetler r ON kr.rozet_id = r.id
            WHERE kr.kullanici_id = ?
            ORDER BY kr.kazanilma_tarihi DESC
        `, [req.user.id]) || [];

        // bi! coin geçmişi (son 10)
        const biGecmisi = await db.getAll(`
            SELECT * FROM bi_islemleri
            WHERE kullanici_id = ?
            ORDER BY olusturma_tarihi DESC
            LIMIT 10
        `, [req.user.id]) || [];

        // Son tahminler
        const sonTahminler = await db.getAll(`
            SELECT kt.*, t.baslik, t.durum as tahmin_durum
            FROM kullanici_tahminleri kt
            JOIN tahminler t ON kt.tahmin_id = t.id
            WHERE kt.kullanici_id = ?
            ORDER BY kt.olusturma_tarihi DESC
            LIMIT 10
        `, [req.user.id]) || [];

        console.log('✅ Profil verisi hazır, render ediliyor...');

        res.render('user/profil', {
            title: 'Profilim - Bilemezsin',
            layout: false,
            user: kullanici,
            rozetler,
            biGecmisi,
            sonTahminler,
            kullaniciAdiDegistirmeUcreti: KULLANICI_ADI_DEGISTIRME_UCRETI
        });
    } catch (err) {
        console.error('❌ Profil sayfası hatası:', err);
        req.flash('error_msg', 'Profil yüklenirken bir hata oluştu');
        res.redirect('/');
    }
});

// Kullanıcı Adı Değiştirme (180 bi! coin)
router.post('/profil/kullanici-adi-degistir', ensureAuthenticated, async (req, res) => {
    try {
        const { yeni_kullanici_adi } = req.body;
        const kullaniciId = req.user.id;

        // Validasyon
        if (!yeni_kullanici_adi) {
            return res.json({ success: false, message: 'Kullanıcı adı gerekli' });
        }

        const username = yeni_kullanici_adi.toLowerCase().trim();

        // Uzunluk kontrolü
        if (username.length < 3 || username.length > 20) {
            return res.json({ success: false, message: 'Kullanıcı adı 3-20 karakter olmalı' });
        }

        // Karakter kontrolü
        if (!/^[a-z0-9_]+$/.test(username)) {
            return res.json({ success: false, message: 'Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir' });
        }

        // Yasaklı kullanıcı adları
        const yasakliAdlar = ['admin', 'administrator', 'moderator', 'mod', 'bilemezsin', 'support', 'destek', 'system', 'root', 'null', 'undefined'];
        if (yasakliAdlar.includes(username)) {
            return res.json({ success: false, message: 'Bu kullanıcı adı kullanılamaz' });
        }

        // Aynı kullanıcı adı mı kontrol et
        const mevcutKullanici = await db.getOne('SELECT kullanici_adi, bi_coin FROM kullanicilar WHERE id = ?', [kullaniciId]);

        if (mevcutKullanici.kullanici_adi === username) {
            return res.json({ success: false, message: 'Bu zaten mevcut kullanıcı adınız' });
        }

        // Kullanıcı adı müsait mi?
        const kullaniciAdiMevcut = await db.getOne(
            'SELECT id FROM kullanicilar WHERE kullanici_adi = ? AND id != ?',
            [username, kullaniciId]
        );

        if (kullaniciAdiMevcut) {
            return res.json({ success: false, message: 'Bu kullanıcı adı zaten kullanılıyor' });
        }

        // bi! coin kontrolü
        if (mevcutKullanici.bi_coin < KULLANICI_ADI_DEGISTIRME_UCRETI) {
            return res.json({
                success: false,
                message: `Kullanıcı adı değiştirmek için ${KULLANICI_ADI_DEGISTIRME_UCRETI} bi! coin gerekli. Mevcut bakiyeniz: ${mevcutKullanici.bi_coin} bi!`
            });
        }

        // bi! coin düş
        const yeniBakiye = mevcutKullanici.bi_coin - KULLANICI_ADI_DEGISTIRME_UCRETI;

        await db.execute(
            'UPDATE kullanicilar SET kullanici_adi = ?, bi_coin = ? WHERE id = ?',
            [username, yeniBakiye, kullaniciId]
        );

        // bi! işlem kaydı oluştur
        await db.insert(
            `INSERT INTO bi_islemleri (kullanici_id, miktar, tip, aciklama, bakiye_sonrasi)
             VALUES (?, ?, 'harcama', ?, ?)`,
            [kullaniciId, -KULLANICI_ADI_DEGISTIRME_UCRETI, 'Kullanıcı adı değişikliği', yeniBakiye]
        );

        res.json({
            success: true,
            message: 'Kullanıcı adınız başarıyla değiştirildi!',
            yeni_kullanici_adi: username,
            yeni_bakiye: yeniBakiye
        });

    } catch (err) {
        console.error('Kullanıcı adı değiştirme hatası:', err);
        res.json({ success: false, message: 'Bir hata oluştu, lütfen tekrar deneyin' });
    }
});

// Profil Güncelleme (ad_soyad, bio)
router.post('/profil/guncelle', ensureAuthenticated, async (req, res) => {
    try {
        console.log('📝 Profil güncelleme isteği:', req.body);
        const { ad_soyad, bio } = req.body;
        const kullaniciId = req.user.id;

        // Validasyon
        if (!ad_soyad || ad_soyad.trim().length < 2 || ad_soyad.trim().length > 50) {
            console.log('❌ Validasyon hatası: ad_soyad geçersiz');
            return res.json({ success: false, message: 'İsim 2-50 karakter arasında olmalıdır' });
        }

        // Bio max 200 karakter
        const temizBio = bio ? bio.substring(0, 200) : '';

        console.log('💾 Veritabanı güncelleniyor:', { ad_soyad: ad_soyad.trim(), bio: temizBio, kullaniciId });

        await db.execute(
            'UPDATE kullanicilar SET ad_soyad = ?, bio = ? WHERE id = ?',
            [ad_soyad.trim(), temizBio, kullaniciId]
        );

        console.log('✅ Profil başarıyla güncellendi');
        res.json({ success: true, message: 'Profiliniz güncellendi!' });

    } catch (err) {
        console.error('❌ Profil güncelleme hatası:', err);
        res.json({ success: false, message: 'Bir hata oluştu' });
    }
});

// Profil Resmi Yükleme
router.post('/profil/avatar-yukle', ensureAuthenticated, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.json({ success: false, message: 'Lütfen bir resim seçin' });
        }

        console.log('📸 Avatar yükleniyor:', req.file.filename);
        const kullaniciId = req.user.id;

        // Eski avatar'ı sil (varsa ve local ise)
        const eskiKullanici = await db.getOne('SELECT avatar FROM kullanicilar WHERE id = ?', [kullaniciId]);
        if (eskiKullanici && eskiKullanici.avatar && eskiKullanici.avatar.includes('/uploads/avatars/')) {
            const eskiDosya = path.join(__dirname, '../public', eskiKullanici.avatar);
            if (fs.existsSync(eskiDosya)) {
                fs.unlinkSync(eskiDosya);
                console.log('🗑️ Eski avatar silindi:', eskiDosya);
            }
        }

        // Yeni avatar URL'i
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;

        // Veritabanını güncelle
        await db.execute(
            'UPDATE kullanicilar SET avatar = ? WHERE id = ?',
            [avatarUrl, kullaniciId]
        );

        console.log('✅ Avatar başarıyla güncellendi:', avatarUrl);
        res.json({
            success: true,
            message: 'Profil resmi başarıyla güncellendi!',
            avatar: avatarUrl
        });

    } catch (err) {
        console.error('❌ Avatar yükleme hatası:', err);
        // Multer hataları için özel mesajlar
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.json({ success: false, message: 'Dosya boyutu çok büyük (maksimum 2MB)' });
        }
        res.json({ success: false, message: err.message || 'Bir hata oluştu' });
    }
});

// Profil Resmi Silme
router.post('/profil/avatar-sil', ensureAuthenticated, async (req, res) => {
    try {
        const kullaniciId = req.user.id;

        // Mevcut avatar'ı al
        const kullanici = await db.getOne('SELECT avatar FROM kullanicilar WHERE id = ?', [kullaniciId]);

        // Eğer local bir avatar varsa dosyayı sil
        if (kullanici && kullanici.avatar && kullanici.avatar.includes('/uploads/avatars/')) {
            const dosyaYolu = path.join(__dirname, '../public', kullanici.avatar);
            if (fs.existsSync(dosyaYolu)) {
                fs.unlinkSync(dosyaYolu);
                console.log('🗑️ Avatar dosyası silindi:', dosyaYolu);
            }
        }

        // Veritabanında avatar'ı NULL yap
        await db.execute(
            'UPDATE kullanicilar SET avatar = NULL WHERE id = ?',
            [kullaniciId]
        );

        console.log('✅ Avatar başarıyla silindi');
        res.json({ success: true, message: 'Profil resmi kaldırıldı' });

    } catch (err) {
        console.error('❌ Avatar silme hatası:', err);
        res.json({ success: false, message: 'Bir hata oluştu' });
    }
});

// Dashboard
router.get('/dashboard', ensureAuthenticated, async (req, res) => {
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

        // Kullanıcı istatistikleri
        const kullanici = await db.getOne(`
            SELECT bi_coin, toplam_tahmin, dogru_tahmin, seri
            FROM kullanicilar WHERE id = ?
        `, [req.user.id]);

        res.render('user/dashboard', {
            title: 'Dashboard - Bilemezsin',
            layout: 'layouts/main',
            tahminler,
            kategoriler,
            kullanici
        });
    } catch (err) {
        console.error('Dashboard hatası:', err);
        res.redirect('/');
    }
});

// Tahminler Sayfası
router.get('/tahminler', ensureAuthenticated, async (req, res) => {
    try {
        const kategoriSlug = req.query.kategori;
        const sayfa = parseInt(req.query.sayfa) || 1;
        const limit = 12;
        const offset = (sayfa - 1) * limit;

        let whereClause = "WHERE t.durum = 'aktif'";
        let params = [];

        if (kategoriSlug) {
            whereClause += " AND k.slug = ?";
            params.push(kategoriSlug);
        }

        const tahminler = await db.getAll(`
            SELECT t.*, k.ad as kategori_adi, k.ikon as kategori_ikon, k.renk as kategori_renk,
                   (SELECT COUNT(*) FROM kullanici_tahminleri WHERE tahmin_id = t.id) as katilimci_sayisi
            FROM tahminler t
            LEFT JOIN kategoriler k ON t.kategori_id = k.id
            ${whereClause}
            ORDER BY t.olusturma_tarihi DESC
            LIMIT ${limit} OFFSET ${offset}
        `, params);

        const kategoriler = await db.getAll(
            'SELECT * FROM kategoriler WHERE aktif_mi = 1 ORDER BY sira'
        );

        // Kullanıcının tahminlerini al
        const kullaniciTahminleri = await db.getAll(
            'SELECT tahmin_id, secim FROM kullanici_tahminleri WHERE kullanici_id = ?',
            [req.user.id]
        );
        const tahminMap = {};
        kullaniciTahminleri.forEach(kt => tahminMap[kt.tahmin_id] = kt.secim);

        res.render('user/tahminler', {
            title: 'Tahminler - Bilemezsin',
            layout: false,
            tahminler,
            kategoriler,
            kategoriSlug,
            kullaniciTahminleri: tahminMap,
            sayfa,
            limit
        });
    } catch (err) {
        console.error('Tahminler hatası:', err);
        res.redirect('/dashboard');
    }
});

// Tahmin Yap
router.post('/tahminler/yap', ensureAuthenticated, async (req, res) => {
    try {
        const { tahmin_id, secim } = req.body;
        const kullaniciId = req.user.id;

        // Tahmin var mı kontrol et
        const tahmin = await db.getOne(
            "SELECT * FROM tahminler WHERE id = ? AND durum = 'aktif'",
            [tahmin_id]
        );

        if (!tahmin) {
            return res.json({ success: false, message: 'Tahmin bulunamadı veya kapalı' });
        }

        // Daha önce tahmin yapılmış mı
        const mevcutTahmin = await db.getOne(
            'SELECT * FROM kullanici_tahminleri WHERE kullanici_id = ? AND tahmin_id = ?',
            [kullaniciId, tahmin_id]
        );

        if (mevcutTahmin) {
            return res.json({ success: false, message: 'Bu tahmin için zaten oy verdiniz' });
        }

        // Tahmini kaydet
        await db.insert(
            'INSERT INTO kullanici_tahminleri (kullanici_id, tahmin_id, secim) VALUES (?, ?, ?)',
            [kullaniciId, tahmin_id, secim]
        );

        // Kullanıcı istatistiklerini güncelle
        await db.execute(
            'UPDATE kullanicilar SET toplam_tahmin = toplam_tahmin + 1 WHERE id = ?',
            [kullaniciId]
        );

        // Tahmin katılım sayısını güncelle
        await db.execute(
            'UPDATE tahminler SET katilim_sayisi = katilim_sayisi + 1 WHERE id = ?',
            [tahmin_id]
        );

        // Oranları güncelle (evet/hayır için)
        if (tahmin.tip === 'evet_hayir') {
            const counts = await db.getOne(`
                SELECT
                    SUM(CASE WHEN secim = 'evet' THEN 1 ELSE 0 END) as evet,
                    SUM(CASE WHEN secim = 'hayir' THEN 1 ELSE 0 END) as hayir,
                    COUNT(*) as toplam
                FROM kullanici_tahminleri WHERE tahmin_id = ?
            `, [tahmin_id]);

            if (counts.toplam > 0) {
                const evetOrani = Math.round((counts.evet / counts.toplam) * 100);
                const hayirOrani = 100 - evetOrani;
                await db.execute(
                    'UPDATE tahminler SET evet_orani = ?, hayir_orani = ? WHERE id = ?',
                    [evetOrani, hayirOrani, tahmin_id]
                );
            }
        }

        res.json({ success: true, message: 'Tahmininiz kaydedildi!' });
    } catch (err) {
        console.error('Tahmin yapma hatası:', err);
        res.json({ success: false, message: 'Bir hata oluştu' });
    }
});

// Sıralama Sayfası
router.get('/siralama', ensureAuthenticated, async (req, res) => {
    try {
        const tip = req.query.tip || 'bi_coin';
        const sayfa = parseInt(req.query.sayfa) || 1;
        const limit = 50;
        const offset = (sayfa - 1) * limit;

        let orderBy = 'bi_coin DESC';
        if (tip === 'dogru') orderBy = 'dogru_tahmin DESC';
        if (tip === 'seviye') orderBy = 'seviye DESC, xp DESC';
        if (tip === 'seri') orderBy = 'max_seri DESC';

        const kullanicilar = await db.getAll(`
            SELECT id, ad_soyad, kullanici_adi, avatar, bi_coin, seviye, xp,
                   toplam_tahmin, dogru_tahmin, seri, max_seri,
                   CASE WHEN toplam_tahmin > 0 THEN ROUND((dogru_tahmin / toplam_tahmin) * 100) ELSE 0 END as dogruluk
            FROM kullanicilar
            WHERE banlandi_mi = 0
            ORDER BY ${orderBy}
            LIMIT ${limit} OFFSET ${offset}
        `);

        // Kullanıcının sıralamasını bul
        const kullaniciSirasi = await db.getOne(`
            SELECT COUNT(*) + 1 as sira FROM kullanicilar
            WHERE banlandi_mi = 0 AND bi_coin > (SELECT bi_coin FROM kullanicilar WHERE id = ?)
        `, [req.user.id]);

        res.render('user/siralama', {
            title: 'Sıralama - Bilemezsin',
            layout: false,
            kullanicilar,
            tip,
            sayfa,
            kullaniciSirasi: kullaniciSirasi?.sira || 0,
            offset
        });
    } catch (err) {
        console.error('Sıralama hatası:', err);
        res.redirect('/dashboard');
    }
});

// Mağaza Sayfası
router.get('/magaza', ensureAuthenticated, async (req, res) => {
    try {
        const urunler = await db.getAll(`
            SELECT * FROM magaza_urunleri
            WHERE aktif_mi = 1
            ORDER BY tip, fiyat_bi
        `);

        // Kullanıcının satın aldıklarını al
        const satinAlmalar = await db.getAll(
            'SELECT urun_id FROM satin_almalar WHERE kullanici_id = ? AND durum != "iptal"',
            [req.user.id]
        );
        const satinAlinanlar = satinAlmalar.map(s => s.urun_id);

        res.render('user/magaza', {
            title: 'Mağaza - Bilemezsin',
            layout: false,
            urunler,
            satinAlinanlar
        });
    } catch (err) {
        console.error('Mağaza hatası:', err);
        res.redirect('/dashboard');
    }
});

// Ürün Satın Al
router.post('/magaza/satin-al', ensureAuthenticated, async (req, res) => {
    try {
        const { urun_id } = req.body;
        const kullaniciId = req.user.id;

        // Ürün bilgisi
        const urun = await db.getOne(
            'SELECT * FROM magaza_urunleri WHERE id = ? AND aktif_mi = 1',
            [urun_id]
        );

        if (!urun) {
            return res.json({ success: false, message: 'Ürün bulunamadı' });
        }

        // Stok kontrolü
        if (urun.stok === 0) {
            return res.json({ success: false, message: 'Ürün stokta yok' });
        }

        // Kullanıcı bakiyesi
        const kullanici = await db.getOne(
            'SELECT bi_coin FROM kullanicilar WHERE id = ?',
            [kullaniciId]
        );

        if (kullanici.bi_coin < urun.fiyat_bi) {
            return res.json({ success: false, message: 'Yetersiz bi! coin bakiyesi' });
        }

        // Tekrarlı satın alma kontrolü (dijital ürünler için)
        if (urun.tip === 'dijital' || urun.tip === 'premium') {
            const mevcutSatinAlma = await db.getOne(
                'SELECT * FROM satin_almalar WHERE kullanici_id = ? AND urun_id = ? AND durum != "iptal"',
                [kullaniciId, urun_id]
            );
            if (mevcutSatinAlma) {
                return res.json({ success: false, message: 'Bu ürünü zaten satın aldınız' });
            }
        }

        // Bakiyeyi düş
        const yeniBakiye = kullanici.bi_coin - urun.fiyat_bi;
        await db.execute(
            'UPDATE kullanicilar SET bi_coin = ? WHERE id = ?',
            [yeniBakiye, kullaniciId]
        );

        // Satın alma kaydı
        await db.insert(
            'INSERT INTO satin_almalar (kullanici_id, urun_id, toplam_bi, durum) VALUES (?, ?, ?, ?)',
            [kullaniciId, urun_id, urun.fiyat_bi, urun.tip === 'dijital' ? 'teslim_edildi' : 'beklemede']
        );

        // Stok düş
        if (urun.stok > 0) {
            await db.execute(
                'UPDATE magaza_urunleri SET stok = stok - 1 WHERE id = ?',
                [urun_id]
            );
        }

        // bi! işlem kaydı
        await db.insert(
            'INSERT INTO bi_islemleri (kullanici_id, miktar, tip, aciklama, bakiye_sonrasi) VALUES (?, ?, ?, ?, ?)',
            [kullaniciId, -urun.fiyat_bi, 'harcama', `Mağaza: ${urun.ad}`, yeniBakiye]
        );

        // Socket.io ile bildir
        if (global.updateUserBiCoin) {
            global.updateUserBiCoin(kullaniciId, yeniBakiye);
        }

        res.json({
            success: true,
            message: 'Satın alma başarılı!',
            yeni_bakiye: yeniBakiye
        });
    } catch (err) {
        console.error('Satın alma hatası:', err);
        res.json({ success: false, message: 'Bir hata oluştu' });
    }
});

// Bildirimler Sayfası
router.get('/bildirimler', ensureAuthenticated, async (req, res) => {
    try {
        const bildirimler = await db.getAll(`
            SELECT * FROM bildirimler
            WHERE kullanici_id = ?
            ORDER BY olusturma_tarihi DESC
            LIMIT 50
        `, [req.user.id]);

        // Okunmamışları okundu işaretle
        await db.execute(
            'UPDATE bildirimler SET okundu_mu = 1 WHERE kullanici_id = ? AND okundu_mu = 0',
            [req.user.id]
        );

        res.render('user/bildirimler', {
            title: 'Bildirimler - Bilemezsin',
            layout: false,
            bildirimler
        });
    } catch (err) {
        console.error('Bildirimler hatası:', err);
        res.redirect('/dashboard');
    }
});

module.exports = router;
