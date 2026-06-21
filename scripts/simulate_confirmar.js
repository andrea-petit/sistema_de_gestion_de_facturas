const facturaModel = require('../models/factura_model');

function parseMonetary(value) {
  if (value === undefined || value === null) return 0.00;
  if (typeof value === 'number') return Number(Number(value).toFixed(2));
  let v = String(value).trim();
  if (!v) return 0.00;
  v = v.replace(/[^\d.,-]/g, '');
  if (v.includes(',') && v.includes('.')) {
    v = v.replace(/\./g, '').replace(',', '.');
  } else if (v.includes(',')) {
    const parts = v.split(',');
    if (parts[parts.length - 1].length === 2) {
      v = v.replace(',', '.');
    } else {
      v = v.replace(/,/g, '');
    }
  }
  const parsed = parseFloat(v);
  return Number.isNaN(parsed) ? 0.00 : Number(parsed.toFixed(2));
}

async function run() {
  // Payload using values detected by OCR
  const payload = {
    proveedor: 'NUEVA LIBRERIA Y PAPELERIA',
    direccion: 'AV CORO ESQUINA LOS CLAVELES',
    rifEmisor: 'V-098022070',
    nroFactura: '00009886',
    nroControl: '00009886',
    fechaEmision: '02-10-2025',
    montoTotal: '2.961,45',
    montoExento: '0,00',
    montoAfectoIva: '2.552,97',
    montoIva: '408,48',
    porcentaje_alicuota: 16,
    porcentaje_retencion: 0
  };

  const monto_total_norm = parseMonetary(payload.montoTotal);
  const monto_exento_norm = parseMonetary(payload.montoExento);
  const monto_afecto_norm = parseMonetary(payload.montoAfectoIva);
  const monto_iva_norm = parseMonetary(payload.montoIva);
  const porcentaje_alicuota_norm = Number.isFinite(Number(payload.porcentaje_alicuota)) ? Number(payload.porcentaje_alicuota) : 0.00;
  const porcentaje_retencion_norm = Number.isFinite(Number(payload.porcentaje_retencion)) ? Number(payload.porcentaje_retencion) : 0.00;

  const facturaData = {
    proveedor_id: 123,
    fecha_emision: payload.fechaEmision,
    numero_factura: payload.nroFactura,
    numero_control: payload.nroControl,
    monto_total: monto_total_norm,
    monto_exento: monto_exento_norm,
    monto_afecto_iva: monto_afecto_norm,
    monto_iva: monto_iva_norm,
    porcentaje_alicuota: porcentaje_alicuota_norm,
    porcentaje_retencion: porcentaje_retencion_norm
  };

  console.log('[simulate_confirmar] Payload normalizado recibido:', {
    monto_total: facturaData.monto_total,
    monto_exento: facturaData.monto_exento,
    monto_afecto_iva: facturaData.monto_afecto_iva,
    monto_iva: facturaData.monto_iva,
    porcentaje_alicuota: facturaData.porcentaje_alicuota,
    porcentaje_retencion: facturaData.porcentaje_retencion
  });

  const impuestoCalc = facturaModel.calculateImpuestos(facturaData);
  console.log('[simulate_confirmar] Impuestos calculados en backend:', impuestoCalc);
}

run().catch(err => { console.error(err); process.exit(1); });
