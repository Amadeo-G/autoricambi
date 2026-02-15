import { products, categories } from '/src/js/products.js';

// State Management
const state = {
    cart: JSON.parse(localStorage.getItem('cart')) || [],
    user: JSON.parse(localStorage.getItem('user')) || null,
    products: products,
    categories: categories
};

// DOM Elements
const elements = {
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    mobileMenu: document.getElementById('mobile-menu'),
    cartCount: document.querySelectorAll('.cart-count'),
    productList: document.getElementById('product-list'),
    featuredCategories: document.getElementById('featured-categories'),
    cartItemsContainer: document.getElementById('cart-items'),
    cartSubtotal: document.getElementById('cart-subtotal'),
    cartTotal: document.getElementById('cart-total')
};

// Helper Functions
const formatPrice = (price) => {
    // Mostrar precios con centavos (2 decimales)
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(price);
};
window.formatPrice = formatPrice;

const saveCart = () => {
    localStorage.setItem('cart', JSON.stringify(state.cart));
    updateCartUI();
};
window.saveCart = saveCart;

const updateCartUI = () => {
    const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    elements.cartCount.forEach(el => el.textContent = totalItems);
};
window.updateCartUI = updateCartUI;
window.state = state; // Also expose state for easier access

// --- Rendering Logic ---

// Home: Featured Categories
const renderFeaturedCategories = () => {
    if (!elements.featuredCategories) return;

    // Icon mapping
    const icons = {
        'electricidad': 'fa-plug',
        'inyeccion': 'fa-atom', // or fa-syringe effectively using atom for tech or similar
        'motor': 'fa-cogs',
        'refrigeracion': 'fa-snowflake',
        'accesorios': 'fa-tools'
    };

    // Card Image mapping (optional override for icons)
    const categoryImages = {
        'electricidad': '/src/img/cat-electricidad.jpg',
        'refrigeracion': '/src/img/cat-refrigeracion.jpg',
        'motor': '/src/img/cat-motor.jpg',
        'inyeccion': '/src/img/cat-inyeccion.jpg',
        'accesorios': '/src/img/cat-accesorios.jpg'
    };

    elements.featuredCategories.innerHTML = state.categories.slice(0, 5).map(cat => {
        const hasImage = categoryImages[cat.id];
        return `
        <a href="buscador.html?category=${cat.id}" class="group relative overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 block bg-white h-64 border border-gray-100">
            <div class="h-2/3 bg-gray-50 flex items-center justify-center group-hover:bg-brand-blue/5 transition duration-500 overflow-hidden relative">
                ${hasImage
                ? `<img src="${categoryImages[cat.id]}" alt="${cat.name}" class="w-full h-full object-cover transition duration-700 transform group-hover:scale-110">
                       <div class="absolute inset-0 bg-black/10 group-hover:bg-transparent transition duration-300"></div>`
                : `<i class="fas ${icons[cat.id] || 'fa-box'} text-6xl text-gray-300 group-hover:text-brand-blue transition duration-500 transform group-hover:scale-110"></i>`
            }
            </div>
            <div class="h-1/3 p-4 bg-white relative z-10 border-t border-gray-100">
                <h3 class="text-lg font-bold text-gray-800 group-hover:text-brand-blue transition">${cat.name}</h3>
                <div class="flex items-center text-xs text-brand-red font-semibold mt-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                    VER PRODUCTOS <i class="fas fa-chevron-right ml-1"></i>
                </div>
            </div>
        </a>
    `}).join('');
};

// Catalog: Sidebar Filters
const renderCategoryFilters = () => {
    const filterContainer = document.getElementById('category-filters');
    if (!filterContainer) return;

    const urlParams = new URLSearchParams(window.location.search);
    const currentCategory = urlParams.get('category');

    filterContainer.innerHTML = `
        <li><a href="/buscador.html" class="block ${!currentCategory ? 'text-brand-red font-bold' : 'text-gray-600 hover:text-brand-blue'}">Ver Todo</a></li>
        ${state.categories.map(cat => `
            <li>
                <a href="/buscador.html?category=${cat.id}" class="block ${currentCategory === cat.id ? 'text-brand-red font-bold' : 'text-gray-600 hover:text-brand-blue'}">
                    ${cat.name}
                </a>
            </li>
        `).join('')}
    `;
};

