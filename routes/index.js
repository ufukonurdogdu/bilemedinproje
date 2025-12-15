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
