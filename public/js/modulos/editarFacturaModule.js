export async function initEditarFacturaModulo() {
    console.log("[SGAF - Editar] Inicializando módulo con tabla paginada...");

    const formBuscador = document.getElementById('formLocalizarFactura');
    const inputBuscar = document.getElementById('inputBuscarCodigo');
    const msgEstado = document.getElementById('msgBusquedaEstado');
    
    // Elementos del Modal Paginado
    const modal = document.getElementById('modalSelectorFacturas');
    const btnCerrarModal = document.getElementById('btnCerrarModalFacturas');
    const tbodyModal = document.getElementById('tbodyModalFacturas');
    const btnAnt = document.getElementById('btnPrevPage');
    const btnSig = document.getElementById('btnNextPage');
    const txtPaginacion = document.getElementById('txtInfoPaginacion');

    const contenedorForm = document.getElementById('contenedorFormularioEdicion');
    const formEditar = document.getElementById('formEditarFactura');
    const selectCategoria = document.getElementById('editCategoria');
    const btnLimpiar = document.getElementById('btnLimpiarModulo');

    // Estado interno del paginador
    let criterioActual = "";
    let paginaActual = 1;
    let totalPaginas = 1;
    const limitePorPagina = 5; // Muestra 5 facturas por tanda para no desbordar el modal

    if (!formBuscador || !formEditar) return;

    // Cargar Categorías
    async function cargarCategorias() {
        try {
            const response = await fetch('/api/categorias', { credentials: 'include' });
            const resData = await response.json();
            if (response.ok && selectCategoria) {
                selectCategoria.innerHTML = '<option value="">-- Seleccione una Categoría --</option>';
                resData.data.forEach(cat => {
                    const opt = document.createElement('option');
                    opt.value = cat.id;
                    opt.textContent = cat.nombre;
                    selectCategoria.appendChild(opt);
                });
            }
        } catch (error) {
            console.error('Error cargando categorías:', error);
        }
    }

    // Cargar los datos definitivos en el Formulario Principal
    function seleccionarFacturaParaEditar(factura) {
        document.getElementById('editFacturaId').value = factura.id;
        document.getElementById('editProveedorId').value = factura.proveedor_id;
        document.getElementById('editNroFactura').value = factura.numero_factura;
        document.getElementById('editNroControl').value = factura.numero_control || '';
        
        const montoFormateado = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(factura.monto_total);
        document.getElementById('editMontoTotal').value = `${montoFormateado} BS`;

        if (factura.fecha_emision) {
            document.getElementById('editFechaEmision').value = factura.fecha_emision.split('T')[0];
        }
        if (factura.categoria && selectCategoria) {
            selectCategoria.value = factura.categoria;
        }

        // Mostrar formulario y cerrar modal
        contenedorForm.classList.remove('hidden-sys');
        modal.classList.add('hidden-sys');
        if (msgEstado) msgEstado.innerHTML = `<p class="success-box-sys"><i class="fas fa-check"></i> Editando Factura N° <strong>${factura.numero_factura}</strong> de ${factura.proveedor}.</p>`;
    }

    // Consultar y renderizar la tabla del Modal
    async function consultarFacturasPaginadas() {
        try {
            tbodyModal.innerHTML = '<tr><td colspan="5" class="text-center">Cargando registros...</td></tr>';
            
            const url = `/api/facturas/buscar/coincidencia?criterio=${encodeURIComponent(criterioActual)}&page=${paginaActual}&limit=${limitePorPagina}`;
            const response = await fetch(url, { credentials: 'include' });
            const resData = await response.json();

            if (!response.ok) throw new Error(resData.error);

            const facturas = resData.data;
            totalPaginas = resData.pagination.totalPaginas;
            paginaActual = resData.pagination.paginaActual;

            tbodyModal.innerHTML = '';

            if (facturas.length === 0) {
                tbodyModal.innerHTML = '<tr><td colspan="5" class="text-center">No hay registros en esta página.</td></tr>';
                txtPaginacion.textContent = "Página 0 de 0";
                return;
            }

            // Renderizar filas en la tabla del modal
            facturas.forEach(fac => {
                const tr = document.createElement('tr');
                const fecha = fac.fecha_emision ? fac.fecha_emision.split('T')[0] : 'S/F';
                const monto = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(fac.monto_total);

                tr.innerHTML = `
                    <td>${fecha}</td>
                    <td><strong>${fac.numero_factura}</strong></td>
                    <td>${fac.proveedor}</td>
                    <td class="text-right" style="color:#4e73df; font-weight:bold;">${monto} BS</td>
                    <td class="text-center">
                        <button type="button" class="btn-sys btn-table-select"><i class="fas fa-check"></i> Editar</button>
                    </td>
                `;

                tr.querySelector('.btn-table-select').onclick = () => seleccionarFacturaParaEditar(fac);
                tbodyModal.appendChild(tr);
            });

            // Actualizar controles visuales de la barra de paginación
            txtPaginacion.textContent = `Página ${paginaActual} de ${totalPaginas}`;
            btnAnt.disabled = paginaActual === 1;
            btnSig.disabled = paginaActual >= totalPaginas;

        } catch (error) {
            console.error(error);
            tbodyModal.innerHTML = `<tr><td colspan="5" class="text-center error-td">Error: ${error.message}</td></tr>`;
        }
    }

    // Evento Submit del Buscador Inicial
    formBuscador.addEventListener('submit', (e) => {
        e.preventDefault();
        criterioActual = inputBuscar.value.trim();
        if (!criterioActual) return;

        paginaActual = 1; // Reseteamos a la página uno para la nueva búsqueda
        contenedorForm.classList.add('hidden-sys');
        modal.classList.remove('hidden-sys'); // Abrimos el modal intermedio
        
        consultarFacturasPaginadas();
    });

    // Controladores de los botones de la paginación
    btnAnt.onclick = () => {
        if (paginaActual > 1) {
            paginaActual--;
            consultarFacturasPaginadas();
        }
    };

    btnSig.onclick = () => {
        if (paginaActual < totalPaginas) {
            paginaActual++;
            consultarFacturasPaginadas();
        }
    };

    // Cerrar el modal de forma manual
    btnCerrarModal.onclick = () => modal.classList.add('hidden-sys');

    // Guardar cambios del formulario (PUT)
    formEditar.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idFactura = document.getElementById('editFacturaId').value;

        const datosActualizados = {
            proveedor_id: document.getElementById('editProveedorId').value,
            numero_factura: document.getElementById('editNroFactura').value.trim(),
            numero_control: document.getElementById('editNroControl').value.trim(),
            fecha_emision: document.getElementById('editFechaEmision').value,
            categoria: selectCategoria ? parseInt(selectCategoria.value, 10) : null
        };

        try {
            const response = await fetch(`/api/facturas/${idFactura}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datosActualizados),
                credentials: 'include'
            });

            const resData = await response.json();
            if (!response.ok) throw new Error(resData.error);

            alert('¡Corrección efectuada y guardada en auditoría!');
            resetModulo();

        } catch (error) {
            alert(`Error al actualizar: ${error.message}`);
        }
    });

    function resetModulo() {
        formEditar.reset();
        formBuscador.reset();
        if (msgEstado) msgEstado.innerHTML = '';
        contenedorForm.classList.add('hidden-sys');
        modal.classList.add('hidden-sys');
        criterioActual = "";
    }

    if (btnLimpiar) btnLimpiar.onclick = resetModulo;

    await cargarCategorias();
}