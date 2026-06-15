const rutas_autenticacion = require('./routes/rutas_autenticacion');
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
const { entrenarModelo, clasificarTexto } = require('./services/nlpClassifier');
const { extraerProveedorYDireccion } = require('./services/facturaParser');
const facturaRoutes = require('./routes/facturas_routes');
const cors = require('cors');
const app = express();
app.use(express.json());
// Allow cross-origin requests with credentials (cookies) when needed
app.use(cors({ origin: true, credentials: true }));
const PORT = process.env.PORT || 3000;

const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use('/api', facturaRoutes);
app.use('/api/auth', rutas_autenticacion);
app.use('/api/login', require('./routes/loginroutes'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
    if (req.session && req.session.user) {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
    } else {
        res.redirect('/');
    }
});



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

    const lineas = text.split('\n');
    const infoProveedor = extraerProveedorYDireccion(lineas);

    datosFactura.proveedor = infoProveedor.proveedor;
    datosFactura.direccionProveedor = infoProveedor.direccion;

    // 1. EXTRAER RIF DEL EMISOR (Buscamos la primera línea que tenga un RIF válido arriba)
    for (let linea of lineas) {
      // Usamos dos grupos de captura: ([J-VG-]) para la letra y (\d{7,10}) para los números
      const rifMatch = linea.match(/RIF\s*([J-VG-])\s*-?\s*(\d{7,10})/i);
      
      if (rifMatch && !linea.includes('Cliente') && !linea.includes('CI/RIF')) {
        const letra = rifMatch[1].toUpperCase();
        let numeros = rifMatch[2];
        
        // Si el número tiene 9 dígitos (como 070049162), el último es el dígito verificador.
        // Lo separamos limpiamente para armar el formato estándar: J-07004916-2
        if (numeros.length === 9) {
          const cuerpo = numeros.slice(0, 8);
          const verificador = numeros.slice(8);
          datosFactura.rifEmisor = `${letra}-${cuerpo}-${verificador}`;
        } else {
          // Si tiene otra longitud (ej. 8 dígitos sueltos), lo guardamos directo de forma limpia
          datosFactura.rifEmisor = `${letra}-${numeros}`;
        }
        
        break; // Nos aseguramos de salir en la primera coincidencia (Cabecera)
      }
    }

    // 2. EXTRAER NÚMERO DE FACTURA (Optimizado para ignorar puntuación basura)
    for (let linea of lineas) {
      const lineaUpper = linea.toUpperCase();
      
      // Filtramos líneas que tengan indicios de ser la etiqueta de la factura
      if (lineaUpper.includes('FACTURA') || lineaUpper.includes('ACTURA')) {
        // El patrón [\D]*? le dice: "salta CUALQUIER caracter que NO sea un número" (letras, comas, espacios, símbolos)
        const nroMatch = linea.match(/[F]?ACTURA\s*[:\s]*[\D]*?(\d+)/i);
        
        // Evitamos agarrar un número de control de máquina fiscal corto o el año aislando números reales de la factura
        if (nroMatch && nroMatch[1].length >= 4) {
          datosFactura.nroFactura = nroMatch[1];
          break; 
        }
      }
    }

    // Respaldo de emergencia ultra-flexible si el bucle por líneas no pescó nada
    if (!datosFactura.nroFactura) {
      const nroSecundario = text.match(/(?:nro|n°|[f]?actura)[\s.:#,-]+(\d+)/i);
      if (nroSecundario) datosFactura.nroFactura = nroSecundario[1];
    }

    // 3. EXTRAER FECHA DE EMISIÓN
    // Tolerancia a si dice "FECHA:" o ""ECHA:" por corte de papel
    const lineaFecha = lineas.find(l => {
      const normalized = l.toUpperCase();
      return normalized.includes('FECHA:') || normalized.includes('ECHA:');
    });

    if (lineaFecha) {
      const fechaMatch = lineaFecha.match(/(\d{2}[-/]\d{2}[-/]\d{4})/);
      if (fechaMatch) datosFactura.fechaEmision = fechaMatch[0];
    } else {
      const fechaMatchGenerica = text.match(/(\d{2}[-/]\d{2}[-/]\d{4})/);
      if (fechaMatchGenerica) datosFactura.fechaEmision = fechaMatchGenerica[0];
    }

    // 4. EXTRAER MONTO TOTAL
    // Primero intentamos buscar la palabra exacta "TOTAL" ya que esta factura sí la tiene limpia
    const lineaTotal = lineas.find(l => l.toUpperCase().includes('TOTAL'));
    const dineroRegex = /(?:bs|exento|total|neto)[\s]*[:]*[\s]*([\d.]+,\d{2})/i;

    if (lineaTotal) {
      const matchTotal = lineaTotal.match(/([\d.]+,\d{2})/);
      if (matchTotal) {
        datosFactura.montoTotal = parseFloat(matchTotal[1].replace(/\./g, '').replace(',', '.')) || 0.00;
      }
    } 
    
    // Si falla el plan A, aplicamos la estrategia del monto máximo (nuestro salvavidas anterior)
    if (!datosFactura.montoTotal || datosFactura.montoTotal === 0) {
      const montosDetectados = [];
      for (let linea of lineas) {
        const match = linea.match(dineroRegex);
        if (match) {
          let valorFloat = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
          if (!isNaN(valorFloat)) montosDetectados.push(valorFloat);
        }
      }
      if (montosDetectados.length > 0) {
        datosFactura.montoTotal = Math.max(...montosDetectados);
      }
    }

    const clasificacion = await clasificarTexto(text);

    datosFactura.categoriaDetectada = clasificacion.categoria;
    datosFactura.confianzaCategoria = clasificacion.confianza;

    return datosFactura;

  } catch (error) {
    console.error("Error en extracción OCR:", error);
    throw error;
  }
}
/**
 * Ruta de la API encargada de recibir y despachar la imagen
 */
// Friendly GET so visiting this URL clarifies expected usage
app.get('/api/facturas', (req, res) => {
  return res.status(200).json({ message: 'This endpoint accepts POST requests with form-data (field name: factura) to upload an invoice image.' });
});
app.post('/api/facturas', upload.single('factura'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Falta subir el archivo de imagen' });
    }

    const datosExtraidos = await extraerDatosFactura(req.file.path);

    // Borramos el archivo temporal para no acumular basura en el servidor
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Error borrando archivo temporal:", err);
    });

    return res.status(200).json({
      mensaje: "Procesado correctamente",
      data: datosExtraidos
    });

  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ error: 'Error interno al procesar el OCR de la factura.' });
  }
});

(async () => {

  try {

    console.log("Entrenando modelo NLP...");

    await entrenarModelo();

    console.log("Modelo NLP entrenado correctamente.");

    app.listen(PORT, () => {

      console.log(`=======================================================`);
      console.log(` Server corriendo exitosamente en: http://localhost:${PORT}`);
      console.log(`=======================================================`);

    });

  } catch (error) {

    console.error("Error iniciando servidor:", error);

  }

})();
