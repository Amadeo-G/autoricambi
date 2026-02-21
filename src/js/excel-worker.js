// excel-worker.js
// Handles heavy Excel parsing and data processing in a background thread

importScripts('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js');

// Helper: Parse any numeric string or number into a valid float
const parsePrice = (val) => {
    if (val === undefined || val === null || val === '') return 0;

    // If it's already a number, we return it. 
    // However, if we suspect it was parsed incorrectly (e.g. 100x larger by SheetJS), 
    // there's no easy way to know here without context. 
    // But with 'raw: true' below, we should always get strings for CSV/Excel data.
    if (typeof val === 'number') return val;

    let s = val.toString().trim();

    // Strategy for comma-based (Argentinian) vs dot-based (US/API)
    // 1. If it has a comma, treat as Argentinian (1.234,56 -> 1234.56)
    if (s.indexOf(',') !== -1) {
        s = s.replace(/\./g, '').replace(',', '.');
    }
    // 2. If it has multiple dots but no comma, treat dots as thousands (1.234.567 -> 1234567)
    else if ((s.match(/\./g) || []).length > 1) {
        s = s.replace(/\./g, '');
    }
    // 3. Special case: single dot with exactly 3 digits after it and no other separator
    // This is ambiguous (1.234 could be 1.234 or 1234). 
    // Given the context of "multiplied by 100" errors, it's safer to trust standard parseFloat 
    // UNLESS we are sure about the scale of the product.
    // For now, we rely on the removal of non-numeric chars.

    s = s.replace(/[^\d.-]/g, ''); // Keep numbers, dot, and minus sign

    let num = parseFloat(s);
    return isNaN(num) ? 0 : num;
};

// Helper: Format Argentinian price 1678.73 -> "1.678,73"
const formatPrice = (val) => {
    if (typeof val !== 'number') val = parseFloat(val) || 0;
    return val.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

// Helper: Fix corrupted encoding
const fixEncoding = (val) => {
    if (!val) return '';
    let s = val.toString().trim();
    return s.replace(/[\uff60-\ufffd]/g, (char) => {
        const code = char.charCodeAt(0);
        const latin1Code = code - 0xff00;
        const win1252Map = {
            0x82: '\u201a', 0x83: '\u0192', 0x84: '\u201e', 0x85: '\u2026',
            0x86: '\u2020', 0x87: '\u2021', 0x88: '\u02c6', 0x89: '\u2030',
            0x8a: '\u0160', 0x8b: '\u2039', 0x8c: '\u0152', 0x8e: '\u017d',
            0x91: '\u2018', 0x92: '\u2019', 0x93: '\u201c', 0x94: '\u201d',
            0x95: '\u2022', 0x96: '\u2013', 0x97: '\u2014', 0x98: '\u02dc',
            0x99: '\u2122', 0x9a: '\u0161', 0x9b: '\u203a', 0x9c: '\u0153',
            0x9e: '\u017e', 0x9f: '\u0178'
        };
        if (win1252Map[latin1Code]) return win1252Map[latin1Code];
        if (latin1Code >= 0x20 && latin1Code <= 0xFF) return String.fromCharCode(latin1Code);
        return char;
    });
};

self.onmessage = function (e) {
    const { type, data, filtros, fijos, userDiscount } = e.data;

    try {
        if (type === 'PARSE_DUAL') {
            processDualExcel(filtros, fijos, userDiscount);
        } else if (type === 'PROCESS_JSON') {
            // If data is array of arrays [filtrosRaw, fijosRaw]
            if (Array.isArray(data) && data.length === 2 && Array.isArray(data[0])) {
                processRawData(data[0], data[1], userDiscount);
            } else {
                // Fallback for old cache
                processRawData(data, [], userDiscount);
            }
        }
    } catch (error) {
        self.postMessage({ type: 'ERROR', error: error.message });
    }
};

function processDualExcel(filtrosBuffer, fijosBuffer, userDiscount) {
    // 1. Parse Filtros
    // CRITICAL: raw: true prevents SheetJS from auto-converting strings like "1678,73" to numbers (incorrectly).
    const wbFiltros = XLSX.read(filtrosBuffer, { type: 'array', raw: true });
    const sheetFiltros = wbFiltros.SheetNames.find(n => n.includes("Hoja 1") || n.includes("Sheet1")) || wbFiltros.SheetNames[0];
    const filtrosRaw = XLSX.utils.sheet_to_json(wbFiltros.Sheets[sheetFiltros], { header: 1, raw: true });

    // 2. Parse Datos Fijos
    let fijosRaw = [];
    if (fijosBuffer) {
        const wbFijos = XLSX.read(fijosBuffer, { type: 'array', raw: true });
        const sheetFijos = wbFijos.SheetNames[0];
        fijosRaw = XLSX.utils.sheet_to_json(wbFijos.Sheets[sheetFijos], { header: 1, raw: true });
    }

    // 3. Cache both
    self.postMessage({ type: 'CACHE_DATA', data: [filtrosRaw, fijosRaw] });

    // 4. Process
    processRawData(filtrosRaw, fijosRaw, userDiscount);
}

function processRawData(filtrosRows, fijosRows, userDiscount) {
    const multiplier = (100 - (userDiscount || 42)) / 100;
    const EXCLUDED_BRANDS = ['NGK'];
    const BLANK_NAME_BRANDS = [
        'BB', 'BOSCH', 'CHAMPION', 'CHAMPIONS', 'DELPHI',
        'INDIEL', 'MARELLI', 'SAGEM', 'RENAULT', 'MOTORCRAFT'
    ];

    // Create Map for fixed data
    const fixedMap = new Map();
    if (fijosRows && fijosRows.length > 0) {
        fijosRows.slice(1).forEach(row => {
            if (!row || !row[0]) return;
            const sku = row[0].toString().trim().toLowerCase();
            fixedMap.set(sku, {
                aplicaciones: fixEncoding(row[1]),
                equivalencias: fixEncoding(row[2]),
                caracteristicas: fixEncoding(row[3])
            });
        });
    }

    const processedData = filtrosRows.slice(1).map((row) => {
        if (!row || row.length < 3) return null;

        const sku = fixEncoding(row[0]);
        const pvVal = parsePrice(row[2]);
        const costVal = pvVal * multiplier;
        let brand = fixEncoding(row[5]);
        const brandUpper = brand.toUpperCase();

        if (EXCLUDED_BRANDS.includes(brandUpper)) return null;
        if (BLANK_NAME_BRANDS.includes(brandUpper)) brand = ' ';

        // Lookup fixed data
        const fixed = fixedMap.get(sku.toLowerCase()) || { aplicaciones: '', equivalencias: '', caracteristicas: '' };

        return {
            codigo: sku,
            descripcion: fixEncoding(row[1]),
            costo: costVal,
            precio: formatPrice(pvVal),
            priceRaw: pvVal,
            subrubro: fixEncoding(row[3]),
            marca: brand,
            rubro: fixEncoding(row[6]),
            aplicaciones: fixed.aplicaciones,
            caracteristicas: fixed.caracteristicas,
            equivalentes: fixed.equivalencias,
            stock: (() => {
                let s = (row[4] || 0).toString().trim();
                s = s.split(/[.,]/)[0];
                const cleanValue = s.replace(/[^\d-]/g, '');
                return parseInt(cleanValue) || 0;
            })()
        };
    }).filter(item => item && item.codigo && item.rubro);

    self.postMessage({ type: 'DONE', data: processedData });
}
