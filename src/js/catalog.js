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

    // New mapping starting from row 3 (index 2):
    // A=0: Codigo, B=1: Descripcion, C=2: Costo ((C * 58) / 10000 for precio), 
    // I=8: SubRubro, L=11: Stock, N=13: Marca, O=14: Rubro
    allData = data.slice(1).map(row => {
        // Calculate precio from costo: (column C * 58) / 10000
        let costoValue = parseFloat((row[2] || '0').toString().replace(/[^\d.-]/g, '')) || 0;
        let precioCalculado = (costoValue * 58) / 10000;

        // Normalize description: replace "BBA" at the start with "BOMBA"
        let descripcionRaw = (row[1] || '').toString().trim();
        let descripcionNormalizada = descripcionRaw.replace(/^BBA\b/i, 'BOMBA');

        const sub = (row[8] || '').toString().trim();
        const invalidSubs = ['INA', 'BOSCH', 'CONTITECH'];
        const subrubroFiltered = invalidSubs.includes(sub.toUpperCase()) ? '' : sub;

        return {
            codigo: (row[0] || '').toString().trim(),
            descripcion: descripcionNormalizada,
            costo: costoValue.toString(),
            precio: precioCalculado.toFixed(2),
            subrubro: subrubroFiltered,
            stock: parseInt((row[11] || 0).toString().replace(/\D/g, '')) || 0,
            marca: (row[13] || '').toString().trim(),
            rubro: (row[14] || '').toString().trim()
        };
    }).filter(item => {
        const cod = item.codigo.toLowerCase();
        const rub = item.rubro.toLowerCase();
        if (cod === 'código' || cod === 'codigo' || cod.includes('columna')) return false;
        const invalidRubros = ['13', 'puente', 'mariposa', 'columna 13', 'columna 7', 'columna 12', 'cable puente', 'cuerpo mariposa'];
        return item.codigo !== '' && !invalidRubros.includes(rub) && rub !== '';
    });

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
function applyFilters() {
    const rub = els.rubro ? els.rubro.value : '';
    const sub = els.subrubro ? els.subrubro.value : '';
    const mar = els.marca ? els.marca.value : '';
    const search = els.search.value.toLowerCase().trim();
    const terms = search.split(/\s+/).filter(t => t);

    filteredData = allData.filter(item => {
        const matchFiltros = (!rub || item.rubro === rub) && (!sub || item.subrubro === sub) && (!mar || item.marca === mar);
        const itemVals = Object.values(item).map(v => v.toString().toLowerCase());
        const matchSearch = terms.every(t => itemVals.some(v => v.includes(t)));
        return matchFiltros && matchSearch;
    });
    renderTable(search);
}

function highlightText(text, query) {
    if (!query) return text;
    const terms = query.split(/\s+/).filter(t => t).sort((a, b) => b.length - a.length);
    if (!terms.length) return text;
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

    // Price
    const formatPrice = (val) => {
        // Simple heuristic parsing
        let n = parseFloat(val.toString().replace('$', '').replace(',', ''));
        if (isNaN(n)) return '---';
        return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
    };

    // Display Price (Simulate Cost being hidden/secure)
    document.getElementById('modalPrecio').textContent = formatPrice(item.precio);

    // Features and Equivalents removed per requested simplification
    const featContainer = document.getElementById('modalFeatures');
    if (featContainer) featContainer.innerHTML = '<span class="text-gray-400 italic text-xs">Información simplificada</span>';

    const equivContainer = document.getElementById('modalEquivalents');
    if (equivContainer) equivContainer.innerHTML = '<span class="text-gray-400 italic text-xs">N/A</span>';

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
