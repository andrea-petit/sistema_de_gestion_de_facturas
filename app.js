require('dotenv').config();
const rutas_autenticacion = require('./routes/rutas_autenticacion');
const express = require('express');
const cookieSession = require('cookie-session');
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
const categoriasRoutes = require('./routes/categorias_routes');
const cors = require('cors');
const app = express();
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(cookieSession({
  name: 'session',
  keys: [process.env.SESSION_SECRET || 'secret-key'],
  maxAge: 24 * 60 * 60 * 1000,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
}));

app.use('/api', historialRoutes);
app.use('/api', facturaRoutes);
app.use('/api/auth', rutas_autenticacion);
app.use('/api/users', userRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/empresa', empresaRoutes);
app.use('/api/categorias', categoriasRoutes)
app.use('/api/login', require('./routes/loginroutes'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/recuperacion', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'recuperacion.html'));
});

app.get('/dashboard', (req, res) => {
    if (req.session && req.session.user) {
    // Prevent browser from caching this page — forces revalidation on back button
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
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
