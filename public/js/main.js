/**
 * SGAF - Módulo de Control de Interfaz y Validación de Flujo
 */

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Sidebar Desplegado por Defecto
    const primerMenuItem = document.querySelector('.menu-item');
    if (primerMenuItem) primerMenuItem.classList.add('active');
    
    // Configurar manejadores de clicks del Sidebar Principal
    document.querySelectorAll('.menu-btn').forEach(button => {
        button.addEventListener('click', () => {
            const menuItem = button.parentElement;
            const isAlreadyActive = menuItem.classList.contains('active');
            
            document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
            if (!isAlreadyActive) {
                menuItem.classList.add('active');
            }
        });
    });

    // Registrar Eventos del Formulario de Carga
    initUploadForm();
    initBuscarModulo();
    initHistorialModulo(); // Inicializa el módulo de historial y carga la primera página
    initProveedoresModulo();
    initUsuariosModulo();
});

/**
 * Cambiar de módulo (Vistas SPA)
 */
function switchView(viewId, element) {
    if (!element) {
        element = document.querySelector(`.submenu-link[href="#${viewId}"]`);
    }
    if (!element) {
        console.warn(`switchView: elemento no encontrado para viewId=${viewId}`);
        return;
    }

    document.querySelectorAll('.submenu-link').forEach(link => link.classList.remove('active'));
    element.classList.add('active');

    document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));
    const targetPanel = document.getElementById(`view-${viewId}`);
    if (targetPanel) {
        targetPanel.classList.add('active');
    }

    const parentMenu = element.closest('.menu-item');
    const parentMenuName = parentMenu ? parentMenu.querySelector('.menu-btn')?.innerText : '';
    const topBarTitle = document.getElementById('topBarTitle');
    if (topBarTitle) {
        topBarTitle.innerText = parentMenuName ? `${parentMenuName} > ${element.innerText}` : element.innerText;
    }
}

/**
 * Gestión del Formulario de Procesamiento e Interacción con el Servidor
 */
// Variable en memoria para las directrices fiscales del SENIAT
let configFiscalEmpresa = null;

