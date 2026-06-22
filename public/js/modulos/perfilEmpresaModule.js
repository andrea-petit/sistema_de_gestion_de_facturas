export function initPerfilModulo() {
    const operadorRol = localStorage.getItem('userRol') || sessionStorage.getItem('userRol');
    const formPerfil = document.getElementById('empresaPerfilForm');
    const btnGuardar = document.getElementById('btnGuardarPerfil');
    const alertaPermiso = document.getElementById('perfilPermisoAlert');
    const inputsPerfil = document.querySelectorAll('.input-perfil');
    const btnLogout = document.getElementById('btnLogout');
    
    // Elemento del botón del footer de la barra lateral
    const btnRegistrarEmpresa = document.getElementById('btnRegistrarEmpresa'); 

    // Estado local para saber si la empresa ya existe en la base de datos
    let empresaExiste = false;

    // --- Control de Permisos Inicial ---
    if (operadorRol === 'superadmin') {
        if (btnGuardar) btnGuardar.style.display = 'block';
        if (alertaPermiso) {
            alertaPermiso.innerText = "Modo de configuración activo";
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

    // --- Manejo de Visibilidad del Botón del Footer ---
    function actualizarVisibilidadBotonSidebar() {
        if (btnRegistrarEmpresa) {
            // Regla estricta: Solo visible si es superadmin Y NO existe empresa
            if (operadorRol === 'superadmin' && !empresaExiste) {
                btnRegistrarEmpresa.style.display = 'block';
            } else {
                btnRegistrarEmpresa.style.display = 'none';
            }
        }
    }

    // --- Consultar Datos de la Empresa ---
    async function obtenerDatosEmpresa() {
        try {
            const res = await fetch('/api/empresa', { method: 'GET', credentials: 'include' });
            const resJson = await res.json();

            // Si hay datos válidos, la empresa ya existe
            if (resJson.ok && resJson.data) {
                empresaExiste = true;
                const emp = resJson.data;
                document.getElementById('empNombre').value = emp.nombre || '';
                document.getElementById('empTipoDoc').value = emp.tipo_documento || 'J';
                document.getElementById('empRif').value = emp.rif || '';
                document.getElementById('empTipoContribuyente').value = emp.tipo_contribuyente || 'Ordinario';
                document.getElementById('empPorcentajeRet').value = emp.porcentaje_retencion || 0;
                document.getElementById('empDireccion').value = emp.direccion || '';
            } else {
                // No hay registros de empresa en PostgreSQL
                empresaExiste = false;
            }
        } catch (err) {
            console.error("Error al poblar el perfil de la empresa:", err);
            empresaExiste = false;
        } finally {
            // Reevaluar el botón del sidebar tras conocer el estado de la DB
            actualizarVisibilidadBotonSidebar();
        }
    }

    // Ejecución inicial
    obtenerDatosEmpresa();

    // --- Envío del Formulario (Guardar / Registrar) ---
    if (formPerfil && operadorRol === 'superadmin') {
        formPerfil.onsubmit = async (e) => {
            e.preventDefault();

            // Mapeo de IDs de elementos a los nombres de columnas de la DB
            const datosFormulario = {
                nombre: document.getElementById('empNombre').value,
                tipo_documento: document.getElementById('empTipoDoc').value,
                rif: document.getElementById('empRif').value,
                tipo_contribuyente: document.getElementById('empTipoContribuyente').value,
                porcentaje_retencion: parseFloat(document.getElementById('empPorcentajeRet').value) || 0,
                direccion: document.getElementById('empDireccion').value
            };

            // CASO A: Si NO existe la empresa, hacemos un POST único para crearla
            if (!empresaExiste) {
                try {
                    const res = await fetch('/api/empresa', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(datosFormulario)
                    });
                    const resJson = await res.json();

                    if (resJson.ok) {
                        alert("¡Felicidades! Empresa registrada y directrices fiscales del SENIAT inicializadas.");
                        await obtenerDatosEmpresa(); // Esto cambiará empresaExiste a true y ocultará el botón
                    } else {
                        alert(`Error al registrar empresa: ${resJson.error || 'Verifica los datos.'}`);
                    }
                } catch (err) {
                    console.error("Error en creación de empresa:", err);
                    alert("Error de conexión al intentar registrar la empresa.");
                }
            } 
            // CASO B: Si YA existe la empresa, conservamos tu lógica secuencial de edición (PUT)
            else {
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
            }
        };
    }

    // --- Flujo de Cierre de Sesión ---
    if (btnLogout) {
        btnLogout.onclick = async () => {
            if (confirm("¿Estás seguro de que deseas salir del SGAF?")) {
                try {
                    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
                    sessionStorage.clear();
                    localStorage.removeItem('userRol'); // Asegura limpiar ambos almacenes
                    alert("Sesión finalizada correctamente.");
                    window.location.replace('/'); // Redirige al login sin posibilidad de volver atrás
                } catch (err) {
                    console.error("Error en flujo de logout:", err);
                }
            }
        };
    }
}