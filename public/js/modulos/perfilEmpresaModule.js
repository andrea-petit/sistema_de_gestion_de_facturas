export function initPerfilModulo() {
    const operadorRol = sessionStorage.getItem('userRol') || 'empleado';
    const formPerfil = document.getElementById('empresaPerfilForm');
    const btnGuardar = document.getElementById('btnGuardarPerfil');
    const alertaPermiso = document.getElementById('perfilPermisoAlert');
    const inputsPerfil = document.querySelectorAll('.input-perfil');
    const btnLogout = document.getElementById('btnLogout');

    if (operadorRol === 'superadmin') {
        if (btnGuardar) btnGuardar.style.display = 'block';
        if (alertaPermiso) {
            alertaPermiso.innerText = "Modo de edición activo";
            alertaPermiso.style.background = "#dcfce7";
            alertaPermiso.style.color = "#166534";
            alertaPermiso.style.display = "block";
        }
        inputsPerfil.forEach(input => input.removeAttribute('disabled'));
    } else {
        if (btnGuardar) btnGuardar.style.display = 'none';
        if (alertaPermiso) {
            alertaPermiso.innerText = "Vista Protegida (Modo Lectura)";
            alertaPermiso.style.background = "#fee2e2";
            alertaPermiso.style.color = "#991b1b";
            alertaPermiso.style.display = "block";
        }
        inputsPerfil.forEach(input => input.setAttribute('disabled', 'true'));
    }

    async function obtenerDatosEmpresa() {
        try {
            const res = await fetch('/api/empresa', { method: 'GET', credentials: 'include' });
            const resJson = await res.json();

            if (resJson.ok && resJson.data) {
                const emp = resJson.data;
                document.getElementById('empNombre').value = emp.nombre || '';
                document.getElementById('empTipoDoc').value = emp.tipo_documento || 'J';
                document.getElementById('empRif').value = emp.rif || '';
                document.getElementById('empTipoContribuyente').value = emp.tipo_contribuyente || 'Ordinario';
                document.getElementById('empPorcentajeRet').value = emp.porcentaje_retencion || 0;
                document.getElementById('empDireccion').value = emp.direccion || '';
            }
        } catch (err) {
            console.error("Error al poblar el perfil de la empresa:", err);
        }
    }

    obtenerDatosEmpresa();

    if (formPerfil && operadorRol === 'superadmin') {
        formPerfil.onsubmit = async (e) => {
            e.preventDefault();

            const campos = ['nombre', 'tipo_documento', 'rif', 'tipo_contribuyente', 'porcentaje_retencion', 'direccion'];
            let errores = 0;

            for (const campo of campos) {
                let idInput = '';
                if (campo === 'nombre') idInput = 'empNombre';
                if (campo === 'tipo_documento') idInput = 'empTipoDoc';
                if (campo === 'rif') idInput = 'empRif';
                if (campo === 'tipo_contribuyente') idInput = 'empTipoContribuyente';
                if (campo === 'porcentaje_retencion') idInput = 'empPorcentajeRet';
                if (campo === 'direccion') idInput = 'empDireccion';

                const valor = document.getElementById(idInput).value;

                try {
                    const res = await fetch('/api/empresa', {
                        method: 'PUT',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ campo, valor })
                    });
                    const resJson = await res.json();
                    if (!resJson.ok) errores++;
                } catch (err) {
                    errores++;
                }
            }

            if (errores === 0) {
                alert("¡Perfil de la empresa y directrices del SENIAT actualizadas con éxito!");
                obtenerDatosEmpresa();
            } else {
                alert("Hubo inconvenientes al guardar algunas especificaciones del perfil.");
            }
        };
    }

    if (btnLogout) {
        btnLogout.onclick = async () => {
            if (confirm("¿Estás seguro de que deseas salir del SGAF?")) {
                try {
                    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
                    sessionStorage.clear();
                    alert("Sesión finalizada correctamente.");
                    window.location.reload();
                } catch (err) {
                    console.error("Error en flujo de logout:", err);
                }
            }
        };
    }
}