async function initUploadForm() {
    const fileInput = document.getElementById('fileInput');
    const uploadLabel = document.getElementById('uploadLabel');
    const uploadForm = document.getElementById('uploadForm');
    const btnSubmit = document.getElementById('btnSubmit');
    const loadingText = document.getElementById('loadingText');
    const resultSection = document.getElementById('resultSection');
    const verificationForm = document.getElementById('verificationForm');
    const dropZone = document.getElementById('dropZone');

    // Elementos nuevos de impuestos
    const valTotal = document.getElementById('valTotal');
    const valBaseImponible = document.getElementById('valBaseImponible');
    const valMontoExento = document.getElementById('valMontoExento');
    const valPorcentajeAlicuota = document.getElementById('valPorcentajeAlicuota');
    const checkRetencionServicio = document.getElementById('checkRetencionServicio');

    // 🚀 CARGA INICIAL: Traer el perfil de la empresa apenas se monta el módulo
    try {
        const resEmpresa = await fetch('/api/empresa', { method: 'GET', credentials: 'include' });
        const resEmpresaJson = await resEmpresa.json();
        if (resEmpresaJson.ok && resEmpresaJson.data) {
            configFiscalEmpresa = resEmpresaJson.data;
            console.log("[SGAF Fiscal] Perfil detectado:", configFiscalEmpresa.tipo_contribuyente);
        }
    } catch (err) {
        console.error("No se pudo pre-cargar el perfil de empresa:", err);
    }

    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => { fileInput.click(); });
    }

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) uploadLabel.innerText = `Seleccionado: ${fileInput.files[0].name}`;
    });

    // =================================================================
    // PASO 1: RECEPCIÓN DEL OCR Y SETEO DE VALORES
    // =================================================================
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

                // Normalizador local: acepta números o strings con separadores ("2.552,97")
                function normalizeNumber(input) {
                    if (input === undefined || input === null) return 0;
                    if (typeof input === 'number') return input;
                    let s = String(input).trim();
                    if (!s) return 0;
                    // eliminar cualquier caracter excepto dígitos, puntos y comas
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
                
                let alicuotaADesglosar = 16; // Por defecto general

                if (montoIvaDetectado === 0 && montoAfectoDetectado === 0 && montoExentoDetectado > 0 && montoExentoDetectado >= totalFactura) {
                    console.log("[SGAF Analizador] Factura totalmente exenta detectada.");
                    alicuotaADesglosar = 0;
                    if (selectorAlicuota) selectorAlicuota.value = "0";
                } else if (textoUpper.includes("EXENTO") || (textoUpper.match(/\(E\)/g) || []).length > 2) {
                    console.log("[SGAF Analizador] Se detectó comportamiento exento (0% IVA).");
                    alicuotaADesglosar = 0;
                    if (selectorAlicuota) selectorAlicuota.value = "0";
                } else {
                    if (selectorAlicuota) selectorAlicuota.value = selectorAlicuota.value || "16";
                }
                
                // Preferir la Base Imponible detectada por OCR si está disponible
                // Si no está, intentamos extraer localmente desde el texto plano mostrado (resTextoPlano)
                function extractFromRawText(labelRegex) {
                    const raw = (document.getElementById('resTextoPlano')?.innerText || '').toUpperCase();
                    const lines = raw.split(/\n|\r/).map(l => l.trim()).filter(Boolean);
                    for (let i = 0; i < lines.length; i++) {
                        if (labelRegex.test(lines[i])) {
                            // buscar en la misma línea
                            const m = lines[i].match(/([\d.]+,\d{2})|([\d,]+\.\d{2})/);
                            if (m) return normalizeNumber(m[0]);
                            // buscar en la siguiente línea
                            if (i + 1 < lines.length) {
                                const m2 = lines[i+1].match(/([\d.]+,\d{2})|([\d,]+\.\d{2})/);
                                if (m2) return normalizeNumber(m2[0]);
                            }
                        }
                    }
                    return 0;
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
                    // Actualizamos visualmente la Base e IVA (si es posible)
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
                alert(`Error: ${resultado.error}`); 
            }
        } catch (error) { 
            alert('Error de conexión con el servidor.'); 
        } finally { 
            btnSubmit.disabled = false; 
            loadingText.style.display = 'none'; 
        }
    });

    // LISTENERS DE RECALCULO FISCAL DINÁMICO EN PANTALLA
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

    // =================================================================
    // PASO 2: ENVÍO DEFINITIVO DE DATOS AUDITADOS (Tablas Relacionales)
    // =================================================================
    verificationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Estructura integrada para 'public.compras' y 'public.compra_impuestos'
        const datosVerificados = {
            proveedor: document.getElementById('valProveedor').value.trim(),
            direccion: document.getElementById('valDireccion').value.trim(),
            rifEmisor: document.getElementById('valRif').value.trim(),
            nroFactura: document.getElementById('valNro').value.trim(),
            nroControl: document.getElementById('valControl').value.trim(),
            fechaEmision: document.getElementById('valFecha').value.trim(),
            categoria: document.getElementById('valCategoria').value.trim(),
            img_url: document.getElementById('valImgUrl').value,
            
            // Monto total real financiero final (Base + IVA - Retencion)
            montoTotal: parseFloat(valTotal.value) || 0,
            porcentaje_alicuota: parseFloat(valPorcentajeAlicuota.value) || 0,
            montoExento: parseFloat(valMontoExento?.value) || 0,
            montoAfectoIva: parseFloat(valBaseImponible.value) || 0,
            montoIva: parseFloat(document.getElementById('valMontoIva').value) || 0,
            porcentaje_retencion: parseFloat(document.getElementById('valPorcentajeRetencion').value) || 0,
            monto_retencion: parseFloat(document.getElementById('valMontoRetencion').value) || 0
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
                alert("¡Factura e Impuestos auditados con éxito!");
                verificationForm.reset();
                uploadForm.reset();
                uploadLabel.innerText = "Haz clic para seleccionar la imagen de la factura";
                resultSection.style.display = 'none';
            } else {
                alert(`Error al guardar: ${resGuardar.error}`);
            }
        } catch (err) {
            alert("Error de conexión al intentar registrar la factura.");
        }
    });
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
        return montoExentoSeguro; // El total financiero es exactamente el monto exento
    }

    const montoIva = base * (alicuota / 100);
    const montoRetencion = montoIva * (retencion / 100);
    const montoTotalFinanciero = montoExentoSeguro + base + montoIva - montoRetencion;

    document.getElementById('valMontoIva').value = montoIva.toFixed(2);
    document.getElementById('valPorcentajeRetencion').value = retencion;
    document.getElementById('valMontoRetencion').value = montoRetencion.toFixed(2);

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


/**
 * Evalúa si la extracción de datos e impuestos vino completa o requiere intervención humana
 */
