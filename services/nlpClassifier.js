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

    const lineas = textoFactura.split('\n');
    const productosEncontrados = [];

    for (let linea of lineas) {
      const lineaUpper = linea.toUpperCase();
      
      if (
        lineaUpper.includes('TOTAL') || 
        lineaUpper.includes('EXENTO') || 
        lineaUpper.includes('EFECTIVO') || 
        lineaUpper.includes('CLIENTE') ||
        lineaUpper.includes('FACTURA')
      ) {
        continue;
      }

      if (linea.match(/bs[:.\s]*\d+/i) || linea.includes('X Bs')) {
        let textoLimpio = linea
          .replace(/[\d.,]+/g, '') 
          .replace(/(?:bs|exento|iva|x|\(e\))/gi, '') 
          .replace(/[^\w\sáéíóúÁÉÍÓÚñÑ]/g, '') 
          .trim()
          .toLowerCase();

        if (textoLimpio.length > 3) {
          productosEncontrados.push(textoLimpio);
        }
      }
    }


    const textoParaClasificar = productosEncontrados.join(' ');

    console.log(`Texto enviado a NLP para clasificar: "${textoParaClasificar}"`);

    if (!textoParaClasificar) {
      return { categoria: 'Sin categoría', confianza: 0.00 };
    }

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