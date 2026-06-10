const { NlpManager } = require('node-nlp');
const categorias = require('../training/categorias');
const fs = require('fs');
const path = require('path');

const modelPath = path.join(__dirname, 'model.nlp');
const manager = new NlpManager({ languages: ['es'], autoSave: false });

// Función para entrenar y guardar de forma segura
async function entrenarModelo() {
  try {
    console.log("Iniciando entrenamiento del modelo NLP...");
    categorias.forEach(grupo => {
      grupo.ejemplos.forEach(item => {
        manager.addDocument('es', item.toLowerCase(), grupo.categoria);
      });
    });

    await manager.train();
    await manager.save(modelPath);
    console.log("¡Modelo NLP entrenado y guardado con éxito!");
  } catch (error) {
    console.error("Error entrenando el modelo NLP:", error);
  }
}

async function clasificarTexto(textoFactura) {
  try {
    if (fs.existsSync(modelPath)) {
      await manager.load(modelPath);
    } else {
      await entrenarModelo();
    }

    // CONTROL DE ENTRADA: Verificamos qué le llega al archivo desde ocrService
    console.log(`[SGAF - NLP] Procesando texto de entrada de longitud: ${textoFactura ? textoFactura.length : 0}`);

    const lineas = textoFactura.split('\n');
    const productosEncontrados = [];

    for (let linea of lineas) {
      const lineaUpper = linea.toUpperCase().trim();
      
      // Filtros de exclusión de líneas basura comunes en facturas
      if (
        !lineaUpper ||
        lineaUpper.includes('TOTAL') || 
        lineaUpper.includes('EXENTO') || 
        lineaUpper.includes('EFECTIVO') || 
        lineaUpper.includes('CLIENTE') ||
        lineaUpper.includes('FACTURA') ||
        lineaUpper.includes('FECHA') ||
        lineaUpper.includes('RIF') ||
        lineaUpper.includes('SENIAT')
      ) {
        continue;
      }

      // Flexibilizamos el Match: Si tiene "Bs", "BS", "x" o simplemente es una línea con texto medio largo
      if (lineaUpper.includes('BS') || lineaUpper.includes('X') || (lineaUpper.length > 4 && lineaUpper.length < 50)) {
        let textoLimpio = linea
          .replace(/[\d.,]+/g, '') // Quita números
          .replace(/(?:bs|exento|iva|x|\(e\)|tg|tarjeta|debito|efectivo|subttl)/gi, '') // Quita palabras administrativas
          .replace(/[^\w\sáéíóúÁÉÍÓÚñÑ]/g, '') // Quita símbolos y etiquetas html rotas
          .replace(/\s+/g, ' ') // Colapsa espacios
          .trim()
          .toLowerCase();

        // Evitamos meter palabras residuales vacías o muy cortas (como "td")
        if (textoLimpio.length > 3 && textoLimpio !== 'td') {
          productosEncontrados.push(textoLimpio);
        }
      }
    }

    // --- CAMBIO CLAVE / SALVAVIDAS ---
    let textoParaClasificar = productosEncontrados.join(' ').trim();

    // [ESTRATEGIA DE RESPALDO]: Si el filtro por líneas de productos falló y dio "", 
    // usamos todo el texto de la factura limpio para que el NLP tenga contexto (como el nombre del proveedor "PANADERIA")
    if (!textoParaClasificar && textoFactura) {
      console.log("[SGAF - NLP] Alerta: No se aislaron productos individuales. Usando texto completo sanetizado como respaldo.");
      textoParaClasificar = textoFactura
        .replace(/[\d.,]+/g, '')
        .replace(/(?:bs|exento|iva|x|\(e\)|cliente|rif|factura|fecha|hora|total|efectivo|debito|tarjeta|td)/gi, '')
        .replace(/[^\w\sáéíóúÁÉÍÓÚñÑ]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    }

    console.log(`Texto enviado a NLP para clasificar: "${textoParaClasificar}"`);

    if (!textoParaClasificar) {
      return { categoria: 'Sin categoría', confianza: 0.00 };
    }

    // Procesamiento formal en el Manager de node-nlp
    const resultado = await manager.process('es', textoParaClasificar);

    if (!resultado.intent || resultado.intent === 'None' || resultado.score < 0.4) {
      return { categoria: 'Sin categoría', confianza: resultado.score || 0.00 };
    }

    return {
      categoria: resultado.intent,
      confianza: (resultado.score * 100).toFixed(2) + '%'
    };

  } catch (error) {
    console.error("Error en clasificación NLP:", error);
    return { categoria: 'Sin categoría', confianza: 0.00 };
  }
}


module.exports = {
  entrenarModelo,
  clasificarTexto
};