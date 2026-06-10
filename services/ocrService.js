const LlamaCloud = require("@llamaindex/llama-cloud").default || require("@llamaindex/llama-cloud");
const fs = require("fs");
const { extraerProveedorYDireccion } = require('./facturaParser');
const { clasificarTexto } = require('./nlpClassifier');

// Inicializamos el cliente oficial con la API Key guardada en tu .env
const client = new LlamaCloud({
  apiKey: process.env.LLAMA_CLOUD_API_KEY,
});

// --- FUNCIONES UTILERIAS MEJORADAS ---

function parseMonetaryValue(value) {
  if (!value) return 0.00;
  // Removemos espacios y símbolos de moneda, cambiamos comas por puntos si es formato ES
  let cleaned = value.replace(/[^\d.,-]/g, '').trim();
  
  // Detectar formato: si tiene puntos y una coma final (ej: 18.567,48)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    // Si solo tiene comas, evaluamos si es decimal o separador de miles
    const parts = cleaned.split(',');
    if (parts[parts.length - 1].length === 2) {
      cleaned = cleaned.replace(',', '.'); // era decimal (ej: 536,96)
    } else {
      cleaned = cleaned.replace(/,/g, ''); // era miles (ej: 18,567)
    }
  }
  
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0.00 : parsed;
}

function roundToTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function extractAmountFromLine(line) {
  if (!line) return 0.00;
  // Captura formatos: 18.567,48 o 18567.48 o 536,96
  const match = line.match(/([\d.]+,\d{2})|([\d,]+\.\d{2})|(\b\d{2,}\b)/);
  if (!match) return 0.00;
  return parseMonetaryValue(match[0]);
}

// Analiza la línea actual y la subsiguiente por si el monto fiscal quedó abajo
function findAmountByLabel(lines, labelRegex) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (labelRegex.test(line)) {
      // Estrategia A: El monto está en la misma línea
      let amount = extractAmountFromLine(line);
      if (amount > 0) return amount;

      // Estrategia B: El monto está en la línea inmediatamente inferior (Común en Tablas Markdown)
      if (i + 1 < lines.length) {
        amount = extractAmountFromLine(lines[i + 1]);
        if (amount > 0) return amount;
      }
    }
  }
  return 0.00;
}

