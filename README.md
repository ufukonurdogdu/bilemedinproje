# 🎯 Bilemezsin - Tahmin Platformu

Bilemezsin, kullanıcıların güncel olaylar hakkında tahmin yapabildiği, bi! coin kazanabildiği ve sıralamada yarışabildiği eğlenceli bir tahmin platformudur.

## 🚀 Özellikler

- **Tahmin Sistemi**: Evet/Hayır formatında tahminler yapın
- **bi! Coin**: Platform içi sanal para birimi
- **Sıralama**: Haftalık ve genel sıralamada yarışın
- **Görevler**: Günlük ve haftalık görevlerle ödüller kazanın
- **Rozetler**: Başarılarınızı sergileyin
- **Premium**: Özel avantajlar ve özellikler
- **Sosyal Giriş**: Google ve Facebook ile hızlı kayıt

## 📦 Teknolojiler

- **Backend**: Node.js, Express.js
- **Veritabanı**: MySQL
- **View Engine**: EJS
- **Authentication**: Passport.js (Local, Google, Facebook)
- **Styling**: Custom CSS (No Framework)

## 🛠️ Kurulum

### Gereksinimler

- Node.js v18+
- MySQL 8+
- npm veya yarn

### Adımlar

1. **Projeyi klonlayın:**
```bash
git clone https://github.com/kullanici/bilemezsin.git
cd bilemezsin
```

2. **Bağımlılıkları yükleyin:**
```bash
npm install
```

3. **Ortam değişkenlerini ayarlayın:**
```bash
cp .env.example .env
```

`.env` dosyasını düzenleyin:
```env
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000

SESSION_SECRET=guclu-bir-anahtar

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=bilemezsin

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_CALLBACK_URL=http://localhost:3000/auth/facebook/callback
```

4. **MySQL veritabanını oluşturun:**
```sql
CREATE DATABASE bilemezsin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

5. **Uygulamayı başlatın:**
```bash
# Development
npm run dev

# Production
npm start
```

Uygulama `http://localhost:3000` adresinde çalışacaktır.

## 📁 Proje Yapısı

```
bilemezsin/
├── config/
│   ├── database.js      # MySQL bağlantısı ve tablo oluşturma
│   └── passport.js      # Passport stratejileri
├── middleware/
│   └── auth.js          # Yetkilendirme middleware'leri
├── routes/
│   ├── index.js         # Ana sayfa ve public sayfalar
│   ├── auth.js          # Giriş/Kayıt işlemleri
│   ├── dashboard.js     # Kullanıcı paneli
│   ├── admin.js         # Admin paneli
│   └── api.js           # REST API endpoints
├── views/
│   ├── layouts/
│   │   ├── main.ejs     # Ana layout
│   │   ├── auth.ejs     # Giriş/Kayıt layout
│   │   ├── user.ejs     # Kullanıcı paneli layout
│   │   └── admin.ejs    # Admin paneli layout
│   ├── auth/
│   │   ├── giris.ejs
│   │   ├── kayit.ejs
│   │   └── sifremi-unuttum.ejs
│   ├── admin/
│   │   ├── dashboard.ejs
│   │   ├── tahminler.ejs
│   │   ├── kullanicilar.ejs
│   │   ├── kategoriler.ejs
│   │   └── ayarlar.ejs
│   ├── user/
│   │   ├── dashboard.ejs
│   │   ├── tahminler.ejs
│   │   ├── siralama.ejs
│   │   ├── magaza.ejs
│   │   ├── gorevler.ejs
│   │   └── profil.ejs
│   ├── pages/
│   │   ├── hakkimizda.ejs
│   │   ├── iletisim.ejs
│   │   ├── gizlilik.ejs
│   │   └── kullanim-sartlari.ejs
│   ├── errors/
│   │   ├── 404.ejs
│   │   └── 500.ejs
│   └── index.ejs        # Ana sayfa
├── public/
│   ├── css/
│   └── js/
├── app.js               # Express uygulaması
├── package.json
├── .env.example
└── README.md
```

## 🔐 API Endpoints

### Public
- `GET /api/tahminler` - Aktif tahminleri listele
- `GET /api/tahminler/:id` - Tek tahmin detayı
- `GET /api/kategoriler` - Kategorileri listele
- `GET /api/siralama` - Sıralamayı getir

### Authenticated
- `POST /api/tahminler/:id/tahmin-yap` - Tahmin yap
- `GET /api/profil` - Kullanıcı profili
- `GET /api/bildirimler` - Bildirimleri getir
- `POST /api/bildirimler/:id/okundu` - Bildirimi okundu işaretle

### Admin
- `GET /api/admin/istatistikler` - Dashboard istatistikleri

## 👤 Kullanıcı Rolleri

| Rol | Yetkiler |
|-----|----------|
| `kullanici` | Tahmin yapma, profil düzenleme |
| `moderator` | + Tahmin onaylama |
| `admin` | + Kullanıcı yönetimi, tahmin ekleme |
| `superadmin` | + Sistem ayarları |

## 🎮 bi! Coin Sistemi

- **Kayıt Bonusu**: 1.000 bi!
- **Doğru Tahmin**: Tahmine göre değişken
- **Günlük Görevler**: 50-200 bi!
- **Haftalık Görevler**: 500-1.500 bi!
- **Giriş Serisi**: Artan bonus

## 📝 Lisans

Bu proje özel kullanım içindir.

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing`)
5. Pull Request açın

---

**Bilemezsin** - Türkiye'nin En Eğlenceli Tahmin Platformu 🎯
