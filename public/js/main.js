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
function initUploadForm() {
    const fileInput = document.getElementById('fileInput');
    const uploadLabel = document.getElementById('uploadLabel');
    const uploadForm = document.getElementById('uploadForm');
    const btnSubmit = document.getElementById('btnSubmit');
    const loadingText = document.getElementById('loadingText');
    const resultSection = document.getElementById('resultSection');
    const statusAlert = document.getElementById('statusAlert');
    const verificationForm = document.getElementById('verificationForm');
    const dropZone = document.getElementById('dropZone');

    // Manejador del clic en la zona de arrastre
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
                
                // 1. Inyectamos los datos en los inputs visibles
                document.getElementById('valProveedor').value = info.proveedor || '';
                document.getElementById('valDireccion').value = info.direccion || '';
                document.getElementById('valRif').value = info.rifEmisor || '';
                document.getElementById('valNro').value = info.nroFactura || '';
                document.getElementById('valControl').value = info.nroControl || '';
                document.getElementById('valFecha').value = info.fechaEmision || '';
                document.getElementById('valTotal').value = info.montoTotal ? info.montoTotal.toFixed(2) : '';
                document.getElementById('valCategoria').value = info.categoriaDetectada || '';
                
                // [NUEVO] 2. Guardamos la URL de Cloudinary en el input oculto
                document.getElementById('valImgUrl').value = info.img_url || '';
                
                document.getElementById('resTextoPlano').innerText = info.textoPlano || '';

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

    // =================================================================
    // PASO 2: ENVÍO DEFINITIVO DE DATOS AUDITADOS
    // =================================================================
    verificationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Recolectamos los datos directamente del estado actual de los inputs
        const datosVerificados = {
            proveedor: document.getElementById('valProveedor').value.trim(),
            direccion: document.getElementById('valDireccion').value.trim(),
            rifEmisor: document.getElementById('valRif').value.trim(),
            nroFactura: document.getElementById('valNro').value.trim(),
            nroControl: document.getElementById('valControl').value.trim(),
            fechaEmision: document.getElementById('valFecha').value.trim(),
            montoTotal: parseFloat(document.getElementById('valTotal').value),
            categoria: document.getElementById('valCategoria').value.trim(),
            // [SOLUCIÓN] Extraemos de forma segura el valor del input oculto
            img_url: document.getElementById('valImgUrl').value 
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
                alert("¡Factura auditada con éxito! Guardada en el Libro de Compras.");
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

/**
 * Evalúa si la extracción de datos vino completa o requiere intervención humana inmediata
 */
function verificarCalidadDatos() {
    const statusAlert = document.getElementById('statusAlert');
    const inputs = [
        document.getElementById('valProveedor'),
        document.getElementById('valDireccion'),
        document.getElementById('valRif'),
        document.getElementById('valNro'),
        document.getElementById('valControl'),
        document.getElementById('valFecha'),
        document.getElementById('valTotal'),
        document.getElementById('valCategoria')
    ];

    let camposIncompletos = false;

    // Evaluamos cada input para marcar visualmente los vacíos o los "No detectado"
    inputs.forEach(input => {
        const val = input.value.trim().toUpperCase();
        if (!val || val === 'NO DETECTADO' || val === 'SIN CATEGORÍA' || val === '0.00') {
            input.classList.add('missing-field');
            camposIncompletos = true;
        } else {
            input.classList.remove('missing-field');
        }
    });

    // Inyección de alertas dinámicas basadas en las condiciones solicitadas
    if (camposIncompletos) {
        statusAlert.innerText = "⚠️ Campos incompletos: ingresa el dato faltante manualmente o sube nuevamente la factura más legible.";
        statusAlert.className = "status-alert warning";
    } else {
        statusAlert.innerText = "✅ Todos los campos se extrajeron con éxito. Por favor, realiza una última verificación visual antes de guardar.";
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