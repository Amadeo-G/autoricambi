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
    // Regla: < .50 para abajo, >= .50 para arriba (Math.round)
    // Sin decimales
    const val = Math.round(price);
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(val);
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

// Cart: Render Items
const renderCart = () => {
    if (!elements.cartItemsContainer) return;

    if (state.cart.length === 0) {
        elements.cartItemsContainer.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">El carrito está vacío</td></tr>';
        if (elements.cartSubtotal) elements.cartSubtotal.textContent = formatPrice(0);
        if (elements.cartTotal) elements.cartTotal.textContent = formatPrice(0);
        return;
    }

    let subtotal = 0;
    elements.cartItemsContainer.innerHTML = state.cart.map(item => {
        // Round unit price to integer per rule
        const unitPrice = Math.round(item.price);
        const itemTotal = unitPrice * item.quantity;
        subtotal += itemTotal;
        return `
            <tr class="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td class="p-4 flex items-center space-x-3">
                    <img src="${item.image}" 
                         onerror="window.cartImgError(this, '${item.sku}')" 
                         class="w-12 h-12 object-cover rounded border border-gray-200">
                    <div>
                        <div class="font-bold text-gray-800">${item.name}</div>
                        <div class="text-xs text-gray-500">${item.sku}</div>
                    </div>
                </td>
                <td class="p-4 text-right font-medium text-gray-600">${formatPrice(unitPrice)}</td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center space-x-1">
                         <button onclick="window.updateQty(${item.id}, -1)" class="w-6 h-6 rounded bg-gray-200 text-gray-600 hover:bg-brand-blue hover:text-white transition flex items-center justify-center">-</button>
                         <input type="number" 
                                value="${item.quantity}" 
                                min="1" 
                                onchange="window.setQty(${item.id}, this.value)"
                                class="w-12 text-center font-bold border rounded py-0.5 focus:ring-1 focus:ring-brand-blue outline-none no-spin">
                         <button onclick="window.updateQty(${item.id}, 1)" class="w-6 h-6 rounded bg-gray-200 text-gray-600 hover:bg-brand-blue hover:text-white transition flex items-center justify-center">+</button>
                    </div>
                </td>
                <td class="p-4 text-right font-bold text-brand-dark">${formatPrice(itemTotal)}</td>
                <td class="p-4 text-center">
                    <button onclick="window.removeFromCart(${item.id})" class="text-red-400 hover:text-red-600 transition"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');

    const totalWithIVA = Math.round(subtotal * 1.21);
    if (elements.cartSubtotal) elements.cartSubtotal.textContent = formatPrice(subtotal);
    if (elements.cartTotal) elements.cartTotal.textContent = formatPrice(totalWithIVA);
};

// Error Handler para imágenes del carrito
window.cartImgError = (img, sku) => {
    const cleanSku = sku ? sku.toLowerCase().trim() : '';
    if (!cleanSku) {
        img.src = 'https://placehold.co/100?text=S/D';
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
    img.src = 'https://placehold.co/100?text=S/D';
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

        const subtotal = state.cart.reduce((sum, item) => sum + (Math.round(item.price) * item.quantity), 0);
        const totalWithIVA = Math.round(subtotal * 1.21);
        const user = state.user || {};

        // DEBUG: ver la estructura real de cada item del carrito
        console.log("=== DEBUG CARRITO ===");
        state.cart.forEach((item, idx) => {
            console.log(`Item ${idx}:`, JSON.stringify(item));
        });

        // Construimos la lista de items con subtotal y total individual
        const items = state.cart.map(i => {
            const unitPrice = Math.round(i.price || 0);
            const itemSubtotal = unitPrice * (i.quantity || 1);
            return {
                codigo: i.sku || i.codigo || i.id || i.name || "S/D",
                descripcion: i.name || i.description || i.descripcion || "S/D",
                cantidad: i.quantity || i.qty || 1,
                precio_unitario: formatPrice(unitPrice),
                subtotal: formatPrice(itemSubtotal),
                total: formatPrice(Math.round(itemSubtotal * 1.21))
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
        <div class="border border-gray-200 rounded-lg mb-4 overflow-hidden">
            <div class="bg-gray-50 px-4 py-3 flex justify-between items-center">
                <div>
                    <span class="font-semibold text-gray-700"><i class="fas fa-calendar-alt mr-1"></i> ${order.date}</span>
                    <span class="ml-3 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">${order.items.length} producto(s)</span>
                </div>
                <button onclick="window.deleteOrder(${idx})" class="text-gray-400 hover:text-red-500 transition text-sm" title="Eliminar pedido">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
            <table class="w-full text-sm">
                <thead class="text-xs text-gray-500 uppercase bg-gray-50 border-t">
                    <tr>
                        <th class="px-4 py-2 text-left">SKU</th>
                        <th class="px-4 py-2 text-left">Descripción</th>
                        <th class="px-4 py-2 text-center">Cantidad</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    ${order.items.map(item => `
                    <tr>
                        <td class="px-4 py-2 font-mono text-gray-800">${item.codigo}</td>
                        <td class="px-4 py-2 text-gray-600">${item.descripcion || '-'}</td>
                        <td class="px-4 py-2 text-center">${item.cantidad}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
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
            elements.mobileMenu.classList.toggle('hidden');
        });
    }
});
