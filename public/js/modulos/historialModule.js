let paginaActualHistorial = 1;
const limitePorPaginaHistorial = 10;

export function initHistorialModulo() {
    const btnPrev = document.getElementById('btnPrevHistorial');
    const btnNext = document.getElementById('btnNextHistorial');
    const cuerpo = document.getElementById('tablaHistorialCuerpo');

    if (!btnPrev || !cuerpo) {
        console.log("[SGAF Info] Componentes de la vista de historial no detectados en este panel.");
        return;
    }

    const nuevoBtnPrev = btnPrev.cloneNode(true);
    const nuevoBtnNext = btnNext.cloneNode(true);
    btnPrev.parentNode.replaceChild(nuevoBtnPrev, btnPrev);
    btnNext.parentNode.replaceChild(nuevoBtnNext, btnNext);

    cargarHistorial(paginaActualHistorial);

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

        cuerpo.innerHTML = '';
        registros.forEach(item => {
            const tr = document.createElement('tr');
            tr.classList.add('row-border');
            
            let colorAccion = '#0ea5e9';
            if (item.accion === 'DELETE') colorAccion = '#ef4444';
            if (item.accion === 'UPDATE') colorAccion = '#f59e0b';

            const fechaLegible = new Date(item.fecha).toLocaleString('es-VE', { timeZone: 'America/Caracas' });
            const datosNuevos = item.valor_nuevo ? JSON.stringify(item.valor_nuevo) : 'N/A';

            tr.innerHTML = `
                <td class="td-history" style="color: #475569; white-space: nowrap;">${fechaLegible}</td>
                <td class="td-history" style="font-weight: 500;">${item.usuario_nombre || item.usuario_email || 'Sistema (Anon)'}</td>
                <td class="td-history"><span class="badge-action" style="background: ${colorAccion};">${item.accion}</span></td>
                <td class="td-history" style="text-transform: uppercase; font-weight:600; color: #64748b;">${item.tabla_afectada}</td>
                <td class="td-history" style="display: none; color: #94a3b8;">#${item.registro_id || 'N/A'}</td>
                <td class="td-history" style="display: none; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; color: #0f172a;" title='${datosNuevos}'>${datosNuevos}</td>
            `;
            cuerpo.appendChild(tr);
        });

        if (infoPag) {
            infoPag.innerText = `Mostrando página ${pag.paginaActual} de ${pag.totalPaginas} (Total: ${pag.totalRegistros} operaciones)`;
        }
        if (btnPrev) btnPrev.disabled = (pag.paginaActual === 1);
        if (btnNext) btnNext.disabled = (pag.paginaActual === pag.totalPaginas || pag.totalPaginas === 0);

    } catch (error) {
        console.error("[SGAF Error Historial]:", error);
        cuerpo.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #ef4444;">Error al cargar historial: ${error.message}</td></tr>`;
        if (btnPrev) btnPrev.disabled = true;
        if (btnNext) btnNext.disabled = true;
    }
}