// Catalog: Product List
const renderCatalog = () => {

    if (!elements.productList) return;

    const urlParams = new URLSearchParams(window.location.search);
    const categoryFilter = urlParams.get('category');
    const searchFilter = document.getElementById('catalog-search')?.value.toLowerCase(); // Simple search

    let filteredProducts = state.products;

    if (categoryFilter) {
        filteredProducts = filteredProducts.filter(p => p.category.toLowerCase() === categoryFilter.toLowerCase());

        // Highlight active sidebar link
        const currentLink = document.querySelector(`a[href*="category=${categoryFilter}"]`);
        if (currentLink) currentLink.classList.add('text-brand-red', 'font-bold');
    }

    if (searchFilter) {
        filteredProducts = filteredProducts.filter(p =>
            p.name.toLowerCase().includes(searchFilter) ||
            p.sku.toLowerCase().includes(searchFilter)
        );
    }

    if (filteredProducts.length === 0) {
        elements.productList.innerHTML = `<div class="col-span-full text-center py-12 text-gray-500">No se encontraron productos.</div>`;
        return;
    }

    elements.productList.innerHTML = filteredProducts.map(product => `
        <div class="bg-white rounded-lg shadow hover:shadow-lg transition duration-300 border border-gray-100 flex flex-col overflow-hidden group">
            <div class="relative h-48 bg-gray-100 overflow-hidden">
                 <img src="${product.image}" alt="${product.name}" onerror="this.src='https://placehold.co/300?text=Sin+Imagen'"
                      class="w-full h-full object-cover object-center transform group-hover:scale-105 transition duration-500 relative z-10">
                ${!product.stock ? '<div class="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">SIN STOCK</div>' : ''}
            </div>
            <div class="p-4 flex-grow flex flex-col">
                <div class="text-xs text-gray-500 mb-1 uppercase tracking-wide">${product.brand} | ${product.category}</div>
                <h3 class="font-bold text-gray-800 leading-tight mb-2 group-hover:text-brand-blue transition">${product.name}</h3>
                <div class="text-xs text-gray-500 mb-3 line-clamp-2">${product.description}</div>
                <div class="mt-auto flex items-center justify-between">
                    <div class="text-xl font-bold text-brand-dark">${formatPrice(product.price)}</div>
                    <button onclick="window.addToCart(${product.id})" class="bg-brand-blue text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-brand-accent hover:text-brand-blue transition duration-300 shadow-md transform active:scale-95">
                        <i class="fas fa-shopping-cart"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
};

// Cart: Render Items (New Card-Based Design)
const renderCart = () => {
    // Update to use new wrapper instead of table
    const cartWrapper = document.getElementById('cart-items-wrapper');
    if (!cartWrapper) return;

    if (state.cart.length === 0) {
        cartWrapper.innerHTML = `
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 md:p-20 text-center">
                <div class="flex flex-col items-center justify-center text-gray-400">
                    <div class="w-24 h-24 bg-gradient-to-br from-gray-50 to-blue-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                        <i class="fas fa-shopping-basket text-5xl text-gray-300"></i>
                    </div>
                    <p class="text-2xl font-black text-gray-600 mb-2">Tu carrito está vacío</p>
                    <p class="text-sm text-gray-500 mb-8">Parece que aún no has agregado ningún producto</p>
                    <a href="buscador.html" class="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-brand-blue to-blue-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-brand-blue/30 transition-all transform hover:scale-105">
                        <i class="fas fa-search"></i>
                        <span>Explorar Catálogo</span>
                    </a>
                </div>
            </div>`;
        if (elements.cartSubtotal) elements.cartSubtotal.textContent = formatPrice(0);
        if (elements.cartTotal) elements.cartTotal.textContent = formatPrice(0);
        return;
    }

    let subtotal = 0;
    cartWrapper.innerHTML = state.cart.map(item => {
        const unitPrice = item.price;
        const itemTotal = unitPrice * item.quantity;
        subtotal += itemTotal;

        // Determinar color del badge de stock
        let stockBadgeColor = 'bg-red-500'; // Sin stock por defecto
        let stockTitle = 'Sin Stock';
        if (item.maxStock !== undefined) {
            if (item.maxStock > 5) {
                stockBadgeColor = 'bg-green-500';
                stockTitle = 'Stock Disponible';
            } else if (item.maxStock >= 1) {
                stockBadgeColor = 'bg-yellow-400';
                stockTitle = 'Últimas Unidades';
            }
        }

        return `
            <div class="cart-item-card bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 hover:border-brand-blue/30 transition-all">
                <div class="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
                    <!-- Product Image & Info - Más Espacio -->
                    <div class="flex gap-4 flex-1 min-w-0">
                        <div class="relative flex-shrink-0 group">
                            <!-- Imagen más pequeña: equivalente a 3 líneas de texto (~4.5rem = 72px) -->
                            <div class="w-16 h-16 md:w-20 md:h-20 bg-gray-50 rounded-xl overflow-hidden border border-gray-100 p-1.5 group-hover:border-brand-blue/30 transition-all">
                                <img src="${item.image}" 
                                     onerror="window.cartImgError(this, '${item.sku}')" 
                                     class="w-full h-full object-contain">
                            </div>
                            <!-- Stock Badge: solo color, sin texto de cantidad -->
                            ${item.maxStock !== undefined ? `<div class="absolute -top-1 -right-1 w-4 h-4 ${stockBadgeColor} rounded-full shadow-lg border-2 border-white" title="${stockTitle}"></div>` : ''}
                        </div>
                        <div class="flex-1 min-w-0">
                            <!-- Título limitado a 2 líneas -->
                            <h3 class="font-black text-brand-dark text-base md:text-lg leading-tight mb-2 line-clamp-2 hover:text-brand-blue transition-colors">${item.name}</h3>
                            <div class="flex flex-wrap items-center gap-2 mb-2">
                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-100 text-brand-blue font-mono text-xs rounded-lg font-bold">
                                    <i class="fas fa-barcode"></i>
                                    ${item.sku}
                                </span>
                                ${item.brand ? `<span class="text-xs text-gray-500 font-semibold">${item.brand}</span>` : ''}
                            </div>
                            <div class="flex items-baseline gap-2">
                                <span class="text-xs text-gray-500 font-medium">Precio unitario:</span>
                                <span class="text-sm md:text-base font-bold text-gray-800">${formatPrice(unitPrice)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Quantity, Subtotal & Actions - Grid con Columnas Fijas -->
                    <div class="grid grid-cols-[auto_auto_auto] md:grid-cols-[140px_160px_50px] gap-3 md:gap-4 items-start ml-auto">
                        <!-- Quantity Control - Columna Fija 140px -->
                        <div class="flex flex-col items-center md:items-end gap-2">
                            <span class="text-xs text-gray-500 font-semibold whitespace-nowrap">Cantidad</span>
                            <div class="flex flex-row items-center bg-white rounded-lg border-2 border-gray-200 hover:border-brand-blue transition-all shadow-sm hover:shadow-md">
                                <button onclick="window.updateQty(${item.id}, -1)" 
                                        class="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white hover:bg-brand-blue transition-all active:scale-90 rounded-l-md group">
                                    <i class="fas fa-minus text-xs group-hover:scale-110 transition-transform"></i>
                                </button>
                                <input type="number" 
                                       value="${item.quantity}" 
                                       min="1" 
                                       onchange="window.setQty(${item.id}, this.value)"
                                       class="w-16 h-9 text-center font-bold bg-gray-50 border-0 focus:ring-0 focus:bg-blue-50 outline-none no-spin text-gray-800 text-sm md:text-base transition-colors">
                                <button onclick="window.updateQty(${item.id}, 1)" 
                                        class="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white hover:bg-brand-blue transition-all active:scale-90 rounded-r-md group">
                                    <i class="fas fa-plus text-xs group-hover:scale-110 transition-transform"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Subtotal - Columna Fija 160px -->
                        <div class="flex flex-col items-end gap-2">
                            <span class="text-xs text-gray-500 font-semibold whitespace-nowrap">Subtotal</span>
                            <span class="text-sm md:text-base font-bold text-brand-blue tabular-nums whitespace-nowrap">${formatPrice(itemTotal)}</span>
                        </div>

                        <!-- Remove Button - Columna Fija 50px -->
                        <div class="flex items-end justify-center h-full pt-6">
                            <button onclick="window.removeFromCart(${item.id})" 
                                    class="w-10 h-10 rounded-xl flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 border-2 border-transparent hover:border-red-200 transition-all transform hover:scale-110 active:scale-95" 
                                    title="Eliminar del carrito">
                                <i class="fas fa-trash-alt text-base"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const totalWithIVA = subtotal * 1.21;
    if (elements.cartSubtotal) elements.cartSubtotal.textContent = formatPrice(subtotal);
    if (elements.cartTotal) elements.cartTotal.textContent = formatPrice(totalWithIVA);
};

// Error Handler para imágenes del carrito
window.cartImgError = (img, sku) => {
    const cleanSku = sku ? sku.toLowerCase().trim() : '';
    if (!cleanSku) {
        img.src = 'https://placehold.co/200?text=S/D';
        img.onerror = null;
        return;
    }

    const R2_BASE = 'https://pub-4a74b73ccfa3493ebcfc17e92136dcf4.r2.dev';

    // Inicializar estado de intentos si no existe
    if (!img.dataset.retryCount) {
        img.dataset.retryCount = '0';
    }

    const state = parseInt(img.dataset.retryCount);

    // Lógica de Reintentos en Cascada
    // 0 -> Intenta R2 WebP (Corrige items viejos guardados como JPG u otros errores)
    // 1 -> Intenta Local WebP (Fallback histórico)
    // 2 -> Placeholder final

    if (state === 0) {
        img.dataset.retryCount = '1';
        const targetUrl = `${R2_BASE}/${cleanSku}-1.webp`;
        // Evitar recargar la misma URL si ya era esa la que falló
        if (img.src !== targetUrl) {
            img.src = targetUrl;
            return;
        }
        // Si ya era esa, pasamos directo al siguiente paso
    }

    if (state <= 1) {
        img.dataset.retryCount = '2';
        img.src = `/Imagenes/${cleanSku}-1.webp`;
        return;
    }

    // Fallback final
    img.src = 'https://placehold.co/200?text=S/D';
    img.onerror = null;
};

// --- Global Actions (Window) ---

window.addToCart = (productId) => {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const existingItem = state.cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        state.cart.push({ ...product, quantity: 1 });
    }

    saveCart();

    // Visual feedback
    const btn = document.activeElement;
    if (btn && btn.tagName === 'BUTTON') {
        const originalHTML = btn.innerHTML;
        const originalClasses = btn.className;
        btn.innerHTML = '<i class="fas fa-check"></i>';
        btn.classList.remove('bg-brand-blue');
        btn.classList.add('bg-green-500');
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.className = originalClasses;
        }, 1000);
    }
};

