// catalog.js - Logic for the Dynamic Excel Catalog

// CONFIGURATION
const EXCEL_FILE_PATH = '/Filtros.xlsx';
const R2_BASE_URL = 'https://pub-4a74b73ccfa3493ebcfc17e92136dcf4.r2.dev';

// GLOBAL STATE
let allData = [];
let filteredData = [];
let pendingInitialCode = null;
let currentServerLastModified = null;

// WEB WORKER INITIALIZATION
const excelWorker = new Worker('/src/js/excel-worker.js');
let currentStickyCost = 0; // Para almacenar el costo del item seleccionado
let currentStickyCode = null; // Para saber qué item está seleccionado

excelWorker.onmessage = async function (e) {
    const { type, data, error } = e.data;

    if (type === 'DONE') {
        allData = data;
        initFilters();
        handleInitialCode(pendingInitialCode);
    } else if (type === 'CACHE_DATA') {
        // Cache the RAW data (rows) for future loads
        if (currentServerLastModified) {
            await dbHelper.set('rawData', data);
            await dbHelper.set('lastModified', currentServerLastModified);
        }
    } else if (type === 'ERROR') {
        console.error("Worker Error:", error);
        if (els.tbody) {
            els.tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Error al procesar datos: ${error}</td></tr>`;
        }
    }
};

// CACHE CONFIGURATION
const CACHE_DB_NAME = 'AutoricambiCatalog';
const CACHE_STORE_NAME = 'catalog_cache';

const dbHelper = {
    open: () => new Promise((resolve) => {
        const request = indexedDB.open(CACHE_DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
                db.createObjectStore(CACHE_STORE_NAME);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
    }),
    get: async (key) => {
        const db = await dbHelper.open();
        return new Promise((resolve) => {
            const tx = db.transaction(CACHE_STORE_NAME, 'readonly');
            const req = tx.objectStore(CACHE_STORE_NAME).get(key);
            req.onsuccess = () => resolve(req.result);
        });
    },
    set: async (key, val) => {
        const db = await dbHelper.open();
        const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
        tx.objectStore(CACHE_STORE_NAME).put(val, key);
        return tx.complete;
    }
};

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
    // Unified Path Detection: Handles both /buscador/CODE and ?p=CODE
    const path = window.location.pathname;
    const match = path.match(/\/(buscador|buscador.html)\/([^/]+)/);
    const codeFromPath = match ? match[2] : null;

    const urlParams = new URLSearchParams(window.location.search);
    const initialCode = codeFromPath || urlParams.get('p') || urlParams.get('s');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    fetchData(initialCode);
    initZoom(); // Initialize zoom functionality
});

// Handle Back/Forward buttons in browser
window.addEventListener('popstate', (event) => {
    const path = window.location.pathname;
    const match = path.match(/\/(buscador|buscador.html)\/([^/]+)/);
    const code = match ? match[2] : null;

    if (code) {
        // Redirigir al sticky
        window.selectProductForSticky(code);
    } else {
        // Cerrar sticky si fuese necesario (opcional)
        const footer = document.getElementById('stickyFooter');
        if (footer) footer.classList.add('translate-y-full');
    }
});

// 1. DATA LOADING & PARSING

// Helper to format Argentinian price: 1678.73 -> "1.678,73" (Con 2 decimales)
const formatPrice = (val) => {
    return val.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

async function fetchData(initialCode = null) {
    pendingInitialCode = initialCode;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userDiscount = (user.discount !== undefined && user.discount !== null) ? parseFloat(user.discount) : 42;

    try {
        // 1. Check if we have a cached version and its timestamp
        const cachedLastModified = await dbHelper.get('lastModified');
        const cachedData = await dbHelper.get('rawData'); // Raw JSON rows

        // SESSION CACHE OPTIMIZATION:
        // If we have verified the data *during this session*, we skip the network HEAD check entirely.
        const isSessionSynced = sessionStorage.getItem('catalog_synced');

        if (isSessionSynced && cachedData) {
            console.log("⚡ Session synced. Loading immediately from local cache (No Server Check).");
            if (els.tbody) els.tbody.innerHTML = `<tr><td colspan="5" class="p-12 text-center text-brand-blue italic"><i class="fas fa-circle-notch fa-spin mr-2"></i>Recuperando datos...</td></tr>`;

            excelWorker.postMessage({
                type: 'PROCESS_JSON',
                data: cachedData,
                userDiscount: userDiscount
            });
            return;
        }

        // 2. Perform a HEAD request to check the server version
        try {
            const headResponse = await fetch(EXCEL_FILE_PATH, { method: 'HEAD' });
            currentServerLastModified = headResponse.headers.get('Last-Modified');
        } catch (e) {
            console.warn("Could not perform HEAD request for cache validation:", e);
        }

        if (cachedData && currentServerLastModified && cachedLastModified === currentServerLastModified) {
            console.log("🚀 Server verified. Loading from IndexedDB Cache (Background Process)...");
            sessionStorage.setItem('catalog_synced', 'true'); // Mark as synced for this session

            if (els.tbody) els.tbody.innerHTML = `<tr><td colspan="5" class="p-12 text-center text-brand-blue italic"><i class="fas fa-circle-notch fa-spin mr-2"></i>Procesando datos...</td></tr>`;

            excelWorker.postMessage({
                type: 'PROCESS_JSON',
                data: cachedData,
                userDiscount: userDiscount
            });
            return;
        }

        // 3. If cache is invalid or missing, fetch the whole Excel file
        console.log("📥 Cache miss or outdated. Fetching Filtros.xlsx...");
        if (els.tbody) els.tbody.innerHTML = `<tr><td colspan="5" class="p-12 text-center text-brand-blue italic"><i class="fas fa-cloud-download-alt mr-2"></i>Descargando catálogo actualizado...</td></tr>`;

        const response = await fetch(`${EXCEL_FILE_PATH}?t=${Date.now()}`);
        if (!response.ok) throw new Error("No se pudo cargar el catálogo.");
        const arrayBuffer = await response.arrayBuffer();

        // Mark as synced after successful download
        sessionStorage.setItem('catalog_synced', 'true');

        if (els.tbody) els.tbody.innerHTML = `<tr><td colspan="5" class="p-12 text-center text-brand-blue italic"><i class="fas fa-cog fa-spin mr-2"></i>Procesando base de datos...</td></tr>`;

        // Send ArrayBuffer to worker for parsing and processing
        excelWorker.postMessage({
            type: 'PARSE_EXCEL',
            data: arrayBuffer,
            userDiscount: userDiscount
        });

    } catch (error) {
        console.error("Fetch Error:", error);
        // Fallback: try to use cache even if HEAD request failed (offline)
        const offlineData = await dbHelper.get('rawData');
        if (offlineData) {
            console.warn("⚠️ Using offline cache due to fetch error.");
            document.title = "[OFFLINE] " + document.title;
            excelWorker.postMessage({
                type: 'PROCESS_JSON',
                data: offlineData,
                userDiscount: userDiscount
            });
        } else if (els.tbody) {
            els.tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Error: ${error.message}</td></tr>`;
        }
    }
}

