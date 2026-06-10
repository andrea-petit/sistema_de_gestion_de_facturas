function extraerProveedorYDireccion(lineas) {
  let proveedor = null;
  let direccionArray = [];
  let telefono = null;

  // 1. PRIMERA PASADA: Identificar la frontera real del Cliente y aislar al Proveedor
  let indiceCliente = lineas.length;

  const esLineaCliente = (lineaUpper) => {
    return lineaUpper.includes('CLIENTE') ||
      lineaUpper.includes('RAZON SOCIAL') ||
      lineaUpper.includes('CI/RIF:') ||
      lineaUpper.includes('RIF/C.I.');
  };

  const esLineaProveedorIgnorable = (lineaUpper) => {
    return lineaUpper === 'SENIAT' ||
      lineaUpper.includes('CONTRIBUYENTE') ||
      /^[VJG-]?\d{7,10}/i.test(lineaUpper) ||
      /^[VJG]-\d+/i.test(lineaUpper);
  };

  const esLineaProveedor = (linea, lineaUpper) => {
    return linea.length > 4 &&
      (
        lineaUpper.includes('C.A.') ||
        lineaUpper.includes('C.A') ||
        lineaUpper.includes('S.A.') ||
        lineaUpper.includes('S.A') ||
        lineaUpper.includes('CORP') ||
        lineaUpper.includes('RANCH') ||
        lineaUpper.includes('PANADERIA') ||
        lineaUpper.includes('SUPER MARKET') ||
        lineaUpper.includes('CARNE') ||
        lineaUpper.includes('LIBRERIA') ||
        (linea === linea.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3,}/.test(linea) && !/\d{4,}/.test(linea))
      );
  };

  for (let i = 0; i < Math.min(20, lineas.length); i++) {
    const linea = lineas[i].trim();
    const lineaUpper = linea.toUpperCase();

    if (!linea) continue;

    if (esLineaCliente(lineaUpper)) {
      indiceCliente = i;
      break;
    }

    if (esLineaProveedorIgnorable(lineaUpper)) continue;

    if (!proveedor && esLineaProveedor(linea, lineaUpper)) {
      proveedor = linea.replace(/\*/g, '').trim();
    }
  }

  const direccionKeyRegex = /av\.|av\s|avenida|calle|cll\.?|cll\s|carrera|urb\.|urb\s|urbanizacion|urbanización|local|edif|edificio|domicilio|direcci[óo]n|postal|zona\s*postal|sector|piso|casa|esquina|esq|callejon|callejón|nr\s|s\/n|p\/b|pb\b|nro|n°/i;

  const esLineaDireccion = (linea, lineaUpper) => {
    return direccionKeyRegex.test(linea) ||
      lineaUpper.includes('FALCON') ||
      lineaUpper.includes('EDO') ||
      lineaUpper.includes('ESTADO') ||
      lineaUpper.includes('PUNTA CARDON') ||
      lineaUpper.includes('PTA CARDON') ||
      lineaUpper.includes('PUNTO FIJO') ||
      lineaUpper.includes('MARAVEN') ||
      lineaUpper.includes('CARDON') ||
      lineaUpper.includes('OLLAR') ||
      lineaUpper.includes('VIRTUDES') ||
      lineaUpper.includes('TOSTO') ||
      lineaUpper.includes('NUMAS');
  };

  for (let i = 0; i < indiceCliente; i++) {
    const linea = lineas[i].trim();
    const lineaUpper = linea.toUpperCase();

    if (!linea || linea === proveedor || esLineaProveedorIgnorable(lineaUpper)) continue;

    if (!telefono) {
      const telMatch = linea.match(/(?:telefono|telef|tlf|tel)[:.\s]*([\d\s-]{7,15})/i);
      if (telMatch) {
        telefono = telMatch[1].replace(/\*/g, '').trim();
        continue;
      }
    }

    const soloEtiquetaDireccion = /^(?:DIRECCI[ÓO]N|DIRECCION|DOMICILIO)[:\s]*$/i.test(linea);
    if (soloEtiquetaDireccion && i + 1 < indiceCliente) {
      const siguiente = lineas[i + 1].trim();
      if (siguiente && !esLineaProveedorIgnorable(siguiente.toUpperCase()) && !siguiente.toUpperCase().includes('TELEF')) {
        direccionArray.push(siguiente.replace(/\*/g, '').trim());
      }
      continue;
    }

    if (esLineaDireccion(linea, lineaUpper) && !lineaUpper.includes('MAIL:') && !lineaUpper.includes('CZL-') && !lineaUpper.includes('Z7C7') && !lineaUpper.includes('ZZP')) {
      direccionArray.push(linea.replace(/\*/g, '').trim());
    }
  }

  if (direccionArray.length === 0 && indiceCliente > 2) {
    let startIndex = 0;
    if (proveedor) {
      const proveedorIndex = lineas.findIndex(l => l.trim() === proveedor);
      if (proveedorIndex >= 0) startIndex = proveedorIndex + 1;
    }

    for (let i = startIndex; i < indiceCliente; i++) {
      const lineaClean = lineas[i].trim();
      const lineaUpper = lineaClean.toUpperCase();

      if (
        lineaClean &&
        lineaClean !== proveedor &&
        !esLineaProveedorIgnorable(lineaUpper) &&
        !lineaUpper.includes('CZL-') &&
        !lineaUpper.includes('TELEF') &&
        !lineaUpper.includes('CLIENTE') &&
        !lineaUpper.includes('RIF') &&
        lineaClean.length < 120
      ) {
        direccionArray.push(lineaClean.replace(/\*/g, '').trim());
      }
    }
  }

  const direccionCompleta = direccionArray.length > 0 ? direccionArray.join(' ') : null;

  return {
    proveedor: proveedor || 'Proveedor No Detectado',
    direccion: direccionCompleta,
    telefono
  };
}

module.exports = {
  extraerProveedorYDireccion
};