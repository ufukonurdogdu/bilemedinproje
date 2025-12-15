const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { ensureAuthenticated } = require('../middleware/auth');

// Gorevler sayfasi
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        // Tum gorevleri getir
        const tumGorevler = await db.getAll(`
            SELECT g.*,
                   COALESCE(kg.ilerleme, 0) as ilerleme,
                   COALESCE(kg.tamamlandi_mi, 0) as tamamlandi_mi,
                   kg.tamamlanma_tarihi
            FROM gorevler g
            LEFT JOIN kullanici_gorevleri kg ON g.id = kg.gorev_id AND kg.kullanici_id = ?
            WHERE g.aktif_mi = 1
            ORDER BY g.tip, g.sira
        `, [req.user.id]);

        // Gorevleri tipine gore grupla
        const gorevler = {
            baslangic: tumGorevler.filter(g => g.tip === 'baslangic'),
            sosyal: tumGorevler.filter(g => g.tip === 'sosyal'),
            gunluk: tumGorevler.filter(g => g.tip === 'gunluk'),
            haftalik: tumGorevler.filter(g => g.tip === 'haftalik'),
            ozel: tumGorevler.filter(g => g.tip === 'ozel')
        };

        // Kullanici bilgilerini gorev durumu icin kontrol et
        const kullanici = await db.getOne(`
            SELECT google_id, facebook_id, bio, toplam_tahmin
            FROM kullanicilar WHERE id = ?
        `, [req.user.id]);

        // Baslangic gorevleri icin otomatik kontrol
        for (const gorev of gorevler.baslangic) {
            if (!gorev.tamamlandi_mi) {
                let tamamlandi = false;

                switch (gorev.kosul_tip) {
                    case 'google_bagli':
                        tamamlandi = !!kullanici.google_id;
                        break;
                    case 'facebook_bagli':
                        tamamlandi = !!kullanici.facebook_id;
                        break;
                    case 'profil_tamamla':
                        tamamlandi = !!(kullanici.bio && kullanici.bio.length > 10);
                        break;
                    case 'ilk_tahmin':
                        tamamlandi = kullanici.toplam_tahmin > 0;
                        break;
                }

                if (tamamlandi && !gorev.tamamlandi_mi) {
                    // Gorevi otomatik tamamla
                    await tamamlaGorev(req.user.id, gorev.id, gorev.bi_odul, gorev.xp_odul);
                    gorev.tamamlandi_mi = 1;
                }
            }
        }

        // Toplam kazanilabilir bi! hesapla
        const toplamKazanilabilir = tumGorevler
            .filter(g => !g.tamamlandi_mi)
            .reduce((sum, g) => sum + g.bi_odul, 0);

        const tamamlananSayisi = tumGorevler.filter(g => g.tamamlandi_mi).length;

        res.render('user/gorevler', {
            title: 'Gorevler - Bilemezsin',
            layout: false,
            gorevler,
            toplamKazanilabilir,
            tamamlananSayisi,
            toplamGorev: tumGorevler.length
        });
    } catch (err) {
        console.error('Gorevler sayfasi hatasi:', err);
        req.flash('error_msg', 'Gorevler yuklenirken bir hata olustu');
        res.redirect('/dashboard');
    }
});

