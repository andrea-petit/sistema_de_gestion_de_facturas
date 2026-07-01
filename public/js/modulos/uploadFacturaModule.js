let configFiscalEmpresa = null;

export function setConfigFiscalEmpresa(data) {
    configFiscalEmpresa = data;
}

export async function initUploadForm() {
    const fileInput = document.getElementById('fileInput');
    const uploadLabel = document.getElementById('uploadLabel');
    const uploadForm = document.getElementById('uploadForm');
    const btnSubmit = document.getElementById('btnSubmit');
    const loadingText = document.getElementById('loadingText');
    const resultSection = document.getElementById('resultSection');
    const verificationForm = document.getElementById('verificationForm');
    const dropZone = document.getElementById('dropZone');

    const valTotal = document.getElementById('valTotal');
    const valBaseImponible = document.getElementById('valBaseImponible');
    const valMontoExento = document.getElementById('valMontoExento');
    const valPorcentajeAlicuota = document.getElementById('valPorcentajeAlicuota');
    const checkRetencionServicio = document.getElementById('checkRetencionServicio');

    try {
        const resEmpresa = await fetch('/api/empresa', { method: 'GET', credentials: 'include' });
        const resEmpresaJson = await resEmpresa.json();
        if (resEmpresaJson.ok && resEmpresaJson.data) {
            configFiscalEmpresa = resEmpresaJson.data;
        }
    } catch (err) {
        console.error("No se pudo pre-cargar el perfil de empresa:", err);
    }

    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => { fileInput.click(); });
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) uploadLabel.innerText = `Seleccionado: ${fileInput.files[0].name}`;
        });
    }

    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('factura', fileInput.files[0]);
            
            btnSubmit.disabled = true;
            loadingText.style.display = 'block';
            resultSection.style.display = 'none';

            try {
                const response = await fetch('/api/facturas', { method: 'POST', body: formData, credentials: 'include' });
                const resultado = await response.json();
                
                if (response.ok) {
                    const info = resultado.data;
                    
                    document.getElementById('valProveedor').value = info.proveedor || '';
                    document.getElementById('valDireccion').value = info.direccion || '';
                    document.getElementById('valRif').value = info.rifEmisor || '';
                    document.getElementById('valNro').value = info.nroFactura || '';
                    document.getElementById('valControl').value = info.nroControl || '';
                    document.getElementById('valFecha').value = info.fechaEmision || '';
                    document.getElementById('valCategoria').value = info.categoriaDetectada || '';
                    document.getElementById('valImgUrl').value = info.img_url || '';
                    
                    const textoCuerpo = info.textoPlano || '';
                    document.getElementById('resTextoPlano').innerText = textoCuerpo;

                    const totalFactura = normalizeNumber(info.montoTotal) || 0;
                    const montoExentoDetectado = normalizeNumber(info.montoExento || 0) || 0;
                    const montoAfectoDetectado = normalizeNumber(info.montoAfectoIva || 0) || 0;
                    const montoIvaDetectado = normalizeNumber(info.montoIva || 0) || 0;

                    valTotal.value = totalFactura.toFixed(2);
                    if (valMontoExento) valMontoExento.value = montoExentoDetectado.toFixed(2);
                    if (valBaseImponible) valBaseImponible.value = montoAfectoDetectado.toFixed(2);
                    if (document.getElementById('valMontoIva')) document.getElementById('valMontoIva').value = montoIvaDetectado.toFixed(2);

                    const textoUpper = textoCuerpo.toUpperCase();
                    const selectorAlicuota = document.getElementById('valPorcentajeAlicuota');
                    
                    let alicuotaADesglosar = 16;

                    if (montoIvaDetectado === 0 && montoAfectoDetectado === 0 && montoExentoDetectado > 0 && montoExentoDetectado >= totalFactura) {
                        alicuotaADesglosar = 0;
                        if (selectorAlicuota) selectorAlicuota.value = "0";
                    } else if (textoUpper.includes("EXENTO") || (textoUpper.match(/\(E\)/g) || []).length > 2) {
                        alicuotaADesglosar = 0;
                        if (selectorAlicuota) selectorAlicuota.value = "0";
                    } else {
                        if (selectorAlicuota) selectorAlicuota.value = selectorAlicuota.value || "16";
                    }
                    
                    let finalBase = montoAfectoDetectado;
                    let finalIva = montoIvaDetectado;

                    if (finalBase <= 0) {
                        finalBase = extractFromRawText(/BI\s*G|BASE\s*IMPONIBLE|SUBTOTAL\s*IVA/i);
                    }
                    if (finalIva <= 0) {
                        finalIva = extractFromRawText(/IVA|IVA\s*G|16\s*%/i);
                    }

                    if (finalBase > 0) {
                        if (valBaseImponible) valBaseImponible.value = finalBase.toFixed(2);
                        recalcularDesdeBase(finalBase, alicuotaADesglosar, montoExentoDetectado);
                    } else if (finalIva > 0) {
                        const factor = alicuotaADesglosar / 100 || 0.16;
                        const baseFromIva = finalIva / factor;
                        if (valBaseImponible) valBaseImponible.value = baseFromIva.toFixed(2);
                        recalcularDesdeBase(baseFromIva, alicuotaADesglosar, montoExentoDetectado);
                    } else {
                        recalcularDesdeTotal(totalFactura, alicuotaADesglosar, montoExentoDetectado);
                    }

                    verificarCalidadDatos();
                    resultSection.style.display = 'block';
                } else {
                    await Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: resultado.error || 'Ocurrió un problema al procesar la factura.'
                    });
                }
            } catch (error) {
                await Swal.fire({
                    icon: 'error',
                    title: 'Error de conexión',
                    text: 'No se pudo conectar con el servidor.'
                });
            } finally {
                btnSubmit.disabled = false;
                loadingText.style.display = 'none';
            }
        });
    }

    if (valTotal) {
        valTotal.addEventListener('input', () => {
            const total = parseFloat(valTotal.value) || 0;
            const alicuota = parseFloat(valPorcentajeAlicuota.value) || 0;
            const montoExento = parseFloat(valMontoExento?.value) || 0;
            recalcularDesdeTotal(total, alicuota, montoExento);
        });
    }

    if (valBaseImponible) {
        valBaseImponible.addEventListener('input', () => {
            const base = parseFloat(valBaseImponible.value) || 0;
            const alicuota = parseFloat(valPorcentajeAlicuota.value) || 0;
            const montoExento = parseFloat(valMontoExento?.value) || 0;
            recalcularDesdeBase(base, alicuota, montoExento);
        });
    }

    if (valMontoExento) {
        valMontoExento.addEventListener('input', () => {
            const montoExento = parseFloat(valMontoExento.value) || 0;
            const base = parseFloat(valBaseImponible.value) || 0;
            const alicuota = parseFloat(valPorcentajeAlicuota.value) || 0;
            recalcularDesdeBase(base, alicuota, montoExento);
        });
    }

    if (valPorcentajeAlicuota) {
        valPorcentajeAlicuota.addEventListener('change', () => {
            const base = parseFloat(valBaseImponible.value) || 0;
            const alicuota = parseFloat(valPorcentajeAlicuota.value) || 0;
            const montoExento = parseFloat(valMontoExento?.value) || 0;
            recalcularDesdeBase(base, alicuota, montoExento);
        });
    }

    if (checkRetencionServicio) {
        checkRetencionServicio.addEventListener('change', () => {
            const base = parseFloat(valBaseImponible.value) || 0;
            const alicuota = parseFloat(valPorcentajeAlicuota.value) || 0;
            const montoExento = parseFloat(valMontoExento?.value) || 0;
            recalcularDesdeBase(base, alicuota, montoExento);
        });
    }

    if (verificationForm) {
        verificationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const textoPlano = document.getElementById('resTextoPlano')?.innerText || '';
            const datosVerificados = {
                proveedor: document.getElementById('valProveedor').value.trim(),
                direccion: document.getElementById('valDireccion').value.trim(),
                rifEmisor: document.getElementById('valRif').value.trim(),
                nroFactura: document.getElementById('valNro').value.trim(),
                nroControl: document.getElementById('valControl').value.trim(),
                fechaEmision: document.getElementById('valFecha').value.trim(),
                categoria: document.getElementById('valCategoria').value.trim(),
                img_url: document.getElementById('valImgUrl').value,
                montoTotal: parseFloat(valTotal.value) || 0,
                porcentaje_alicuota: parseFloat(valPorcentajeAlicuota.value) || 0,
                montoExento: parseFloat(valMontoExento?.value) || 0,
                montoAfectoIva: parseFloat(valBaseImponible.value) || 0,
                montoIva: parseFloat(document.getElementById('valMontoIva').value) || 0,
                porcentaje_retencion: parseFloat(document.getElementById('valPorcentajeRetencion')?.value) || 0,
                monto_retencion: parseFloat(document.getElementById('valPorcentajeRetencion')?.value) || 0,
                textoPlano: textoPlano
            };

            try {
                const response = await fetch('/api/facturas/guardar', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(datosVerificados)
                });

                const resGuardar = await response.json();

                if (response.ok) {
                    await Swal.fire({
                        icon: 'success',
                        title: 'Factura guardada',
                        text: 'La factura y los impuestos se auditaron correctamente.',
                        timer: 2200,
                        showConfirmButton: false
                    });

                    // 🔥 EJECUCIÓN DEL COMPROBANTE DINÁMICO
                    if (resGuardar.comprobante) {
                        window.open(`/api/facturas/comprobante/${resGuardar.id}`, '_blank');
                    }

                    verificationForm.reset();
                    uploadForm.reset();
                    if (uploadLabel) uploadLabel.innerText = "Haz clic para seleccionar la imagen de la factura";
                    resultSection.style.display = 'none';
                } else {
                    await Swal.fire({
                        icon: 'error',
                        title: 'Error al guardar',
                        text: resGuardar.error || resGuardar.mensaje || 'Ocurrió un error al guardar la factura.'
                    });
                }
            } catch (err) {
                console.error("[SGAF Error Frontend Guardar]:", err);
                await Swal.fire({
                    icon: 'error',
                    title: 'Error subiendo factura',
                    text: 'No se pudo registrar la factura: ' + err.message
                });
            }
        });
    }
}

