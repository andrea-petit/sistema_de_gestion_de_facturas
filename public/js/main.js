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
});

/**
 * Cambiar de módulo (Vistas SPA)
 */
function switchView(viewId, element) {
    document.querySelectorAll('.submenu-link').forEach(link => link.classList.remove('active'));
    element.classList.add('active');

    document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');

    const parentMenuName = element.closest('.menu-item').querySelector('.menu-btn').innerText;
    document.getElementById('topBarTitle').innerText = `${parentMenuName} > ${element.innerText}`;
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
            const response = await fetch('/api/facturas', { method: 'POST', body: formData });
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