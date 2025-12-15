/**
 * Ortak yardımcı fonksiyonlar
 */

// Türkçe karakter dönüşüm haritası
const TURKISH_CHAR_MAP = {
    'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
    'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u'
};

// Yasaklı kullanıcı adları
const BANNED_USERNAMES = [
    'admin', 'administrator', 'moderator', 'mod', 'bilemezsin',
    'support', 'destek', 'system', 'root', 'null', 'undefined',
    'api', 'www', 'mail', 'ftp', 'localhost', 'test'
];

// Kullanıcı adı değiştirme ücreti
const USERNAME_CHANGE_COST = 180;

/**
 * Türkçe karakterleri İngilizce karşılıklarına dönüştürür
 * @param {string} text - Dönüştürülecek metin
 * @returns {string} Dönüştürülmüş metin
 */
function convertTurkishChars(text) {
    if (!text) return '';
    let result = text;
    for (const [tr, en] of Object.entries(TURKISH_CHAR_MAP)) {
        result = result.replace(new RegExp(tr, 'g'), en);
    }
    return result;
}

/**
 * Ad soyad'dan kullanıcı adı oluşturur
 * @param {string} adSoyad - Ad soyad
 * @returns {string} Kullanıcı adı (benzersizlik kontrolü yapılmamış)
 */
function generateBaseUsername(adSoyad) {
    let username = (adSoyad || 'kullanici').toLowerCase();

    // Türkçe karakterleri değiştir
    username = convertTurkishChars(username);

    // Sadece harf ve rakam bırak
    username = username.replace(/[^a-z0-9]/g, '');

    // Minimum 3 karakter
    if (username.length < 3) {
        username = 'kullanici';
    }

    // Maximum 15 karakter
    return username.substring(0, 15);
}

/**
 * Kullanıcı adı validasyonu
 * @param {string} username - Kontrol edilecek kullanıcı adı
 * @returns {{ valid: boolean, message: string }}
 */
function validateUsername(username) {
    if (!username) {
        return { valid: false, message: 'Kullanıcı adı gerekli' };
    }

    const cleanUsername = username.toLowerCase().trim();

    if (cleanUsername.length < 3) {
        return { valid: false, message: 'Kullanıcı adı en az 3 karakter olmalı' };
    }

    if (cleanUsername.length > 20) {
        return { valid: false, message: 'Kullanıcı adı en fazla 20 karakter olabilir' };
    }

    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
        return { valid: false, message: 'Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir' };
    }

    if (BANNED_USERNAMES.includes(cleanUsername)) {
        return { valid: false, message: 'Bu kullanıcı adı kullanılamaz' };
    }

    return { valid: true, message: 'Geçerli' };
}

/**
 * Doğruluk oranı hesapla
 * @param {number} dogru - Doğru tahmin sayısı
 * @param {number} toplam - Toplam tahmin sayısı
 * @returns {number} Yüzdelik oran
 */
function calculateAccuracyRate(dogru, toplam) {
    if (!toplam || toplam === 0) return 0;
    return Math.round((dogru / toplam) * 100);
}

/**
 * Seviye hesapla (doğru tahmin sayısına göre)
 * @param {number} dogruTahmin - Doğru tahmin sayısı
 * @returns {number} Seviye
 */
function calculateLevel(dogruTahmin) {
    if (!dogruTahmin || dogruTahmin < 1) return 1;
    // Her 10 doğru tahmin = 1 seviye
    return Math.floor(dogruTahmin / 10) + 1;
}

/**
 * Tarih formatla (Türkçe)
 * @param {Date|string} date - Tarih
 * @returns {string} Formatlanmış tarih
 */
function formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

/**
 * Zaman farkı (örn: "2 saat önce")
 * @param {Date|string} date - Tarih
 * @returns {string} Zaman farkı
 */
function timeAgo(date) {
    if (!date) return '-';

    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Az önce';
    if (diffMin < 60) return `${diffMin} dakika önce`;
    if (diffHour < 24) return `${diffHour} saat önce`;
    if (diffDay < 7) return `${diffDay} gün önce`;
    if (diffDay < 30) return `${Math.floor(diffDay / 7)} hafta önce`;
    if (diffDay < 365) return `${Math.floor(diffDay / 30)} ay önce`;
    return `${Math.floor(diffDay / 365)} yıl önce`;
}

module.exports = {
    TURKISH_CHAR_MAP,
    BANNED_USERNAMES,
    USERNAME_CHANGE_COST,
    convertTurkishChars,
    generateBaseUsername,
    validateUsername,
    calculateAccuracyRate,
    calculateLevel,
    formatDate,
    timeAgo
};