function verificarCalidadDatos() {
    const statusAlert = document.getElementById('statusAlert');
    if (!statusAlert) return;

    // Lista extendida con los nuevos campos fiscales obligatorios
    const inputs = [
        document.getElementById('valProveedor'),
        document.getElementById('valDireccion'),
        document.getElementById('valRif'),
        document.getElementById('valNro'),
        document.getElementById('valControl'),
        document.getElementById('valFecha'),
        document.getElementById('valTotal'),
        document.getElementById('valCategoria'),
        document.getElementById('valBaseImponible'), // <-- Nuevo auditado
        document.getElementById('valMontoExento'),
        document.getElementById('valMontoIva')        // <-- Nuevo auditado
    ];

    let camposIncompletos = false;

    // Evaluamos cada input para marcar visualmente los vacíos o los "No detectado"
    inputs.forEach(input => {
        if (!input) return; // Salvavidas por si acaso
        
        const val = input.value.trim().toUpperCase();
        
        // Si el campo está vacío, es "0.00" (en campos críticos) o dice "NO DETECTADO", se marca en rojo
            if (!val || val === 'NO DETECTADO' || val === 'SIN CATEGORÍA' || val === '0.00' || val === '0') {

            // Excepción: Si la alícuota es 0% (Exento), el IVA y la Base Imponible pueden ser 0.00 sin ser un error
            if (input.id === 'valMontoIva' && document.getElementById('valPorcentajeAlicuota').value === '0') {
                input.classList.remove('missing-field');
                return;
            }
            if (input.id === 'valBaseImponible' && document.getElementById('valPorcentajeAlicuota').value === '0') {
                input.classList.remove('missing-field');
                return;
            }
            if (input.id === 'valMontoExento' && document.getElementById('valPorcentajeAlicuota').value !== '0') {
                input.classList.remove('missing-field');
                return;
            }

            input.classList.add('missing-field');
            camposIncompletos = true;
        } else {
            input.classList.remove('missing-field');
        }
    });

    // Inyección de alertas dinámicas basadas en el estado del motor fiscal y OCR
    if (camposIncompletos) {
        statusAlert.innerText = "Campos o cálculos incompletos: Revisa los bloques marcados en rojo e ingresa los datos fiscales faltantes manualmente.";
        statusAlert.className = "status-alert warning";
    } else {
        statusAlert.innerText = "¡Estructura fiscal y datos extraídos con éxito! Realiza una última verificación visual de los montos antes de guardar.";
        statusAlert.className = "status-alert success";
    }
}

function initBuscarModulo() {
    const btnBuscar = document.getElementById('btnBuscarFacturas');
    const searchFecha = document.getElementById('searchFecha');
    const listaCuerpo = document.getElementById('listaFacturasCuerpo');
    const visorPlaceholder = document.getElementById('visorPlaceholder');
    const visorContenido = document.getElementById('visorContenido');
    const visorTitulo = document.getElementById('visorTitulo');
    const imgFacturaDigital = document.getElementById('imgFacturaDigital');

    if (!btnBuscar) return;

    btnBuscar.addEventListener('click', async () => {
        const fechaSeleccionada = searchFecha.value; // Formato nativo: YYYY-MM-DD
        
        if (!fechaSeleccionada) {
            alert("Por favor, selecciona una fecha válida para la consulta.");
            return;
        }

        const [anio, mes, dia] = fechaSeleccionada.split('-');
    
        // Lo reorganizamos al formato exacto que tiene tu BD (Año - Mes - Día real)
        // Si notas que el input del navegador te leyó el día como mes, los invertimos aquí:
        const fechaFormateada = `${anio}-${dia}-${mes}`; 
        
        console.log("[SGAF Frontend] Fecha corregida enviada al API:", fechaFormateada);

        btnBuscar.disabled = true;
        listaCuerpo.innerHTML = `<tr><td colspan="3" style="padding: 20px; text-align: center; color: var(--primary);"> Buscando comprobantes...</td></tr>`;
        
        // Resetear visor
        visorContenido.style.display = 'none';
        visorPlaceholder.style.display = 'block';

        try {
            // Hacemos el fetch enviando la fecha como un Query Parameter (?fecha=YYYY-MM-DD)
            const response = await fetch(`/api/facturas?fecha=${fechaFormateada}`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
                // Si requieres pasar tokens de authMiddleware, agrégalos aquí en los headers:
                // 'Authorization': `Bearer ${token}`
            });

            const resultado = await response.json();

            if (!response.ok) {
                throw new Error(resultado.error || 'Error al obtener registros.');
            }

            const facturas = resultado.data || [];

            if (facturas.length === 0) {
                listaCuerpo.innerHTML = `<tr><td colspan="3" style="padding: 20px; text-align: center; color: var(--text-muted);">No se encontraron facturas emitidas en este día.</td></tr>`;
                return;
            }

            // Limpiamos la tabla para inyectar filas
            listaCuerpo.innerHTML = '';

            facturas.forEach(factura => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border)';
                tr.style.transition = 'background 0.2s';
                
                // Formateamos los datos seguros desde las relaciones unificadas del backend
                const proveedorNombre = factura.proveedores?.razon_social || factura.proveedor_nombre || 'Desconocido';
                const numeroFactura = factura.numero_factura;
                const urlDigital = factura.img_url || '';

                tr.innerHTML = `
                    <td style="padding: 12px 15px; font-weight: 500; color: #0f172a;">${numeroFactura}</td>
                    <td style="padding: 12px 15px; color: #475569;">${proveedorNombre}</td>
                    <td style="padding: 12px 15px; text-align: right;">
                        <button class="btn-auditar" style="background: var(--primary); color: white; border: none; padding: 6px 12px; font-size: 12px; font-weight:600; border-radius: 4px; cursor: pointer;">
                            Ver Imagen
                        </button>
                    </td>
                `;

                // Evento click al botón de la fila para cargar la imagen en el visor
                const btnAuditar = tr.querySelector('.btn-auditar');
                btnAuditar.addEventListener('click', () => {
                    // Resaltar fila seleccionada visualmente
                    document.querySelectorAll('#listaFacturasCuerpo tr').forEach(r => r.style.background = 'transparent');
                    tr.style.background = '#eff6ff';

                    if (!urlDigital) {
                        alert("Este registro no cuenta con una imagen de respaldo digital en Cloudinary.");
                        return;
                    }

                    // Cargar datos al visor lateral
                    visorTitulo.innerText = `Factura: ${numeroFactura} - ${proveedorNombre}`;
                    imgFacturaDigital.src = urlDigital;
                    
                    visorPlaceholder.style.display = 'none';
                    visorContenido.style.display = 'block';
                });

                listaCuerpo.appendChild(tr);
            });

        } catch (error) {
            listaCuerpo.innerHTML = `<tr><td colspan="3" style="padding: 20px; text-align: center; color: #ef4444;">❌ Error: ${error.message}</td></tr>`;
        } finally {
            btnBuscar.disabled = false;
        }
    });

}

