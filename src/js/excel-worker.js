// excel-worker.js
// Handles heavy Excel parsing and data processing in a background thread

importScripts('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js');

// Helper: Parse Argentinian price "1.678,73" -> 1678.73
const parsePrice = (val) => {
    if (!val) return 0;
    let s = val.toString().trim();
    s = s.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
    let num = parseFloat(s) || 0;
    return num;
};

// Helper: Format Argentinian price 1678.73 -> "1.678,73"
const formatPrice = (val) => {
    return val.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

self.onmessage = function (e) {
    const { type, data, userDiscount } = e.data;

    try {
        if (type === 'PARSE_EXCEL') {
            // data is ArrayBuffer
            processExcel(data, userDiscount);
        } else if (type === 'PROCESS_JSON') {
            // data is already the raw JSON array (from cache)
            processRawData(data, userDiscount);
        }
    } catch (error) {
        self.postMessage({ type: 'ERROR', error: error.message });
    }
};

function processExcel(arrayBuffer, userDiscount) {
    // 1. Read Excel File
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const targetSheetName = workbook.SheetNames.find(n => n.includes("Hoja 1") || n.includes("Sheet1")) || workbook.SheetNames[0];

    // 2. Convert to JSON (Header: 1 means array of arrays)
    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[targetSheetName], { header: 1 });

    // 3. Send raw data back for caching (optional, but good if we want to update cache)
    self.postMessage({ type: 'CACHE_DATA', data: rawData });

    // 4. Process for UI
    processRawData(rawData, userDiscount);
}

function processRawData(dataRows, userDiscount) {
    const multiplier = (100 - (userDiscount || 42)) / 100;

    // Filter and Map
    // Skip header (slice 1)
    const processedData = dataRows.slice(1).map((row) => {
        if (!row || row.length < 3) return null;

        const pvVal = parsePrice(row[2]);
        const costVal = pvVal * multiplier;

        return {
            codigo: (row[0] || '').toString().trim(),
            descripcion: (row[1] || '').toString().trim(),
            costo: costVal,
            precio: formatPrice(pvVal),
            priceRaw: pvVal,
            subrubro: (row[8] || '').toString().trim(),
            marca: (row[13] || '').toString().trim(),
            rubro: (row[14] || '').toString().trim(),
            caracteristicas: '',
            equivalentes: '',
            stock: (() => {
                let s = (row[11] || 0).toString().trim();
                s = s.split(/[.,]/)[0];
                const cleanValue = s.replace(/[^\d-]/g, '');
                return parseInt(cleanValue) || 0;
            })()
        };
    }).filter(item => item && item.codigo && item.rubro);

    // Send final processed data to main thread
    self.postMessage({ type: 'DONE', data: processedData });
}
