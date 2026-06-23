// Variable global para almacenar y destruir la instancia de la gráfica si se recarga la vista
let instanciaGraficaTorta = null;

export async function initCategoriasModulo() {
    const gridRecuadros = document.getElementById('gridRecuadrosCategorias');
    const txtGranTotal = document.getElementById('txtGranTotalCategorias');
    const modalDesglose = document.getElementById('modalDesgloseCategoria');
    const btnCerrarModal = document.getElementById('btnCerrarModalCategorias');

    // --- Función Principal: Cargar Resumen de la Vista ---
    async function cargarAnaliticaCategorias() {
        try {
            const response = await fetch('/api/categorias/resumen', { credentials: 'include' });
            const resData = await response.json();

            if (!response.ok) throw new Error(resData.error || 'Error al compilar el resumen.');

            const { granTotal, data: categorias } = resData;

            // 1. Mostrar Gran Total Formateado en BS
            if (txtGranTotal) {
                txtGranTotal.textContent = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(granTotal);
            }

            // 2. Renderizar Recuadros Financieros Laterales
            renderizarRecuadros(categorias);

            // 3. Renderizar la Gráfica de Torta Grande
            renderizarGraficaTorta(categorias);

        } catch (error) {
            console.error('Error en initCategoriasModulo:', error);
            if (gridRecuadros) {
                gridRecuadros.innerHTML = `<p class="error-text">No se pudo cargar el análisis financiero: ${error.message}</p>`;
            }
        }
    }

    // --- Función: Pintar los Recuadros de Totales en el DOM ---
    function renderizarRecuadros(categorias) {
        if (!gridRecuadros) return;
        gridRecuadros.innerHTML = '';

        if (categorias.length === 0) {
            gridRecuadros.innerHTML = '<p class="info-text">No se registran compras asociadas a ninguna categoría.</p>';
            return;
        }

        categorias.forEach(cat => {
            const montoFormateado = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cat.total_bs);
            
            const card = document.createElement('div');
            card.className = 'categoria-card-item';
            card.setAttribute('data-id', cat.id);
            card.setAttribute('data-nombre', cat.nombre);
            
            card.innerHTML = `
                <div class="card-item-info">
                    <h4>${cat.nombre}</h4>
                    <p class="card-monto">${montoFormateado} <small>BS</small></p>
                </div>
                <div class="card-item-action">
                    <i class="fas fa-chevron-right"></i>
                </div>
            `;

            // Escuchador de clic para abrir el desglose de facturas
            card.addEventListener('click', () => {
                abrirModalDesglose(cat.id, cat.nombre);
            });

            gridRecuadros.appendChild(card);
        });
    }

    // --- Función: Construir / Actualizar la Gráfica de Chart.js ---
    function renderizarGraficaTorta(categorias) {
        const ctx = document.getElementById('chartCategoriasTorta');
        if (!ctx) return;

        // Si ya existía una gráfica activa, la destruimos para evitar parpadeos visuales al actualizar datos
        if (instanciaGraficaTorta) {
            instanciaGraficaTorta.destroy();
        }

        // Filtramos categorías que tengan un gasto mayor a cero para que la torta sea estéticamente limpia
        const categoriasConGasto = categorias.filter(c => parseFloat(c.total_bs) > 0);

        const labels = categoriasConGasto.map(c => c.nombre);
        const montos = categoriasConGasto.map(c => parseFloat(c.total_bs));

        // Paleta de colores profesionales para la interfaz corporativa
        const coloresPlataforma = [
            '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', 
            '#858796', '#5a5c69', '#6f42c1', '#fd7e14', '#20c997'
        ];

        instanciaGraficaTorta = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: montos,
                    backgroundColor: coloresPlataforma.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, font: { family: 'Poppins', size: 12 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const valorActual = context.raw;
                                const porcentaje = ((valorActual / total) * 100).toFixed(2);
                                const formatoBs = new Intl.NumberFormat('es-VE').format(valorActual);
                                return ` ${context.label}: ${formatoBs} BS (${porcentaje}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // --- Función: Obtener y desplegar el Modal con las facturas ---
    async function abrirModalDesglose(categoriaId, categoriaNombre) {
        const tbody = document.getElementById('tbodyDetalleGastos');
        const tituloModal = document.getElementById('modalCategoriaTitulo');
        
        if (tituloModal) tituloModal.textContent = `Desglose de Gastos: ${categoriaNombre}`;
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center">Cargando facturas...</td></tr>';
        
        if (modalDesglose) modalDesglose.classList.remove('hidden');

        try {
            const response = await fetch(`/api/categorias/${categoriaId}/gastos`, { credentials: 'include' });
            const resData = await response.json();

            if (!response.ok) throw new Error(resData.error || 'Error al obtener las facturas.');

            const facturas = resData.data;
            tbody.innerHTML = '';

            if (facturas.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center info-td">No hay facturas activas registradas en esta categoría.</td></tr>';
                return;
            }

            facturas.forEach(fac => {
                const tr = document.createElement('tr');
                
                // Formatear Fecha
                const fechaFormateada = fac.fecha_emision ? fac.fecha_emision.split('T')[0] : 'N/A';
                // Formatear Monto
                const montoBs = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(fac.monto_bs);

                tr.innerHTML = `
                    <td>${fechaFormateada}</td>
                    <td><strong>${fac.numero_factura}</strong></td>
                    <td>${fac.proveedor}</td>
                    <td class="text-right text-primary"><strong>${montoBs}</strong></td>
                    <td><span class="badge badge-success">${fac.estatus.toUpperCase()}</span></td>
                `;
                tbody.appendChild(tr);
            });

        } catch (error) {
            console.error('Error al cargar desglose:', error);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center error-td">Error: ${error.message}</td></tr>`;
            }
        }
    }

    // --- Manejo de Cierre de Modal ---
    if (btnCerrarModal) {
        btnCerrarModal.onclick = () => {
            if (modalDesglose) modalDesglose.classList.add('hidden');
        };
    }

    // Cerrar si hacen clic fuera del contenedor del modal
    window.onclick = (event) => {
        if (event.target === modalDesglose) {
            modalDesglose.classList.add('hidden');
        }
    };

    // Ejecutar carga inicial automática al instanciar el módulo
    cargarAnaliticaCategorias();
}