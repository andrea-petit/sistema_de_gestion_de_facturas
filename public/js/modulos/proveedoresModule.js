export function initProveedoresModulo() {
    cargarProveedores();

    const formEdicion = document.getElementById('formEdicionProveedor');
    if (!formEdicion) return;

    formEdicion.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const idProveedor = document.getElementById('editProvId').value;
        const inputs = [
            document.getElementById('editProvRazon'),
            document.getElementById('editProvDireccion'),
            document.getElementById('editProvTelefono'),
            document.getElementById('editProvContribuyente')
        ];

        let actualizacionesExitosas = 0;
        const btnSubmit = formEdicion.querySelector('button[type="submit"]');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerText = "Guardando...";
        }

        try {
            for (const input of inputs) {
                if (!input) continue;

                const nombreCampo = input.getAttribute('data-campo');
                let valorCampo = input.value.trim();

                if (nombreCampo === 'telefono' && !valorCampo) {
                    valorCampo = "";
                }

                const response = await fetch(`/api/proveedores/${idProveedor}`, {
                    method: 'PUT',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ campo: nombreCampo, valor: valorCampo })
                });

                if (response.ok) actualizacionesExitosas++;
            }

            if (actualizacionesExitosas > 0) {
                await Swal.fire({
                    icon: 'success',
                    title: 'Proveedor actualizado',
                    text: 'Los datos del proveedor se guardaron correctamente.',
                    timer: 2200,
                    showConfirmButton: false
                });
                await cargarProveedores();
                document.getElementById('editorPlaceholder').style.display = 'block';
                formEdicion.style.display = 'none';
                formEdicion.reset();
            } else {
                await Swal.fire({
                    icon: 'info',
                    title: 'Sin cambios',
                    text: 'No se realizaron modificaciones en el proveedor.'
                });
            }

        } catch (error) {
            console.error("[SGAF Error Proveedores]:", error);
            await Swal.fire({
                icon: 'error',
                title: 'Error de conexión',
                text: 'No se pudo actualizar el proveedor. Intenta de nuevo.'
            });
        } finally {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerText = "Guardar Cambios";
            }
        }
    });
}

export async function cargarProveedores() {
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

            const btnEditar = tr.querySelector('.btn-editar-prov');
            if (btnEditar) {
                btnEditar.addEventListener('click', () => {
                    document.querySelectorAll('#listaProveedoresCuerpo tr').forEach(r => r.style.background = 'transparent');
                    tr.style.background = '#eff6ff';

                    document.getElementById('editorPlaceholder').style.display = 'none';
                    const formEdicion = document.getElementById('formEdicionProveedor');
                    formEdicion.style.display = 'flex';

                    document.getElementById('editProvId').value = prov.id;
                    document.getElementById('editProvRazon').value = prov.razon_social || '';
                    document.getElementById('editProvDireccion').value = prov.direccion || '';
                    document.getElementById('editProvTelefono').value = prov.telefono || '';
                    document.getElementById('editProvContribuyente').value = prov.tipo_contribuyente || '';
                });
            }

            cuerpoTabla.appendChild(tr);
        });

    } catch (error) {
        console.error("[SGAF Error Tabla Proveedores]:", error);
        cuerpoTabla.innerHTML = `<tr><td colspan="4" style="padding: 20px; text-align: center; color: #ef4444;">❌ Error al procesar listado: ${error.message}</td></tr>`;
    }
}