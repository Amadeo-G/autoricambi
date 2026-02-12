# Listas de Precios

Esta carpeta contiene las listas de precios para descargar desde la página principal.

## 🔒 Restricción de Acceso

**Solo usuarios registrados y autenticados** pueden descargar las listas de precios.
Los usuarios no registrados serán redirigidos a la página de login.

## 📁 Formatos Soportados

Las listas pueden estar en cualquiera de los siguientes formatos:

- **PDF** (.pdf) - Recomendado para visualización
- **Excel** (.xlsx) - Para edición y análisis
- **CSV** (.csv) - Para importación a otros sistemas
- **Texto** (.txt) - Formato simple

## Archivos necesarios

Coloca los archivos de listas de precios en esta carpeta con los siguientes nombres base:

- `fiat.[formato]` - Lista de precios de Fiat
- `renault.[formato]` - Lista de precios de Renault  
- `chevrolet.[formato]` - Lista de precios de Chevrolet
- `volkswagen.[formato]` - Lista de precios de Volkswagen
- `ford.[formato]` - Lista de precios de Ford
- `peugeot.[formato]` - Lista de precios de Peugeot
- `motor.[formato]` - Lista de precios de Motor

**Ejemplo:** `fiat.pdf`, `renault.xlsx`, `chevrolet.csv`, etc.

## Notas

- Los nombres de archivo deben estar en **minúsculas**
- Puedes tener el mismo archivo en múltiples formatos
- Actualmente la interfaz está configurada para descargar formato **PDF** por defecto
- Para cambiar el formato, modifica el segundo parámetro en la función `downloadPriceList()` en `index.html`