function handleInitialCode(initialCode) {
    if (initialCode) {
        const cleanCode = initialCode.trim().toLowerCase();
        if (els.tbody) els.tbody.innerHTML = `<tr><td colspan="5" class="p-12 text-center text-brand-blue font-bold italic">Buscando producto: ${initialCode}...</td></tr>`;
        const exactMatch = allData.find(d => d.codigo.toLowerCase() === cleanCode);
        if (exactMatch) {
            setTimeout(() => window.selectProductForSticky(exactMatch.codigo), 500);
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
    // Populate all initial values
    populateSelect(els.rubro, getUniqueValues(allData, 'rubro'), "Todos los Rubros");
    populateSelect(els.subrubro, getUniqueValues(allData, 'subrubro'), "Todos los Subrubros");
    populateSelect(els.marca, getUniqueValues(allData, 'marca'), "Todas las Marcas");
}

function syncFilters(changedField) {
    const r = els.rubro.value;
    const s = els.subrubro.value;
    const m = els.marca.value;

    // We refresh the options for the fields that WERE NOT changed
    // based on what's available for the current selections.

    if (changedField !== 'rubro') {
        // Find rubros matching current subrubro and marca
        let filtered = allData;
        if (s) filtered = filtered.filter(item => item.subrubro === s);
        if (m) filtered = filtered.filter(item => item.marca === m);
        const available = getUniqueValues(filtered, 'rubro');
        updateSelectOptions(els.rubro, available, r, "Todos los Rubros");
    }

    if (changedField !== 'subrubro') {
        let filtered = allData;
        if (r) filtered = filtered.filter(item => item.rubro === r);
        if (m) filtered = filtered.filter(item => item.marca === m);
        const available = getUniqueValues(filtered, 'subrubro');
        updateSelectOptions(els.subrubro, available, s, "Todos los Subrubros");
    }

    if (changedField !== 'marca') {
        let filtered = allData;
        if (r) filtered = filtered.filter(item => item.rubro === r);
        if (s) filtered = filtered.filter(item => item.subrubro === s);
        const available = getUniqueValues(filtered, 'marca');
        updateSelectOptions(els.marca, available, m, "Todas las Marcas");
    }

    applyFilters();
}

// Helper to update options while preserving selection
function updateSelectOptions(selectElement, values, currentValue, defaultText) {
    selectElement.innerHTML = `<option value="">${defaultText}</option>`;
    values.forEach(val => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = val;
        if (val === currentValue) opt.selected = true;
        selectElement.appendChild(opt);
    });
}

if (els.rubro) {
    els.rubro.addEventListener('change', () => syncFilters('rubro'));
}
if (els.subrubro) {
    els.subrubro.addEventListener('change', () => syncFilters('subrubro'));
}
if (els.marca) {
    els.marca.addEventListener('change', () => syncFilters('marca'));
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

// Helper to normalize parts of a code (remove leading zeros from numeric segments)
function ultraCleanCode(text) {
    if (!text) return "";
    return text.toString()
        .split(/[^a-z0-9]/i) // Split by non-alphanumeric
        .filter(p => p)      // Remove empty parts
        .map(p => {
            // If it's a number, remove leading zeros (00123 -> 123)
            if (/^\d+$/.test(p)) return parseInt(p, 10).toString();
            return p.toLowerCase();
        })
        .join("");
}

function applyFilters() {
    const rub = els.rubro ? els.rubro.value : '';
    const sub = els.subrubro ? els.subrubro.value : '';
    const mar = els.marca ? els.marca.value : '';
    const searchRaw = els.search.value.trim();
    const searchNorm = normalizeText(searchRaw);
    const terms = searchNorm.split(/\s+/).filter(t => t);

    // Prepare ultra-clean versions for flexible code search
    const ultraCleanQuery = ultraCleanCode(searchRaw);

    filteredData = allData.filter(item => {
        const matchFiltros = (!rub || item.rubro === rub) && (!sub || item.subrubro === sub) && (!mar || item.marca === mar);
        if (!matchFiltros) return false;

        // If no search query, match only filters
        if (!searchRaw) return true;

        // Strategy 1: Standard Search (includes Description, Brand, etc.)
        const itemText = normalizeText([item.codigo, item.descripcion, item.marca, item.rubro, item.subrubro].join(" "));
        const matchStandard = terms.every(t => itemText.includes(t));
        if (matchStandard) return true;

        // Strategy 2: Flexible Code Search (Improved fuzzy matching)
        if (ultraCleanQuery.length >= 2) {
            const itemUltraClean = ultraCleanCode(item.codigo);

            // Si es un match directo o contenido, listo
            if (itemUltraClean.includes(ultraCleanQuery)) return true;

            // Búsqueda por segmentos (para casos como KTB271 -> LKTBN271)
            // Dividimos la búsqueda en grupos de letras y grupos de números
            const queryParts = searchRaw.match(/[a-z]+|\d+/gi) || [];
            if (queryParts.length > 1) {
                let lastIdx = -1;
                const allPartsMatch = queryParts.every(part => {
                    const cleanPart = /^\d+$/.test(part) ? parseInt(part, 10).toString() : part.toLowerCase();
                    const foundIdx = itemUltraClean.indexOf(cleanPart, lastIdx + 1);
                    if (foundIdx > lastIdx) {
                        lastIdx = foundIdx;
                        return true;
                    }
                    return false;
                });
                if (allPartsMatch) return true;
            }
        }

        return false;
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

    // Ordenar por relevancia cuando hay búsqueda, alfabéticamente cuando no
    const sortedData = [...filteredData].sort((a, b) => {
        const codigoA = (a.codigo || '').toLowerCase();
        const codigoB = (b.codigo || '').toLowerCase();

        // Si hay una búsqueda activa, ordenar por relevancia + alfabético
        if (q && q.trim()) {
            const searchTerm = q.toLowerCase().trim();

            // Calcular tipo de coincidencia (no score numérico, sino categoría)
            const getMatchType = (codigo) => {
                // 1. Coincidencia exacta completa
                if (codigo === searchTerm) {
                    return 4;
                }

                // 2. Comienza con el término de búsqueda
                if (codigo.startsWith(searchTerm)) {
                    return 3;
                }

                // 3. Contiene el término de búsqueda
                if (codigo.indexOf(searchTerm) !== -1) {
                    return 2;
                }

                // 4. Coincidencia parcial de caracteres en orden
                let matchCount = 0;
                let lastIndex = -1;
                for (let char of searchTerm) {
                    const idx = codigo.indexOf(char, lastIndex + 1);
                    if (idx > lastIndex) {
                        matchCount++;
                        lastIndex = idx;
                    }
                }

                if (matchCount > 0) {
                    return 1;
                }

                // 5. Sin coincidencia
                return 0;
            };

            const typeA = getMatchType(codigoA);
            const typeB = getMatchType(codigoB);

            // Si tienen diferente tipo de coincidencia, ordenar por tipo
            if (typeA !== typeB) {
                return typeB - typeA;
            }

            // Si tienen el mismo tipo de coincidencia, ordenar alfabéticamente
            // Esto mantiene Bi372, Bi372 10, Bi372 20 antes que Bi810
            return codigoA.localeCompare(codigoB, 'es', {
                sensitivity: 'base',
                numeric: true  // Esto maneja números correctamente (Bi372 10 < Bi372 20)
            });
        }

        // Si no hay búsqueda, ordenar alfabéticamente
        return codigoA.localeCompare(codigoB, 'es', {
            sensitivity: 'base',
            numeric: true
        });
    });

    const fragment = document.createDocumentFragment();
    // Limit to 100 for performance
    sortedData.slice(0, 100).forEach(item => {
        const tr = document.createElement('tr');
        // Add cursor-pointer and click handler to row
        tr.className = "hover:bg-blue-50/50 cursor-pointer transition-colors duration-200 border-b border-gray-100 last:border-b-0 group/row";
        tr.onclick = (e) => {
            // Avoid triggering if clicked on action buttons
            if (e.target.closest('button') || e.target.closest('.no-select')) return;
            window.selectProductForSticky(item.codigo);
        };

        tr.innerHTML = `
            <td class="p-4 font-bold text-sm text-gray-700" data-label="Código">
                <span class="bg-white px-2 py-1 rounded border border-gray-200 shadow-sm inline-block group-hover/row:border-blue-200 group-hover/row:text-brand-blue transition-colors">${highlightText(item.codigo, q)}</span>
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
            <td class="p-4 text-right font-bold text-gray-400" data-label="Costo">
                <span id="cost-${item.codigo}" 
                      class="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-all select-none"
                      onclick="window.toggleTableCost('${item.codigo}', ${item.costo})">***</span>
            </td>
            <td class="p-4 text-center" data-label="Acción">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="window.addToCartFromCatalog('${item.codigo}', event)" 
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
    let colorStyle = '';
    let colorClass = 'bg-red-500';
    let title = 'Sin Stock';

    if (stock < 0) {
        colorStyle = 'style="background-color: #991b1b;"'; // Bordó (red-800 en Tailwind)
        colorClass = ''; // No usar clase cuando hay style inline
        title = 'Entrega Diferida';
    } else if (stock > 5) {
        colorClass = 'bg-green-500';
        title = 'Stock Disponible';
    } else if (stock >= 1) {
        colorClass = 'bg-yellow-400';
        title = 'Últimas Unidades';
    }

    return `<div class="w-3 h-3 rounded-full ${colorClass} shadow-sm" ${colorStyle} title="${title}: ${stock}"></div>`;
}

// --- STICKY FOOTER LOGIC ---

window.selectProductForSticky = function (codigo) {
    const item = allData.find(d => d.codigo === codigo);
    if (!item) return;

    currentStickyCode = item.codigo;
    currentStickyCost = item.costo;

    const footer = document.getElementById('stickyFooter');
    if (!footer) return;

    // 1. Populate Info
    document.getElementById('stickyCode').textContent = item.codigo;
    document.getElementById('stickyBrand').textContent = item.marca || 'GENÉRICO';
    document.getElementById('stickyDesc').textContent = item.descripcion;
    document.getElementById('stickyPrice').textContent = `$ ${formatPrice(item.precio)}`;

    // Reset Cost to hidden state
    const costPageEl = document.getElementById('stickyCost');
    if (costPageEl) {
        costPageEl.textContent = '****';
        costPageEl.classList.remove('text-brand-blue');
        costPageEl.classList.add('text-gray-300');
    }

    // 2. Features
    const featContainer = document.getElementById('stickyFeatures');
    featContainer.innerHTML = '';
    if (item.caracteristicas) {
        const feats = item.caracteristicas.split(/[,\n]/).filter(f => f.trim());
        feats.slice(0, 5).forEach(f => { // Limit to 5 for UI balance
            const span = document.createElement('span');
            span.className = "bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] border border-gray-200";
            span.textContent = f;
            featContainer.appendChild(span);
        });
        if (feats.length > 5) {
            const more = document.createElement('span');
            more.className = "text-[10px] text-gray-400 italic px-1";
            more.textContent = `+${feats.length - 5} más`;
            featContainer.appendChild(more);
        }
    } else {
        featContainer.innerHTML = '<span class="text-gray-300 italic text-[10px]">Sin características</span>';
    }

    // 3. Equivalences
    const equivContainer = document.getElementById('stickyEquivs');
    equivContainer.innerHTML = '';
    if (item.equivalentes) {
        const codes = item.equivalentes.split(/[,\n]/).filter(c => c.trim());
        codes.slice(0, 8).forEach(c => {
            const span = document.createElement('span');
            span.className = "font-mono text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-500";
            span.textContent = c;
            equivContainer.appendChild(span);
        });
    } else {
        equivContainer.innerHTML = '<span class="text-gray-300 italic text-[10px]">N/A</span>';
    }

    // 4. Image
    const imgEl = document.getElementById('stickyImg');
    const codeLower = item.codigo.toLowerCase();
    // Reset to R2 or placeholder logic
    const trySetImage = (url) => {
        imgEl.src = url;
    };

    // Chain: R2 -> Local -> Placeholder
    imgEl.onload = null; // Clear prev handlers
    imgEl.onerror = function () {
        if (this.src.includes('r2.dev')) {
            this.src = `/Imagenes/${codeLower}-1.webp`;
        } else if (this.src.includes('/Imagenes/')) {
            this.src = 'https://placehold.co/250x250/f3f4f6/cbd5e1?text=Sin+Imagen';
        }
    };
    trySetImage(`${R2_BASE_URL}/${codeLower}-1.webp`);

    // 5. Button Action
    const btn = document.getElementById('stickyBtnAdd');
    btn.onclick = (e) => window.addToCartFromCatalog(item.codigo, e);

    // 6. Show Footer with Animation
    footer.classList.remove('translate-y-full');

    // 7. Add spacer to prevent content from being hidden
    let spacer = document.getElementById('stickySpacer');
    if (!spacer) {
        spacer = document.createElement('div');
        spacer.id = 'stickySpacer';
        spacer.style.height = '160px'; // New Compact Footer height (140px) + buffer
        spacer.style.transition = 'height 0.3s ease';
        // Insert after the table container or at the end of main
        const main = document.querySelector('main');
        if (main) main.appendChild(spacer);
    } else {
        spacer.style.height = '160px';
        spacer.style.display = 'block';
    }
}

window.toggleStickyCost = function () {
    const el = document.getElementById('stickyCost');
    if (!el) return;

    if (el.textContent === '****') {
        el.textContent = `$ ${formatPrice(currentStickyCost)}`;
        el.classList.remove('text-gray-300');
        el.classList.add('text-brand-blue');
    } else {
        el.textContent = '****';
        el.classList.remove('text-brand-blue');
        el.classList.add('text-gray-300');
    }
};

window.closeSticky = function () {
    const footer = document.getElementById('stickyFooter');
    if (footer) footer.classList.add('translate-y-full');

    const spacer = document.getElementById('stickySpacer');
    if (spacer) {
        spacer.style.height = '0px';
        // Optional: set display none after transition
    }
};

// Event Listeners
// Event Listeners
if (els.btnSearch) els.btnSearch.addEventListener('click', applyFilters);

// Live search: Update while typing
if (els.search) {
    let searchTimeout;
    els.search.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        // Small delay (300ms) to avoid too many renders while typing fast
        searchTimeout = setTimeout(applyFilters, 300);
    });

    // Also capture Enter for immediate search
    els.search.addEventListener('keypress', e => e.key === 'Enter' && applyFilters());
}
els.btnReset.addEventListener('click', () => {
    els.search.value = '';
    if (els.rubro) els.rubro.value = '';
    if (els.subrubro) els.subrubro.value = '';
    if (els.marca) els.marca.value = '';

    // Re-habilitar y poblar todos los filtros originales
    initFilters();

    filteredData = [];
    showInitialMessage();

    // Reset Sticky Footer state
    if (window.closeSticky) window.closeSticky();

    // Animación del icono
    const icon = els.btnReset.querySelector('i');
    if (icon) {
        icon.classList.add('animate-spin');
        setTimeout(() => icon.classList.remove('animate-spin'), 500);
    }
});

document.getElementById('btnResetInline')?.addEventListener('click', () => els.btnReset.click());

function showInitialMessage() {
    if (els.tbody) els.tbody.innerHTML = `<tr><td colspan="2" class="p-12 text-center text-gray-400 italic">Selecciona filtros o escribe un código para buscar.</td></tr>`;
    if (els.count) els.count.textContent = '';
    if (els.status) els.status.classList.add('hidden');
}

// --- MODAL LOGIC (Exposed globally) ---
// --- STICKY REDIRECT (Formerly Modal) ---
window.openProductDetail = function (codigo, pushState = true) {
    // Redirect legacy calls to the sticky footer
    window.selectProductForSticky(codigo);

    // Update URL if requested
    if (pushState) {
        const item = allData.find(d => d.codigo.toLowerCase() === codigo.toLowerCase());
        if (item) {
            const newPath = `/buscador/${item.codigo}`;
            history.pushState({ codigo: item.codigo }, '', newPath);
        }
    }
};

window.closeModal = function () {
    // Legacy support: Just close the sticky footer if needed
    const footer = document.getElementById('stickyFooter');
    if (footer) footer.classList.add('translate-y-full');
    history.pushState(null, '', '/buscador');
};

// Deprecated Carousel Logic Removed
// Deprecated Carousel Logic Removed
window.setSlide = function () { };
window.nextSlide = function () { };

// --- RESTORED FUNCTIONS ---

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

window.addToCartFromCatalog = function (codigo, event) {
    const item = allData.find(d => d.codigo === codigo);
    if (!item) return;

    if (item.stock <= 0) {
        const mensaje = item.stock < 0
            ? `El producto "${item.descripcion}" está en entrega diferida (stock: ${item.stock}). No se puede agregar al carrito en este momento.`
            : `Lo sentimos, el producto "${item.descripcion}" no tiene stock disponible.`;
        alert(mensaje);
        return;
    }

    if (!window.state || !window.state.cart) {
        console.error("Cart state not initialized");
        return;
    }

    const existingItem = window.state.cart.find(c => c.sku === item.codigo);
    if (existingItem) {
        if (existingItem.quantity + 1 > item.stock) {
            alert(`No puedes agregar más unidades. El stock disponible para este producto es ${item.stock}.`);
            return;
        }
        existingItem.quantity += 1;
    } else {
        window.state.cart.push({
            id: Date.now() + Math.random(), // Unique temp ID
            name: item.descripcion,
            sku: item.codigo,
            price: item.costo, // Using COST instead of PV for wholesale
            image: `${R2_BASE_URL}/${item.codigo.toLowerCase()}-1.webp`,
            brand: item.marca,
            category: item.rubro,
            description: item.descripcion,
            quantity: 1,
            maxStock: item.stock,
            stock: true
        });
    }

    if (window.saveCart) window.saveCart();

    // Visual feedback on button
    if (event && event.currentTarget) {
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
    }
};

// Zoom logic no longer needed as modal is removed
function initZoom() { }