// =================================================================
// MODULO DE HISTORIAL DE AUDITORÍA (LIBRO DE COMPRAS - SGAF)
// =================================================================

// Mantenemos las variables de estado en el ámbito global del script
let paginaActualHistorial = 1;
const limitePorPaginaHistorial = 10; 

function initHistorialModulo() {
    const btnPrev = document.getElementById('btnPrevHistorial');
    const btnNext = document.getElementById('btnNextHistorial');
    const cuerpo = document.getElementById('tablaHistorialCuerpo');

    // BLINDAJE: Si los elementos no existen en la vista HTML actual, se sale pacíficamente
    if (!btnPrev || !cuerpo) {
        console.log("[SGAF Info] Componentes de la vista de historial no detectados en este panel.");
        return;
    }

    // Remover listeners viejos para evitar ejecuciones duplicadas en memoria
    const nuevoBtnPrev = btnPrev.cloneNode(true);
    const nuevoBtnNext = btnNext.cloneNode(true);
    btnPrev.parentNode.replaceChild(nuevoBtnPrev, btnPrev);
    btnNext.parentNode.replaceChild(nuevoBtnNext, btnNext);

    // Cargar la primera página automáticamente al inicializar el módulo
    cargarHistorial(paginaActualHistorial);

    // Registrar los nuevos eventos limpios
    nuevoBtnPrev.addEventListener('click', () => {
        if (paginaActualHistorial > 1) {
            paginaActualHistorial--;
            cargarHistorial(paginaActualHistorial);
        }
    });

    nuevoBtnNext.addEventListener('click', () => {
        paginaActualHistorial++;
        cargarHistorial(paginaActualHistorial);
    });
}

