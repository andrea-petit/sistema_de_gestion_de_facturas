const Tesseract = require('tesseract.js');
const { extraerProveedorYDireccion } = require('./facturaParser');
const { clasificarTexto } = require('./nlpClassifier');

async function extraerDatosFactura(imagePath) {
  try {
    const { data: { text } } = await Tesseract.recognize(imagePath, 'spa');
    
    const lineas = text.split('\n').map(l => l.trim());

    const { proveedor, direccion, telefono } = extraerProveedorYDireccion(lineas);

    const datosFactura = {
      proveedor: proveedor,
      direccion: direccion,
      telefonoProveedor: telefono,
      rifEmisor: null,
      nroFactura: null,
      nroControl: null, 
      fechaEmision: null,
      montoTotal: 0.00,
      textoPlano: text
    };

    for (let i = 0; i < Math.min(10, lineas.length); i++) {
      const lineaUpper = lineas[i].toUpperCase();
      if (lineaUpper.includes('CLIENTE:') || lineaUpper.includes('RAZON SOCIAL:') || lineaUpper.includes('CI/RIF:')) {
        break;
      }
      const rifMatch = lineas[i].match(/RIF\s*([A-Z-e0-9])\s*[-]?\s*(\d{7,10})/i);
      if (rifMatch) {
        let letra = rifMatch[1].toUpperCase();
        let numeros = rifMatch[2];
        if (letra === 'E' && numeros.startsWith('0')) letra = 'V';
        else if (!['J', 'V', 'G', 'E'].includes(letra)) {
          letra = numeros.startsWith('0') || numeros.length === 8 ? 'V' : 'J';
        }
        if (numeros.length === 9) {
          datosFactura.rifEmisor = `${letra}-${numeros.slice(0, 8)}-${numeros.slice(8)}`;
        } else {
          datosFactura.rifEmisor = `${letra}-${numeros}`;
        }
        break;
      }
    }

    for (let linea of lineas) {
      const lineaUpper = linea.toUpperCase();
      if ((lineaUpper.includes('FACTURA') || lineaUpper.includes('ACTURA')) && !lineaUpper.includes('CLIENTE')) {
        const nroMatch = linea.match(/[F]?ACTURA\s*[:\s]*[\D]*?(\d+)/i);
        if (nroMatch && nroMatch[1].length >= 4) {
          datosFactura.nroFactura = nroMatch[1];
          break;
        }
      }
    }

    for (let linea of lineas) {
      const lineaUpper = linea.toUpperCase();
      if (lineaUpper.includes('CONTROL') || lineaUpper.includes('CTRL')) {
        const controlMatch = linea.match(/(?:control|ctrl)\s*[:\s]*[\D]*?([\d-]{4,12})/i);
        if (controlMatch) {
          datosFactura.nroControl = controlMatch[1].replace(/-/g, '').trim();
          break;
        }
      }
    }

    const lineaFecha = lineas.find(l => {
      const upper = l.toUpperCase();
      return upper.includes('FECHA:') || upper.includes('ECHA:');
    });
    if (lineaFecha) {
      const fechaMatch = lineaFecha.match(/(\d{2}[-/]\d{2}[-/]\d{4})/);
      if (fechaMatch) datosFactura.fechaEmision = fechaMatch[0];
    } else {
      const fechaMatchGenerica = text.match(/(\d{2}[-/]\d{2}[-/]\d{4})/);
      if (fechaMatchGenerica) datosFactura.fechaEmision = fechaMatchGenerica[0];
    }

    const montosDetectados = [];
    const dineroRegex = /(?:bs|total|neto|exento)?[\s.:]*([\d.]+,\d{2})/i;

    for (let linea of lineas) {
      const match = linea.match(dineroRegex);
      if (match) {
        let valorStr = match[1].replace(/\./g, '').replace(',', '.');
        let valorFloat = parseFloat(valorStr);
        if (!isNaN(valorFloat) && valorFloat > 0) {
          montosDetectados.push(valorFloat);
        }
      }
    }
    if (montosDetectados.length > 0) {
      datosFactura.montoTotal = Math.max(...montosDetectados);
    }

    const { categoria, confianza } = await clasificarTexto(text);
    datosFactura.categoriaDetectada = categoria;
    datosFactura.confianzaNLP = confianza;

    return datosFactura;

  } catch (error) {
    console.error("Error en extracción central:", error);
    throw error;
  }
}

module.exports = {
  extraerDatosFactura
};