// catalog.js - Logic for the Dynamic Excel Catalog

// CONFIGURATION
const EXCEL_FILE_PATH = 'Filtros.xlsx';

// GLOBAL STATE
let allData = [];
let filteredData = [];

// DOM Elements
const els = {
    search: document.getElementById('globalSearch'),
    rubro: document.getElementById('filterRubro'),
    subrubro: document.getElementById('filterSubrubro'),
    marca: document.getElementById('filterMarca'),
    btnSearch: document.getElementById('btnSearch'),
    btnReset: document.getElementById('btnReset'),
    tbody: document.getElementById('tableBody'),
    status: document.getElementById('statusMessage'),
    count: document.getElementById('resultCount'),
    modal: document.getElementById('productModal')
};

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    // Check for URL code: can be in path /buscador/CODE or in query ?p=CODE
    const pathParts = window.location.pathname.split('/');
    const codeFromPath = pathParts.includes('buscador') ? pathParts[pathParts.indexOf('buscador') + 1] : null;
    const initialCode = codeFromPath || urlParams.get('p') || urlParams.get('s');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    fetchData(initialCode);
});

// Handle Back/Forward buttons in browser
window.addEventListener('popstate', () => {
    const pathParts = window.location.pathname.split('/');
    const code = pathParts.includes('buscador') ? pathParts[pathParts.indexOf('buscador') + 1] : null;
    if (code) {
        window.openProductDetail(code, false); // false to not push state again
    } else {
        window.closeModal(false);
    }
});

// 1. DATA LOADING & PARSING
// Helper to parse Argentinian price: "1.678,73" -> 1678.73
const parsePrice = (val) => {
    if (!val) return 0;
    let s = val.toString().trim();
    s = s.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
    return parseFloat(s) || 0;
};

// Helper to format Argentinian price: 1678.73 -> "1.678,73"
const formatPrice = (val) => {
    return val.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

async function fetchData(initialQuery = null) {
    try {
        const response = await fetch(`${EXCEL_FILE_PATH}?t=${Date.now()}`);
        if (!response.ok) throw new Error("No se pudo cargar el catálogo.");
        const arrayBuffer = await response.arrayBuffer();
        parseExcel(arrayBuffer, initialQuery);
    } catch (error) {
        console.error(error);
        if (els.tbody) els.tbody.innerHTML = `<tr><td colspan="2" class="p-4 text-center text-red-500">Error: ${error.message} - Asegúrate de que Filtros.xlsx esté en la raíz.</td></tr>`;
    }
}

function parseExcel(arrayBuffer, initialCode = null) {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });


    allData = data.slice(2).map(row => {
        const pvVal = parsePrice(row[2]); // Column C is PV (Precio de Venta)
        const costVal = pvVal * 0.58;     // Cost is 58% of PV

        return {
            codigo: (row[0] || '').toString().trim(),         // Column A
            descripcion: (row[1] || '').toString().trim(),    // Column B
            costo: costVal,
            precio: formatPrice(pvVal),
            priceRaw: pvVal,
            subrubro: (row[8] || '').toString().trim(),       // Column I
            marca: (row[13] || '').toString().trim(),         // Column N
            rubro: (row[14] || '').toString().trim(),         // Column O
            caracteristicas: '',
            equivalentes: '',
            stock: parseInt((row[11] || 0).toString().replace(/\D/g, '')) || 0 // Column L
        };
    }).filter(item => item.codigo && item.rubro);

    initFilters();

    // Auto-search if code exists
    if (initialCode) {
        // If it's a specific code (more likely if initialCode comes from path)
        const exactMatch = allData.find(d => d.codigo.toLowerCase() === initialCode.toLowerCase());
        if (exactMatch) {
            window.openProductDetail(exactMatch.codigo, false);
        } else {
            els.search.value = initialCode;
            applyFilters();
        }
    } else {
        showInitialMessage();
    }
}

// 2. FILTERS LOGIC
function getUniqueValues(data, key) {
    return [...new Set(data.map(item => item[key]).filter(x => x))].sort();
}

function populateSelect(selectElement, values, defaultText) {
    selectElement.innerHTML = `<option value="">${defaultText}</option>`;
    values.forEach(val => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = val;
        selectElement.appendChild(opt);
    });
    selectElement.disabled = false;
}

function initFilters() {
    populateSelect(els.rubro, getUniqueValues(allData, 'rubro'), "Todos los Rubros");
}