window.removeFromCart = (productId) => {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
};

window.updateQty = (productId, change) => {
    const item = state.cart.find(item => item.id === productId);
    if (item) {
        const newQty = item.quantity + change;
        if (newQty < 1) return;

        if (item.maxStock !== undefined && newQty > item.maxStock) {
            alert(`No puedes superar el stock disponible de ${item.maxStock} unidades.`);
            return;
        }

        item.quantity = newQty;
        saveCart();
        renderCart();
    }
};

window.setQty = (productId, newValue) => {
    const item = state.cart.find(item => item.id === productId);
    if (item) {
        let val = parseInt(newValue);
        if (isNaN(val) || val < 1) val = 1;

        if (item.maxStock !== undefined && val > item.maxStock) {
            alert(`Stock limitado: Se ajustó a ${item.maxStock} unidades.`);
            val = item.maxStock;
        }

        item.quantity = val;
        saveCart();
        renderCart();
    }
};

// Google Sheets Integration URL (Configurar después de publicar la App Script)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxzhXBnBrXh8zUbxdpRGGd-140wkv9gPaPseB-ygwor1vaKbtZ9RAOvPWd6CxMrW_1I/exec";

window.sendToSystem = async () => {
    if (state.cart.length === 0) return;

    if (!GOOGLE_SCRIPT_URL) {
        alert("Configuración pendiente...");
        return;
    }

    const btn = document.getElementById('btn-system');
    const originalText = btn.innerHTML;

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Enviando...';

        const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const totalWithIVA = subtotal * 1.21;
        const user = state.user || {};

        // DEBUG: ver la estructura real de cada item del carrito
        console.log("=== DEBUG CARRITO ===");
        state.cart.forEach((item, idx) => {
            console.log(`Item ${idx}:`, JSON.stringify(item));
        });

        // Construimos la lista de items con subtotal y total individual
        const items = state.cart.map(i => {
            const unitPrice = i.price || 0;
            const itemSubtotal = unitPrice * (i.quantity || 1);
            return {
                codigo: i.sku || i.codigo || i.id || i.name || "S/D",
                descripcion: i.name || i.description || i.descripcion || "S/D",
                cantidad: i.quantity || i.qty || 1,
                precio_unitario: formatPrice(unitPrice),
                subtotal: formatPrice(itemSubtotal),
                total: formatPrice(itemSubtotal * 1.21),
                imagen: i.image || ''
            };
        });

        const orderData = {
            clientName: user.name || "Cliente No Identificado",
            items: JSON.stringify(items),
            discount: String(user.discount || 42)
        };

        console.log("Enviando pedido:", orderData);
        console.log("Items JSON:", orderData.items);

        // Usamos un iframe oculto + formulario para evitar problemas de CORS con Google
        await new Promise((resolve, reject) => {
            const iframeName = 'hidden_iframe_' + Date.now();
            const iframe = document.createElement('iframe');
            iframe.name = iframeName;
            iframe.style.display = 'none';
            document.body.appendChild(iframe);

            const form = document.createElement('form');
            form.method = 'POST';
            form.action = GOOGLE_SCRIPT_URL;
            form.target = iframeName;
            form.style.display = 'none';

            // Enviamos los datos como campos individuales del formulario
            Object.keys(orderData).forEach(key => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = orderData[key];
                form.appendChild(input);
            });

            document.body.appendChild(form);

            iframe.onload = () => {
                // Limpiar después de enviar
                setTimeout(() => {
                    document.body.removeChild(iframe);
                    document.body.removeChild(form);
                }, 500);
                resolve();
            };

            iframe.onerror = () => {
                document.body.removeChild(iframe);
                document.body.removeChild(form);
                reject(new Error('Error al enviar'));
            };

            form.submit();

            // Timeout de seguridad: si no carga en 10 segundos, asumimos éxito
            setTimeout(resolve, 10000);
        });

        alert('✅ ¡Pedido enviado con éxito! Se ha registrado en nuestro sistema.');

        // Guardar en historial local antes de limpiar el carrito
        const orderRecord = {
            date: new Date().toLocaleString('es-AR', { hour12: false }),
            items: items,
            discount: user.discount || 42
        };
        const history = JSON.parse(localStorage.getItem('orderHistory') || '[]');
        history.unshift(orderRecord); // Más reciente primero
        localStorage.setItem('orderHistory', JSON.stringify(history));

        state.cart = [];
        saveCart();
        if (typeof renderCart === 'function') renderCart();
        if (typeof renderOrderHistory === 'function') renderOrderHistory();

    } catch (error) {
        console.error('Error al enviar pedido:', error);
        alert('❌ Hubo un problema al enviar el pedido por sistema.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

window.checkout = () => {
    if (state.cart.length === 0) return;

    const user = state.user || {};
    const userName = user.name || 'un cliente';
    const message = `¡Hola Autoricambi! Soy ${userName} (${user.email || 'S/D'}) y este es mi pedido:%0A` +
        state.cart.map(i => `- ${i.sku} x ${i.quantity} (${i.name})`).join('%0A');

    const phoneNumber = "543516861092";
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
};


// --- Order History ---
window.renderOrderHistory = () => {
    const container = document.getElementById('order-history');
    if (!container) return;

    const history = JSON.parse(localStorage.getItem('orderHistory') || '[]');

    if (history.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-400 py-8">
                <i class="fas fa-clipboard-list text-4xl mb-3"></i>
                <p>No hay pedidos anteriores.</p>
            </div>`;
        return;
    }

    let html = '';
    history.forEach((order, idx) => {
        html += `
        <div class="bg-white border border-gray-200 rounded-2xl mb-8 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
            <div class="bg-gray-50/80 px-8 py-5 flex justify-between items-center border-b border-gray-100">
                <div class="flex items-center space-x-5">
                    <div class="bg-brand-blue/10 p-3 rounded-xl text-brand-blue shadow-inner">
                        <i class="fas fa-calendar-check text-xl"></i>
                    </div>
                    <div>
                        <div class="text-[10px] font-black text-brand-blue uppercase tracking-widest mb-0.5">Fecha del Pedido</div>
                        <div class="font-bold text-gray-900 text-lg">${order.date}</div>
                    </div>
                </div>
                <div class="flex items-center space-x-4">
                    <div class="text-right hidden sm:block">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Ítems</span>
                        <span class="font-black text-gray-600">${order.items.length}</span>
                    </div>
                    <button onclick="window.deleteOrder(${idx})" class="w-11 h-11 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all border border-transparent hover:border-red-100" title="Eliminar del historial">
                        <i class="fas fa-trash-alt text-lg"></i>
                    </button>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="text-[10px] text-gray-400 uppercase bg-gray-50/30 border-b border-gray-100">
                        <tr>
                            <th class="px-8 py-4 text-left font-black tracking-widest">Producto</th>
                            <th class="px-8 py-4 text-center font-black tracking-widest" width="100">Cantidad</th>
                            <th class="px-8 py-4 text-right font-black tracking-widest" width="150">Precio</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-50">
                        ${order.items.map(item => `
                        <tr class="hover:bg-gray-50/30 transition-colors">
                            <td class="px-8 py-4" data-label="Producto">
                                <div class="flex items-center space-x-4">
                                    <div class="w-12 h-12 flex-shrink-0 bg-white border border-gray-100 rounded-lg overflow-hidden p-0.5">
                                        <img src="${item.imagen || 'https://placehold.co/100?text=S/D'}" 
                                             onerror="window.cartImgError(this, '${item.codigo}')" 
                                             class="w-full h-full object-contain">
                                    </div>
                                    <div>
                                        <div class="font-bold text-gray-800 leading-tight">${item.descripcion}</div>
                                        <div class="text-[10px] font-mono font-bold text-brand-blue uppercase tracking-wider mt-0.5">${item.codigo}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-8 py-4 text-center font-black text-gray-600 bg-gray-50/20" data-label="Cantidad">${item.cantidad}</td>
                            <td class="px-8 py-4 text-right font-bold text-gray-800 bg-gray-50/20" data-label="Precio">${item.precio_unitario || '-'}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    });

    container.innerHTML = html;
};

window.deleteOrder = (idx) => {
    if (!confirm('¿Eliminar este pedido del historial?')) return;
    const history = JSON.parse(localStorage.getItem('orderHistory') || '[]');
    history.splice(idx, 1);
    localStorage.setItem('orderHistory', JSON.stringify(history));
    renderOrderHistory();
};

// Inicializar historial al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof renderOrderHistory === 'function') renderOrderHistory();
    }, 500);
});



// Header Logic (Login/User Status)
const updateHeader = async () => {
    // Import auth if not defined (though it's usually global)
    const { auth } = await import('./auth.js');
    const user = await auth.getCurrentUser();

    const loginLink = document.querySelector('a[href="login.html"]');
    const mobileLoginLink = document.querySelector('#mobile-menu a[href="login.html"]');

    if (user && loginLink) {
        const desktopLoginHTML = `
            <div class="flex items-center space-x-3">
                <div class="flex flex-col items-end">
                    <span class="text-xs text-gray-400">Hola,</span>
                    <span class="font-bold text-sm">${user.name}</span>
                </div>
                <button id="logout-btn" class="hover:text-brand-accent transition">
                    <i class="fas fa-sign-out-alt text-xl"></i>
                </button>
            </div>
        `;
        const container = loginLink.parentElement;
        loginLink.remove();
        container.insertAdjacentHTML('afterbegin', desktopLoginHTML);

        document.getElementById('logout-btn')?.addEventListener('click', async () => {
            await auth.logout();
        });
    }

    if (user && mobileLoginLink) {
        mobileLoginLink.innerHTML = `<i class="fas fa-user mr-2"></i> ${user.name} (Cerrar Sesión)`;
        mobileLoginLink.href = "#";
        mobileLoginLink.addEventListener('click', async (e) => {
            e.preventDefault();
            await auth.logout();
        });
    }
};

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    updateCartUI();
    await updateHeader();
    renderFeaturedCategories();
    renderCategoryFilters();
    renderCatalog();
    renderCart();

    if (elements.mobileMenuBtn) {
        elements.mobileMenuBtn.addEventListener('click', () => {
            const isHidden = elements.mobileMenu.classList.contains('hidden');
            if (isHidden) {
                elements.mobileMenu.classList.remove('hidden');
                elements.mobileMenu.classList.add('animate-fade-in');
            } else {
                elements.mobileMenu.classList.add('hidden');
            }
        });
    }
});
