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

    // --- Control de Permisos Inicial del Formulario ---
    if (operadorRol === 'superadmin') {
        if (btnGuardar) btnGuardar.classList.remove('hidden');
        if (alertaPermiso) {
            alertaPermiso.innerText = "Modo de configuración activo";
            alertaPermiso.classList.remove('hidden', 'alert-error');
            alertaPermiso.classList.add('alert-success');
            alertaPermiso.style.color = "";
            alertaPermiso.style.backgroundColor = "";
        }
        inputsPerfil.forEach(input => input.removeAttribute('disabled'));
    } else {
        if (btnGuardar) btnGuardar.classList.add('hidden');
        if (alertaPermiso) {
            alertaPermiso.innerText = "Vista Protegida (Modo Lectura). Solo el Superadmin puede modificar los datos fiscales.";
            alertaPermiso.classList.remove('hidden', 'alert-success');
            alertaPermiso.classList.add('alert-error');
            alertaPermiso.style.color = "#856404";
            alertaPermiso.style.backgroundColor = "#fff3cd";
        }
        inputsPerfil.forEach(input => {
            if (input.tagName === 'SELECT') {
                input.setAttribute('disabled', 'true');
            } else {
                input.setAttribute('readonly', 'true');
            }
        });
    }

    // --- Manejo de Visibilidad del Botón del Footer ---
    function actualizarVisibilidadBotonSidebar() {
        if (btnRegistrarEmpresa) {
            btnRegistrarEmpresa.style.setProperty('display', 'block', 'important');
            btnRegistrarEmpresa.classList.remove('hidden');
            btnRegistrarEmpresa.classList.add('visible');

            if (empresaExiste) {
                btnRegistrarEmpresa.textContent = 'Ver Empresa';
            } else {
                if (operadorRol !== 'superadmin') {
                    btnRegistrarEmpresa.textContent = 'Ver Empresa (Sin registrar)';
                } else {
                    btnRegistrarEmpresa.textContent = 'Registrar Empresa';
                }
            }
        }
    }

    // --- Consultar Datos de la Empresa ---
    async function obtenerDatosEmpresa() {
        try {
            const response = await fetch('/api/empresa'); 
            const resData = await response.json();

            const headerTitle = document.querySelector('#view-perfil .panel-header h2');

            if (!response.ok) throw new Error(resData.msg);

            if (resData.ok && resData.data) {
                const empresa = resData.data;
                empresaExiste = true; 

                document.getElementById('empNombre').value = empresa.nombre || '';
                document.getElementById('empTipoDoc').value = empresa.tipo_documento || 'J';
                document.getElementById('empRif').value = empresa.rif || '';
                document.getElementById('empTipoContribuyente').value = empresa.tipo_contribuyente || 'Ordinario';
                document.getElementById('empPorcentajeRet').value = parseInt(empresa.porcentaje_retencion, 10) || 0;
                document.getElementById('empDireccion').value = empresa.direccion || '';

                if (headerTitle) headerTitle.innerText = "Información del Perfil Empresarial";
                
                if (operadorRol === 'superadmin') {
                    if (btnGuardar) {
                        btnGuardar.classList.remove('hidden');
                        btnGuardar.innerText = "Actualizar Cambios"; 
                    }
                    inputsPerfil.forEach(input => input.removeAttribute('disabled'));
                } else {
                    if (btnGuardar) btnGuardar.classList.add('hidden'); 
                    inputsPerfil.forEach(input => {
                        if (input.tagName === 'SELECT') {
                            input.setAttribute('disabled', 'true');
                        } else {
                            input.setAttribute('readonly', 'true');
                        }
                    });
                }
            } else {
                empresaExiste = false; 
                if (formPerfil) formPerfil.reset();
                if (headerTitle) headerTitle.innerText = "Inicializar Perfil de la Empresa";
                
                if (operadorRol === 'superadmin') {
                    if (btnGuardar) {
                        btnGuardar.classList.remove('hidden');
                        btnGuardar.innerText = "Registrar Empresa"; 
                    }
                    inputsPerfil.forEach(input => input.removeAttribute('disabled'));
                }
            }

            actualizarVisibilidadBotonSidebar();

        } catch (error) {
            console.error('Error en la lógica del perfil:', error);
        }
    }

    // --- Cargar Información Dinámica del Usuario Logueado (CORREGIDO) ---
    async function cargarDatosUsuarioFooter() {
        const nameElement = document.getElementById('sidebarUserName');
        const roleElement = document.getElementById('sidebarUserRole');
        const initialsElement = document.getElementById('userInitials');

        try {
            const response = await fetch('/api/users/session-info', { credentials: 'include' });
            const resData = await response.json();

            if (resData.ok && resData.usuario) {
                const nombreMostrar = resData.usuario.nombre_completo || resData.usuario.nombre;
                
                if (nameElement) nameElement.textContent = "Usuario:" + " " + nombreMostrar;
                
                if (roleElement && operadorRol) {
                    roleElement.textContent =  "Rol:" + " "+ operadorRol;
                }

                if (initialsElement && nombreMostrar) {
                    const partes = nombreMostrar.split(' ');
                    const iniciales = partes.map(p => p[0]).join('').substring(0, 2).toUpperCase();
                    initialsElement.textContent = iniciales;
                }
            } else {
                if (nameElement) nameElement.textContent = "Usuario Activo";
            }
        } catch (error) {
            console.error('Error al cargar datos del usuario en el footer:', error);
            if (nameElement) nameElement.textContent = "Usuario";
        }
    }
    
    // 🌟 EJECUCIÓN SECUENCIAL DIRECTA (Sin escuchar el DOMContentLoaded diferido)
    obtenerDatosEmpresa();
    cargarDatosUsuarioFooter();

    // --- Envío del Formulario (Guardar / Registrar) ---
    if (formPerfil && operadorRol === 'superadmin') {
        formPerfil.onsubmit = async (e) => {
            e.preventDefault();

            const porcentajeRetencionLimpio = parseInt(document.getElementById('empPorcentajeRet').value, 10) || 0;

            const datosFormulario = {
                nombre: document.getElementById('empNombre').value,
                tipo_documento: document.getElementById('empTipoDoc').value,
                rif: document.getElementById('empRif').value,
                tipo_contribuyente: document.getElementById('empTipoContribuyente').value,
                porcentaje_retencion: porcentajeRetencionLimpio, 
                direccion: document.getElementById('empDireccion').value
            };

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
                        await Swal.fire({
                            icon: 'success',
                            title: 'Empresa registrada',
                            text: 'Empresa registrada y directrices fiscales inicializadas exitosamente.',
                            timer: 2200,
                            showConfirmButton: false
                        });
                        await obtenerDatosEmpresa(); 
                    } else {
                        await Swal.fire({
                            icon: 'error',
                            title: 'Error al registrar empresa',
                            text: resJson.error || 'Verifica los datos.'
                        });
                    }
                } catch (err) {
                    console.error("Error en creación de empresa:", err);
                }
            } else {
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

                    let valor = document.getElementById(idInput).value;

                    if (campo === 'porcentaje_retencion') {
                        valor = parseInt(valor, 10) || 0;
                    }

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
                    await Swal.fire({
                        icon: 'success',
                        title: 'Perfil actualizado',
                        text: 'El perfil de la empresa se guardó correctamente.',
                        timer: 2200,
                        showConfirmButton: false
                    });
                    await obtenerDatosEmpresa();
                } else {
                    await Swal.fire({
                        icon: 'error',
                        title: 'Error al guardar',
                        text: 'Hubo inconvenientes al guardar algunas especificaciones del perfil.'
                    });
                }
            }
        };
    }

    // --- Flujo de Cierre de Sesión ---
    if (btnLogout) {
        btnLogout.onclick = async () => {
            const confirmLogout = await Swal.fire({
                title: '¿Estás seguro de que deseas salir del SGAF?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sí, salir',
                cancelButtonText: 'No, permanecer',
                reverseButtons: true
            });
            if (!confirmLogout.isConfirmed) return;

            try {
                await fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
                sessionStorage.clear();
                localStorage.removeItem('token');
                localStorage.removeItem('userRol'); 
                await Swal.fire({
                    icon: 'success',
                    title: 'Sesión finalizada',
                    text: 'La sesión se cerró correctamente.',
                    timer: 1500,
                    showConfirmButton: false
                });
                window.location.replace('/'); 
            } catch (err) {
                console.error("Error en flujo de logout:", err);
            }
        };
    }
}