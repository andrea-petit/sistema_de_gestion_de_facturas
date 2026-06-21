// Script de prueba para simular extracción OCR
function parseMonetaryValue(value) {
  if (!value) return 0.00;
  let cleaned = value.replace(/[^\d.,-]/g, '').trim();
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    if (parts[parts.length - 1].length === 2) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0.00 : parsed;
}

function extractAmountFromLine(line) {
  if (!line) return 0.00;
  // Only match amounts with decimal cents to avoid grabbing integers like hours
  const match = line.match(/([\d.]+,\d{2})|([\d,]+\.\d{2})/);
  if (!match) return 0.00;
  return parseMonetaryValue(match[0]);
}

// Specialized extractor for IVA amounts: prefers a number following 'IVA' within 40 chars and a preceding 'Bs'
function findIvaAmount(lines) {
  const moneyRegexGlobal = /([\d.]+,\d{2})|([\d,]+\.\d{2})/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\bIVA\b|IVA\s*G/i.test(line)) {
      const ivaAfter = line.match(/IVA[\s\S]{0,40}?Bs\s*(([\d.]+,\d{2})|([\d,]+\.\d{2}))/i);
      if (ivaAfter && ivaAfter[1]) { console.log('[findIvaAmount] matched ivaAfter ->', ivaAfter[1]); return parseMonetaryValue(ivaAfter[1]); }
      const all = Array.from(line.matchAll(moneyRegexGlobal)).map(m => m[0]);
      if (all.length > 0) { console.log('[findIvaAmount] fallback all ->', all[all.length - 1]); return parseMonetaryValue(all[all.length - 1]); }
      if (i + 1 < lines.length) {
        const nextMatches = Array.from(lines[i + 1].matchAll(moneyRegexGlobal)).map(m => m[0]);
        if (nextMatches.length > 0) { console.log('[findIvaAmount] next line ->', nextMatches[0]); return parseMonetaryValue(nextMatches[0]); }
      }
    }
  }
  return 0.00;
}

// Specialized extractor for Base Imponible: prefers a number following BI G / BASE ... within 40 chars and a preceding 'Bs'
function findBaseAmount(lines) {
  const moneyRegexGlobal = /([\d.]+,\d{2})|([\d,]+\.\d{2})/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/BI\s*G|BASE\s*IMPONIBLE|BASE\s*IVA|SUBTOTAL\s*IVA/i.test(line)) {
      const baseAfter = line.match(/(?:BI\s*G|BASE\s*IMPONIBLE|BASE\s*IVA|SUBTOTAL\s*IVA)[\s\S]{0,40}?Bs\s*(([\d.]+,\d{2})|([\d,]+\.\d{2}))/i);
      if (baseAfter && baseAfter[1]) { console.log('[findBaseAmount] matched baseAfter ->', baseAfter[1]); return parseMonetaryValue(baseAfter[1]); }
      const all = Array.from(line.matchAll(moneyRegexGlobal)).map(m => m[0]);
      if (all.length > 0) { console.log('[findBaseAmount] fallback all ->', all[0]); return parseMonetaryValue(all[0]); }
      if (i + 1 < lines.length) {
        const nextMatches = Array.from(lines[i + 1].matchAll(moneyRegexGlobal)).map(m => m[0]);
        if (nextMatches.length > 0) { console.log('[findBaseAmount] next line ->', nextMatches[0]); return parseMonetaryValue(nextMatches[0]); }
      }
    }
  }
  return 0.00;
}

// Extractor para montos exentos
function findExentoAmount(lines) {
  const moneyRegexGlobal = /([\d.]+,\d{2})|([\d,]+\.\d{2})/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\bEXENT[OA]S?\b/i.test(line)) {
      const after = line.match(/EXENT[OA]S?[\s\S]{0,40}?Bs\s*(([\d.]+,\d{2})|([\d,]+\.\d{2}))/i);
      if (after && after[1]) return parseMonetaryValue(after[1]);
      const all = Array.from(line.matchAll(moneyRegexGlobal)).map(m => m[0]);
      if (all.length > 0) return parseMonetaryValue(all[all.length - 1]);
      if (i + 1 < lines.length) {
        const nextMatches = Array.from(lines[i + 1].matchAll(moneyRegexGlobal)).map(m => m[0]);
        if (nextMatches.length > 0) return parseMonetaryValue(nextMatches[0]);
      }
    }
  }
  return 0.00;
}


function roundToTwo(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }

const textMarkdown = `SENIATRIF V-098022070MARIA ARIETE GONCALVES DE GOMEZNUEVA LIBRERIA Y PAPELERIAVIRGEN DE FATIMAAV CORO ESQUINA LOS CLAVELES CASA NRO 53URB SANTA IRENE PUNTO FIJO ESTADO FALCONZONA POSTAL 4102TELEFONO: 0412-4282669MAIL: nuevalibreriafatima@gmail.com**Cliente**: LA PEPITERIA PF**CI/RIF**: J-50697989-6 - **EST**: 300**Dir**: AV 9 CENTRO COMERCIAL ASOCIACION DESERVICIO MULTRIPLES COMUNIDAD CARDON00266406/CONTADO**Vendedor**: UNICOMARIA ARIETE GONCALVES DE GOMEZ (NUEVATasa Ref. Bs./$: 181,30FACTURA 00009886**FACTURA**:**FECHA**: 02-10-2025 **HORA**: 11:11CARTELERA DE CORCHO 60X45 CTM - OFIART (G) Bs 2.552,97BI G16,00% Bs 2.552,97 IVA G16,00% Bs 408,48TARJ. DEBITO Bs 2.961,45**TOTAL** **Bs 2.961,45**Tot.. a Pagar USD: 16,33MHZ7C7037484`;

const lines = textMarkdown.split(/\n|\r|\*\*/).map(l => l.trim()).filter(Boolean);

// DEBUG: imprimir lines que contienen IVA o BI
console.log('\n--- LÍNEAS QUE CONTIENEN IVA/BI ---');
lines.forEach((ln, idx) => {
  if (/\bIVA\b|\bBI\s*G|BASE\s*IMPONIBLE|BASE\s*IVA|SUBTOTAL\s*IVA|\d{1,2}\s*%/i.test(ln)) {
    console.log(idx, ln);
    const ivaMatch = ln.match(/IVA[\s\S]{0,40}?Bs\s*(([\d.]+,\d{2})|([\d,]+\.\d{2}))/i);
    const baseMatch = ln.match(/(?:BI\s*G|BASE\s*IMPONIBLE|BASE\s*IVA|SUBTOTAL\s*IVA)[\s\S]{0,40}?Bs\s*(([\d.]+,\d{2})|([\d,]+\.\d{2}))/i);
    console.log('  IVA regex ->', ivaMatch ? ivaMatch[1] : null, '  BASE regex ->', baseMatch ? baseMatch[1] : null);
  }
});

const dineroRegexFlex = /(?:Bs\s*)?([\d.]+,\d{2})|(?:Bs\s*)?([\d,]+\.\d{2})/g;
const montosDetectados = [];
let matchMoney;
while ((matchMoney = dineroRegexFlex.exec(textMarkdown)) !== null) {
  const valorStr = matchMoney[0];
  const valorFloat = parseMonetaryValue(valorStr);
  if (!isNaN(valorFloat) && valorFloat > 0) montosDetectados.push(valorFloat);
}

const montoTotal = montosDetectados.length > 0 ? Math.max(...montosDetectados) : 0;
const montoExentoDetectado = findExentoAmount(lines);
// Use specialized detectors to avoid regex collisions between IVA and BASE
const montoIvaDetectado = findIvaAmount(lines);
const baseImponibleDetectado = findBaseAmount(lines);

console.log('montosDetectados:', montosDetectados);
console.log('montoTotal:', montoTotal);
console.log('montoExentoDetectado:', montoExentoDetectado);
console.log('montoIvaDetectado:', montoIvaDetectado);
console.log('baseImponibleDetectado:', baseImponibleDetectado);

let datosFactura = { montoTotal, montoExento: roundToTwo(montoExentoDetectado), montoAfectoIva: 0, montoIva: 0 };
if (baseImponibleDetectado > 0 || montoIvaDetectado > 0) {
  datosFactura.montoAfectoIva = baseImponibleDetectado > 0 ? roundToTwo(baseImponibleDetectado) : roundToTwo(montoIvaDetectado / 0.16);
  datosFactura.montoIva = montoIvaDetectado > 0 ? roundToTwo(montoIvaDetectado) : roundToTwo(datosFactura.montoAfectoIva * 0.16);
  const subtotalAfecto = datosFactura.montoAfectoIva + datosFactura.montoIva;
  const diferenciaExenta = datosFactura.montoTotal - subtotalAfecto;
  if (diferenciaExenta > 0.99) datosFactura.montoExento = roundToTwo(diferenciaExenta);
  else { datosFactura.montoExento = 0.00; datosFactura.montoTotal = roundToTwo(subtotalAfecto); }
} else if (datosFactura.montoExento > 0) {
  datosFactura.montoAfectoIva = 0.00; datosFactura.montoIva = 0.00; datosFactura.montoTotal = datosFactura.montoExento;
} else { datosFactura.montoAfectoIva = 0.00; datosFactura.montoIva = 0.00; datosFactura.montoExento = datosFactura.montoTotal; }

console.log('datosFactura final:', datosFactura);
