# BİLEMEZSİN - PROJE ANALİZ RAPORU

**Tarih:** 2025-12-15
**Analiz Yapan:** Claude Code

---

## 📊 GENEL BAKIŞ

**Proje Tipi:** Full-stack Web Uygulaması (Tahmin Platformu)
**Teknoloji:** Node.js, Express.js, MySQL, Socket.io, EJS
**Toplam Dosya:** 43 EJS template, 6 route dosyası, ~3,200 satır kod

---

## 🔴 KRİTİK: ERİŞİLEMEYEN SAYFALAR

Aşağıdaki sayfaların view dosyaları mevcut ancak route tanımları eksik. Kullanıcılar bu sayfalara erişemiyor!

| Sayfa | View Dosyası | Route Dosyası | Durum |
|-------|--------------|---------------|-------|
| **Ayarlar** | `views/user/ayarlar.ejs` | `routes/user.js` | ❌ Route yok |
| **Bi! Geçmişi** | `views/user/bi-gecmisi.ejs` | `routes/user.js` | ❌ Route yok |
| **Görevlerim** | `views/user/gorevlerim.ejs` | `routes/user.js` | ❌ Route yok |
| **Rozetlerim** | `views/user/rozetlerim.ejs` | `routes/user.js` | ❌ Route yok |
| **Tahminlerim** | `views/user/tahminlerim.ejs` | `routes/user.js` | ❌ Route yok |

### Çözüm

`routes/user.js` dosyasına aşağıdaki route'ların eklenmesi gerekiyor:

```javascript
// Ayarlar Sayfası
router.get('/ayarlar', ensureAuthenticated, async (req, res) => {
    res.render('user/ayarlar', {
        title: 'Ayarlar - Bilemezsin',
        layout: false
    });
});

// Bi! Coin Geçmişi
router.get('/bi-gecmisi', ensureAuthenticated, async (req, res) => {
    const islemler = await db.getAll(`
        SELECT * FROM bi_islemleri
        WHERE kullanici_id = ?
        ORDER BY olusturma_tarihi DESC
        LIMIT 50
    `, [req.user.id]);

    res.render('user/bi-gecmisi', {
        title: 'Bi! Geçmişi - Bilemezsin',
        layout: false,
        islemler
    });
});

// Görevlerim (Tamamlanan Görevler)
router.get('/gorevlerim', ensureAuthenticated, async (req, res) => {
    const tamamlananGorevler = await db.getAll(`
        SELECT g.*, kg.tamamlanma_tarihi
        FROM kullanici_gorevleri kg
        JOIN gorevler g ON kg.gorev_id = g.id
        WHERE kg.kullanici_id = ? AND kg.tamamlandi_mi = 1
        ORDER BY kg.tamamlanma_tarihi DESC
    `, [req.user.id]);

    res.render('user/gorevlerim', {
        title: 'Görevlerim - Bilemezsin',
        layout: false,
        gorevler: tamamlananGorevler
    });
});

// Rozetlerim
router.get('/rozetlerim', ensureAuthenticated, async (req, res) => {
    const rozetler = await db.getAll(`
        SELECT r.*, kr.kazanilma_tarihi
        FROM kullanici_rozetleri kr
        JOIN rozetler r ON kr.rozet_id = r.id
        WHERE kr.kullanici_id = ?
        ORDER BY kr.kazanilma_tarihi DESC
    `, [req.user.id]);

    res.render('user/rozetlerim', {
        title: 'Rozetlerim - Bilemezsin',
        layout: false,
        rozetler
    });
});

// Tahminlerim
router.get('/tahminlerim', ensureAuthenticated, async (req, res) => {
    const tahminler = await db.getAll(`
        SELECT kt.*, t.baslik, t.durum as tahmin_durum, t.dogru_cevap,
               k.ad as kategori_adi, k.ikon as kategori_ikon
        FROM kullanici_tahminleri kt
        JOIN tahminler t ON kt.tahmin_id = t.id
        LEFT JOIN kategoriler k ON t.kategori_id = k.id
        WHERE kt.kullanici_id = ?
        ORDER BY kt.olusturma_tarihi DESC
    `, [req.user.id]);

    res.render('user/tahminlerim', {
        title: 'Tahminlerim - Bilemezsin',
        layout: false,
        tahminler
    });
});
```

---

## 🔴 GÜVENLİK SORUNLARI

### 1. Varsayılan Admin Şifresi (KRİTİK)

**Dosya:** `config/database.js:384`

```javascript
// ❌ SORUNLU KOD
const hashedPassword = await bcrypt.hash('Admin123!', 10);
```

**Çözüm:** Şifreyi environment variable'dan al:
```javascript
const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin123!';
const hashedPassword = await bcrypt.hash(adminPassword, 10);
```