async function extraerDatosFactura(imagePath) {
  try {
    console.log(`Subiendo documento para análisis: ${imagePath}`);
    
    // 1. PASO 1: Subir el archivo a LlamaCloud para su procesamiento
    const fileObj = await client.files.create({
      file: fs.createReadStream(imagePath),
      purpose: "parse",
    });

    console.log(`Archivo subido con ID: ${fileObj.id}. Iniciando análisis con Agentic Tier...`);

    // 2. PASO 2: Solicitar el parseo, esperar a que termine (polling) y traer el resultado expandido
    const result = await client.parsing.parse({
      file_id: fileObj.id,
      tier: "agentic",
      version: "latest",
      expand: ["markdown_full", "text_full"],
    });

    // Extraemos el texto en formato Markdown provisto por LlamaCloud
    const textMarkdown = result.markdown_full ?? "";
    
    // Convertimos el Markdown estructurado en un array de líneas para no romper tu lógica actual
    const lineas = textMarkdown.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // 3. PASO 3: Ejecutar tu parser de cabecera (recolectará proveedor, dirección y teléfono)
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
      montoExento: 0.00,
      montoAfectoIva: 0.00,
      montoIva: 0.00,
      textoPlano: textMarkdown // Guardamos la estructura Markdown como texto plano para auditorías
    };

    // 4. EXTRAER RIF DEL EMISOR
    // 4. EXTRAER RIF DEL EMISOR (Optimizado para capturar RIFs con o sin la palabra "RIF")
    for (let i = 0; i < Math.min(12, lineas.length); i++) {
      const lineaUpper = lineas[i].toUpperCase().trim();
      
      // Si nos topamos con los datos del cliente, nos detenemos para no confundir RIFs
      if (lineaUpper.includes('CLIENTE:') || lineaUpper.includes('RAZON SOCIAL:') || lineaUpper.includes('CI/RIF:')) {
        break;
      }
      
      // Expresión regular que busca una letra fiscal válida seguida de 7 a 9 números sueltos o con guiones
      // Ejemplo match: "J-503420693", "RIF J503420693", "G-12345678-9"
      const rifMatch = lineas[i].match(/(?:RIF\s*)?([VJGEC])\s*[-]?\s*(\d{7,10})(?:\s*[-]?\s*(\d))?/i);
      
      if (rifMatch) {
        let letra = rifMatch[1].toUpperCase();
        let numeros = rifMatch[2];
        let digitoVerificador = rifMatch[3] || ""; // Por si trae el último dígito separado por guión

        // Correcciones de formato estándar para el SGAF
        if (letra === 'E' && numeros.startsWith('0')) letra = 'V';
        
        let rifCompleto = digitoVerificador ? `${letra}-${numeros}-${digitoVerificador}` : `${letra}-${numeros}`;
        
        // Si los números vinieron todos pegados sin guión y tienen longitud de 9, le damos formato estético (Ej: J-50342069-3)
        if (!digitoVerificador && numeros.length === 9) {
          rifCompleto = `${letra}-${numeros.slice(0, 8)}-${numeros.slice(8)}`;
        }

        datosFactura.rifEmisor = rifCompleto;
        break; // RIF encontrado con éxito, salimos del ciclo
      }
    }

    // 5. EXTRAER NÚMERO DE FACTURA
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

    // 6. EXTRAER NÚMERO DE CONTROL (Optimizado para formatos de Máquinas Fiscales)
    for (let linea of lineas) {
      const lineaUpper = linea.toUpperCase();
      if (lineaUpper.includes('CONTROL') || lineaUpper.includes('CTRL')) {
        const controlMatch = linea.match(/(?:control|ctrl)\s*[:\s]*[\D]*?(\d+)/i);
        if (controlMatch) {
          datosFactura.nroControl = controlMatch[1].trim();
          break;
        }
      }
    }

    // [FALLBACK FISCAL PRIORITARIO DESDE ABAJO]: Priorizamos la última línea real para el Serial Fiscal
    if (!datosFactura.nroControl) {
      let serialDetectado = null;

      // Estrategia A: Miramos la última línea válida del documento (De abajo hacia arriba)
      if (lineas.length > 0) {
        for (let k = lineas.length - 1; k >= 0; k--) {
          const ultimaLineaClean = lineas[k].toUpperCase().replace(/[\[\]]/g, '').trim();

          if (!ultimaLineaClean || ultimaLineaClean.includes('SIGNATURE') || ultimaLineaClean.includes('ITEMS')) {
            continue;
          }

          // Verificamos si cumple con la estructura típica de un serial fiscal (Z..., CZL..., CN...)
          const regexEstructuraSerial = /(CZL-[\w\d-]+|Z[0-9A-Z]{7,12}|ZK\d+|CN-?\d+)/i;
          const matchU = ultimaLineaClean.match(regexEstructuraSerial);
          if (matchU) {
            serialDetectado = matchU[1].trim();
            break;
          }
        }
      }

      // Estrategia B: Si la última línea falló, buscamos en todo el documento secuencialmente por patrón
      if (!serialDetectado) {
        for (let linea of lineas) {
          const lineaUpper = linea.toUpperCase().replace(/[\[\]]/g, '').trim();
          const regexSerial = /(?:^|[\s])(CZL-[\w\d-]+|Z[0-9A-Z]{9,11}|ZK\d+|CN-?\d+)(?:$|[\s])/i;
          const match = lineaUpper.match(regexSerial);
          
          if (match && !lineaUpper.includes('SIGNATURE')) {
            serialDetectado = match[1].trim();
            break;
          }
        }
      }

      // Asignación final del campo
      if (serialDetectado) {
        datosFactura.nroControl = serialDetectado.toUpperCase();
        console.log(`[SGAF] Nro Control asignado exitosamente vía Serial Fiscal: ${datosFactura.nroControl}`);
      } else if (datosFactura.nroFactura) {
        datosFactura.nroControl = datosFactura.nroFactura;
        console.log(`[SGAF] Nro Control igualado a Nro Factura por contingencia.`);
      }
    }
    // 7. EXTRAER FECHA DE EMISIÓN
    const lineaFecha = lineas.find(l => {
      const upper = l.toUpperCase();
      return upper.includes('FECHA:') || upper.includes('ECHA:');
    });
    if (lineaFecha) {
      const fechaMatch = lineaFecha.match(/(\d{2}[-/]\d{2}[-/]\d{4})/);
      if (fechaMatch) datosFactura.fechaEmision = fechaMatch[0];
    } else {
      const fechaMatchGenerica = textMarkdown.match(/(\d{2}[-/]\d{2}[-/]\d{4})/);
      if (fechaMatchGenerica) datosFactura.fechaEmision = fechaMatchGenerica[0];
    }

    // =================================================================
    // 8. EXTRAER Y BALANCEAR MONTOS FISCALES (Reglas de Negocio SENIAT)
    // =================================================================
    
    // Extraemos todos los números sospechosos de dinero en el documento
    const montosDetectados = [];
    const dineroRegexFlex = /(?:Bs\s*)?([\d.]+,\d{2})|(?:Bs\s*)?([\d,]+\.\d{2})/g;
    
    let matchMoney;
    while ((matchMoney = dineroRegexFlex.exec(textMarkdown)) !== null) {
      const valorStr = matchMoney[0];
      const valorFloat = parseMonetaryValue(valorStr);
      if (!isNaN(valorFloat) && valorFloat > 0) {
        montosDetectados.push(valorFloat);
      }
    }

    if (montosDetectados.length > 0) {
      datosFactura.montoTotal = Math.max(...montosDetectados);
    }

    // Busqueda de etiquetas fiscales con la estrategia de proximidad de líneas
    const montoExentoDetectado = findAmountByLabel(lineas, /\bEXENT[OA]S?\b/i);
    const montoIvaDetectado = findAmountByLabel(lineas, /\bIVA\b|\bBI\s*G|\bIVA\s*G/i); // Captura "IVA G16,00%"
    const baseImponibleDetectado = findAmountByLabel(lineas, /BASE\s*IMPONIBLE|BASE\s*IVA|SUBTOTAL|BI\s*G/i);

    datosFactura.montoExento = roundToTwo(montoExentoDetectado);

    // --- REGLAS DE RECONCILIACIÓN MATEMÁTICA ---
    if (baseImponibleDetectado > 0) {
      datosFactura.montoAfectoIva = roundToTwo(baseImponibleDetectado);
      datosFactura.montoIva = montoIvaDetectado > 0 ? roundToTwo(montoIvaDetectado) : roundToTwo(baseImponibleDetectado * 0.16);
    } 
    else if (montoIvaDetectado > 0) {
      datosFactura.montoIva = roundToTwo(montoIvaDetectado);
      datosFactura.montoAfectoIva = roundToTwo(montoIvaDetectado / 0.16);
    } 
    else if (datosFactura.montoExento > 0 && datosFactura.montoTotal > 0) {
      // Si hay exento y hay total, calculamos la diferencia afecta de forma segura
      const diferencia = datosFactura.montoTotal - datosFactura.montoExento;
      if (diferencia > 0.5) { // Tolerancia por redondeos fiscales menores
        datosFactura.montoAfectoIva = roundToTwo(diferencia / 1.16);
        datosFactura.montoIva = roundToTwo(datosFactura.montoTotal - datosFactura.montoExento - datosFactura.montoAfectoIva);
      } else {
        // Es una factura 100% exenta (Como Barbacoa Ranch o Tu Carne)
        datosFactura.montoAfectoIva = 0.00;
        datosFactura.montoIva = 0.00;
        datosFactura.montoExento = datosFactura.montoTotal; // Cuadre perfecto
      }
    } 
    else if (datosFactura.montoTotal > 0) {
      // Fallback: Si no se detectó IVA ni Exento explícito, asumimos por seguridad tasa general 16%
      datosFactura.montoAfectoIva = roundToTwo(datosFactura.montoTotal / 1.16);
      datosFactura.montoIva = roundToTwo(datosFactura.montoTotal - datosFactura.montoAfectoIva);
    }

    // Doble verificación: Si la suma da el total, forzamos el exento exacto
    if (datosFactura.montoExento === 0 && datosFactura.montoAfectoIva === 0 && datosFactura.montoTotal > 0) {
      datosFactura.montoExento = datosFactura.montoTotal;
    }

    // 9. CLASIFICACIÓN DE CATEGORÍA CON TU MODELO NLP (Sanetizado Seguro)
    let textoParaNLP = "";

    if (textMarkdown.includes('<table') || textMarkdown.includes('<td')) {
      textoParaNLP = textMarkdown
        .replace(/<\/?[a-zA-Z0-9]+\b[^>]*>/g, ' ') 
        .replace(/\s+/g, ' ')                      
        .trim();
    } else {
      textoParaNLP = textMarkdown.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    }

    if (!textoParaNLP) {
      textoParaNLP = textMarkdown;
    }

    // CONTROL A: Verificamos qué tiene la variable exactamente antes de enviarla
    console.log(`[SGAF - ocrService] Variable 'textoParaNLP' lista para enviar: "${textoParaNLP.substring(0, 60)}..."`);

    // Invocamos pasándole estrictamente el string plano
    const resultadoNLP = await clasificarTexto(textoParaNLP); 
    
    // Nos aseguramos de capturar bien el retorno
    datosFactura.categoriaDetectada = resultadoNLP?.categoria || "Sin categoría";
    datosFactura.confianzaNLP = resultadoNLP?.confianza || 0.0;

    return datosFactura;

  } catch (error) {
    console.error("Error en extracción central LlamaCloud:", error);
    throw error;
  }
}

module.exports = {
  extraerDatosFactura
};