if (els.rubro) {
    els.rubro.addEventListener('change', (e) => {
        const val = e.target.value;
        const subExists = els.subrubro;
        if (subExists) {
            els.subrubro.innerHTML = '<option value="">Todos los Subrubros</option>';
            els.subrubro.disabled = true;
        }
        if (els.marca) {
            els.marca.innerHTML = '<option value="">Todas las Marcas</option>';
            els.marca.disabled = true;
        }

        if (val && subExists) {
            const subrubros = getUniqueValues(allData.filter(d => d.rubro === val), 'subrubro');
            populateSelect(els.subrubro, subrubros, "Todos los Subrubros");
        }
        applyFilters();
    });
}

if (els.subrubro) {
    els.subrubro.addEventListener('change', (e) => {
        const r = els.rubro.value;
        const s = e.target.value;
        if (els.marca) {
            els.marca.innerHTML = '<option value="">Todas las Marcas</option>';
            els.marca.disabled = true;
        }

        if (s && els.marca) {
            const marcas = getUniqueValues(allData.filter(d => d.rubro === r && d.subrubro === s), 'marca');
            populateSelect(els.marca, marcas, "Todas las Marcas");
        }
        applyFilters();
    });
}

if (els.marca) {
    els.marca.addEventListener('change', () => applyFilters());
}

// 3. SEARCH LOGIC

