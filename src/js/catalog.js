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
    // Check for URL params to auto-search
    const urlParams = new URLSearchParams(window.location.search);
    const initialQuery = urlParams.get('s');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    fetchData(initialQuery);
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

function parseExcel(arrayBuffer, initialQuery = null) {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });


    allData = data.slice(2).map(row => {
        const baseValue = parsePrice(row[2]); // Column C is now the Price
        const costVal = baseValue * 0.58;     // Cost is 58% of Price

        return {
            codigo: (row[0] || '').toString().trim(),         // Column A
            descripcion: (row[1] || '').toString().trim(),    // Column B
            costo: costVal,
            precio: formatPrice(baseValue),
            subrubro: (row[8] || '').toString().trim(),       // Column I
            marca: (row[13] || '').toString().trim(),         // Column N
            rubro: (row[14] || '').toString().trim(),         // Column O
            caracteristicas: '', // Not specified in New Mapping, keep empty for now
            equivalentes: '',   // Not specified in New Mapping, keep empty for now
            stock: parseInt((row[11] || 0).toString().replace(/\D/g, '')) || 0 // Column L
        };
    }).filter(item => item.codigo && item.rubro);

    initFilters();

    // Auto-search if query exists
    if (initialQuery) {
        els.search.value = initialQuery;
        applyFilters();
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

// Synonyms Configuration
const SYNONYMS = {
    'bomba': ['bba'],
    'bba': ['bomba'],
    'k': ['kit'],
    'kit': ['k'],
    'izq': ['izquierda'],
    'der': ['derecha'],
    'del': ['delantera'],
    'tras': ['trasera']
};

// Levenshtein Distance for Fuzzy Search
function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1  // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

function expandTerm(term) {
    const expansions = [term];
    if (SYNONYMS[term]) {
        expansions.push(...SYNONYMS[term]);
    }
    return expansions;
}

// Helper to remove accents/diacritics

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

    // Split query into terms and filter empty
    const queryTerms = searchNorm.split(/\s+/).filter(t => t);

    // If no search terms and no filters, show all (or limit if needed, but logic below handles filtering)
    // We only filter if we have > 0 terms or active select filters.

    filteredData = allData.map(item => {
        // 1. Hard Filters (Rubro, Subrubro, Marca) - boolean check
        const matchFiltros = (!rub || item.rubro === rub) && (!sub || item.subrubro === sub) && (!mar || item.marca === mar);
        if (!matchFiltros) return { item, score: -1 };

        // 2. Search Text Scoring
        if (queryTerms.length === 0) return { item, score: 1 }; // Pass if no search terms

        // Prepare text to search against
        const fieldsToSearch = [item.codigo, item.descripcion, item.marca, item.rubro, item.subrubro];
        const itemText = normalizeText(fieldsToSearch.join(" "));
        const itemWords = itemText.split(/\s+/); // Tokenize item text for better matching

        let totalScore = 0;
        let allTermsMatched = true;

        for (const term of queryTerms) {
            let termMatched = false;
            let termBestScore = 0;

            // Expand synonyms
            const expandedTerms = expandTerm(term);

            for (const expanded of expandedTerms) {
                // Exact substring match in full text
                if (itemText.includes(expanded)) {
                    termBestScore = Math.max(termBestScore, 10);
                    termMatched = true;
                }

                // Check against individual words for Fuzzy
                if (!termMatched && expanded.length > 3) {
                    for (const word of itemWords) {
                        const dist = levenshtein(expanded, word);
                        // Allow 1 substitution/deletion for words 4-6 chars, 2 for longer
                        const threshold = expanded.length > 6 ? 2 : 1;
                        if (dist <= threshold) {
                            termBestScore = Math.max(termBestScore, 5); // Lower score for fuzzy
                            termMatched = true;
                            break;
                        }
                    }
                }
            }

            if (termMatched) {
                totalScore += termBestScore;
            } else {
                allTermsMatched = false;
            }
        }

        if (allTermsMatched) return { item, score: totalScore };
        return { item, score: -1 };
    })
        .filter(result => result.score > 0)
        .sort((a, b) => b.score - a.score) // Sort by relevance
        .map(result => result.item); // Unwrap

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
            <td class="p-4 font-bold text-sm text-gray-700 w-1/4" data-label="Código">
                <span class="bg-white px-2 py-1 rounded border border-gray-200 shadow-sm inline-block">${highlightText(item.codigo, q)}</span>
            </td>
            <td class="p-4 text-sm text-gray-800 w-3/4" data-label="Descripción">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <span class="font-medium">${highlightText(item.descripcion, q)}</span>
                     <div class="flex items-center gap-2 mt-2 md:mt-0">
                        <button onclick="window.openProductDetail('${item.codigo}')" class="flex-none flex items-center gap-2 px-4 py-1.5 bg-white hover:bg-brand-blue hover:text-white text-brand-blue border border-brand-blue rounded-full text-xs font-bold transition-all shadow-sm active:scale-95">
                            <i data-lucide="eye" class="w-3 h-3"></i> Ver
                        </button>
                        ${getBadgeHtml(item.stock)}
                     </div>
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
window.openProductDetail = function (codigo) {
    const item = allData.find(d => d.codigo === codigo);
    if (!item) return;

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

window.closeModal = function () {
    const modal = document.getElementById('productModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
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

window.toggleCostVisibility = function () {
    const costEl = document.getElementById('modalCosto');
    // Lucide replaces <i> with <svg>, so we look for both or just use the container
    const btnIcon = document.querySelector('[onclick="window.toggleCostVisibility()"] i, [onclick="window.toggleCostVisibility()"] svg');
    if (!costEl || !btnIcon) return;

    const isHidden = costEl.classList.contains('is-hidden');
    if (isHidden) {
        costEl.textContent = costEl.dataset.value;
        costEl.classList.remove('is-hidden');
        btnIcon.setAttribute('data-lucide', 'eye');
    } else {
        costEl.textContent = '••••••••';
        costEl.classList.add('is-hidden');
        btnIcon.setAttribute('data-lucide', 'eye-off');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
};
