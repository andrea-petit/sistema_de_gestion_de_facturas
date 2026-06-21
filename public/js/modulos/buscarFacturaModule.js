export function initBuscarModulo() {
    const btnBuscar = document.getElementById('btnBuscarFacturas');
    const searchFecha = document.getElementById('searchFecha');
    const listaCuerpo = document.getElementById('listaFacturasCuerpo');
    const visorPlaceholder = document.getElementById('visorPlaceholder');
    const visorContenido = document.getElementById('visorContenido');
    const visorTitulo = document.getElementById('visorTitulo');
    const imgFacturaDigital = document.getElementById('imgFacturaDigital');

    if (!btnBuscar) return;

    btnBuscar.addEventListener('click', async () => {
        const fechaSeleccionada = searchFecha.value;

        if (!fechaSeleccionada) {
            alert("Por favor, selecciona una fecha válida para la consulta.");
            return;
        }

        const [anio, mes, dia] = fechaSeleccionada.split('-');
        const fechaFormateada = `${anio}-${dia}-${mes}`;
        console.log("[SGAF Frontend] Fecha corregida enviada al API:", fechaFormateada);

        btnBuscar.disabled = true;
        listaCuerpo.innerHTML = `<tr><td colspan="3" style="padding: 20px; text-align: center; color: var(--primary);"> Buscando comprobantes...</td></tr>`;
        visorContenido.style.display = 'none';
        visorPlaceholder.style.display = 'block';

        try {
            const response = await fetch(`/api/facturas?fecha=${fechaFormateada}`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
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

            listaCuerpo.innerHTML = '';

            facturas.forEach(factura => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border)';
                tr.style.transition = 'background 0.2s';
                
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

                const btnAuditar = tr.querySelector('.btn-auditar');
                btnAuditar.addEventListener('click', () => {
                    document.querySelectorAll('#listaFacturasCuerpo tr').forEach(r => r.style.background = 'transparent');
                    tr.style.background = '#eff6ff';

                    if (!urlDigital) {
                        alert("Este registro no cuenta con una imagen de respaldo digital en Cloudinary.");
                        return;
                    }

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