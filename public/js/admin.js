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
            this.setTheme('light');
        }
        
        if (this.lightBtn) {
            this.lightBtn.addEventListener('click', () => this.setTheme('light'));
        }
        if (this.darkBtn) {
            this.darkBtn.addEventListener('click', () => this.setTheme('dark'));
        }
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

// Sidebar Toggle (for mobile)
const SidebarManager = {
    init() {
        const toggleBtn = document.querySelector('.sidebar-toggle');
        const sidebar = document.querySelector('.sidebar');
        
        if (toggleBtn && sidebar) {
            toggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
        }
    }
};

// Stats Animation
const StatsAnimation = {
    init() {
        const statValues = document.querySelectorAll('.stat-value');
        
        statValues.forEach(el => {
            const target = parseInt(el.textContent.replace(/[,\.]/g, ''));
            if (isNaN(target)) return;
            
            this.animateValue(el, 0, target, 1000);
        });
    },
    
    animateValue(el, start, end, duration) {
        const startTime = performance.now();
        const format = (n) => n.toLocaleString('tr-TR');
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(start + (end - start) * easeOut);
            
            el.textContent = format(current);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
};

// Search Functionality
const SearchManager = {
    init() {
        const searchInput = document.querySelector('.search-box input');
        if (!searchInput) return;
        
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.search(e.target.value);
            }, 300);
        });
    },
    
    search(query) {
        if (query.length < 2) return;
        
        // Implement search logic based on current page
        console.log('Searching for:', query);
    }
};

// Table Row Actions
const TableActions = {
    init() {
        // Delete confirmation
        document.querySelectorAll('.action-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (!confirm('Bu öğeyi silmek istediğinizden emin misiniz?')) {
                    e.preventDefault();
                }
            });
        });
        
        // Row selection
        const selectAllCheckbox = document.querySelector('th input[type="checkbox"]');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                document.querySelectorAll('td input[type="checkbox"]').forEach(cb => {
                    cb.checked = e.target.checked;
                });
            });
        }
    }
};

// Form Enhancements
const FormEnhancements = {
    init() {
        // Date picker defaults
        document.querySelectorAll('input[type="datetime-local"]').forEach(input => {
            if (!input.value) {
                const now = new Date();
                now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                input.value = now.toISOString().slice(0, 16);
            }
        });
        
        // Character counter for textareas
        document.querySelectorAll('textarea[maxlength]').forEach(textarea => {
            const counter = document.createElement('div');
            counter.className = 'char-counter';
            counter.style.cssText = 'text-align: right; font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;';
            
            textarea.parentNode.appendChild(counter);
            
            const updateCounter = () => {
                const remaining = textarea.maxLength - textarea.value.length;
                counter.textContent = `${remaining} karakter kaldı`;
            };
            
            textarea.addEventListener('input', updateCounter);
            updateCounter();
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

// Filter Buttons
const FilterManager = {
    init() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const filterGroup = this.closest('.filters');
                if (filterGroup) {
                    filterGroup.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                }
                this.classList.add('active');
                
                // Update URL or filter content
                const filter = this.dataset.filter;
                if (filter) {
                    window.location.href = `?durum=${filter}`;
                }
            });
        });
    }
};

// Modal Manager
const ModalManager = {
    open(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    },
    
    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    },
    
    init() {
        // Close modal on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.close(modal.id);
                }
            });
        });
        
        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(modal => {
                    if (modal.style.display === 'flex') {
                        this.close(modal.id);
                    }
                });
            }
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
            showToast('Bir hata oluştu', 'error');
            return { success: false };
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
            showToast('Bir hata oluştu', 'error');
            return { success: false };
        }
    }
};

// Load Stats
async function loadStats() {
    const result = await API.get('/api/admin/istatistikler');
    if (result.success) {
        // Update stat cards if needed
        console.log('Stats loaded:', result.data);
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
    
    .modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    }
    
    .modal-content {
        background: var(--bg-card);
        border-radius: var(--radius);
        padding: 32px;
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
    }
`;
document.head.appendChild(style);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
    SidebarManager.init();
    StatsAnimation.init();
    SearchManager.init();
    TableActions.init();
    FormEnhancements.init();
    AlertManager.init();
    FilterManager.init();
    ModalManager.init();
});