### 2. CSRF Koruması Yok

**Dosya:** `app.js`

Tüm POST istekleri CSRF saldırılarına açık.

**Çözüm:**
```bash
npm install csurf
```
```javascript
const csrf = require('csurf');
app.use(csrf());
```

### 3. Rate Limiting Yok

**Dosya:** `app.js`

Login ve kayıt formları brute force saldırılarına açık.

**Çözüm:**
```bash
npm install express-rate-limit
```
```javascript
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 100 // IP başına istek limiti
});
app.use('/auth', limiter);
```

### 4. Session Store Yok

**Dosya:** `app.js:46`

Memory store kullanılıyor. Production ortamında memory leak ve veri kaybı riski.

**Çözüm:**
```bash
npm install connect-redis redis
```

---

## 🟠 EKSİK İŞLEVSELLİK

| Özellik | Mevcut Durum | Eksik |
|---------|--------------|-------|
| **Şifre Sıfırlama** | GET route var | POST işlemi, token oluşturma, email gönderimi |
| **Arkadaşlık Sistemi** | DB tablosu var | Tüm route'lar (istek gönder, kabul et, reddet, liste) |
| **İletişim Formu** | Sayfa var | POST işlemi, email gönderimi |
| **Kategori Yönetimi** | Liste var | Ekleme, düzenleme, silme |
| **Reklam Yönetimi** | Liste var | CRUD işlemleri |

---

## 🟠 VERITABANI SORUNLARI

### 1. ALTER TABLE Syntax Hatası

**Dosya:** `config/database.js:195-202`

```javascript
// ❌ MySQL'de "IF NOT EXISTS" ALTER TABLE ile kullanılamaz
await connection.query(`ALTER TABLE gorevler ADD COLUMN IF NOT EXISTS ikon...`);
```

**Çözüm:** Try-catch ile hata yakala ve geç

### 2. CASCADE Silme Riski

Tahmin silindiğinde tüm kullanıcı tahminleri de siliniyor. Bu veri kaybına yol açabilir.

---

## 🟡 KOD KALİTESİ

### 1. Tutarsız Layout Kullanımı

- Bazı sayfalar: `layout: false`
- Bazı sayfalar: `layout: 'layouts/main'`
- Bazı sayfalar: `layout: 'layouts/user'`

### 2. Debug Console.log

Production'da temizlenmesi gereken debug logları:
- `routes/user.js` - `console.log('📄 Profil...')`
- `routes/auth.js` - `console.log('✅ Google OAuth...')`
- `app.js` - `console.log('🔌 Yeni bağlantı...')`

### 3. Türkçe Karakter Tutarsızlığı

`routes/gorevler.js` dosyasında Türkçe karakterler ASCII'ye dönüştürülmüş.

---

## ✅ ÇALIŞAN ÖZELLİKLER

- [x] Ana sayfa ve tahmin listeleme
- [x] Kullanıcı kaydı (Local)
- [x] Google OAuth girişi
- [x] Facebook OAuth girişi
- [x] Tahmin yapma sistemi
- [x] Görevler sistemi
- [x] Mağaza sistemi
- [x] Bildirimler
- [x] Sıralama tablosu
- [x] Admin paneli (temel)
- [x] Socket.io canlı güncellemeler
- [x] Profil düzenleme
- [x] Avatar yükleme

---

## 📋 ÖNCELİKLİ YAPILACAKLAR

### Öncelik 1 (Kritik)
1. [ ] Eksik 5 route'u ekle (ayarlar, bi-gecmisi, gorevlerim, rozetlerim, tahminlerim)
2. [ ] CSRF koruması ekle
3. [ ] Rate limiting ekle
4. [ ] Varsayılan admin şifresini güvenli hale getir

### Öncelik 2 (Önemli)
5. [ ] Şifre sıfırlama özelliğini tamamla
6. [ ] Session store ekle (Redis/MongoDB)
7. [ ] Arkadaşlık sistemi route'larını ekle

### Öncelik 3 (İyileştirme)
8. [ ] Layout kullanımını standardize et
9. [ ] Debug loglarını temizle
10. [ ] Admin panel CRUD işlemlerini tamamla

---

## 📊 ÖZET

| Kategori | Toplam | Sorunlu |
|----------|--------|---------|
| Sayfalar (Views) | 43 | 5 erişilemiyor |
| Route'lar | ~40 | 5 eksik |
| Güvenlik | - | 4 kritik sorun |
| İşlevsellik | - | 5 eksik özellik |

**Genel Durum:** Proje temel olarak çalışıyor ancak 5 sayfa erişilemiyor ve kritik güvenlik açıkları mevcut.
