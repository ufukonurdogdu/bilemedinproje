// Theme Management
const ThemeManager = {
    init() {
        this.lightBtn = document.getElementById('lightBtn');
        this.darkBtn = document.getElementById('darkBtn');
        this.html = document.documentElement;
        
        // Load saved theme or auto-detect
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            this.setTheme(savedTheme);
        } else {
            this.autoDetectTheme();
        }
        
        // Event listeners
        if (this.lightBtn) {
            this.lightBtn.addEventListener('click', () => this.setTheme('light'));
        }
        if (this.darkBtn) {
            this.darkBtn.addEventListener('click', () => this.setTheme('dark'));
        }
    },
    
    autoDetectTheme() {
        const hour = new Date().getHours();
        const theme = (hour >= 7 && hour < 19) ? 'light' : 'dark';
        this.setTheme(theme);
    },
    
    setTheme(theme) {
        this.html.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        if (this.lightBtn && this.darkBtn) {
            this.lightBtn.classList.toggle('active', theme === 'light');
            this.darkBtn.classList.toggle('active', theme === 'dark');
        }
    }
};

// Alert Auto-dismiss
const AlertManager = {
    init() {
        const alerts = document.querySelectorAll('.alert');
        alerts.forEach(alert => {
            setTimeout(() => {
                alert.style.opacity = '0';
                alert.style.transform = 'translateY(-10px)';
                setTimeout(() => alert.remove(), 300);
            }, 5000);
        });
    }
};

// Form Validation
const FormValidator = {
    init() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            form.addEventListener('submit', (e) => this.validate(e));
        });
    },
    
    validate(e) {
        const form = e.target;
        const inputs = form.querySelectorAll('input[required]');
        let isValid = true;
        
        inputs.forEach(input => {
            if (!input.value.trim()) {
                isValid = false;
                input.style.borderColor = '#ef4444';
            } else {
                input.style.borderColor = '';
            }
        });
        
        // Password confirmation check
        const password = form.querySelector('input[name="sifre"]');
        const passwordConfirm = form.querySelector('input[name="sifre_tekrar"]');
        
        if (password && passwordConfirm) {
            if (password.value !== passwordConfirm.value) {
                isValid = false;
                passwordConfirm.style.borderColor = '#ef4444';
            }
        }
        
        if (!isValid) {
            e.preventDefault();
        }
    }
};

// Smooth Scroll
const SmoothScroll = {
    init() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }
};

// API Helper
const API = {
    async get(url) {
        try {
            const response = await fetch(url);
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, message: 'Bir hata oluştu' };
        }
    },
    
    async post(url, data) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, message: 'Bir hata oluştu' };
        }
    }
};

// Tahmin Yap Function
async function tahminYap(tahminId, secim) {
    const result = await API.post(`/api/tahminler/${tahminId}/tahmin-yap`, { secim });
    
    if (result.success) {
        showToast('Tahminin kaydedildi!', 'success');
        setTimeout(() => location.reload(), 1000);
    } else {
        showToast(result.message || 'Bir hata oluştu', 'error');
    }
}

// Toast Notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 16px 24px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1'};
        color: white;
        border-radius: 8px;
        font-weight: 500;
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add CSS for toast animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
    AlertManager.init();
    FormValidator.init();
    SmoothScroll.init();
});
