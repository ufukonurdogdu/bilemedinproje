// Theme Management
const ThemeManager = {
    init() {
        this.lightBtn = document.getElementById('lightBtn');
        this.darkBtn = document.getElementById('darkBtn');
        this.html = document.documentElement;
        
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            this.setTheme(savedTheme);
        } else {
            this.autoDetectTheme();
        }
        
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

// Notification Manager
const NotificationManager = {
    async loadUnreadCount() {
        try {
            const response = await fetch('/api/bildirimler');
            const data = await response.json();
            
            if (data.success && data.okunmamis > 0) {
                const dot = document.querySelector('.notification-dot');
                if (dot) {
                    dot.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Notification error:', error);
        }
    },
    
    async markAsRead(id) {
        try {
            await fetch(`/api/bildirimler/${id}/okundu`, { method: 'POST' });
        } catch (error) {
            console.error('Mark read error:', error);
        }
    },
    
    async markAllAsRead() {
        try {
            await fetch('/api/bildirimler/tumunu-oku', { method: 'POST' });
            const dot = document.querySelector('.notification-dot');
            if (dot) {
                dot.style.display = 'none';
            }
        } catch (error) {
            console.error('Mark all read error:', error);
        }
    }
};

// Profile Stats Animation
const StatsAnimation = {
    init() {
        const statValues = document.querySelectorAll('.profile-stat-value, .stat-value');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateValue(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        });
        
        statValues.forEach(el => observer.observe(el));
    },
    
    animateValue(el) {
        const text = el.textContent;
        const match = text.match(/[\d,\.]+/);
        if (!match) return;
        
        const target = parseInt(match[0].replace(/[,\.]/g, ''));
        const duration = 1000;
        const start = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(target * easeOut);
            
            el.textContent = text.replace(match[0], current.toLocaleString('tr-TR'));
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                el.textContent = text;
            }
        };
        
        requestAnimationFrame(animate);
    }
};

// Progress Bar Animation
const ProgressAnimation = {
    init() {
        const progressBars = document.querySelectorAll('.level-fill, .mission-progress-fill');
        
        progressBars.forEach(bar => {
            const width = bar.style.width;
            bar.style.width = '0';
            
            setTimeout(() => {
                bar.style.transition = 'width 1s ease-out';
                bar.style.width = width;
            }, 300);
        });
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

// Tab Functionality
const TabManager = {
    init() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const tabGroup = this.closest('.tabs');
                tabGroup.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                const tab = this.dataset.tab;
                const contentArea = this.closest('.card') || document;
                
                contentArea.querySelectorAll('[data-status]').forEach(item => {
                    if (tab === 'tum') {
                        item.style.display = 'flex';
                    } else if (tab === 'aktif') {
                        item.style.display = item.dataset.status === 'aktif' ? 'flex' : 'none';
                    } else {
                        item.style.display = item.dataset.status === 'sonuclandi' ? 'flex' : 'none';
                    }
                });
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, message: 'Bir hata oluştu' };
        }
    }
};

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

// Add animations
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
    NotificationManager.loadUnreadCount();
    StatsAnimation.init();
    ProgressAnimation.init();
    AlertManager.init();
    TabManager.init();
});
