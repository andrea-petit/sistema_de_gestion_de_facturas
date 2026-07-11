// 1. Añade esta línea arriba del todo para que cargue obligatoriamente tu archivo .env
require('dotenv').config();

const { Pool } = require('pg');

const poolConfig = {};

if (process.env.DATABASE_URL) {
  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    const sslmode = dbUrl.searchParams.get('sslmode');
    const sslParam = dbUrl.searchParams.get('ssl');

    dbUrl.searchParams.delete('sslmode');
    dbUrl.searchParams.delete('ssl');

    poolConfig.connectionString = dbUrl.toString();

    if (sslmode === 'require' || sslParam === 'true' || process.env.NODE_ENV !== 'production') {
      poolConfig.ssl = {
        rejectUnauthorized: false,
      };
    }
  } catch (error) {
    poolConfig.connectionString = process.env.DATABASE_URL;
    poolConfig.ssl = {
      rejectUnauthorized: false,
    };
  }
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de la base de datos:', err);
});

module.exports = pool;