// Gorev tamamla (sosyal takip icin manuel onay)
router.post('/tamamla/:gorevId', ensureAuthenticated, async (req, res) => {
    try {
        const gorevId = parseInt(req.params.gorevId);
        const kullaniciId = req.user.id;

        // Gorevi kontrol et
        const gorev = await db.getOne('SELECT * FROM gorevler WHERE id = ? AND aktif_mi = 1', [gorevId]);
        if (!gorev) {
            return res.json({ success: false, message: 'Gorev bulunamadi' });
        }

        // Daha once tamamlanmis mi kontrol et
        const mevcutGorev = await db.getOne(
            'SELECT * FROM kullanici_gorevleri WHERE kullanici_id = ? AND gorev_id = ?',
            [kullaniciId, gorevId]
        );

        if (mevcutGorev && mevcutGorev.tamamlandi_mi) {
            return res.json({ success: false, message: 'Bu gorev zaten tamamlanmis' });
        }

        // Kullanici bilgilerini getir
        const kullanici = await db.getOne(`
            SELECT google_id, facebook_id, bio, toplam_tahmin
            FROM kullanicilar WHERE id = ?
        `, [kullaniciId]);

        // Gorev tipine gore kontrol
        let tamamlanabilir = false;
        let hata = '';

        switch (gorev.kosul_tip) {
            case 'google_bagli':
                if (kullanici.google_id) {
                    tamamlanabilir = true;
                } else {
                    hata = 'Once Google hesabinizi baglayiniz';
                }
                break;

            case 'facebook_bagli':
                if (kullanici.facebook_id) {
                    tamamlanabilir = true;
                } else {
                    hata = 'Once Facebook hesabinizi baglayiniz';
                }
                break;

            case 'profil_tamamla':
                if (kullanici.bio && kullanici.bio.length > 10) {
                    tamamlanabilir = true;
                } else {
                    hata = 'Profil bilgilerinizi doldurunuz (en az 10 karakter bio)';
                }
                break;

            case 'ilk_tahmin':
                if (kullanici.toplam_tahmin > 0) {
                    tamamlanabilir = true;
                } else {
                    hata = 'Henuz bir tahmin yapmadiniz';
                }
                break;

            case 'twitter_takip':
            case 'instagram_takip':
                // Sosyal medya takipleri icin link tiklanmis olmali ve sure gecmis olmali
                const linkKey = `sosyal_link_${gorevId}`;
                const linkTiklanmaZamani = req.session[linkKey];

                if (!linkTiklanmaZamani) {
                    hata = 'Önce sosyal medya linkine tıklayın ve hesabı takip edin';
                } else {
                    // 15 saniye gecmis olmali
                    const gecenSure = Date.now() - linkTiklanmaZamani;
                    const beklenenSure = 15 * 1000; // 15 saniye

                    if (gecenSure < beklenenSure) {
                        const kalanSaniye = Math.ceil((beklenenSure - gecenSure) / 1000);
                        hata = `Lütfen ${kalanSaniye} saniye daha bekleyin`;
                    } else {
                        tamamlanabilir = true;
                        // Session'dan temizle
                        delete req.session[linkKey];
                    }
                }
                break;

            default:
                hata = 'Bu gorev manuel olarak tamamlanamaz';
        }

        if (!tamamlanabilir) {
            return res.json({ success: false, message: hata });
        }

        // Gorevi tamamla
        await tamamlaGorev(kullaniciId, gorevId, gorev.bi_odul, gorev.xp_odul);

        // Guncel bi_coin degerini al
        const guncelKullanici = await db.getOne('SELECT bi_coin FROM kullanicilar WHERE id = ?', [kullaniciId]);

        res.json({
            success: true,
            message: `Tebrikler! ${gorev.bi_odul} bi! kazandiniz!`,
            odul: gorev.bi_odul,
            yeni_bakiye: guncelKullanici.bi_coin
        });
    } catch (err) {
        console.error('Gorev tamamlama hatasi:', err);
        res.json({ success: false, message: 'Bir hata olustu' });
    }
});

// Sosyal medya linki tiklandiginda kayit
router.post('/link-tiklandi/:gorevId', ensureAuthenticated, async (req, res) => {
    try {
        const gorevId = parseInt(req.params.gorevId);

        // Gorevi kontrol et
        const gorev = await db.getOne('SELECT * FROM gorevler WHERE id = ? AND aktif_mi = 1', [gorevId]);
        if (!gorev) {
            return res.json({ success: false, message: 'Gorev bulunamadi' });
        }

        // Sadece sosyal medya gorevleri icin gecerli
        if (!['twitter_takip', 'instagram_takip'].includes(gorev.kosul_tip)) {
            return res.json({ success: false, message: 'Bu gorev icin link dogrulamasi gerekli degil' });
        }

        // Daha once tamamlanmis mi kontrol et
        const mevcutGorev = await db.getOne(
            'SELECT * FROM kullanici_gorevleri WHERE kullanici_id = ? AND gorev_id = ? AND tamamlandi_mi = 1',
            [req.user.id, gorevId]
        );

        if (mevcutGorev) {
            return res.json({ success: false, message: 'Bu gorev zaten tamamlanmis' });
        }

        // Session'a tiklama zamanini kaydet
        const linkKey = `sosyal_link_${gorevId}`;
        req.session[linkKey] = Date.now();

        // Session'i kaydet
        req.session.save((err) => {
            if (err) {
                console.error('Session kaydetme hatasi:', err);
                return res.json({ success: false, message: 'Bir hata olustu' });
            }

            res.json({
                success: true,
                message: 'Link tiklama kaydedildi. Hesabi takip ettikten sonra 15 saniye bekleyin.',
                bekleme_suresi: 15
            });
        });
    } catch (err) {
        console.error('Link tiklama hatasi:', err);
        res.json({ success: false, message: 'Bir hata olustu' });
    }
});

