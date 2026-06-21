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
const historialRoutes = require('./routes/historial_routes');
const userRoutes = require('./routes/user_routes');
const proveedoresRoutes = require('./routes/proveedores_routes');
const empresaRoutes = require('./routes/empresa_routes');
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

app.use('/api', historialRoutes);
app.use('/api', facturaRoutes);
app.use('/api/auth', rutas_autenticacion);
app.use('/api/users', userRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/empresa', empresaRoutes);
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
