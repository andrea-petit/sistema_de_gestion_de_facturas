function extraerProveedorYDireccion(lineas) {
  let proveedor = null;
  let direccion = null;

  for (let i = 0; i < Math.min(10, lineas.length); i++) {
    const linea = lineas[i].trim();
    const lineaUpper = linea.toUpperCase();

    // --- FILTRO DE EXCLUSIÓN OPTIMIZADO ---
    // Agregamos variantes comunes de errores de OCR para la palabra SENIAT (como SENTAT o SEN1AT)
    if (
      lineaUpper.includes('CLIENTE:') || 
      lineaUpper.includes('CI/RIF:') || 
      lineaUpper.includes('DIR:') ||
      /SE[NM][I1T]AT/i.test(lineaUpper) || // Captura SENIAT, SENTAT, SEN1AT
      lineaUpper.startsWith('RIF ')
    ) {
      continue; 
    }

    // --- DETECCIÓN DE PROVEEDOR ---
    if (!proveedor) {
      if (
        linea.length > 4 &&
        (
          lineaUpper.includes('C.A.') || 
          lineaUpper.includes('C.A') || 
          lineaUpper.includes('S.A.') || 
          lineaUpper.includes('S.A') || 
          lineaUpper.includes('CORP') ||
          (linea === linea.toUpperCase() && /[A-Z]{3,}/.test(linea) && !/\d{6,}/.test(linea))
        )
      ) {
        proveedor = linea;
      }
    }

    // --- DETECCIÓN DE DIRECCIÓN ---
    if (!direccion) {
      if (
        linea.match(/av\.|av\s|calle|urb\.|urb\s|local|edif|centro/i)
      ) {
        direccion = linea;
      }
    }
  }

  return {
    proveedor,
    direccion
  };
}

module.exports = {
  extraerProveedorYDireccion
};