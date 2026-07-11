// 1. Añade esta línea arriba del todo para que cargue obligatoriamente tu archivo .env
require('dotenv').config(); 

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase')
    ? { rejectUnauthorized: false }
    : false
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de la base de datos:', err);
});

module.exports = pool;