const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});

// Test connection
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ MySQL bağlantısı başarılı');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ MySQL bağlantı hatası:', error.message);
        return false;
    }
};

// Tabloları oluştur
const createTables = async () => {
    const connection = await pool.getConnection();
    
    try {
        // Kullanicilar tablosu
        await connection.query(`
            CREATE TABLE IF NOT EXISTS kullanicilar (
                id INT AUTO_INCREMENT PRIMARY KEY,
                google_id VARCHAR(255) UNIQUE,
                facebook_id VARCHAR(255) UNIQUE,
                email VARCHAR(255) NOT NULL UNIQUE,
                sifre VARCHAR(255),
                ad_soyad VARCHAR(100) NOT NULL,
                kullanici_adi VARCHAR(50) UNIQUE,
                avatar VARCHAR(500),
                bio TEXT,
                rol ENUM('kullanici', 'moderator', 'admin', 'superadmin') DEFAULT 'kullanici',
                bi_coin INT DEFAULT 50,
                seviye INT DEFAULT 1,
                xp INT DEFAULT 0,
                toplam_tahmin INT DEFAULT 0,
                dogru_tahmin INT DEFAULT 0,
                seri INT DEFAULT 0,
                max_seri INT DEFAULT 0,
                siralama INT,
                premium_mi TINYINT(1) DEFAULT 0,
                premium_bitis DATETIME,
                dogrulanmis_mi TINYINT(1) DEFAULT 0,
                banlandi_mi TINYINT(1) DEFAULT 0,
                ban_sebebi TEXT,
                kullanici_adi_onaylandi TINYINT(1) DEFAULT 0,
                giris_yontemi ENUM('local', 'google', 'facebook') DEFAULT 'local',
                son_giris DATETIME,
                giris_serisi INT DEFAULT 0,
                ayarlar JSON DEFAULT '{"tema": "auto", "bildirimler": true, "email_bildirimleri": true, "dil": "tr"}',
                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_kullanici_adi (kullanici_adi),
                INDEX idx_google_id (google_id),
                INDEX idx_facebook_id (facebook_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ kullanicilar tablosu hazır');

        // Kategoriler tablosu
        await connection.query(`
            CREATE TABLE IF NOT EXISTS kategoriler (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ad VARCHAR(100) NOT NULL,
                slug VARCHAR(100) NOT NULL UNIQUE,
                ikon VARCHAR(50),
                renk VARCHAR(20),
                sira INT DEFAULT 0,
                aktif_mi TINYINT(1) DEFAULT 1,
                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_slug (slug)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ kategoriler tablosu hazır');

        // Tahminler tablosu
        await connection.query(`
            CREATE TABLE IF NOT EXISTS tahminler (
                id INT AUTO_INCREMENT PRIMARY KEY,
                kategori_id INT,
                baslik VARCHAR(255) NOT NULL,
                aciklama TEXT,
                gorsel VARCHAR(500),
                tip ENUM('evet_hayir', 'coktan_secmeli', 'skor', 'tarih') DEFAULT 'evet_hayir',
                secenekler JSON,
                dogru_cevap VARCHAR(255),
                bi_odul INT DEFAULT 100,
                katilim_sayisi INT DEFAULT 0,
                evet_orani DECIMAL(5,2) DEFAULT 50.00,
                hayir_orani DECIMAL(5,2) DEFAULT 50.00,
                durum ENUM('aktif', 'beklemede', 'sonuclandi', 'iptal') DEFAULT 'aktif',
                bitis_tarihi DATETIME,
                sonuclanma_tarihi DATETIME,
                olusturan_id INT,
                sponsorlu_mu TINYINT(1) DEFAULT 0,
                sponsor_adi VARCHAR(100),
                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (kategori_id) REFERENCES kategoriler(id) ON DELETE SET NULL,
                FOREIGN KEY (olusturan_id) REFERENCES kullanicilar(id) ON DELETE SET NULL,
                INDEX idx_durum (durum),
                INDEX idx_kategori (kategori_id),
                INDEX idx_bitis (bitis_tarihi)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ tahminler tablosu hazır');

        // Kullanici Tahminleri tablosu
        await connection.query(`
            CREATE TABLE IF NOT EXISTS kullanici_tahminleri (
                id INT AUTO_INCREMENT PRIMARY KEY,
                kullanici_id INT NOT NULL,
                tahmin_id INT NOT NULL,
                secim VARCHAR(255) NOT NULL,
                dogru_mu TINYINT(1),
                kazanilan_bi INT DEFAULT 0,
                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id) ON DELETE CASCADE,
                FOREIGN KEY (tahmin_id) REFERENCES tahminler(id) ON DELETE CASCADE,
                UNIQUE KEY unique_kullanici_tahmin (kullanici_id, tahmin_id),
                INDEX idx_kullanici (kullanici_id),
                INDEX idx_tahmin (tahmin_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ kullanici_tahminleri tablosu hazır');

        // Rozetler tablosu
        await connection.query(`
            CREATE TABLE IF NOT EXISTS rozetler (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ad VARCHAR(100) NOT NULL,
                aciklama TEXT,
                ikon VARCHAR(50),
                kosul_tip VARCHAR(50),
                kosul_deger INT,
                bi_odul INT DEFAULT 0,
                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ rozetler tablosu hazır');

        // Kullanici Rozetleri tablosu
        await connection.query(`
            CREATE TABLE IF NOT EXISTS kullanici_rozetleri (
                id INT AUTO_INCREMENT PRIMARY KEY,
                kullanici_id INT NOT NULL,
                rozet_id INT NOT NULL,
                kazanilma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id) ON DELETE CASCADE,
                FOREIGN KEY (rozet_id) REFERENCES rozetler(id) ON DELETE CASCADE,
                UNIQUE KEY unique_kullanici_rozet (kullanici_id, rozet_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ kullanici_rozetleri tablosu hazır');

        // Gorevler tablosu
        await connection.query(`
            CREATE TABLE IF NOT EXISTS gorevler (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ad VARCHAR(100) NOT NULL,
                aciklama TEXT,
                tip ENUM('gunluk', 'haftalik', 'ozel', 'sosyal', 'baslangic') DEFAULT 'gunluk',
                kosul_tip VARCHAR(50),
                kosul_deger INT,
                bi_odul INT DEFAULT 100,
                xp_odul INT DEFAULT 50,
                ikon VARCHAR(50) DEFAULT '🎯',
                link VARCHAR(500),
                sira INT DEFAULT 0,
                tekrarlanabilir TINYINT(1) DEFAULT 0,
                aktif_mi TINYINT(1) DEFAULT 1,
                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ gorevler tablosu hazır');

        // Gorevler tablosu migration - yeni alanlar ekle
        try {
            await connection.query(`ALTER TABLE gorevler ADD COLUMN IF NOT EXISTS ikon VARCHAR(50) DEFAULT '🎯'`);
            await connection.query(`ALTER TABLE gorevler ADD COLUMN IF NOT EXISTS link VARCHAR(500)`);
            await connection.query(`ALTER TABLE gorevler ADD COLUMN IF NOT EXISTS sira INT DEFAULT 0`);
            await connection.query(`ALTER TABLE gorevler ADD COLUMN IF NOT EXISTS tekrarlanabilir TINYINT(1) DEFAULT 0`);
            await connection.query(`ALTER TABLE gorevler MODIFY COLUMN tip ENUM('gunluk', 'haftalik', 'ozel', 'sosyal', 'baslangic') DEFAULT 'gunluk'`);
        } catch (e) {
            // MySQL'de IF NOT EXISTS yok, hata göz ardı edilebilir
        }

        // Kullanici Gorevleri tablosu
        await connection.query(`
            CREATE TABLE IF NOT EXISTS kullanici_gorevleri (
                id INT AUTO_INCREMENT PRIMARY KEY,
                kullanici_id INT NOT NULL,
                gorev_id INT NOT NULL,
                ilerleme INT DEFAULT 0,
                tamamlandi_mi TINYINT(1) DEFAULT 0,
                tamamlanma_tarihi DATETIME,
                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id) ON DELETE CASCADE,
                FOREIGN KEY (gorev_id) REFERENCES gorevler(id) ON DELETE CASCADE,
                INDEX idx_kullanici (kullanici_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ kullanici_gorevleri tablosu hazır');

        // Bildirimler tablosu
        await connection.query(`
            CREATE TABLE IF NOT EXISTS bildirimler (
                id INT AUTO_INCREMENT PRIMARY KEY,
                kullanici_id INT NOT NULL,
                baslik VARCHAR(255) NOT NULL,
                mesaj TEXT,
                tip ENUM('sistem', 'tahmin', 'odul', 'sosyal') DEFAULT 'sistem',
                link VARCHAR(500),
                okundu_mu TINYINT(1) DEFAULT 0,
                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id) ON DELETE CASCADE,
                INDEX idx_kullanici (kullanici_id),
                INDEX idx_okundu (okundu_mu)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ bildirimler tablosu hazır');

        // Arkadasliklar tablosu
        await connection.query(`
            CREATE TABLE IF NOT EXISTS arkadasliklar (
                id INT AUTO_INCREMENT PRIMARY KEY,
                kullanici_id INT NOT NULL,
                arkadas_id INT NOT NULL,
                durum ENUM('beklemede', 'kabul', 'reddedildi') DEFAULT 'beklemede',
                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id) ON DELETE CASCADE,
                FOREIGN KEY (arkadas_id) REFERENCES kullanicilar(id) ON DELETE CASCADE,
                UNIQUE KEY unique_arkadaslik (kullanici_id, arkadas_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ arkadasliklar tablosu hazır');

        // Bi Islemleri tablosu (coin hareketleri)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS bi_islemleri (
                id INT AUTO_INCREMENT PRIMARY KEY,
                kullanici_id INT NOT NULL,
                miktar INT NOT NULL,
                tip ENUM('kazanc', 'harcama', 'bonus', 'transfer') NOT NULL,
                aciklama VARCHAR(255),
                referans_tip VARCHAR(50),
                referans_id INT,
                bakiye_sonrasi INT,
                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id) ON DELETE CASCADE,
                INDEX idx_kullanici (kullanici_id),
                INDEX idx_tarih (olusturma_tarihi)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ bi_islemleri tablosu hazır');

        // Reklamlar tablosu
        await connection.query(`
            CREATE TABLE IF NOT EXISTS reklamlar (
                id INT AUTO_INCREMENT PRIMARY KEY,
                baslik VARCHAR(255) NOT NULL,
                gorsel VARCHAR(500),
                link VARCHAR(500),
                konum ENUM('banner', 'sidebar', 'inline', 'popup') DEFAULT 'banner',
                baslangic_tarihi DATETIME,
                bitis_tarihi DATETIME,
                goruntulenme INT DEFAULT 0,
                tiklanma INT DEFAULT 0,
                aktif_mi TINYINT(1) DEFAULT 1,
                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ reklamlar tablosu hazır');

        // Magaza Urunleri tablosu
        await connection.query(`
            CREATE TABLE IF NOT EXISTS magaza_urunleri (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ad VARCHAR(255) NOT NULL,
                aciklama TEXT,
                gorsel VARCHAR(500),
                tip ENUM('dijital', 'fiziksel', 'cekilis', 'premium') DEFAULT 'dijital',
                fiyat_bi INT NOT NULL,
                stok INT DEFAULT -1,
                aktif_mi TINYINT(1) DEFAULT 1,
                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ magaza_urunleri tablosu hazır');

        // Satın Almalar tablosu
        await connection.query(`
            CREATE TABLE IF NOT EXISTS satin_almalar (
                id INT AUTO_INCREMENT PRIMARY KEY,
                kullanici_id INT NOT NULL,
                urun_id INT NOT NULL,
                miktar INT DEFAULT 1,
                toplam_bi INT NOT NULL,
                durum ENUM('beklemede', 'onaylandi', 'teslim_edildi', 'iptal') DEFAULT 'beklemede',
                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id) ON DELETE CASCADE,
                FOREIGN KEY (urun_id) REFERENCES magaza_urunleri(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ satin_almalar tablosu hazır');

        // Varsayılan kategorileri ekle
        await connection.query(`
            INSERT IGNORE INTO kategoriler (id, ad, slug, ikon, renk, sira) VALUES
            (1, 'Spor', 'spor', '⚽', '#10b981', 1),
            (2, 'Ekonomi', 'ekonomi', '💰', '#f59e0b', 2),
            (3, 'Teknoloji', 'teknoloji', '💻', '#6366f1', 3),
            (4, 'Eğlence', 'eglence', '🎬', '#8b5cf6', 4),
            (5, 'Siyaset', 'siyaset', '🏛️', '#ef4444', 5),
            (6, 'Dünya', 'dunya', '🌍', '#06b6d4', 6)
        `);
        console.log('✅ Varsayılan kategoriler eklendi');

        // Varsayılan rozetleri ekle
        await connection.query(`
            INSERT IGNORE INTO rozetler (id, ad, aciklama, ikon, kosul_tip, kosul_deger, bi_odul) VALUES
            (1, 'İlk Tahmin', 'İlk tahminini yaptın!', '🎯', 'tahmin_sayisi', 1, 100),
            (2, '10 Tahmin', '10 tahmin yaptın!', '🔥', 'tahmin_sayisi', 10, 250),
            (3, '100 Tahmin', '100 tahmin yaptın!', '⭐', 'tahmin_sayisi', 100, 1000),
            (4, '7 Gün Seri', '7 gün üst üste giriş yaptın!', '📅', 'giris_serisi', 7, 500),
            (5, '30 Gün Seri', '30 gün üst üste giriş yaptın!', '🏆', 'giris_serisi', 30, 2000),
            (6, '%80 Doğruluk', '%80 doğruluk oranına ulaştın!', '🎯', 'dogruluk_orani', 80, 1500),
            (7, '5 Arkadaş', '5 arkadaş edindin!', '👥', 'arkadas_sayisi', 5, 500),
            (8, '10K bi!', '10.000 bi! coin biriktirdin!', '💰', 'bi_coin', 10000, 1000)
        `);
        console.log('✅ Varsayılan rozetler eklendi');

        // Varsayılan görevleri ekle
        await connection.query(`
            INSERT IGNORE INTO gorevler (id, ad, aciklama, tip, kosul_tip, kosul_deger, bi_odul, xp_odul, ikon, link, sira) VALUES
            (1, '5 Tahmin Yap', 'Bugün 5 tahmin yap', 'gunluk', 'gunluk_tahmin', 5, 100, 50, '🎯', NULL, 1),
            (2, 'Giriş Yap', 'Bugün giriş yap', 'gunluk', 'giris', 1, 50, 25, '📅', NULL, 2),
            (3, '3 Doğru Tahmin', 'Bugün 3 doğru tahmin yap', 'gunluk', 'gunluk_dogru', 3, 200, 100, '✅', NULL, 3),
            (4, '20 Tahmin Yap', 'Bu hafta 20 tahmin yap', 'haftalik', 'haftalik_tahmin', 20, 500, 250, '🔥', NULL, 1),
            (5, 'Arkadaş Davet Et', '3 arkadaş davet et', 'haftalik', 'davet', 3, 1500, 500, '👥', NULL, 2),
            (6, 'Top 100', 'Sıralamada ilk 100e gir', 'ozel', 'siralama', 100, 5000, 2000, '🏆', NULL, 1),
            (7, 'Google Hesabı Bağla', 'Google hesabını bağlayarak hızlı giriş yap', 'baslangic', 'google_bagli', 1, 300, 100, '🔴', '/auth/google', 1),
            (8, 'Facebook Hesabı Bağla', 'Facebook hesabını bağlayarak hızlı giriş yap', 'baslangic', 'facebook_bagli', 1, 300, 100, '🔵', '/auth/facebook', 2),
            (9, 'Twitter Takip Et', '@bilemezsin hesabını takip et', 'sosyal', 'twitter_takip', 1, 100, 50, '🐦', 'https://twitter.com/bilemezsin', 1),
            (10, 'Instagram Takip Et', '@bilemezsin hesabını takip et', 'sosyal', 'instagram_takip', 1, 100, 50, '📸', 'https://instagram.com/bilemezsin', 2),
            (11, 'Profili Tamamla', 'Profil bilgilerini doldur', 'baslangic', 'profil_tamamla', 1, 200, 100, '👤', '/profil', 3),
            (12, 'İlk Tahminini Yap', 'Platformda ilk tahminini yap', 'baslangic', 'ilk_tahmin', 1, 150, 75, '🎯', '/tahminler', 4)
        `);
        console.log('✅ Varsayılan görevler eklendi');

        // Varsayılan mağaza ürünleri ekle
        await connection.query(`
            INSERT IGNORE INTO magaza_urunleri (id, ad, aciklama, tip, fiyat_bi, stok, gorsel) VALUES
            (1, 'Premium Üyelik (1 Ay)', 'Reklamsız deneyim, özel rozetler ve 2x XP kazanımı', 'premium', 5000, -1, '/images/shop/premium.png'),
            (2, '500 bi! Coin', 'Hesabınıza 500 bi! coin yüklenir', 'dijital', 0, -1, '/images/shop/coin.png'),
            (3, 'Özel Profil Çerçevesi', 'Profilinize özel altın çerçeve', 'dijital', 2000, -1, '/images/shop/frame.png'),
            (4, 'Çekiliş Bileti', 'Aylık büyük ödül çekilişine katılım', 'cekilis', 1000, 100, '/images/shop/ticket.png'),
            (5, 'Bilemezsin T-Shirt', 'Özel tasarım Bilemezsin t-shirt', 'fiziksel', 8000, 50, '/images/shop/tshirt.png'),
            (6, 'XP Boost (7 Gün)', '7 gün boyunca 2x XP kazanın', 'dijital', 1500, -1, '/images/shop/xp-boost.png'),
            (7, 'İsim Rengi Değiştir', 'Kullanıcı adınızı renkli yapın', 'dijital', 3000, -1, '/images/shop/name-color.png'),
            (8, 'VIP Rozeti', 'Profilinizde VIP rozeti gösterin', 'dijital', 10000, -1, '/images/shop/vip.png')
        `);
        console.log('✅ Varsayılan mağaza ürünleri eklendi');

        // Varsayılan admin kullanıcısı oluştur
        const adminExists = await connection.query('SELECT id FROM kullanicilar WHERE email = ?', ['admin@bilemezsin.com']);
        if (adminExists[0].length === 0) {
            const hashedPassword = await bcrypt.hash('Admin123!', 10);
            await connection.query(`
                INSERT INTO kullanicilar (email, sifre, ad_soyad, kullanici_adi, rol, bi_coin, dogrulanmis_mi, giris_yontemi)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, ['admin@bilemezsin.com', hashedPassword, 'Admin', 'admin', 'superadmin', 100000, 1, 'local']);
            console.log('✅ Varsayılan admin kullanıcısı oluşturuldu (admin@bilemezsin.com / Admin123!)');
        }

        // Örnek tahminler ekle
        await connection.query(`
            INSERT IGNORE INTO tahminler (id, kategori_id, baslik, aciklama, tip, bi_odul, durum, bitis_tarihi, olusturan_id) VALUES
            (1, 1, 'Galatasaray bu hafta maçını kazanır mı?', 'Süper Lig 15. hafta maçı', 'evet_hayir', 100, 'aktif', DATE_ADD(NOW(), INTERVAL 3 DAY), 1),
            (2, 1, 'Fenerbahçe vs Beşiktaş derbi skoru ne olur?', 'Süper Lig derbisi', 'coktan_secmeli', 150, 'aktif', DATE_ADD(NOW(), INTERVAL 5 DAY), 1),
            (3, 2, 'Dolar 35 TL yi geçer mi bu ay?', 'Ekonomi tahmini', 'evet_hayir', 200, 'aktif', DATE_ADD(NOW(), INTERVAL 15 DAY), 1),
            (4, 3, 'Apple yeni iPhone modelini bu çeyrekte tanıtır mı?', 'Teknoloji haberleri', 'evet_hayir', 120, 'aktif', DATE_ADD(NOW(), INTERVAL 30 DAY), 1),
            (5, 4, 'Bu yılın en çok izlenen filmi hangisi olur?', 'Sinema tahminleri', 'coktan_secmeli', 300, 'aktif', DATE_ADD(NOW(), INTERVAL 60 DAY), 1),
            (6, 1, 'Milli takım Euro 2024te kaçıncı olur?', 'Milli takım performansı', 'coktan_secmeli', 500, 'aktif', DATE_ADD(NOW(), INTERVAL 90 DAY), 1)
        `);
        console.log('✅ Örnek tahminler eklendi');

        connection.release();
        return true;
    } catch (error) {
        connection.release();
        console.error('❌ Tablo oluşturma hatası:', error);
        throw error;
    }
};

// Query helper
const query = async (sql, params) => {
    try {
        const [results] = await pool.execute(sql, params);
        return results;
    } catch (error) {
        console.error('Query error:', error);
        throw error;
    }
};

// Get single row
const getOne = async (sql, params) => {
    const results = await query(sql, params);
    return results[0] || null;
};

// Get multiple rows
const getAll = async (sql, params) => {
    return await query(sql, params);
};

// Insert and get ID
const insert = async (sql, params) => {
    const results = await query(sql, params);
    return results.insertId;
};

// Update/Delete and get affected rows
const execute = async (sql, params) => {
    const results = await query(sql, params);
    return results.affectedRows;
};

module.exports = {
    pool,
    testConnection,
    createTables,
    query,
    getOne,
    getAll,
    insert,
    execute
};