async function cargarHistorial(page) {
    const cuerpo = document.getElementById('tablaHistorialCuerpo');
    const infoPag = document.getElementById('infoPaginacion');
    const btnPrev = document.getElementById('btnPrevHistorial');
    const btnNext = document.getElementById('btnNextHistorial');

    if (!cuerpo) return;

    cuerpo.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--primary);">⏳ Cargando bitácora de auditoría...</td></tr>`;

    try {
        // Hacemos la petición pasando las credenciales seguras (Cookies de sesión/Auth)
        const response = await fetch(`/api/historial?page=${page}&limit=${limitePorPaginaHistorial}`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });

        const resultado = await response.json();
        if (!response.ok) throw new Error(resultado.error || 'Error en la petición de auditoría.');

        const registros = resultado.data || [];
        const pag = resultado.paginacion || { paginaActual: page, totalPaginas: 1, totalRegistros: registros.length };

        if (registros.length === 0) {
            cuerpo.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--text-muted);">No existen registros en la bitácora de cambios.</td></tr>`;
            if (infoPag) infoPag.innerText = "Página 0 de 0";
            if (btnPrev) btnPrev.disabled = true;
            if (btnNext) btnNext.disabled = true;
            return;
        }

        // Limpiamos e inyectamos filas dinámicas
        cuerpo.innerHTML = '';
        registros.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';
            
            let colorAccion = '#0ea5e9'; // CREATE (Azul)
            if (item.accion === 'DELETE') colorAccion = '#ef4444'; // DELETE (Rojo)
            if (item.accion === 'UPDATE') colorAccion = '#f59e0b'; // UPDATE (Amarillo)

            // Formatear fecha legible con la zona horaria de Venezuela (SENIAT compliance)
            const fechaLegible = new Date(item.fecha).toLocaleString('es-VE', { timeZone: 'America/Caracas' });
            
            // Sanitización del bloque JSON para evitar romper la estructura de la tabla
            const datosNuevos = item.valor_nuevo ? JSON.stringify(item.valor_nuevo) : 'N/A';

            tr.innerHTML = `
                <td style="padding: 10px 15px; color: #475569; white-space: nowrap;">${fechaLegible}</td>
                <td style="padding: 10px 15px; font-weight: 500;">${item.usuario_nombre || item.usuario_email || 'Sistema (Anon)'}</td>
                <td style="padding: 10px 15px;"><span style="background: ${colorAccion}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">${item.accion}</span></td>
                <td style="padding: 10px 15px; text-transform: uppercase; font-weight:600; color: #64748b;">${item.tabla_afectada}</td>
                <td style="padding: 10px 15px; color: #94a3b8;">#${item.registro_id || 'N/A'}</td>
                <td style="padding: 10px 15px; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; color: #0f172a;" title='${datosNuevos}'>${datosNuevos}</td>
            `;
            cuerpo.appendChild(tr);
        });

        // Actualizar estados visuales de la botonera
        if (infoPag) {
            infoPag.innerText = `Mostrando página ${pag.paginaActual} de ${pag.totalPaginas} (Total: ${pag.totalRegistros} operaciones)`;
        }
        if (btnPrev) btnPrev.disabled = (pag.paginaActual === 1);
        if (btnNext) btnNext.disabled = (pag.paginaActual === pag.totalPaginas || pag.totalPaginas === 0);

    } catch (error) {
        console.error("[SGAF Error Historial]:", error);
        cuerpo.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #ef4444;">❌ Error al cargar historial: ${error.message}</td></tr>`;
        if (btnPrev) btnPrev.disabled = true;
        if (btnNext) btnNext.disabled = true;
    }
}


function initProveedoresModulo() {
    cargarProveedores();

    const formEdicion = document.getElementById('formEdicionProveedor');
    if (!formEdicion) return;

    formEdicion.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const idProveedor = document.getElementById('editProvId').value;
        
        // Mapeamos los campos actuales
        const inputs = [
            document.getElementById('editProvRazon'),
            document.getElementById('editProvDireccion'),
            document.getElementById('editProvTelefono'),
            document.getElementById('editProvContribuyente')
        ];

        let actualizacionesExitosas = 0;
        const btnSubmit = formEdicion.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.innerText = "Guardando...";

        try {
            // Evaluamos secuencialmente cada input
            for (const input of inputs) {
                const nombreCampo = input.getAttribute('data-campo');
                let valorCampo = input.value.trim();

                // Si el teléfono está vacío, lo enviamos como un string vacío o nulo en lugar de bloquear el submit
                if (nombreCampo === 'telefono' && !valorCampo) {
                    valorCampo = ""; 
                }

                const response = await fetch(`/api/proveedores/${idProveedor}`, {
                    method: 'PUT',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        campo: nombreCampo,
                        valor: valorCampo
                    })
                });

                if (response.ok) actualizacionesExitosas++;
            }

            if (actualizacionesExitosas > 0) {
                alert("¡Proveedor actualizado correctamente!");
                await cargarProveedores();
                
                // Limpieza del panel de edición
                document.getElementById('editorPlaceholder').style.display = 'block';
                formEdicion.style.display = 'none';
                formEdicion.reset();
            } else {
                alert("No se realizaron modificaciones en el proveedor.");
            }

        } catch (error) {
            console.error("[SGAF Error Proveedores]:", error);
            alert("Error de conexión al intentar actualizar el proveedor.");
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerText = "Guardar Cambios";
        }
    });
}

