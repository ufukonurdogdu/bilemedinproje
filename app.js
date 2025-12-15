require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const passport = require('passport');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');

// Database
const db = require('./config/database');

// Passport Config
require('./config/passport')(passport);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.BASE_URL,
        methods: ["GET", "POST"]
    }
});

// Socket.io'yu global yap
app.set('io', io);

// Trust proxy (Apache/Nginx arkasında çalışıyorsa gerekli)
app.set('trust proxy', 1);

// EJS Setup
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');

// Body Parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 gün
    }
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Flash Messages
app.use(flash());

// Global Variables - Güncel kullanıcı verisi için
app.use(async (req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.baseUrl = process.env.BASE_URL;

    // Kullanıcı giriş yapmışsa güncel veriyi çek
    if (req.user && req.user.id) {
        try {
            const freshUser = await db.getOne(
                'SELECT id, ad_soyad, kullanici_adi, email, avatar, bio, rol, bi_coin, seviye, xp, google_id, facebook_id FROM kullanicilar WHERE id = ?',
                [req.user.id]
            );
            res.locals.user = freshUser || req.user;
        } catch (err) {
            res.locals.user = req.user;
        }
    } else {
        res.locals.user = null;
    }

    next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/', require('./routes/user'));
app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));
app.use('/admin', require('./routes/admin'));
app.use('/gorevler', require('./routes/gorevler'));

// 404 Handler
app.use((req, res) => {
    // API istekleri için JSON response
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            message: 'Endpoint bulunamadı'
        });
    }
    res.status(404).render('errors/404', {
        title: 'Sayfa Bulunamadı',
        layout: 'layouts/main'
    });
});

// Error Handler
app.use((err, req, res, next) => {
    // Hata logla
    console.error('❌ Hata:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    // API istekleri için JSON response
    if (req.path.startsWith('/api/')) {
        return res.status(err.status || 500).json({
            success: false,
            message: process.env.NODE_ENV === 'development' ? err.message : 'Sunucu hatası'
        });
    }

    res.status(err.status || 500).render('errors/500', {
        title: 'Sunucu Hatası',
        layout: 'layouts/main'
    });
});

const PORT = process.env.PORT || 3000;

// Socket.io bağlantı yönetimi
io.on('connection', (socket) => {
    console.log('🔌 Yeni bağlantı:', socket.id);

    // Kullanıcı odasına katıl
    socket.on('join', (userId) => {
        if (userId) {
            socket.join(`user_${userId}`);
            console.log(`👤 Kullanıcı ${userId} odaya katıldı`);
        }
    });

    // Genel odaya katıl (sıralama vb. için)
    socket.on('joinLeaderboard', () => {
        socket.join('leaderboard');
    });

    socket.on('disconnect', () => {
        console.log('🔌 Bağlantı koptu:', socket.id);
    });
});

// bi! coin güncelleme fonksiyonu (global)
global.updateUserBiCoin = async (userId, newBalance) => {
    io.to(`user_${userId}`).emit('biCoinUpdate', { bi_coin: newBalance });
};

// Sıralama güncelleme fonksiyonu (global)
global.updateLeaderboard = async () => {
    try {
        const topUsers = await db.getAll(`
            SELECT id, kullanici_adi, ad_soyad, avatar, bi_coin, seviye, dogru_tahmin, toplam_tahmin
            FROM kullanicilar
            WHERE banlandi_mi = 0
            ORDER BY bi_coin DESC
            LIMIT 100
        `);
        io.to('leaderboard').emit('leaderboardUpdate', topUsers);
    } catch (err) {
        console.error('Sıralama güncelleme hatası:', err);
    }
};

// Veritabanı tablolarını oluştur ve sunucuyu başlat
const initializeApp = async () => {
    try {
        await db.createTables();
        console.log('✅ Veritabanı tabloları hazır');

        server.listen(PORT, () => {
            console.log(`🚀 Sunucu ${PORT} portunda çalışıyor`);
            console.log(`🌐 ${process.env.BASE_URL}`);
            console.log(`🔌 Socket.io aktif`);
        });
    } catch (err) {
        console.error('❌ Başlatma hatası:', err);
        process.exit(1);
    }
};

initializeApp();

module.exports = { app, io };
