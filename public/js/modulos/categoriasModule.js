// Variable global para almacenar y destruir la instancia de la gráfica si se recarga la vista
let instanciaGraficaTorta = null;

export async function initCategoriasModulo(forzarRefresco = false) {
    console.log(`[SGAF - Categorías] Inicializando módulo analítico. Forzar Refresco: ${forzarRefresco}`);

    const gridRecuadros = document.getElementById('gridRecuadrosCategorias');
    const txtGranTotal = document.getElementById('txtGranTotalCategorias');
    const modalDesglose = document.getElementById('modalDesgloseCategoria');
    const btnCerrarModal = document.getElementById('btnCerrarModalCategorias');

    if (!gridRecuadros) {
        console.warn("[SGAF - Categorías] No se localizó el contenedor 'gridRecuadrosCategorias' en el DOM.");
        return;
    }

    // --- Función Principal: Cargar Resumen de la Vista ---
    async function cargarAnaliticaCategorias() {
        try {
            if (gridRecuadros) {
                gridRecuadros.innerHTML = '<p class="info-text"><i class="fas fa-spinner fa-spin"></i> Compilando métricas financieras...</p>';
            }

            const response = await fetch('/api/categorias/resumen', { credentials: 'include' });
            const resData = await response.json();

            if (!response.ok) throw new Error(resData.error || 'Error al compilar el resumen analítico.');

            const { granTotal, data: categorias } = resData;

            // 1. Mostrar Gran Total Formateado en BS (Formato Moneda Local)
            if (txtGranTotal) {
                txtGranTotal.textContent = new Intl.NumberFormat('es-VE', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                }).format(granTotal) + " BS";
            }

            // 2. Renderizar Recuadros Financieros Laterales
            renderizarRecuadros(categorias);

            // 3. Renderizar la Gráfica de Torta Grande
            renderizarGraficaTorta(categorias);

        } catch (error) {
            console.error('Error crítico en initCategoriasModulo:', error);
            if (gridRecuadros) {
                gridRecuadros.innerHTML = `<p class="error-box-sys">No se pudo cargar el análisis financiero: ${error.message}</p>`;
            }
        }
    }

    // --- Función: Pintar los Recuadros de Totales en el DOM ---
    function renderizarRecuadros(categorias) {
        gridRecuadros.innerHTML = '';

        if (!categorias || categorias.length === 0) {
            gridRecuadros.innerHTML = '<p class="info-text">No se registran compras indexadas asociadas a ninguna categoría fiscal.</p>';
            return;
        }

        categorias.forEach(cat => {
            const montoFormateado = new Intl.NumberFormat('es-VE', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            }).format(cat.total_bs);
            
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

            // Escuchador de clic para abrir el desglose analítico de facturas
            card.addEventListener('click', () => {
                abrirModalDesglose(cat.id, cat.nombre);
            });

            gridRecuadros.appendChild(card);
        });
    }

    // --- Función: Construir / Actualizar la Gráfica de Chart.js ---
    // --- Función: Construir / Actualizar la Gráfica de Chart.js ---
    function renderizarGraficaTorta(categorias) {
        const ctx = document.getElementById('chartCategoriasTorta');
        if (!ctx) {
            console.warn("[SGAF - Categorías] Canvas 'chartCategoriasTorta' no disponible.");
            return;
        }

        // ====================================================================
        // 🔥 SOLUCIÓN CRÍTICA: Buscar y destruir la instancia directamente desde el DOM
        // ====================================================================
        const graficaExistente = Chart.getChart(ctx); 
        if (graficaExistente) {
            console.log("[SGAF - Categorías] Instancia previa detectada en el Canvas. Destruyendo...");
            graficaExistente.destroy();
        }

        // Filtramos categorías que tengan un gasto real mayor a cero para limpiar la interfaz
        const categoriasConGasto = categorias.filter(c => parseFloat(c.total_bs) > 0);

        const labels = categoriasConGasto.map(c => c.nombre);
        const montos = categoriasConGasto.map(c => parseFloat(c.total_bs));

        const coloresPlataforma = [
            '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', 
            '#858796', '#5a5c69', '#6f42c1', '#fd7e14', '#20c997'
        ];

        // Creamos la nueva gráfica sobre el canvas completamente limpio
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
                        labels: { 
                            boxWidth: 12, 
                            font: { family: 'Poppins', size: 12 } 
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const valorActual = context.raw;
                                const porcentaje = ((valorActual / total) * 100).toFixed(2);
                                const formatoBs = new Intl.NumberFormat('es-VE', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                }).format(valorActual);
                                return ` ${context.label}: ${formatoBs} BS (${porcentaje}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // --- Función: Obtener y desplegar el Modal de Auditoría ---
    async function abrirModalDesglose(categoriaId, categoriaNombre) {
        const tbody = document.getElementById('tbodyDetalleGastos');
        const tituloModal = document.getElementById('modalCategoriaTitulo');
        
        if (tituloModal) tituloModal.textContent = `Libro de Compras ➜ Categoría: ${categoriaNombre}`;
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin"></i> Extrayendo historial analítico...</td></tr>';
        
        if (modalDesglose) modalDesglose.classList.remove('hidden');

        try {
            const response = await fetch(`/api/categorias/${categoriaId}/gastos`, { credentials: 'include' });
            const resData = await response.json();

            if (!response.ok) throw new Error(resData.error || 'Error al obtener las facturas.');

            const facturas = resData.data;

            // Reset container
            tbody.innerHTML = '';

            // If no records, show empty state and reset pagination UI
            if (!facturas || facturas.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center info-td">No hay facturas activas registradas en esta sección del Libro de Compras.</td></tr>';
                const pageInfo = document.getElementById('txtInfoPaginacionCategorias');
                if (pageInfo) pageInfo.textContent = 'Página 0 de 0';
                const prevBtn = document.getElementById('btnPrevPageCategorias');
                const nextBtn = document.getElementById('btnNextPageCategorias');
                if (prevBtn) prevBtn.disabled = true;
                if (nextBtn) nextBtn.disabled = true;
                return;
            }

            // Pagination configuration
            const pageSize = 6; // records per page
            let currentPage = 1;
            const totalPages = Math.ceil(facturas.length / pageSize);
            const prevBtn = document.getElementById('btnPrevPageCategorias');
            const nextBtn = document.getElementById('btnNextPageCategorias');
            const pageInfo = document.getElementById('txtInfoPaginacionCategorias');

            // Render a specific page
            function renderPage(page) {
                tbody.innerHTML = '';
                const startIdx = (page - 1) * pageSize;
                const endIdx = startIdx + pageSize;
                const pageItems = facturas.slice(startIdx, endIdx);
                pageItems.forEach(fac => {
                    const tr = document.createElement('tr');
                    const fechaFormateada = fac.fecha_emision ? fac.fecha_emision.split('T')[0] : 'S/F';
                    const montoBs = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(fac.monto_bs);
                    const estatusLimpios = fac.estatus ? fac.estatus.toUpperCase() : 'PROCESADO';
                    tr.innerHTML = `
                        <td>${fechaFormateada}</td>
                        <td><strong>${fac.numero_factura}</strong></td>
                        <td>${fac.proveedor}</td>
                        <td class="text-right text-primary" style="font-weight: bold;">${montoBs} BS</td>`;
                    //<td><span class="badge badge-success">${estatusLimpios}</span></td>
                    tbody.appendChild(tr);
                });
                // Update pagination UI
                if (pageInfo) pageInfo.textContent = `Página ${page} de ${totalPages}`;
                if (prevBtn) prevBtn.disabled = page <= 1;
                if (nextBtn) nextBtn.disabled = page >= totalPages;
            }

            // Initial render
            renderPage(currentPage);

            // Navigation button handlers
            if (prevBtn) {
                prevBtn.onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        renderPage(currentPage);
                    }
                };
            }
            if (nextBtn) {
                nextBtn.onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        renderPage(currentPage);
                    }
                };
            }

        } catch (error) {
            console.error('Error al cargar desglose en modal:', error);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center error-td">Error de comunicación: ${error.message}</td></tr>`;
            }
        }
    }

    // --- MANEJO LOGÍSTICO DEL MODAL ---
    if (btnCerrarModal) {
        btnCerrarModal.onclick = () => {
            if (modalDesglose) modalDesglose.classList.add('hidden');
        };
    }

    // Cerrar de forma nativa si hacen clic fuera del marco
    window.addEventListener('click', (event) => {
        if (event.target === modalDesglose) {
            modalDesglose.classList.add('hidden');
        }
    });

    // --- DISPARO AUTOMÁTICO CONTROLADO ---
    await cargarAnaliticaCategorias();
}