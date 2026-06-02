const { NlpManager } = require('node-nlp');
const categorias = require('../training/categorias');

const manager = new NlpManager({ languages: ['es'] });

async function entrenarModelo() {

  categorias.forEach(grupo => {

    grupo.ejemplos.forEach(item => {

      manager.addDocument('es', item, grupo.categoria);

    });

  });

  await manager.train();
  manager.save();
}

async function clasificarTexto(textoFactura) {

  const resultado = await manager.process('es', textoFactura);

  return {
    categoria: resultado.intent,
    confianza: resultado.score
  };
}

module.exports = {
  entrenarModelo,
  clasificarTexto
};