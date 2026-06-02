import dotenv from 'dotenv';
dotenv.config();

// Dynamic import to ensure dotenv loads BEFORE db.js reads DATABASE_URL
const { default: sql } = await import('./config/bd.js');

console.log('Probando conexión a la base de datos...');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Configurada ✓' : 'NO CONFIGURADA ✗');

try {
    const result = await sql.query('SELECT 1 as test');
    console.log('Conexión exitosa:', result.rows || result);
} catch (error) {
    console.error('Error de conexión:', error.message);
} finally {
    await sql.end();
}