async function cargarProveedores() {
    const cuerpoTabla = document.getElementById('listaProveedoresCuerpo');
    if (!cuerpoTabla) return;

    try {
        const response = await fetch('/api/proveedores', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });

        const resultado = await response.json();
        if (!response.ok) throw new Error(resultado.msg || 'Error al recuperar proveedores.');

        const proveedores = resultado.data || [];

        if (proveedores.length === 0) {
            cuerpoTabla.innerHTML = `<tr><td colspan="4" style="padding: 20px; text-align: center; color: var(--text-muted);">No existen proveedores registrados en la base de datos.</td></tr>`;
            return;
        }

        cuerpoTabla.innerHTML = '';
        
        proveedores.forEach(prov => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';
            tr.style.transition = 'background 0.2s';

            // Formateo estético del RIF completo (Ej: J-41234567-0)
            const tipoDoc = prov.tipo_documento ? `${prov.tipo_documento}-` : '';
            const rifCompleto = `${tipoDoc}${prov.rif || 'S/R'}`;

            tr.innerHTML = `
                <td style="padding: 12px 10px; font-weight: 600; color: #0f172a;">${rifCompleto}</td>
                <td style="padding: 12px 10px; color: #334155; font-weight: 500;">${prov.razon_social}</td>
                <td style="padding: 12px 10px; color: #64748b;">${prov.telefono || 'N/A'}</td>
                <td style="padding: 12px 10px; text-align: right;">
                    <button class="btn-editar-prov" style="background: #f1f5f9; color: var(--primary); border: 1px solid var(--border); padding: 5px 10px; font-size: 12px; font-weight: 600; border-radius: 4px; cursor: pointer; transition: all 0.2s;">
                        Editar
                    </button>
                </td>
            `;

            // Evento interactivo para cargar los datos en el editor lateral
            const btnEditar = tr.querySelector('.btn-editar-prov');
            btnEditar.addEventListener('click', () => {
                // Efecto visual selectivo en la tabla
                document.querySelectorAll('#listaProveedoresCuerpo tr').forEach(r => r.style.background = 'transparent');
                tr.style.background = '#eff6ff';

                // Mostrar el formulario y rellenar los inputs con el estado actual
                document.getElementById('editorPlaceholder').style.display = 'none';
                const formEdicion = document.getElementById('formEdicionProveedor');
                formEdicion.style.display = 'flex';

                document.getElementById('editProvId').value = prov.id;
                document.getElementById('editProvRazon').value = prov.razon_social || '';
                document.getElementById('editProvDireccion').value = prov.direccion || '';
                document.getElementById('editProvTelefono').value = prov.telefono || '';
                document.getElementById('editProvContribuyente').value = prov.tipo_contribuyente || '';
            });

            cuerpoTabla.appendChild(tr);
        });

    } catch (error) {
        console.error("[SGAF Error Tabla Proveedores]:", error);
        cuerpoTabla.innerHTML = `<tr><td colspan="4" style="padding: 20px; text-align: center; color: #ef4444;">❌ Error al procesar listado: ${error.message}</td></tr>`;
    }
}


// Variables de control de estado del módulo
let modoFormUsuario = 'REGISTRO'; 

function initUsuariosModulo() {
    // Forzamos un valor seguro por defecto por si storage está vacío
    // Primero leemos `localStorage` (guardado por el login), con fallback a `sessionStorage`
    let operadorRol = localStorage.getItem('userRol') || sessionStorage.getItem('userRol');

    console.log("[SGAF Seguridad] Inicializando módulo con rol:", operadorRol);

    // 1. CONTROL DE ACCESO DE MENÚ LATERAL (Evita romper el script si el id cambia)
    if (operadorRol === 'empleado') {
        const menuUser = document.getElementById('menuItemUsuarios');
        if (menuUser) menuUser.remove();
        return; 
    }

    // 2. REGLA ESTRICTA: El Admin NO puede crear Administradores
    const optAdmin = document.getElementById('optRolAdmin');
    if (operadorRol === 'admin' && optAdmin) {
        optAdmin.remove(); 
    }

    // Forzar la carga de la tabla
    cargarUsuariosTabla(operadorRol);

    // 3. CAPTURA DEL FORMULARIO SIN CAUSAR EXCEPCIONES
    const formGestion = document.getElementById('formGestionUsuario');
    if (formGestion) {
        formGestion.onsubmit = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await procesarFormularioUsuario(operadorRol);
            return false;
        };
    } else {
        console.warn("[SGAF Seguridad] Alerta: No se encontró el elemento #formGestionUsuario en el HTML.");
    }

    // Botones auxiliares de control de modo
    const btnModoRegistro = document.getElementById('btnModoRegistro');
    const btnCancelarEdicion = document.getElementById('btnCancelarEdicion');

    if (btnModoRegistro) {
        btnModoRegistro.onclick = () => setFormModo('REGISTRO', null, operadorRol);
    }
    if (btnCancelarEdicion) {
        btnCancelarEdicion.onclick = () => setFormModo('REGISTRO', null, operadorRol);
    }
}

