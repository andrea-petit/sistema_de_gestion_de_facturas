// utils/validadorFactura.js

/**
 * Valida de forma ultra rápida si el texto de LlamaCloud es legible y corresponde a una factura
 * @param {string} textoOcr - El texto crudo devuelto por LlamaCloud
 * @returns {Object} { valido: boolean, error: string|null }
 */
function validarLecturaRapida(textoOcr) {
    // 1. Control de Imagen Borrosa / Ilegible (V vacío o extremadamente corto)
    if (!textoOcr || textoOcr.trim().length < 30) { 
        return {
            valido: false,
            error: "La imagen está demasiado borrosa o el documento está vacío. Por favor, intente tomar la foto con mejor iluminación."
        };
    }

    const textoMin = textoOcr.toLowerCase();

    // 2. Control de tipo de documento (¿Es una factura fiscal venezolana?)
    // Diccionario de palabras clave indispensables
    const palabrasClave = ['factura', 'rif', 'control', 'iva', 'base imponible', 'seniat'];
    
    // Contamos las coincidencias en una sola pasada
    let coincidencias = 0;
    for (const palabra of palabrasClave) {
        if (minTexto.includes(palabra)) {
            coincidencias++;
        }
    }

    // Si no contiene al menos 2 términos clave, rechazamos de inmediato en 0 milisegundos
    if (coincidencias < 2) {
        return {
            valido: false,
            error: "El documento analizado no posee la estructura de una factura fiscal. Verifique el archivo y vuelva a intentarlo."
        };
    }

    return { valido: true, error: null };
}

module.exports = { validarLecturaRapida };