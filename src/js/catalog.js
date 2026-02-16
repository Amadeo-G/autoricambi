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
        window.openProductDetail(code, false); // false to not push state again
    } else {
        window.closeModal(false);
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
            setTimeout(() => window.openProductDetail(exactMatch.codigo, false), 500);
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
        tr.className = "group hover:bg-gray-50 transition-colors duration-200 border-b border-gray-100 last:border-b-0 cursor-pointer";

        // Click en la fila -> Vista Previa
        tr.onclick = (e) => {
            // Si el clic fue en un botón o su icono, no cambiamos la selección (opcional)
            // O mejor, permitimos que seleccione también para feedback visual.
            // Pero evitemos conflictos si hay modales.
            if (e.target.closest('button')) return;
            window.selectPreview(item.codigo, tr);
        };

        tr.innerHTML = `
            <td class="p-4 font-bold text-sm text-gray-700" data-label="Código">
                <span class="bg-white px-2 py-1 rounded border border-gray-200 shadow-sm inline-block group-hover:border-brand-blue/30 transition-colors">${highlightText(item.codigo, q)}</span>
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
                      onclick="event.stopPropagation(); window.toggleTableCost('${item.codigo}', ${item.costo})">***</span>
            </td>
            <td class="p-4 text-center" data-label="Acción">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="window.addToCartFromCatalog('${item.codigo}', event)" 
                            class="p-2 bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition shadow-sm active:scale-95 z-10 relative" 
                            title="Agregar al carrito">
                        <i data-lucide="shopping-cart" class="w-4 h-4"></i>
                    </button>
                    <button onclick="event.stopPropagation(); window.openProductDetail('${item.codigo}')" 
                            class="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-brand-blue hover:text-white transition shadow-sm active:scale-95 z-10 relative" 
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

// --- PREVIEW LOGIC (Bottom Panel) ---
const panelEls = {
    container: document.getElementById('bottomPanel'),
    image: document.getElementById('panelImage'),
    features: document.getElementById('panelFeatures'),
    equivalents: document.getElementById('panelEquivalents'),
    price: document.getElementById('panelPrice'),
    cost: document.getElementById('panelCost'),
    stock: document.getElementById('panelStock'),
    btnAdd: document.getElementById('panelBtnAdd')
};

window.selectPreview = function (codigo, rowEl) {
    console.log("Selecting preview for:", codigo);

    // 1. Highlight Row Logic
    const prevRow = document.querySelector('tr.bg-blue-50.border-l-4');
    if (prevRow) {
        prevRow.classList.remove('bg-blue-50', 'border-l-4', 'border-brand-blue');
    }

    // Toggle logic: If clicking the same row, deselect?
    // Let's decide to always select for now, unless we want a toggle behavior.

    if (rowEl) {
        rowEl.classList.add('bg-blue-50', 'border-l-4', 'border-brand-blue');
    }

    // 2. Fetch Data
    const item = allData.find(d => d.codigo === codigo);
    if (!item) {
        console.error("Item not found:", codigo);
        return;
    }

    // 3. Show Panel (Slide Up)
    if (panelEls.container) {
        panelEls.container.classList.remove('translate-y-full');
    }

    // 4. Populate Data

    // Features
    if (panelEls.features) {
        panelEls.features.textContent = item.caracteristicas || "Sin características especificadas.";
    }

    // Equivalents
    if (panelEls.equivalents) {
        panelEls.equivalents.innerHTML = '';
        if (item.equivalentes) {
            const codes = item.equivalentes.split(/[,\n]/).filter(c => c.trim());
            codes.forEach(c => {
                const span = document.createElement('span');
                span.className = "font-mono text-[10px] bg-white border border-gray-300 px-1.5 py-0.5 rounded text-gray-600 select-all shadow-sm";
                span.textContent = c;
                panelEls.equivalents.appendChild(span);
            });
        } else {
            panelEls.equivalents.innerHTML = '<span class="text-xs text-gray-400 italic">N/A</span>';
        }
    }

    // Pricing
    if (panelEls.price) panelEls.price.textContent = `$ ${item.precio}`;

    // Cost (Hidden/Blurred by default logic handled by CSS classes, just set values)
    if (panelEls.cost) {
        // We store exact numeric value if needed, or just formatted
        panelEls.cost.textContent = `$ ${item.costo}`;
        panelEls.cost.dataset.raw = item.costo;
    }

    // Stock
    if (panelEls.stock) {
        panelEls.stock.innerHTML = getBadgeHtml(item.stock); // Use existing badge logic or text
        // Or simply text:
        // panelEls.stock.textContent = item.stock > 0 ? 'Disponible' : 'Sin Stock';
    }

    // Add Button Action
    if (panelEls.btnAdd) {
        const newBtn = panelEls.btnAdd.cloneNode(true);
        panelEls.btnAdd.parentNode.replaceChild(newBtn, panelEls.btnAdd);
        newBtn.onclick = (e) => window.addToCartFromCatalog(item.codigo, e);

        // Disable if no stock? Or let global logic handle it
        if (item.stock <= 0 && item.stock > -1) { // 0 but not negative (diferido)
            // newBtn.disabled = true;
            // newBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }

    // Image Loading (Robust)
    if (panelEls.image) {
        const codeLower = item.codigo.toLowerCase();
        const r2Src = `${R2_BASE_URL}/${codeLower}-1.webp`;
        const localSrc = `/Imagenes/${codeLower}-1.webp`;
        const placeholderSrc = 'https://placehold.co/150x150/f3f4f6/cbd5e1?text=Sin+Imagen'; // Smaller size

        panelEls.image.onload = null; // Clear prev handlers

        panelEls.image.onerror = function () {
            console.warn("Panel Image failed:", this.src);
            if (this.src.includes('r2.dev')) {
                this.src = localSrc;
            } else if (!this.src.includes('placehold.co')) {
                this.src = placeholderSrc;
            }
            this.onerror = null;
        };

        panelEls.image.src = r2Src;
    }
};

window.togglePanelCost = function () {
    const costEl = document.getElementById('panelCost');
    const icon = document.getElementById('panelCostIcon');
    if (!costEl) return;

    // Toggle blur class
    if (costEl.classList.contains('blur-sm')) {
        costEl.classList.remove('blur-sm');
        if (icon) icon.setAttribute('data-lucide', 'eye');
    } else {
        costEl.classList.add('blur-sm');
        if (icon) icon.setAttribute('data-lucide', 'eye-off');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

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

    // Display Price
    const priceEl = document.getElementById('modalPrecio');
    if (priceEl) priceEl.textContent = `$ ${item.precio}`;




    // Features
    const featContainer = document.getElementById('modalFeatures');
    featContainer.innerHTML = '';
    if (item.caracteristicas) {
        const feats = item.caracteristicas.split(/[,\n]/).filter(f => f.trim());
        feats.forEach(f => {
            const span = document.createElement('span');
            span.className = "bg-white text-gray-700 px-2 py-1 rounded text-xs border border-gray-200 shadow-sm";
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
            span.className = "font-mono text-xs bg-white border border-gray-200 px-2 py-1 rounded text-gray-500 select-all shadow-sm";
            span.textContent = c;
            equivContainer.appendChild(span);
        });
    } else {
        equivContainer.innerHTML = '<span class="text-gray-400 italic text-xs">N/A</span>';
    }

    // Images Carousel Logic (R2 with fallback)
    const codeLower = item.codigo.toLowerCase();

    for (let i = 1; i <= 3; i++) {
        const imgEl = document.getElementById(`modalImg${i}`);
        if (imgEl) {
            // Fallback logic chain: R2 (.jpg) -> Local (.webp) -> Placeholder
            imgEl.onerror = function () {
                const currentSrc = this.src;

                // If failed R2 JPG, try local WebP (legacy)
                if (currentSrc.includes('r2.dev')) {
                    this.src = `/Imagenes/${codeLower}-${i}.webp`;
                    return;
                }

                // If failed local or other, show placeholder
                this.src = 'https://placehold.co/600x400/f3f4f6/a3a3a3?text=Sin+Imagen';
                this.onerror = null; // Stop chain
            };

            // Try R2 first (assuming .webp for uploads based on user request)
            imgEl.src = `${R2_BASE_URL}/${codeLower}-${i}.webp`;
        }
    }

    // Show Modal
    const modal = document.getElementById('productModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex'); // Ensure flex display

    // Setup Add to Cart Button Logic (Footer)
    const btnAddFooter = document.getElementById('modalBtnAddFooter');
    if (btnAddFooter) {
        const newBtnFooter = btnAddFooter.cloneNode(true);
        btnAddFooter.parentNode.replaceChild(newBtnFooter, btnAddFooter);
        newBtnFooter.onclick = (e) => window.addToCartFromCatalog(item.codigo, e);
    }


    // Reset Carousel to slide 1 (simple visibility toggle needed if implementing full carousel)
    showSlide(1);
    if (typeof lucide !== 'undefined') lucide.createIcons();
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

// --- ZOOM LOGIC (2x) ---
function initZoom() {
    const container = document.getElementById('modalImageContainer');
    if (!container) return;

    // Add magnifying glass cursor on hover
    container.addEventListener('mouseenter', () => {
        container.style.cursor = 'zoom-in';
    });

    container.addEventListener('mousemove', (e) => {
        // Find visible image
        const img = Array.from(container.querySelectorAll('img')).find(el => el.style.display !== 'none');
        if (!img) return;

        const rect = container.getBoundingClientRect();

        // Calculate mouse position as percentage within the container
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Use percentages for transform-origin to properly center the zoom on cursor
        const xPercent = (x / rect.width) * 100;
        const yPercent = (y / rect.height) * 100;

        img.style.transformOrigin = `${xPercent}% ${yPercent}%`;
        img.style.transform = "scale(2)"; // 2x Zoom
    });

    container.addEventListener('mouseleave', () => {
        const img = Array.from(container.querySelectorAll('img')).find(el => el.style.display !== 'none');
        if (!img) return;

        // Reset
        img.style.transformOrigin = "center center";
        img.style.transform = "scale(1)";
        container.style.cursor = '';
    });
}
