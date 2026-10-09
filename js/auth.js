/**
 * NEXORA - Authentication & User Profile Logic (auth.js)
 * Manages Sign In, Sign Up, Session State, and Order History Dashboard.
 */

(function() {
    'use strict';

    // 1. Constants & Assets
    const FALLBACK_IMG = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'%3E%3Crect width='300' height='300' fill='%23f1f5f9'/%3E%3Cpath d='M110 130a20 20 0 1 0 0-40 20 20 0 0 0 0 40zm10 20l-45 60h150l-45-60-30 40-30-40z' fill='%23cbd5e1'/%3E%3Ctext x='50%25' y='80%25' font-family='sans-serif' font-size='14' font-weight='bold' fill='%2394a3b8' text-anchor='middle'%3ENEXORA%3C/text%3E%3C/svg%3E";

    // 2. Storage Helpers
    function safeParse(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed !== null && parsed !== undefined ? parsed : fallback;
        } catch (e) {
            console.warn(`[NEXORA Storage] Error parsing "${key}":`, e);
            return fallback;
        }
    }

    function safeSet(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error(`[NEXORA Storage] Quota exceeded or error saving "${key}":`, e);
            showToast('Unable to save settings. Local storage may be full.', 'error');
            return false;
        }
    }

    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatPrice(amount) {
        const val = Number(amount) || 0;
        return '₹' + Math.round(val).toLocaleString('en-IN');
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'fa-circle-info';
        if (type === 'success') icon = 'fa-circle-check';
        if (type === 'error') icon = 'fa-circle-exclamation';

        toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <span>${escapeHTML(message)}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-fade');
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 3200);
    }

    // 3. Header Badges & Auth Display
    function updateHeaderBadges() {
        const cart = safeParse('nexora_cart', []);
        const totalCartItems = cart.reduce((acc, item) => acc + (Number(item.quantity) || 1), 0);
        const cartBadge = document.getElementById('cart-count');
        if (cartBadge) cartBadge.textContent = totalCartItems;

        const wishlist = safeParse('nexora_wishlist', []);
        const wishBadge = document.getElementById('wishlist-count');
        if (wishBadge) wishBadge.textContent = Array.isArray(wishlist) ? wishlist.length : 0;

        const currentUser = safeParse('nexora_current_user', null);
        const navUserLabel = document.getElementById('nav-user-label');
        if (navUserLabel) {
            if (currentUser && currentUser.name) {
                navUserLabel.textContent = currentUser.name.split(' ')[0];
                navUserLabel.title = `Signed in as ${currentUser.name}`;
            } else {
                navUserLabel.textContent = 'Sign In';
            }
        }
    }

    // 4. Main Auth & Profile View Renderers
    let currentAuthTab = 'login'; // 'login' or 'register'

    function renderAuthView() {
        const container = document.getElementById('auth-main-container');
        if (!container) return;

        const currentUser = safeParse('nexora_current_user', null);

        if (currentUser && currentUser.name) {
            renderProfileDashboard(container, currentUser);
        } else {
            renderAuthForms(container);
        }

        updateHeaderBadges();
    }

    function renderAuthForms(container) {
        container.innerHTML = `
            <div class="auth-card">
                <div class="auth-tabs">
                    <button type="button" class="auth-tab-btn ${currentAuthTab === 'login' ? 'active' : ''}" id="tab-login-btn">
                        <i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In
                    </button>
                    <button type="button" class="auth-tab-btn ${currentAuthTab === 'register' ? 'active' : ''}" id="tab-register-btn">
                        <i class="fa-solid fa-user-plus"></i> Create Account
                    </button>
                </div>

                <div class="auth-body">
                    <!-- Login Form -->
                    <div id="login-section" style="display: ${currentAuthTab === 'login' ? 'block' : 'none'};">
                        <form id="login-form" class="auth-form" novalidate>
                            <div class="form-group">
                                <label for="login-email">Email Address</label>
                                <input type="email" id="login-email" placeholder="name@example.com" required autocomplete="email">
                            </div>

                            <div class="form-group">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <label for="login-password">Password</label>
                                    <a href="#" style="font-size: 12px; color: var(--primary-color); text-decoration: none;" onclick="alert('Demo reset instructions sent to email.'); return false;">Forgot?</a>
                                </div>
                                <input type="password" id="login-password" placeholder="••••••••" required autocomplete="current-password">
                            </div>

                            <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-muted);">
                                <input type="checkbox" id="login-remember" checked style="width: auto;">
                                <label for="login-remember" style="margin: 0; font-weight: normal; cursor: pointer;">Stay signed in on this device</label>
                            </div>

                            <button type="submit" class="auth-btn-primary">
                                <i class="fa-solid fa-lock"></i> Sign In to NEXORA
                            </button>

                            <div class="demo-auth-box">
                                <p>Recruiter / Fast Demo Access:</p>
                                <button type="button" class="demo-fill-btn" id="demo-fill-btn">
                                    <i class="fa-solid fa-wand-magic-sparkles"></i> Auto-Fill Demo Credentials
                                </button>
                            </div>
                        </form>
                    </div>

                    <!-- Register Form -->
                    <div id="register-section" style="display: ${currentAuthTab === 'register' ? 'block' : 'none'};">
                        <form id="register-form" class="auth-form" novalidate>
                            <div class="form-group">
                                <label for="reg-name">Full Name *</label>
                                <input type="text" id="reg-name" placeholder="e.g. Rahul Sharma" required autocomplete="name">
                            </div>

                            <div class="form-group">
                                <label for="reg-email">Email Address *</label>
                                <input type="email" id="reg-email" placeholder="name@example.com" required autocomplete="email">
                            </div>

                            <div class="form-group">
                                <label for="reg-phone">Mobile Number *</label>
                                <input type="tel" id="reg-phone" placeholder="10-digit mobile number" maxlength="10" required autocomplete="tel">
                            </div>

                            <div class="form-group">
                                <label for="reg-password">Create Password *</label>
                                <input type="password" id="reg-password" placeholder="At least 6 characters" required autocomplete="new-password">
                            </div>

                            <div class="form-group">
                                <label for="reg-confirm-password">Confirm Password *</label>
                                <input type="password" id="reg-confirm-password" placeholder="Re-enter password" required autocomplete="new-password">
                            </div>

                            <button type="submit" class="auth-btn-primary">
                                <i class="fa-solid fa-user-check"></i> Create NEXORA Account
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        `;

        setupAuthFormListeners();
    }

    function setupAuthFormListeners() {
        const tabLogin = document.getElementById('tab-login-btn');
        const tabReg = document.getElementById('tab-register-btn');
        const loginSec = document.getElementById('login-section');
        const regSec = document.getElementById('register-section');

        if (tabLogin && tabReg) {
            tabLogin.addEventListener('click', () => {
                currentAuthTab = 'login';
                tabLogin.classList.add('active');
                tabReg.classList.remove('active');
                if (loginSec) loginSec.style.display = 'block';
                if (regSec) regSec.style.display = 'none';
            });

            tabReg.addEventListener('click', () => {
                currentAuthTab = 'register';
                tabReg.classList.add('active');
                tabLogin.classList.remove('active');
                if (loginSec) loginSec.style.display = 'none';
                if (regSec) regSec.style.display = 'block';
            });
        }

        // Demo Credentials fill button
        const demoFillBtn = document.getElementById('demo-fill-btn');
        if (demoFillBtn) {
            demoFillBtn.addEventListener('click', () => {
                const email = document.getElementById('login-email');
                const pass = document.getElementById('login-password');
                if (email && pass) {
                    email.value = 'rahul.sharma@nexora.example.com';
                    pass.value = 'NexoraPass2026';
                    showToast('Demo credentials filled. Click Sign In!', 'info');
                }
            });
        }

        // Login Submit
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const emailInput = document.getElementById('login-email');
                const passInput = document.getElementById('login-password');

                const email = emailInput ? emailInput.value.trim() : '';
                const password = passInput ? passInput.value.trim() : '';

                if (!email || !password) {
                    showToast('Please enter both email and password.', 'error');
                    return;
                }

                // Check stored users or allow demo login
                const users = safeParse('nexora_users', []);
                const matched = users.find(u => u.email.toLowerCase() === email.toLowerCase());

                let userToLogin = null;
                if (matched) {
                    if (matched.password === password) {
                        userToLogin = matched;
                    } else {
                        showToast('Incorrect password. Please try again.', 'error');
                        return;
                    }
                } else {
                    // Fallback demo user
                    userToLogin = {
                        name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        email: email,
                        phone: '9876543210',
                        joinedDate: new Date().toISOString()
                    };
                }

                safeSet('nexora_current_user', userToLogin);
                showToast(`Welcome back, ${userToLogin.name}!`, 'success');
                renderAuthView();
            });
        }

        // Register Submit
        const regForm = document.getElementById('register-form');
        if (regForm) {
            regForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = document.getElementById('reg-name').value.trim();
                const email = document.getElementById('reg-email').value.trim();
                const phone = document.getElementById('reg-phone').value.trim();
                const pass = document.getElementById('reg-password').value;
                const confirmPass = document.getElementById('reg-confirm-password').value;

                if (name.length < 2) {
                    showToast('Please provide your full name.', 'error');
                    return;
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    showToast('Please provide a valid email address.', 'error');
                    return;
                }

                const phoneClean = phone.replace(/\D/g, '');
                if (phoneClean.length !== 10) {
                    showToast('Please provide a 10-digit mobile number.', 'error');
                    return;
                }

                if (pass.length < 6) {
                    showToast('Password must be at least 6 characters.', 'error');
                    return;
                }

                if (pass !== confirmPass) {
                    showToast('Passwords do not match.', 'error');
                    return;
                }

                const users = safeParse('nexora_users', []);
                if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
                    showToast('An account with this email already exists. Please Sign In.', 'error');
                    return;
                }

                const newUser = {
                    name,
                    email,
                    phone: phoneClean,
                    password: pass,
                    joinedDate: new Date().toISOString()
                };

                users.push(newUser);
                safeSet('nexora_users', users);
                safeSet('nexora_current_user', {
                    name: newUser.name,
                    email: newUser.email,
                    phone: newUser.phone,
                    joinedDate: newUser.joinedDate
                });

                showToast(`Account created! Welcome to NEXORA, ${newUser.name}.`, 'success');
                renderAuthView();
            });
        }
    }

    function renderProfileDashboard(container, user) {
        const orders = safeParse('nexora_orders', []);
        const cart = safeParse('nexora_cart', []);
        const totalCartItems = cart.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
        const wishlist = safeParse('nexora_wishlist', []);

        const initials = user.name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || 'NX';

        container.innerHTML = `
            <div class="auth-card">
                <!-- Profile Header -->
                <div class="profile-header">
                    <div class="profile-avatar">${escapeHTML(initials)}</div>
                    <div class="profile-info">
                        <h2>${escapeHTML(user.name)}</h2>
                        <p><i class="fa-regular fa-envelope"></i> ${escapeHTML(user.email)} &bull; <i class="fa-solid fa-phone"></i> +91 ${escapeHTML(user.phone || '9876543210')}</p>
                        <span style="display: inline-block; margin-top: 6px; background: rgba(37,99,235,0.15); color: var(--primary-color); font-weight: 700; font-size: 12px; padding: 3px 10px; border-radius: 20px;">
                            <i class="fa-solid fa-crown"></i> NEXORA Prime Member
                        </span>
                    </div>
                    <div>
                        <button type="button" class="reset-filter-btn" id="sign-out-btn" style="padding: 10px 18px; font-size: 13.5px; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-arrow-right-from-bracket"></i> Sign Out
                        </button>
                    </div>
                </div>

                <!-- Stats Row -->
                <div class="profile-stats-row">
                    <div class="stat-card">
                        <div class="stat-card-number">${orders.length}</div>
                        <div class="stat-card-label">Total Orders Placed</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-number">${wishlist.length}</div>
                        <div class="stat-card-label">Saved in Wishlist</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-number">${totalCartItems}</div>
                        <div class="stat-card-label">Items in Cart</div>
                    </div>
                </div>

                <!-- Orders Section -->
                <div class="profile-orders-section">
                    <h3><i class="fa-solid fa-clock-rotate-left"></i> Order History & Tracking</h3>
                    
                    ${orders.length === 0 ? `
                        <div style="text-align: center; padding: 40px 15px; color: var(--text-muted); border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
                            <i class="fa-solid fa-box-open" style="font-size: 44px; margin-bottom: 12px; display: block; opacity: 0.6;"></i>
                            <p style="font-size: 15px; font-weight: 600; margin-bottom: 16px;">No orders placed yet.</p>
                            <a href="../index.html#featured-products" class="place-order-btn" style="text-decoration: none; display: inline-flex; width: auto; padding: 10px 24px; font-size: 14px;">
                                <i class="fa-solid fa-compass"></i> Discover Products
                            </a>
                        </div>
                    ` : `
                        <div class="orders-list">
                            ${orders.map(order => {
                                const orderDate = new Date(order.date).toLocaleDateString('en-IN', {
                                    year: 'numeric', month: 'short', day: 'numeric'
                                });
                                return `
                                    <div class="order-card-item">
                                        <div class="order-card-header">
                                            <div>
                                                <strong>Order #${escapeHTML(order.orderId)}</strong>
                                                <span style="color: var(--text-muted); margin-left: 8px;">Placed on ${orderDate}</span>
                                            </div>
                                            <div>
                                                <span style="background: rgba(16, 185, 129, 0.15); color: var(--success-color); font-weight: 700; padding: 4px 10px; border-radius: 12px; font-size: 12px;">
                                                    <i class="fa-solid fa-circle-check"></i> ${escapeHTML(order.status || 'Confirmed')}
                                                </span>
                                            </div>
                                        </div>
                                        <div class="order-card-body">
                                            ${(order.items || []).map(item => `
                                                <div class="order-product-mini">
                                                    <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}';">
                                                    <div style="flex: 1;">
                                                        <div style="font-size: 14px; font-weight: 700; color: var(--text-main);">${escapeHTML(item.name)}</div>
                                                        <div style="font-size: 12.5px; color: var(--text-muted);">Qty: ${item.quantity} &bull; ${formatPrice(item.price)} each</div>
                                                    </div>
                                                </div>
                                            `).join('')}

                                            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 6px; font-size: 14px;">
                                                <span style="color: var(--text-muted);">Payment: <strong>${escapeHTML(order.paymentMethod || 'UPI')}</strong></span>
                                                <span>Total Paid: <strong style="color: var(--primary-color); font-size: 16px;">${formatPrice(order.total)}</strong></span>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;

        const signOutBtn = document.getElementById('sign-out-btn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => {
                localStorage.removeItem('nexora_current_user');
                showToast('You have been signed out.', 'info');
                renderAuthView();
            });
        }
    }

    // 5. Cart Drawer Setup
    function setupCartDrawer() {
        const cartBtn = document.getElementById('cart-btn');
        const closeCartBtn = document.getElementById('close-cart-btn');
        const cartOverlay = document.getElementById('cart-overlay');
        const cartDrawer = document.getElementById('cart-drawer');

        function openDrawer() {
            renderCartDrawerItems();
            if (cartDrawer) cartDrawer.classList.add('active');
            if (cartOverlay) cartOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeDrawer() {
            if (cartDrawer) cartDrawer.classList.remove('active');
            if (cartOverlay) cartOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }

        if (cartBtn) cartBtn.addEventListener('click', openDrawer);
        if (closeCartBtn) closeCartBtn.addEventListener('click', closeDrawer);
        if (cartOverlay) cartOverlay.addEventListener('click', closeDrawer);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && cartDrawer && cartDrawer.classList.contains('active')) {
                closeDrawer();
            }
        });
    }

    function renderCartDrawerItems() {
        const itemsContainer = document.getElementById('cart-items');
        const totalEl = document.getElementById('cart-total');
        if (!itemsContainer) return;

        const cart = safeParse('nexora_cart', []);
        if (cart.length === 0) {
            itemsContainer.innerHTML = `
                <div class="empty-cart-state" style="text-align: center; padding: 40px 15px; color: var(--text-muted);">
                    <i class="fa-solid fa-bag-shopping" style="font-size: 40px; margin-bottom: 12px; display: block;"></i>
                    <p style="font-weight: 600;">Your cart is empty</p>
                </div>
            `;
            if (totalEl) totalEl.textContent = '₹0';
            return;
        }

        let total = 0;
        let html = '';

        cart.forEach(item => {
            const product = (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []).find(p => p.id === Number(item.id));
            if (!product) return;

            const itemTotal = product.price * item.quantity;
            total += itemTotal;

            html += `
                <div class="cart-item">
                    <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}';">
                    <div class="cart-item-info">
                        <div class="cart-item-title">${escapeHTML(product.name)}</div>
                        <div class="cart-item-price">${formatPrice(product.price)}</div>
                        <div class="cart-item-controls">
                            <button type="button" class="quantity-btn" onclick="updateAuthCartQty(${product.id}, ${item.quantity - 1})">-</button>
                            <span class="quantity-value">${item.quantity}</span>
                            <button type="button" class="quantity-btn" onclick="updateAuthCartQty(${product.id}, ${item.quantity + 1})">+</button>
                            <button type="button" class="remove-item-btn" onclick="removeAuthCartItem(${product.id})">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        itemsContainer.innerHTML = html;
        if (totalEl) totalEl.textContent = formatPrice(total);
    }

    window.updateAuthCartQty = function(id, newQty) {
        let cart = safeParse('nexora_cart', []);
        if (newQty <= 0) {
            cart = cart.filter(item => item.id !== id);
        } else {
            const item = cart.find(it => it.id === id);
            if (item) item.quantity = newQty;
        }
        safeSet('nexora_cart', cart);
        renderAuthView();
        renderCartDrawerItems();
    };

    window.removeAuthCartItem = function(id) {
        let cart = safeParse('nexora_cart', []);
        cart = cart.filter(item => item.id !== id);
        safeSet('nexora_cart', cart);
        showToast('Item removed from cart.', 'info');
        renderAuthView();
        renderCartDrawerItems();
    };

    // 6. Theme Toggle
    function setupThemeToggle() {
        const toggleBtn = document.getElementById('theme-toggle-btn');
        const themeIcon = document.getElementById('theme-icon');

        function applyTheme(t) {
            document.documentElement.setAttribute('data-theme', t);
            if (themeIcon) {
                themeIcon.className = t === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            }
        }

        const currentTheme = localStorage.getItem('nexora_theme') || 'light';
        applyTheme(currentTheme);

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const now = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                localStorage.setItem('nexora_theme', now);
                applyTheme(now);
            });
        }
    }

    // 7. Search Redirection
    function setupSearch() {
        const searchInput = document.getElementById('auth-search-input');
        const searchBtn = document.getElementById('auth-search-btn');

        function doSearch() {
            if (!searchInput) return;
            const q = searchInput.value.trim();
            if (q) {
                window.location.href = `../index.html?search=${encodeURIComponent(q)}#featured-products`;
            }
        }

        if (searchBtn) searchBtn.addEventListener('click', doSearch);
        if (searchInput) {
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') doSearch();
            });
        }
    }

    // 8. Cross-Tab Storage Listener
    window.addEventListener('storage', (e) => {
        if (e.key === 'nexora_theme') {
            const t = e.newValue || 'light';
            document.documentElement.setAttribute('data-theme', t);
            const themeIcon = document.getElementById('theme-icon');
            if (themeIcon) themeIcon.className = t === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        } else if (e.key === 'nexora_cart' || e.key === 'nexora_wishlist' || e.key === 'nexora_current_user' || e.key === 'nexora_orders') {
            updateHeaderBadges();
            renderAuthView();
        }
    });

    // 9. Init
    document.addEventListener('DOMContentLoaded', () => {
        setupThemeToggle();
        setupSearch();
        setupCartDrawer();
        renderAuthView();
    });

})();