// Configura visualmente el formulario dependiendo de la acción (Registrar o Editar)
function setFormModo(modo, usuarioData = null, operadorRol = 'admin') {
    modoFormUsuario = modo;
    const form = document.getElementById('formGestionUsuario');
    const titulo = document.getElementById('formUsuarioTitulo');
    const desc = document.getElementById('formUsuarioDescripcion');
    const btnSubmit = document.getElementById('btnSubmitUsuario');
    const btnCancelar = document.getElementById('btnCancelarEdicion');
    const groupRol = document.getElementById('groupFormRol');
    const labelPass = document.getElementById('labelFormPassword');
    const helpPass = document.getElementById('helpFormPassword');
    const inputPass = document.getElementById('userFormPassword');

    if (!form) return;
    form.reset();

    // Variables de colores a prueba de fallos (si no existen tus variables CSS, usa valores fijos)
    const colorPrimario = "var(--primary, #2563eb)";
    const colorAdvertencia = "var(--warning, #eab308)";

    if (modo === 'REGISTRO') {
        if (titulo) titulo.innerText = "Registrar Nuevo Usuario";
        if (desc) desc.innerText = "Completa los datos para asignar credenciales de acceso al sistema.";
        if (btnSubmit) {
            btnSubmit.innerText = "Crear Usuario";
            btnSubmit.style.backgroundColor = colorPrimario;
        }
        if (btnCancelar) btnCancelar.style.display = "none";
        if (groupRol) groupRol.style.display = "flex";
        if (labelPass) labelPass.innerText = "Contraseña de Acceso:";
        if (helpPass) helpPass.style.display = "none";
        if (inputPass) inputPass.required = true;
        
        const inputUser = document.getElementById('userFormUsername');
        if (inputUser) inputUser.disabled = false;
    } else if (modo === 'EDICION' && usuarioData) {
        if (titulo) titulo.innerText = `Editar: @${usuarioData.nombre_usuario}`;
        if (desc) desc.innerText = "Modifica los campos del operador. El rol no puede alterarse.";
        if (btnSubmit) {
            btnSubmit.innerText = "Guardar Cambios";
            btnSubmit.style.backgroundColor = colorAdvertencia;
        }
        if (btnCancelar) btnCancelar.style.display = "block";
        if (groupRol) groupRol.style.display = "none"; 
        if (labelPass) labelPass.innerText = "Resetear Contraseña (Opcional):";
        if (helpPass) helpPass.style.display = "block";
        if (inputPass) inputPass.required = false; 

        // Rellenar datos controlando nulos
        const inputId = document.getElementById('userFormId');
        const inputUser = document.getElementById('userFormUsername');
        const inputNombre = document.getElementById('userFormNombre');
        const inputCorreo = document.getElementById('userFormCorreo');

        if (inputId) inputId.value = usuarioData.id || '';
        if (inputUser) {
            inputUser.value = usuarioData.nombre_usuario || '';
            inputUser.disabled = true;
        }
        if (inputNombre) inputNombre.value = usuarioData.nombre_completo || '';
        if (inputCorreo) inputCorreo.value = usuarioData.correo || '';
    }
}

