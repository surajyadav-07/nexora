/**
 * NEXORA - Secure Checkout Logic (checkout.js)
 * Manages order summary, coupon engine, form validation, order persistence & success states.
 */

(function() {
    'use strict';

    // 1. Constants & Fallback Assets
    const FALLBACK_IMG = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'%3E%3Crect width='300' height='300' fill='%23f1f5f9'/%3E%3Cpath d='M110 130a20 20 0 1 0 0-40 20 20 0 0 0 0 40zm10 20l-45 60h150l-45-60-30 40-30-40z' fill='%23cbd5e1'/%3E%3Ctext x='50%25' y='80%25' font-family='sans-serif' font-size='14' font-weight='bold' fill='%2394a3b8' text-anchor='middle'%3ENEXORA%3C/text%3E%3C/svg%3E";

    const VALID_COUPONS = {
        'NEXORA10': { type: 'percent', value: 0.10, desc: '10% Discount on order' },
        'FLAT500': { type: 'flat', value: 500, minOrder: 1500, desc: '₹500 Flat Discount (Min ₹1,500)' },
        'WELCOME50': { type: 'percent', value: 0.05, desc: '5% Welcome Discount' }
    };

    let appliedCoupon = null;
    let selectedPayment = 'UPI / QR Code';

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

    // 3. Badge & Auth State Updates
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

    // 4. Cart Details Calculation
    function getCartDetailed() {
        const cart = safeParse('nexora_cart', []);
        const detailedItems = [];

        cart.forEach(cartItem => {
            const product = (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []).find(p => p.id === Number(cartItem.id));
            if (product) {
                const qty = Math.max(1, Number(cartItem.quantity) || 1);
                detailedItems.push({
                    product,
                    quantity: qty,
                    itemTotal: product.price * qty
                });
            }
        });

        return detailedItems;
    }

    function calculateTotals(items) {
        const subtotal = items.reduce((acc, item) => acc + item.itemTotal, 0);
        
        let discount = 0;
        if (appliedCoupon && subtotal > 0) {
            if (appliedCoupon.type === 'percent') {
                discount = Math.round(subtotal * appliedCoupon.value);
            } else if (appliedCoupon.type === 'flat') {
                discount = Math.min(subtotal, appliedCoupon.value);
            }
        }

        const discountedSubtotal = Math.max(0, subtotal - discount);
        const shipping = subtotal === 0 || subtotal >= 999 ? 0 : 99;
        // 18% standard GST calculation
        const tax = Math.round(discountedSubtotal * 0.18);
        const grandTotal = discountedSubtotal + shipping + tax;

        return { subtotal, discount, shipping, tax, grandTotal };
    }

    // 5. Render Checkout Page
    function renderCheckout() {
        const container = document.getElementById('checkout-container');
        if (!container) return;

        const items = getCartDetailed();

        if (items.length === 0) {
            // Empty Cart State
            container.innerHTML = `
                <div class="checkout-card" style="text-align: center; padding: 60px 20px; max-width: 600px; margin: 40px auto;">
                    <div style="font-size: 64px; color: var(--text-muted); margin-bottom: 20px;">
                        <i class="fa-solid fa-cart-arrow-down"></i>
                    </div>
                    <h2 style="justify-content: center; border: none; font-size: 24px; margin-bottom: 10px;">Your Cart is Empty</h2>
                    <p style="color: var(--text-muted); font-size: 15px; margin-bottom: 28px; line-height: 1.6;">
                        You have no items in your shopping cart to checkout. Explore our premium collection and discover amazing offers today!
                    </p>
                    <a href="../index.html#featured-products" class="place-order-btn" style="text-decoration: none; display: inline-flex; width: auto; padding: 13px 32px;">
                        <i class="fa-solid fa-compass"></i> Explore Catalog
                    </a>
                </div>
            `;
            updateHeaderBadges();
            return;
        }

        const totals = calculateTotals(items);
        const currentUser = safeParse('nexora_current_user', {});

        container.innerHTML = `
            <div class="checkout-grid">
                <!-- Left: Shipping & Payment Form -->
                <div class="checkout-card">
                    <h2><i class="fa-solid fa-truck-fast"></i> Shipping & Delivery Details</h2>
                    <form id="checkout-form" novalidate>
                        <div class="checkout-form-grid">
                            <div class="form-group form-full">
                                <label for="cust-name">Full Name *</label>
                                <input type="text" id="cust-name" placeholder="e.g. Rahul Sharma" value="${escapeHTML(currentUser.name || '')}" required>
                                <span class="field-error" id="error-name">Please enter your full name (at least 2 letters).</span>
                            </div>

                            <div class="form-group">
                                <label for="cust-email">Email Address *</label>
                                <input type="email" id="cust-email" placeholder="name@example.com" value="${escapeHTML(currentUser.email || '')}" required>
                                <span class="field-error" id="error-email">Please enter a valid email address.</span>
                            </div>

                            <div class="form-group">
                                <label for="cust-phone">Mobile Number *</label>
                                <input type="tel" id="cust-phone" placeholder="10-digit number" maxlength="10" value="${escapeHTML(currentUser.phone || '')}" required>
                                <span class="field-error" id="error-phone">Please enter a valid 10-digit mobile number.</span>
                            </div>

                            <div class="form-group form-full">
                                <label for="cust-address">Street Address / Flat / Building *</label>
                                <input type="text" id="cust-address" placeholder="House no, apartment, street name" value="${escapeHTML(currentUser.address || '')}" required>
                                <span class="field-error" id="error-address">Please enter complete street address.</span>
                            </div>

                            <div class="form-group">
                                <label for="cust-city">City *</label>
                                <input type="text" id="cust-city" placeholder="e.g. Mumbai" value="${escapeHTML(currentUser.city || '')}" required>
                                <span class="field-error" id="error-city">Please specify your city.</span>
                            </div>

                            <div class="form-group">
                                <label for="cust-state">State *</label>
                                <select id="cust-state" required>
                                    <option value="">Select State</option>
                                    <option value="Maharashtra" ${currentUser.state === 'Maharashtra' ? 'selected' : ''}>Maharashtra</option>
                                    <option value="Delhi" ${currentUser.state === 'Delhi' ? 'selected' : ''}>Delhi</option>
                                    <option value="Karnataka" ${currentUser.state === 'Karnataka' ? 'selected' : ''}>Karnataka</option>
                                    <option value="Tamil Nadu" ${currentUser.state === 'Tamil Nadu' ? 'selected' : ''}>Tamil Nadu</option>
                                    <option value="Telangana" ${currentUser.state === 'Telangana' ? 'selected' : ''}>Telangana</option>
                                    <option value="Uttar Pradesh" ${currentUser.state === 'Uttar Pradesh' ? 'selected' : ''}>Uttar Pradesh</option>
                                    <option value="Gujarat" ${currentUser.state === 'Gujarat' ? 'selected' : ''}>Gujarat</option>
                                    <option value="West Bengal" ${currentUser.state === 'West Bengal' ? 'selected' : ''}>West Bengal</option>
                                    <option value="Rajasthan" ${currentUser.state === 'Rajasthan' ? 'selected' : ''}>Rajasthan</option>
                                    <option value="Kerala" ${currentUser.state === 'Kerala' ? 'selected' : ''}>Kerala</option>
                                    <option value="Other">Other</option>
                                </select>
                                <span class="field-error" id="error-state">Please select your state.</span>
                            </div>

                            <div class="form-group">
                                <label for="cust-pincode">PIN Code *</label>
                                <input type="text" id="cust-pincode" placeholder="6-digit PIN code" maxlength="6" value="${escapeHTML(currentUser.pincode || '')}" required>
                                <span class="field-error" id="error-pincode">Please enter a valid 6-digit PIN code.</span>
                            </div>

                            <div class="form-group">
                                <label for="cust-landmark">Landmark (Optional)</label>
                                <input type="text" id="cust-landmark" placeholder="Near metro station, park, etc.">
                            </div>
                        </div>

                        <h2 style="margin-top: 35px;"><i class="fa-solid fa-credit-card"></i> Payment Method</h2>
                        <div class="payment-options-grid">
                            <div class="payment-opt-card active" data-method="UPI / QR Code">
                                <i class="fa-solid fa-qrcode"></i>
                                <span>UPI / QR Code</span>
                            </div>
                            <div class="payment-opt-card" data-method="Credit / Debit Card">
                                <i class="fa-solid fa-credit-card"></i>
                                <span>Cards</span>
                            </div>
                            <div class="payment-opt-card" data-method="Cash on Delivery">
                                <i class="fa-solid fa-money-bill-wave"></i>
                                <span>Cash on Delivery</span>
                            </div>
                        </div>

                        <div style="background: rgba(37, 99, 235, 0.05); border: 1px solid rgba(37, 99, 235, 0.2); border-radius: var(--radius-sm); padding: 12px 16px; margin-top: 15px; font-size: 13px; color: var(--text-muted); display: flex; align-items: center; gap: 10px;">
                            <i class="fa-solid fa-shield-halved text-success" style="font-size: 18px;"></i>
                            <span>All transactions are 256-bit encrypted. Official GST Invoice provided upon order dispatch.</span>
                        </div>
                    </form>
                </div>

                <!-- Right: Order Summary & Coupon -->
                <div class="checkout-card">
                    <h2>
                        <i class="fa-solid fa-receipt"></i> 
                        <span>Order Summary</span> 
                        <span style="font-size: 14px; font-weight: 600; color: var(--text-muted); margin-left: auto;">
                            (${items.length} ${items.length === 1 ? 'item' : 'items'})
                        </span>
                    </h2>

                    <!-- Items List -->
                    <div class="checkout-items-list" id="checkout-items-list">
                        ${items.map(item => `
                            <div class="checkout-item-row">
                                <img src="${escapeHTML(item.product.image)}" alt="${escapeHTML(item.product.name)}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}';">
                                <div class="checkout-item-info">
                                    <h4>${escapeHTML(item.product.name)}</h4>
                                    <span>Qty: ${item.quantity} × ${formatPrice(item.product.price)}</span>
                                </div>
                                <div class="checkout-item-price">
                                    ${formatPrice(item.itemTotal)}
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <!-- Coupon Code Input -->
                    <div class="coupon-box">
                        <input type="text" id="coupon-input" placeholder="Coupon Code (e.g. NEXORA10)" value="${appliedCoupon ? appliedCoupon.code : ''}">
                        <button type="button" id="apply-coupon-btn">${appliedCoupon ? 'Applied' : 'Apply'}</button>
                    </div>
                    <div class="coupon-badge" id="coupon-badge" style="display: ${appliedCoupon ? 'block' : 'none'};">
                        <i class="fa-solid fa-circle-check"></i> Applied: <strong>${appliedCoupon ? appliedCoupon.code : ''}</strong> (${appliedCoupon ? appliedCoupon.desc : ''})
                        <button type="button" id="remove-coupon-btn" style="background:none;border:none;color:var(--danger-color);cursor:pointer;margin-left:8px;font-weight:700;text-decoration:underline;">Remove</button>
                    </div>

                    <!-- Cost Breakdown -->
                    <div class="summary-line">
                        <span>Items Subtotal</span>
                        <span>${formatPrice(totals.subtotal)}</span>
                    </div>

                    ${totals.discount > 0 ? `
                        <div class="summary-line" style="color: var(--success-color); font-weight: 700;">
                            <span>Coupon Discount</span>
                            <span>-${formatPrice(totals.discount)}</span>
                        </div>
                    ` : ''}

                    <div class="summary-line">
                        <span>Estimated Shipping</span>
                        <span>${totals.shipping === 0 ? '<strong style="color: var(--success-color);">FREE</strong>' : formatPrice(totals.shipping)}</span>
                    </div>

                    <div class="summary-line">
                        <span>Estimated GST (18%)</span>
                        <span>${formatPrice(totals.tax)}</span>
                    </div>

                    <div class="summary-line summary-total">
                        <span>Total Payable</span>
                        <span style="color: var(--primary-color);">${formatPrice(totals.grandTotal)}</span>
                    </div>

                    <button type="button" id="place-order-btn" class="place-order-btn">
                        <i class="fa-solid fa-lock"></i> Place Order • ${formatPrice(totals.grandTotal)}
                    </button>
                </div>
            </div>
        `;

        setupEventListeners();
        updateHeaderBadges();
    }

    // 6. Interactive Event Handlers
    function setupEventListeners() {
        // Payment option selection
        const paymentCards = document.querySelectorAll('.payment-opt-card');
        paymentCards.forEach(card => {
            card.addEventListener('click', () => {
                paymentCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                selectedPayment = card.getAttribute('data-method') || 'UPI / QR Code';
            });
        });

        // Coupon Apply
        const applyCouponBtn = document.getElementById('apply-coupon-btn');
        const couponInput = document.getElementById('coupon-input');
        if (applyCouponBtn && couponInput) {
            applyCouponBtn.addEventListener('click', () => {
                const code = couponInput.value.trim().toUpperCase();
                if (!code) {
                    showToast('Please enter a coupon code.', 'error');
                    return;
                }

                if (VALID_COUPONS[code]) {
                    const cData = VALID_COUPONS[code];
                    const items = getCartDetailed();
                    const subtotal = items.reduce((acc, it) => acc + it.itemTotal, 0);

                    if (cData.minOrder && subtotal < cData.minOrder) {
                        showToast(`Coupon ${code} requires a minimum order of ${formatPrice(cData.minOrder)}.`, 'error');
                        return;
                    }

                    appliedCoupon = { code, ...cData };
                    showToast(`Coupon "${code}" applied successfully!`, 'success');
                    renderCheckout();
                } else {
                    showToast('Invalid coupon code. Try NEXORA10 or FLAT500.', 'error');
                }
            });
        }

        // Coupon Remove
        const removeCouponBtn = document.getElementById('remove-coupon-btn');
        if (removeCouponBtn) {
            removeCouponBtn.addEventListener('click', () => {
                appliedCoupon = null;
                showToast('Coupon removed.', 'info');
                renderCheckout();
            });
        }

        // Place Order Button click
        const placeOrderBtn = document.getElementById('place-order-btn');
        if (placeOrderBtn) {
            placeOrderBtn.addEventListener('click', handlePlaceOrder);
        }
    }

    // 7. Form Validation & Order Submission
    function handlePlaceOrder(e) {
        if (e) e.preventDefault();

        // Clear previous error messages
        const errorSpans = document.querySelectorAll('.field-error');
        errorSpans.forEach(span => span.style.display = 'none');

        let isValid = true;
        let firstInvalid = null;

        function markInvalid(inputEl, errorId) {
            isValid = false;
            const errEl = document.getElementById(errorId);
            if (errEl) errEl.style.display = 'block';
            if (inputEl) {
                inputEl.style.borderColor = 'var(--danger-color)';
                if (!firstInvalid) firstInvalid = inputEl;
            }
        }

        function resetInput(inputEl) {
            if (inputEl) inputEl.style.borderColor = 'var(--border-color)';
        }

        const nameInput = document.getElementById('cust-name');
        const emailInput = document.getElementById('cust-email');
        const phoneInput = document.getElementById('cust-phone');
        const addressInput = document.getElementById('cust-address');
        const cityInput = document.getElementById('cust-city');
        const stateInput = document.getElementById('cust-state');
        const pincodeInput = document.getElementById('cust-pincode');

        [nameInput, emailInput, phoneInput, addressInput, cityInput, stateInput, pincodeInput].forEach(resetInput);

        // Name validation (min 2 chars)
        if (!nameInput || nameInput.value.trim().length < 2) {
            markInvalid(nameInput, 'error-name');
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailInput || !emailRegex.test(emailInput.value.trim())) {
            markInvalid(emailInput, 'error-email');
        }

        // Phone validation (10 digits)
        const phoneClean = phoneInput ? phoneInput.value.trim().replace(/\D/g, '') : '';
        if (!phoneInput || phoneClean.length !== 10) {
            markInvalid(phoneInput, 'error-phone');
        }

        // Address validation (min 6 chars)
        if (!addressInput || addressInput.value.trim().length < 6) {
            markInvalid(addressInput, 'error-address');
        }

        // City validation
        if (!cityInput || cityInput.value.trim().length < 2) {
            markInvalid(cityInput, 'error-city');
        }

        // State validation
        if (!stateInput || !stateInput.value.trim()) {
            markInvalid(stateInput, 'error-state');
        }

        // PIN code validation (6 digits)
        const pinClean = pincodeInput ? pincodeInput.value.trim().replace(/\D/g, '') : '';
        if (!pincodeInput || pinClean.length !== 6) {
            markInvalid(pincodeInput, 'error-pincode');
        }

        if (!isValid) {
            if (firstInvalid) {
                firstInvalid.focus();
                firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            showToast('Please correct the highlighted shipping fields.', 'error');
            return;
        }

        // Process order placement
        const items = getCartDetailed();
        if (items.length === 0) {
            showToast('Cannot place order: Cart is empty.', 'error');
            renderCheckout();
            return;
        }

        const totals = calculateTotals(items);
        const orderId = 'NEX-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random() * 900);
        
        const customerData = {
            name: nameInput.value.trim(),
            email: emailInput.value.trim(),
            phone: phoneInput.value.trim(),
            address: addressInput.value.trim(),
            city: cityInput.value.trim(),
            state: stateInput.value.trim(),
            pincode: pincodeInput.value.trim()
        };

        const newOrder = {
            orderId: orderId,
            date: new Date().toISOString(),
            items: items.map(it => ({
                id: it.product.id,
                name: it.product.name,
                price: it.product.price,
                quantity: it.quantity,
                image: it.product.image
            })),
            subtotal: totals.subtotal,
            discount: totals.discount,
            couponCode: appliedCoupon ? appliedCoupon.code : null,
            shipping: totals.shipping,
            tax: totals.tax,
            total: totals.grandTotal,
            customer: customerData,
            paymentMethod: selectedPayment,
            status: 'Confirmed'
        };

        // Save order to nexora_orders
        const orders = safeParse('nexora_orders', []);
        orders.unshift(newOrder);
        safeSet('nexora_orders', orders);

        // Update current user info with latest address if available
        const currentUser = safeParse('nexora_current_user', {}) || {};
        safeSet('nexora_current_user', {
            ...currentUser,
            name: customerData.name,
            email: customerData.email,
            phone: customerData.phone,
            address: customerData.address,
            city: customerData.city,
            state: customerData.state,
            pincode: customerData.pincode
        });

        // Clear cart
        safeSet('nexora_cart', []);
        appliedCoupon = null;

        // Render success modal
        showOrderSuccessModal(newOrder);
    }

    function showOrderSuccessModal(order) {
        const modal = document.getElementById('order-success-modal');
        const detailsBox = document.getElementById('order-success-details');
        if (!modal || !detailsBox) return;

        // Delivery estimate 3-4 days ahead
        const estDate = new Date();
        estDate.setDate(estDate.getDate() + 4);
        const dateOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
        const deliveryStr = estDate.toLocaleDateString('en-IN', dateOptions);

        detailsBox.innerHTML = `
            <p><strong>Order ID:</strong> <span style="color:var(--primary-color); font-family:monospace; font-weight:700;">#${escapeHTML(order.orderId)}</span></p>
            <p><strong>Delivering to:</strong> ${escapeHTML(order.customer.name)}, ${escapeHTML(order.customer.city)} (${escapeHTML(order.customer.pincode)})</p>
            <p><strong>Estimated Delivery:</strong> <span style="color:var(--success-color); font-weight:700;">${deliveryStr}</span></p>
            <p><strong>Payment Method:</strong> ${escapeHTML(order.paymentMethod)}</p>
            <p><strong>Total Amount Paid:</strong> <strong style="font-size:15px; color:var(--text-main);">${formatPrice(order.total)}</strong></p>
        `;

        modal.classList.add('active');
        updateHeaderBadges();
        showToast('Order confirmed! Check your email.', 'success');
    }

    // 8. Cart Drawer Helpers (viewable on checkout)
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
                            <button type="button" class="quantity-btn" onclick="updateCheckoutCartQty(${product.id}, ${item.quantity - 1})">-</button>
                            <span class="quantity-value">${item.quantity}</span>
                            <button type="button" class="quantity-btn" onclick="updateCheckoutCartQty(${product.id}, ${item.quantity + 1})">+</button>
                            <button type="button" class="remove-item-btn" onclick="removeCheckoutCartItem(${product.id})">
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

    window.updateCheckoutCartQty = function(id, newQty) {
        let cart = safeParse('nexora_cart', []);
        if (newQty <= 0) {
            cart = cart.filter(item => item.id !== id);
        } else {
            const item = cart.find(it => it.id === id);
            if (item) item.quantity = newQty;
        }
        safeSet('nexora_cart', cart);
        renderCheckout();
        renderCartDrawerItems();
    };

    window.removeCheckoutCartItem = function(id) {
        let cart = safeParse('nexora_cart', []);
        cart = cart.filter(item => item.id !== id);
        safeSet('nexora_cart', cart);
        showToast('Item removed from cart.', 'info');
        renderCheckout();
        renderCartDrawerItems();
    };

    // 9. Theme Toggle Setup
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

    // 10. Search Redirection
    function setupSearch() {
        const searchInput = document.getElementById('checkout-search-input');
        const searchBtn = document.getElementById('checkout-search-btn');

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

    // 11. Cross-Tab Realtime Synchronization
    window.addEventListener('storage', (e) => {
        if (e.key === 'nexora_theme') {
            const t = e.newValue || 'light';
            document.documentElement.setAttribute('data-theme', t);
            const themeIcon = document.getElementById('theme-icon');
            if (themeIcon) themeIcon.className = t === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        } else if (e.key === 'nexora_cart' || e.key === 'nexora_wishlist' || e.key === 'nexora_current_user') {
            updateHeaderBadges();
            renderCheckout();
        }
    });

    // 12. Initialization
    document.addEventListener('DOMContentLoaded', () => {
        setupThemeToggle();
        setupSearch();
        setupCartDrawer();
        renderCheckout();
    });

})();