// Helper to remove accents/diacritics
function normalizeText(text) {
    if (!text) return "";
    return text.toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function applyFilters() {
    const rub = els.rubro ? els.rubro.value : '';
    const sub = els.subrubro ? els.subrubro.value : '';
    const mar = els.marca ? els.marca.value : '';
    const searchRaw = els.search.value.trim();
    const searchNorm = normalizeText(searchRaw);
    const terms = searchNorm.split(/\s+/).filter(t => t);

    filteredData = allData.filter(item => {
        const matchFiltros = (!rub || item.rubro === rub) && (!sub || item.subrubro === sub) && (!mar || item.marca === mar);

        // Search in code, description, brand, rubric and sub-rubric
        const fieldsToSearch = [item.codigo, item.descripcion, item.marca, item.rubro, item.subrubro];
        const itemText = normalizeText(fieldsToSearch.join(" "));

        const matchSearch = terms.every(t => itemText.includes(t));
        return matchFiltros && matchSearch;
    });
    renderTable(searchRaw);
}

function highlightText(text, query) {
    if (!query) return text;
    // For highlighting, we still need to handle names correctly but matching the normalized query
    const terms = normalizeText(query).split(/\s+/).filter(t => t).sort((a, b) => b.length - a.length);
    if (!terms.length) return text;

    // This is tricky: highlight original text based on normalized terms
    // Simple approach: case-insensitive match on original text if possible, 
    // but better to just use a regex that handles normalized matching if we wanted it perfect.
    // For now, let's keep it simple and highlight case-insensitive matches.
    const pattern = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');
    return text.replace(regex, '<mark class="bg-blue-100 text-brand-blue font-bold px-0.5 rounded">$1</mark>');
}

function renderTable(q = '') {
    els.tbody.innerHTML = '';

    if (filteredData.length === 0) {
        if (els.count) els.count.textContent = '0 resultados';
        if (els.status) els.status.classList.remove('hidden');
        return;
    }

    if (els.count) els.count.textContent = `${filteredData.length} resultados encontrados`;
    if (els.status) els.status.classList.add('hidden');

    const fragment = document.createDocumentFragment();
    // Limit to 100 for performance
    filteredData.slice(0, 100).forEach(item => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50 transition-colors duration-200 border-b border-gray-100 last:border-b-0";

        tr.innerHTML = `
            <td class="p-4 font-bold text-sm text-gray-700" data-label="Código">
                <span class="bg-white px-2 py-1 rounded border border-gray-200 shadow-sm inline-block">${highlightText(item.codigo, q)}</span>
            </td>
            <td class="p-4 text-sm text-gray-800" data-label="Descripción">
                <div class="flex flex-col">
                    <span class="font-medium">${highlightText(item.descripcion, q)}</span>
                    <span class="text-[10px] text-gray-400 uppercase font-bold">${item.marca} | ${item.rubro}</span>
                </div>
            </td>
            <td class="p-4 text-right font-bold text-gray-800" data-label="Precio">
                $ ${item.precio}
            </td>
            <td class="p-4 text-right font-mono text-sm text-gray-400" data-label="Costo">
                <span id="cost-${item.codigo}" 
                      class="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-all select-none"
                      onclick="window.toggleTableCost('${item.codigo}', ${item.costo})">***</span>
            </td>
            <td class="p-4 text-center" data-label="Acción">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="window.addToCartFromCatalog('${item.codigo}')" 
                            class="p-2 bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition shadow-sm active:scale-95" 
                            title="Agregar al carrito">
                        <i data-lucide="shopping-cart" class="w-4 h-4"></i>
                    </button>
                    <button onclick="window.openProductDetail('${item.codigo}')" 
                            class="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-brand-blue hover:text-white transition shadow-sm active:scale-95" 
                            title="Ver detalles">
                        <i data-lucide="eye" class="w-4 h-4"></i>
                    </button>
                    ${getBadgeHtml(item.stock)}
                </div>
            </td>
        `;
        fragment.appendChild(tr);
    });
    els.tbody.appendChild(fragment);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function getBadgeHtml(stock) {
    let colorClass = 'bg-red-500';
    let title = 'Sin Stock';

    if (stock > 5) {
        colorClass = 'bg-green-500';
        title = 'Stock Disponible';
    } else if (stock >= 1) {
        colorClass = 'bg-yellow-400';
        title = 'Últimas Unidades';
    }

    return `<div class="w-3 h-3 rounded-full ${colorClass} shadow-sm" title="${title}: ${stock}"></div>`;
}

// Event Listeners
if (els.btnSearch) els.btnSearch.addEventListener('click', applyFilters);
if (els.search) els.search.addEventListener('keypress', e => e.key === 'Enter' && applyFilters());
if (els.btnReset) {
    els.btnReset.addEventListener('click', () => {
        els.search.value = '';
        if (els.rubro) els.rubro.value = '';
        if (els.subrubro) {
            els.subrubro.innerHTML = '<option value="">Selecciona Rubro primero</option>';
            els.subrubro.disabled = true;
        }
        if (els.marca) {
            els.marca.innerHTML = '<option value="">Selecciona Subrubro primero</option>';
            els.marca.disabled = true;
        }
        filteredData = [];
        showInitialMessage();

        // Spin icon effect
        const icon = els.btnReset.querySelector('i');
        if (icon) {
            icon.classList.add('animate-spin');
            setTimeout(() => icon.classList.remove('animate-spin'), 500);
        }
    });
}

document.getElementById('btnResetInline')?.addEventListener('click', () => els.btnReset.click());

function showInitialMessage() {
    if (els.tbody) els.tbody.innerHTML = `<tr><td colspan="2" class="p-12 text-center text-gray-400 italic">Selecciona filtros o escribe un código para buscar.</td></tr>`;
    if (els.count) els.count.textContent = '';
    if (els.status) els.status.classList.add('hidden');
}

// --- MODAL LOGIC (Exposed globally) ---
window.openProductDetail = function (codigo, pushState = true) {
    const item = allData.find(d => d.codigo.toLowerCase() === codigo.toLowerCase());
    if (!item) return;

    // Update URL if requested
    if (pushState) {
        // Clean paths: /buscador/RGU477
        const newPath = `/buscador/${item.codigo}`;
        history.pushState({ codigo: item.codigo }, '', newPath);
    }

    // Populate Data
    document.getElementById('modalTitle').textContent = item.descripcion;
    document.getElementById('modalCodigo').textContent = item.codigo;
    document.getElementById('modalMarca').textContent = item.marca || 'Genérico';
    document.getElementById('modalRubro').textContent = `${item.rubro || '-'} > ${item.subrubro || '-'}`;

    // Display Price & Cost
    const costEl = document.getElementById('modalCosto');
    const priceEl = document.getElementById('modalPrecio');

    if (costEl) {
        costEl.dataset.value = `$ ${formatPrice(item.costo)}`;
        costEl.textContent = '••••••••';
        costEl.classList.add('is-hidden');
    }
    if (priceEl) priceEl.textContent = `$ ${item.precio}`;

    // Update Stock Badge
    const stockBadge = document.getElementById('modalStockBadge');
    if (stockBadge) {
        stockBadge.className = 'w-4 h-4 rounded-full shadow-sm transition-colors border border-gray-200';
        let stockColor = 'bg-red-500';
        let stockTitle = 'Sin Stock';

        if (item.stock > 5) {
            stockColor = 'bg-green-500';
            stockTitle = 'Stock Disponible';
        } else if (item.stock >= 1) {
            stockColor = 'bg-yellow-400';
            stockTitle = 'Últimas Unidades';
        }

        stockBadge.classList.add(stockColor);
        stockBadge.title = `${stockTitle} (${item.stock})`;
    }

    // Reset eye icon
    const eyeBtn = document.querySelector('[onclick="window.toggleCostVisibility()"] i');
    if (eyeBtn && typeof lucide !== 'undefined') {
        eyeBtn.setAttribute('data-lucide', 'eye-off');
        lucide.createIcons();
    }

    // Features
    const featContainer = document.getElementById('modalFeatures');
    featContainer.innerHTML = '';
    if (item.caracteristicas) {
        const feats = item.caracteristicas.split(/[,\n]/).filter(f => f.trim());
        feats.forEach(f => {
            const span = document.createElement('span');
            span.className = "bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs border border-gray-200";
            span.textContent = f;
            featContainer.appendChild(span);
        });
    } else {
        featContainer.innerHTML = '<span class="text-gray-400 italic text-xs">Sin detalles adicionales</span>';
    }

    // Equivalents
    const equivContainer = document.getElementById('modalEquivalents');
    equivContainer.innerHTML = '';
    if (item.equivalentes) {
        const codes = item.equivalentes.split(/[,\n]/).filter(c => c.trim());
        codes.forEach(c => {
            const span = document.createElement('span');
            span.className = "font-mono text-xs bg-gray-50 border border-gray-200 px-2 py-1 rounded text-gray-500 select-all";
            span.textContent = c;
            equivContainer.appendChild(span);
        });
    } else {
        equivContainer.innerHTML = '<span class="text-gray-400 italic text-xs">N/A</span>';
    }

    // Images Carousel Logic (Simplified for now)
    // Try to load up to 3 images: Imagenes/{codigo}-1.webp
    const codeLower = item.codigo.toLowerCase();

    for (let i = 1; i <= 3; i++) {
        const imgEl = document.getElementById(`modalImg${i}`);
        if (imgEl) {
            // Fallback logic
            imgEl.onerror = function () {
                this.src = 'https://placehold.co/600x400/f3f4f6/a3a3a3?text=Sin+Imagen';
            };
            imgEl.src = `Imagenes/${codeLower}-${i}.webp`;
        }
    }

    // Show Modal
    const modal = document.getElementById('productModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex'); // Ensure flex display

    // Reset Carousel to slide 1 (simple visibility toggle needed if implementing full carousel)
    showSlide(1);
};

window.closeModal = function (pushState = true) {
    const modal = document.getElementById('productModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');

    // Restore URL
    if (pushState) {
        history.pushState(null, '', '/buscador');
    }
};

// Carousel Helpers
let currentSlide = 1;
function showSlide(n) {
    const slides = [1, 2, 3]; // Indices
    slides.forEach(i => {
        const el = document.getElementById(`modalImg${i}`);
        if (el) {
            el.style.display = (i === n) ? 'block' : 'none';
        }
    });
    // Update dots
    slides.forEach(i => {
        const dot = document.getElementById(`dot${i}`);
        if (dot) {
            dot.classList.toggle('bg-brand-blue', i === n);
            dot.classList.toggle('bg-gray-300', i !== n);
            dot.classList.toggle('w-6', i === n);
            dot.classList.toggle('w-2', i !== n);
        }
    });
    currentSlide = n;
}

window.setSlide = function (n) { showSlide(n); }
window.nextSlide = function (d) {
    let n = currentSlide + d;
    if (n > 3) n = 1;
    if (n < 1) n = 3;
    showSlide(n);
}

window.toggleTableCost = function (codigo, costo) {
    const el = document.getElementById(`cost-${codigo}`);
    if (!el) return;

    if (el.textContent === '***') {
        el.textContent = `$ ${formatPrice(costo)}`;
        el.classList.remove('text-gray-400');
        el.classList.add('text-brand-blue', 'font-bold');
    } else {
        el.textContent = '***';
        el.classList.remove('text-brand-blue', 'font-bold');
        el.classList.add('text-gray-400');
    }
};

window.addToCartFromCatalog = function (codigo) {
    const item = allData.find(d => d.codigo === codigo);
    if (!item) return;

    if (!window.state || !window.state.cart) {
        console.error("Cart state not initialized");
        return;
    }

    const existingItem = window.state.cart.find(c => c.sku === item.codigo);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        window.state.cart.push({
            id: Date.now() + Math.random(), // Unique temp ID
            name: item.descripcion,
            sku: item.codigo,
            price: item.priceRaw,
            image: `Imagenes/${item.codigo.toLowerCase()}-1.webp`,
            brand: item.marca,
            category: item.rubro,
            description: item.descripcion,
            quantity: 1,
            stock: item.stock > 0
        });
    }

    if (window.saveCart) window.saveCart();

    // Visual feedback on button
    const btn = event.currentTarget;
    const icon = btn.querySelector('i');
    if (icon) {
        const originalIcon = icon.getAttribute('data-lucide');
        icon.setAttribute('data-lucide', 'check');
        btn.classList.replace('bg-brand-blue', 'bg-green-500');
        if (typeof lucide !== 'undefined') lucide.createIcons();

        setTimeout(() => {
            icon.setAttribute('data-lucide', originalIcon);
            btn.classList.replace('bg-green-500', 'bg-brand-blue');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }, 1000);
    }
};