async function cargarUsuariosTabla(operadorRol) {
    const cuerpo = document.getElementById('listaUsuariosCuerpo');
    if (!cuerpo) return;

    // Estilos de texto alternativos por si var(--text-muted) causa problemas
    const colorMuted = "var(--text-muted, #64748b)";

    try {
        console.log("[SGAF Seguridad] Solicitando /api/users...");
        const res = await fetch('/api/users', { method: 'GET', credentials: 'include' });
        const resJson = await res.json();

        if (!res.ok) throw new Error(resJson.msg || 'Error al descargar el listado.');

        const usuarios = resJson.data || [];
        cuerpo.innerHTML = '';

        if (usuarios.length === 0) {
            cuerpo.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: ${colorMuted};">No hay usuarios registrados.</td></tr>`;
            return;
        }

        usuarios.forEach(user => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border, #e2e8f0)';
            
            const estaActivo = user.activo !== false;
            const badgeEstado = estaActivo
                ? `<span style="background: #dcfce7; color: #16a34a; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 11px;">Activo</span>`
                : `<span style="background: #fee2e2; color: #ef4444; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 11px;">Inactivo</span>`;

            tr.innerHTML = `
                <td style="padding: 12px 10px; font-weight: 600; color: #0f172a;">@${user.nombre_usuario || 'S/U'}</td>
                <td style="padding: 12px 10px; color: #334155;">${user.nombre_completo || 'Sin Nombre'}</td>
                <td style="padding: 12px 10px;"><span style="text-transform: capitalize; font-size: 12px; color: #475569; font-weight: 500;">${user.rol || 'Sin Rol'}</span></td>
                <td style="padding: 12px 10px;">${badgeEstado}</td>
                <td style="padding: 12px 10px; text-align: right;" class="acciones-zona"></td>
            `;

            const zonaAcciones = tr.querySelector('.acciones-zona');

            if (operadorRol === 'admin' && (user.rol === 'admin' || user.rol === 'superadmin')) {
                if (zonaAcciones) zonaAcciones.innerHTML = `<span style="color: ${colorMuted}; font-size: 12px; font-style: italic;">Protegido</span>`;
            } else {
                const btnEdit = document.createElement('button');
                btnEdit.innerText = "✏️";
                btnEdit.style = "background: none; border: none; cursor: pointer; margin-right: 10px; font-size: 13px;";
                btnEdit.onclick = () => setFormModo('EDICION', user, operadorRol);

                const btnInactivar = document.createElement('button');
                btnInactivar.innerText = estaActivo ? "❌" : "✅";
                btnInactivar.style = "background: none; border: none; cursor: pointer; font-size: 13px;";
                btnInactivar.onclick = () => alternarEstadoUsuario(user.id, user.nombre_usuario, operadorRol);

                if (zonaAcciones) {
                    zonaAcciones.appendChild(btnEdit);
                    zonaAcciones.appendChild(btnInactivar);
                }
            }

            cuerpo.appendChild(tr);
        });

    } catch (err) {
        console.error("[SGAF Render Usuarios Error]:", err);
        cuerpo.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #ef4444;">❌ Error al procesar usuarios: ${err.message}</td></tr>`;
    }
}

async function procesarFormularioUsuario(operadorRol) {
    const btnSubmit = document.getElementById('btnSubmitUsuario');
    if (btnSubmit) btnSubmit.disabled = true;

    try {
        if (modoFormUsuario === 'REGISTRO') {
            const bodyData = {
                nombre_usuario: document.getElementById('userFormUsername').value.trim(),
                nombre_completo: document.getElementById('userFormNombre').value.trim(),
                correo: document.getElementById('userFormCorreo').value.trim(),
                contraseña: document.getElementById('userFormPassword').value,
                rol: document.getElementById('userFormRol').value
            };

            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(bodyData)
            });
            const resJson = await res.json();
            if (!res.ok) throw new Error(resJson.msg || 'Error en el servidor al registrar.');

            alert('¡Usuario guardado con éxito!');
            setFormModo('REGISTRO', null, operadorRol);
            await cargarUsuariosTabla(operadorRol);

        } else {
            // MODO EDICIÓN
            const idUser = document.getElementById('userFormId').value;
            const camposAEditar = [
                { campo: 'nombre_completo', valor: document.getElementById('userFormNombre').value.trim() },
                { campo: 'correo', valor: document.getElementById('userFormCorreo').value.trim() }
            ];

            const passVal = document.getElementById('userFormPassword').value;
            if (passVal) {
                camposAEditar.push({ campo: 'contraseña', valor: passVal });
            }

            for (const item of camposAEditar) {
                const res = await fetch(`/api/users/${idUser}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ campo: item.campo, valor: item.valor })
                });
                if (!res.ok) {
                    const errorJson = await res.json();
                    throw new Error(errorJson.msg || 'Fallo al actualizar campos.');
                }
            }
            alert('¡Información de usuario modificada con éxito!');
            setFormModo('REGISTRO', null, operadorRol);
            await cargarUsuariosTabla(operadorRol);
        }
    } catch (err) {
        alert(`Error: ${err.message}`);
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

async function alternarEstadoUsuario(id, username, operadorRol) {
    if (!confirm(`¿Deseas cambiar el estado de actividad de @${username}?`)) return;

    try {
        const res = await fetch(`/api/users/${id}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.msg || 'No se pudo procesar la solicitud.');

        alert(`Estado de @${username} modificado.`);
        await cargarUsuariosTabla(operadorRol);
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}

