const Tesseract = require('tesseract.js');

/**
 * Procesa la imagen de una factura y extrae los datos clave.
 * @param {string|Buffer} imagePath - Ruta local, URL o Buffer de la imagen.
 */
async function extraerDatosFactura(imagePath) {
  try {

    const { data: { text } } = await Tesseract.recognize(imagePath, 'spa');
    
    const datosFactura = {
      rifEmisor: null,
      nroFactura: null,
      fechaEmision: null,
      montoTotal: 0.00,
      textoPlano: text 
    };

    const rifRegex = /([VJG-]\d{8,9}-\d|[VJG]\d{9})/i;
    const rifMatch = text.match(rifRegex);
    if (rifMatch) datosFactura.rifEmisor = rifMatch[0].toUpperCase();

    const nroRegex = /(?:factura|nro|n°|control)[:.\s]*(\d+)/i;
    const nroMatch = text.match(nroRegex);
    if (nroMatch) datosFactura.nroFactura = nroMatch[1];

    const fechaRegex = /(\d{2}[-/]\d{2}[-/]\d{4})/;
    const fechaMatch = text.match(fechaRegex);
    if (fechaMatch) datosFactura.fechaEmision = fechaMatch[0];

    const totalRegex = /(?:total|monto total|neto)[:.\s]*([\d.,]+)/i;
    const totalMatch = text.match(totalRegex);
    if (totalMatch) {
      let montoStr = totalMatch[1].replace(/\./g, '').replace(',', '.');
      datosFactura.montoTotal = parseFloat(montoStr);
    }

    return datosFactura;

  } catch (error) {
    console.error("Error en el servicio de OCR:", error);
    throw new Error("No se pudo procesar la imagen de la factura");
  }
}

module.exports = { extraerDatosFactura };