// API: Kullanicinin gorev durumu
router.get('/api/durum', ensureAuthenticated, async (req, res) => {
    try {
        const gorevler = await db.getAll(`
            SELECT g.id, g.ad, g.bi_odul, g.tip,
                   COALESCE(kg.tamamlandi_mi, 0) as tamamlandi_mi
            FROM gorevler g
            LEFT JOIN kullanici_gorevleri kg ON g.id = kg.gorev_id AND kg.kullanici_id = ?
            WHERE g.aktif_mi = 1
        `, [req.user.id]);

        const tamamlanan = gorevler.filter(g => g.tamamlandi_mi).length;
        const toplam = gorevler.length;
        const kazanilan = gorevler.filter(g => g.tamamlandi_mi).reduce((s, g) => s + g.bi_odul, 0);

        res.json({
            success: true,
            tamamlanan,
            toplam,
            kazanilan,
            gorevler
        });
    } catch (err) {
        console.error('Gorev durumu hatasi:', err);
        res.json({ success: false, message: 'Bir hata olustu' });
    }
});

// Yardimci fonksiyon: Gorev tamamla ve odul ver
async function tamamlaGorev(kullaniciId, gorevId, biOdul, xpOdul) {
    // Mevcut kaydi kontrol et
    const mevcut = await db.getOne(
        'SELECT * FROM kullanici_gorevleri WHERE kullanici_id = ? AND gorev_id = ?',
        [kullaniciId, gorevId]
    );

    if (mevcut) {
        // Guncelle
        await db.query(`
            UPDATE kullanici_gorevleri
            SET ilerleme = 1, tamamlandi_mi = 1, tamamlanma_tarihi = NOW()
            WHERE kullanici_id = ? AND gorev_id = ?
        `, [kullaniciId, gorevId]);
    } else {
        // Yeni kayit olustur
        await db.query(`
            INSERT INTO kullanici_gorevleri (kullanici_id, gorev_id, ilerleme, tamamlandi_mi, tamamlanma_tarihi)
            VALUES (?, ?, 1, 1, NOW())
        `, [kullaniciId, gorevId]);
    }

    // bi! coin ver
    await db.query(`
        UPDATE kullanicilar SET bi_coin = bi_coin + ?, xp = xp + ?
        WHERE id = ?
    `, [biOdul, xpOdul, kullaniciId]);

    // bi! islem kaydi olustur
    const kullanici = await db.getOne('SELECT bi_coin FROM kullanicilar WHERE id = ?', [kullaniciId]);

    // Socket.io ile canli bi! coin guncelle
    if (global.updateUserBiCoin) {
        global.updateUserBiCoin(kullaniciId, kullanici.bi_coin);
    }
    if (global.updateLeaderboard) {
        global.updateLeaderboard();
    }
    await db.query(`
        INSERT INTO bi_islemleri (kullanici_id, miktar, tip, aciklama, referans_tip, referans_id, bakiye_sonrasi)
        VALUES (?, ?, 'bonus', 'Gorev odulu', 'gorev', ?, ?)
    `, [kullaniciId, biOdul, gorevId, kullanici.bi_coin]);

    // Bildirim olustur
    await db.query(`
        INSERT INTO bildirimler (kullanici_id, baslik, mesaj, tip, link)
        VALUES (?, 'Gorev Tamamlandi!', ?, 'odul', '/gorevler')
    `, [kullaniciId, `Tebrikler! ${biOdul} bi! kazandiniz.`]);
}

module.exports = router;
