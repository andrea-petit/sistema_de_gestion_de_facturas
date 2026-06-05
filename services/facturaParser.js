function extraerProveedorYDireccion(lineas) {
  let proveedor = null;
  let direccion = null;
  let telefono = null;

  for (let i = 0; i < Math.min(12, lineas.length); i++) {
    const linea = lineas[i].trim();
    const lineaUpper = linea.toUpperCase();


    if (
      lineaUpper.includes('CLIENTE:') || 
      lineaUpper.includes('CI/RIF:') || 
      lineaUpper.includes('RAZON SOCIAL:') ||
      lineaUpper.startsWith('DIR:') || 
      /SE[NM][I1T]AT/i.test(lineaUpper) || 
      /^[VJG-]?\s*RIF/i.test(lineaUpper) || 
      /CZL-\d+/i.test(lineaUpper)
    ) {
      continue; 
    }


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

    if (!direccion) {
      if (
        linea.match(/av\.|av\s|calle|urb\.|urb\s|local|edif|centro|piso|sector|zona\s*postal/i) ||
        lineaUpper.includes('FALCON') || lineaUpper.includes('PUNTA CARDON')
      ) {
        direccion = linea;
      }
    }

    if (!telefono) {
      const telMatch = linea.match(/(?:telefono|telef|tlf|tel)[:.\s]*([\d\s-]{7,15})/i);
      if (telMatch && !lineaUpper.includes('CLIENTE')) {
        telefono = telMatch[1].trim();
      }
    }
  }

  return {
    proveedor,
    direccion,
    telefono
  };
}

module.exports = {
  extraerProveedorYDireccion
};