function normalizeNumber(input) {
    if (input === undefined || input === null) return 0;
    if (typeof input === 'number') return input;
    let s = String(input).trim();
    if (!s) return 0;
    s = s.replace(/[^\d.,-]/g, '');
    if (s.includes(',') && s.includes('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',')) {
        const parts = s.split(',');
        if (parts[parts.length - 1].length === 2) {
            s = s.replace(',', '.');
        } else {
            s = s.replace(/,/g, '');
        }
    }
    const n = parseFloat(s);
    return Number.isNaN(n) ? 0 : n;
}

function extractFromRawText(labelRegex) {
    const raw = (document.getElementById('resTextoPlano')?.innerText || '').toUpperCase();
    const lines = raw.split(/\n|\r/).map(l => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
        if (labelRegex.test(lines[i])) {
            const m = lines[i].match(/([\d.]+,\d{2})|([\d,]+\.\d{2})/);
            if (m) return normalizeNumber(m[0]);
            if (i + 1 < lines.length) {
                const m2 = lines[i+1].match(/([\d.]+,\d{2})|([\d,]+\.\d{2})/);
                if (m2) return normalizeNumber(m2[0]);
            }
        }
    }
    return 0;
}

function getRetencionPorcentaje() {
    if (configFiscalEmpresa && configFiscalEmpresa.tipo_contribuyente === 'Especial') {
        return configFiscalEmpresa.porcentaje_retencion || 75;
    }
    return document.getElementById('checkRetencionServicio')?.checked ? 5 : 0;
}

function ejecutarCalculoFiscal(base, alicuota, montoExento = 0) {
    const montoExentoSeguro = Math.max(0, montoExento);
    const retencion = getRetencionPorcentaje();

    if (alicuota === 0) {
        document.getElementById('valMontoIva').value = "0.00";
        document.getElementById('valPorcentajeRetencion').value = "0";
        document.getElementById('valMontoRetencion').value = "0.00";

        const contenedorCheck = document.getElementById('contenedorCheckServicio');
        if (contenedorCheck) contenedorCheck.style.display = 'none';

        if (document.getElementById('valBaseImponible')) {
            document.getElementById('valBaseImponible').value = "0.00";
        }
        return montoExentoSeguro;
    }

    const montoIva = base * (alicuota / 100);
    const montoRetencion = montoIva * (retencion / 100);
    const montoTotalFinanciero = montoExentoSeguro + base + montoIva - montoRetencion;

    document.getElementById('valMontoIva').value = montoIva.toFixed(2);
    
    const inputPorc = document.getElementById('valPorcentajeRetencion');
    if (inputPorc) inputPorc.value = retencion;
    
    const inputMontoRet = document.getElementById('valMontoRetencion');
    if (inputMontoRet) inputMontoRet.value = montoRetencion.toFixed(2);

    return montoTotalFinanciero;
}

function recalcularDesdeTotal(total, alicuota, montoExento = 0) {
    if (alicuota === 0) {
        if (document.getElementById('valMontoExento')) {
            document.getElementById('valMontoExento').value = total.toFixed(2);
        }
        if (document.getElementById('valBaseImponible')) {
            document.getElementById('valBaseImponible').value = "0.00";
        }
        ejecutarCalculoFiscal(0, 0, total);
        return;
    }

    const porcRet = getRetencionPorcentaje();
    const factorIva = alicuota / 100;
    const factorRet = porcRet / 100;
    const montoExentoSeguro = Math.max(0, montoExento);
    const taxedTotal = Math.max(0, total - montoExentoSeguro);
    const baseCalculada = taxedTotal / (1 + factorIva - (factorIva * factorRet));

    if (document.getElementById('valBaseImponible')) {
        document.getElementById('valBaseImponible').value = baseCalculada.toFixed(2);
    }
    if (document.getElementById('valMontoExento')) {
        document.getElementById('valMontoExento').value = montoExentoSeguro.toFixed(2);
    }

    ejecutarCalculoFiscal(baseCalculada, alicuota, montoExentoSeguro);
}

function recalcularDesdeBase(base, alicuota, montoExento = 0) {
    const totalFinanciero = ejecutarCalculoFiscal(base, alicuota, montoExento);
    document.getElementById('valTotal').value = totalFinanciero.toFixed(2);
}

// ====================================================================
// 🔥 SOLUCIÓN ARREGLADA: Validación inteligente de Monto Exento en Cero
// ====================================================================
function verificarCalidadDatos() {
    const statusAlert = document.getElementById('statusAlert');
    if (!statusAlert) return;

    const alicuotaActual = document.getElementById('valPorcentajeAlicuota')?.value || "16";

    const inputs = [
        document.getElementById('valProveedor'),
        document.getElementById('valDireccion'),
        document.getElementById('valRif'),
        document.getElementById('valNro'),
        document.getElementById('valControl'),
        document.getElementById('valFecha'),
        document.getElementById('valTotal'),
        document.getElementById('valCategoria'),
        document.getElementById('valBaseImponible'),
        document.getElementById('valMontoExento'),
        document.getElementById('valMontoIva')
    ];

    let camposIncompletos = false;

    inputs.forEach(input => {
        if (!input) return;
        const val = input.value.trim();
        const valUpper = val.toUpperCase();
        
        // Excepciones explícitas basadas en la lógica contable del IVA
        if (input.id === 'valMontoExento' && alicuotaActual !== '0' && (val === '0.00' || val === '0' || val === '')) {
            // Si hay IVA y el exento es cero, es 100% lícito contablemente. Quitamos error.
            input.classList.remove('missing-field');
            return;
        }
        if (input.id === 'valMontoIva' && alicuotaActual === '0') {
            input.classList.remove('missing-field');
            return;
        }
        if (input.id === 'valBaseImponible' && alicuotaActual === '0') {
            input.classList.remove('missing-field');
            return;
        }

        // Regla general de campo vacío o no detectado
        if (!val || valUpper === 'NO DETECTADO' || valUpper === 'SIN CATEGORÍA' || val === '0.00' || val === '0') {
            input.classList.add('missing-field');
            camposIncompletos = true;
        } else {
            input.classList.remove('missing-field');
        }
    });

    if (camposIncompletos) {
        statusAlert.innerText = "Campos o cálculos incompletos: Revisa los bloques marcados en rojo e ingresa los datos fiscales faltantes manualmente.";
        statusAlert.className = "status-alert warning";
    } else {
        statusAlert.innerText = "¡Estructura fiscal y datos extraídos con éxito! Realiza una última verificación visual de los montos antes de guardar.";
        statusAlert.className = "status-alert success";
    }
}