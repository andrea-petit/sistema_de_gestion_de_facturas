let modoFormUsuario = 'REGISTRO';

export function initUsuariosModulo() {
    let operadorRol = localStorage.getItem('userRol') || sessionStorage.getItem('userRol');
    console.log("[SGAF Seguridad] Inicializando módulo con rol:", operadorRol);

    if (operadorRol === 'empleado') {
        const menuUser = document.getElementById('menuItemUsuarios');
        if (menuUser) menuUser.remove();
        return;
    }

    const optAdmin = document.getElementById('optRolAdmin');
    if (operadorRol === 'admin' && optAdmin) {
        optAdmin.remove();
    }

    cargarUsuariosTabla(operadorRol);
    ocultarPanelUsuario();

    const formGestion = document.getElementById('formGestionUsuario');
    if (formGestion) {
        formGestion.onsubmit = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await procesarFormularioUsuario(operadorRol);
            return false;
        };
    } else {
        console.warn("[SGAF Seguridad] Alerta: No se encontró el elemento #formGestionUsuario en el HTML.");
    }

    const btnModoRegistro = document.getElementById('btnModoRegistro');
    const btnCancelarEdicion = document.getElementById('btnCancelarEdicion');

    if (btnModoRegistro) {
        btnModoRegistro.onclick = () => {
            mostrarPanelUsuario();
            setFormModo('REGISTRO', null, operadorRol);
        };
    }
    if (btnCancelarEdicion) {
        btnCancelarEdicion.onclick = () => {
            setFormModo('REGISTRO', null, operadorRol);
            ocultarPanelUsuario();
        };
    }
}

function mostrarPanelUsuario() {
    const panel = document.getElementById('panelFormUsuario');
    if (panel) panel.classList.remove('hidden');
}

function ocultarPanelUsuario() {
    const panel = document.getElementById('panelFormUsuario');
    if (panel) panel.classList.add('hidden');
}


export function setFormModo(modo, usuarioData = null, operadorRol = 'admin') {
    modoFormUsuario = modo;
    const form = document.getElementById('formGestionUsuario');
    const panel = document.getElementById('panelFormUsuario');
    const titulo = document.getElementById('formUsuarioTitulo');
    const desc = document.getElementById('formUsuarioDescripcion');
    const btnSubmit = document.getElementById('btnSubmitUsuario');
    const btnCancelar = document.getElementById('btnCancelarEdicion');
    const groupRol = document.getElementById('groupFormRol');
    const labelPass = document.getElementById('labelFormPassword');
    const helpPass = document.getElementById('helpFormPassword');
    const inputPass = document.getElementById('userFormPassword');

    if (!form) return;
    if (panel) panel.classList.remove('hidden');
    form.reset();

    const colorPrimario = "var(--primary, #2563eb)";
    const colorAdvertencia = "var(--warning, #eab308)";

    if (modo === 'REGISTRO') {
        if (titulo) titulo.innerText = "Registrar Nuevo Usuario";
        if (desc) desc.innerText = "Completa los datos para asignar credenciales de acceso al sistema.";
        if (btnSubmit) {
            btnSubmit.innerText = "Crear Usuario";
            btnSubmit.classList.remove('btn-warning');
            btnSubmit.classList.add('btn-primary');
        }
        if (btnCancelar) btnCancelar.classList.remove('hidden');
        if (groupRol) groupRol.classList.remove('hidden');
        if (labelPass) labelPass.innerText = "Contraseña de Acceso:";
        if (helpPass) helpPass.classList.add('help-hidden');
        if (inputPass) inputPass.required = true;

        const inputUser = document.getElementById('userFormUsername');
        if (inputUser) inputUser.disabled = false;
    } else if (modo === 'EDICION' && usuarioData) {
        if (titulo) titulo.innerText = `Editar: @${usuarioData.nombre_usuario}`;
        if (desc) desc.innerText = "Modifica los campos del operador. El rol no puede alterarse.";
        if (btnSubmit) {
            btnSubmit.innerText = "Guardar Cambios";
            btnSubmit.classList.remove('btn-primary');
            btnSubmit.classList.add('btn-warning');
        }
        if (btnCancelar) btnCancelar.classList.remove('hidden');
        if (groupRol) groupRol.classList.add('hidden');
        if (labelPass) labelPass.innerText = "Resetear Contraseña (Opcional):";
        if (helpPass) helpPass.classList.remove('help-hidden');
        if (inputPass) inputPass.required = false;

        const inputId = document.getElementById('userFormId');
        const inputUser = document.getElementById('userFormUsername');
        const inputNombre = document.getElementById('userFormNombre');
        const inputCorreo = document.getElementById('userFormCorreo');

        if (inputId) inputId.value = usuarioData.id || '';
        if (inputUser) {
            inputUser.value = usuarioData.nombre_usuario || '';
            inputUser.disabled = true;
        }
        if (inputNombre) inputNombre.value = usuarioData.nombre_completo || '';
        if (inputCorreo) inputCorreo.value = usuarioData.correo || '';
    }
}

export async function cargarUsuariosTabla(operadorRol) {
    const cuerpo = document.getElementById('listaUsuariosCuerpo');
    if (!cuerpo) return;

    const colorMuted = "var(--text-muted, #64748b)";

    try {
        console.log("[SGAF Seguridad] Solicitando /api/users...");
        const res = await fetch('/api/users', { method: 'GET', credentials: 'include' });
        const resJson = await res.json();

        if (!res.ok) throw new Error(resJson.msg || 'Error al descargar el listado.');

        const usuarios = resJson.data || [];
        cuerpo.innerHTML = '';

        if (usuarios.length === 0) {
            cuerpo.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: ${colorMuted};">No hay usuarios registrados.</td></tr>`;
            return;
        }

        usuarios.forEach(user => {
            const tr = document.createElement('tr');
            tr.classList.add('row-border');
            
            const estaActivo = user.activo !== false;
            const badgeEstado = estaActivo
                ? `<span class="badge-active">Activo</span>`
                : `<span class="badge-inactive">Inactivo</span>`;

            tr.innerHTML = `
                <td class="td-username">@${user.nombre_usuario || 'S/U'}</td>
                <td class="td-normal">${user.nombre_completo || 'Sin Nombre'}</td>
                <td class="td-role"><span style="text-transform: capitalize; font-size: 12px; color: #475569; font-weight: 500;">${user.rol || 'Sin Rol'}</span></td>
                <td>${badgeEstado}</td>
                <td class="td-actions acciones-zona"></td>
            `;

            const zonaAcciones = tr.querySelector('.acciones-zona');
            if (operadorRol === 'admin' && (user.rol === 'admin' || user.rol === 'superadmin')) {
                if (zonaAcciones) zonaAcciones.innerHTML = `<span style="color: ${colorMuted}; font-size: 12px; font-style: italic;">Protegido</span>`;
            } else {
                const btnEdit = document.createElement('button');
                btnEdit.innerText = "Editar";
                btnEdit.classList.add('action-btn');
                btnEdit.onclick = () => setFormModo('EDICION', user, operadorRol);

                const btnInactivar = document.createElement('button');
                btnInactivar.innerText = estaActivo ? "Inactivar" : "Activar";
                btnInactivar.classList.add('action-btn');
                btnInactivar.onclick = () => alternarEstadoUsuario(user.id, user.nombre_usuario, operadorRol);

                if (zonaAcciones) {
                    zonaAcciones.appendChild(btnEdit);
                    zonaAcciones.appendChild(btnInactivar);
                }
            }

            cuerpo.appendChild(tr);
        });

    } catch (err) {
        console.error("[SGAF Render Usuarios Error]:", err);
        cuerpo.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #ef4444;">Error al procesar usuarios: ${err.message}</td></tr>`;
    }
}

export async function procesarFormularioUsuario(operadorRol) {
    const btnSubmit = document.getElementById('btnSubmitUsuario');
    if (btnSubmit) btnSubmit.disabled = true;

    try {
        if (modoFormUsuario === 'REGISTRO') {
            const bodyData = {
                nombre_usuario: document.getElementById('userFormUsername').value.trim(),
                nombre_completo: document.getElementById('userFormNombre').value.trim(),
                correo: document.getElementById('userFormCorreo').value.trim(),
                contraseña: document.getElementById('userFormPassword').value,
                rol: document.getElementById('userFormRol').value
            };

            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(bodyData)
            });
            const resJson = await res.json();
            if (!res.ok) throw new Error(resJson.msg || 'Error en el servidor al registrar.');

            await Swal.fire({
                icon: 'success',
                title: '¡Usuario guardado!',
                text: 'El usuario se registró correctamente.',
                timer: 2200,
                showConfirmButton: false
            });
            setFormModo('REGISTRO', null, operadorRol);
            ocultarPanelUsuario();
            await cargarUsuariosTabla(operadorRol);

        } else {
            const idUser = document.getElementById('userFormId').value;
            const camposAEditar = [
                { campo: 'nombre_completo', valor: document.getElementById('userFormNombre').value.trim() },
                { campo: 'correo', valor: document.getElementById('userFormCorreo').value.trim() }
            ];

            const passVal = document.getElementById('userFormPassword').value;
            if (passVal) {
                camposAEditar.push({ campo: 'contraseña', valor: passVal });
            }

            for (const item of camposAEditar) {
                const res = await fetch(`/api/users/${idUser}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ campo: item.campo, valor: item.valor })
                });
                if (!res.ok) {
                    const errorJson = await res.json();
                    throw new Error(errorJson.msg || 'Fallo al actualizar campos.');
                }
            }
            await Swal.fire({
                icon: 'success',
                title: '¡Información guardada!',
                text: 'Los cambios se aplicaron correctamente.',
                timer: 2200,
                showConfirmButton: false
            });
            setFormModo('REGISTRO', null, operadorRol);
            ocultarPanelUsuario();
            await cargarUsuariosTabla(operadorRol);
        }
    } catch (err) {
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err.message
        });
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

export async function alternarEstadoUsuario(id, username, operadorRol) {
    const confirmCambio = await Swal.fire({
        title: `¿Deseas cambiar el estado de actividad de @${username}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, cambiar',
        cancelButtonText: 'No, cancelar',
        reverseButtons: true
    });
    if (!confirmCambio.isConfirmed) return;

    try {
        const res = await fetch(`/api/users/${id}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.msg || 'No se pudo procesar la solicitud.');

        await Swal.fire({
            icon: 'success',
            title: 'Estado modificado',
            text: `El estado de @${username} ha sido actualizado.`,
            timer: 2200,
            showConfirmButton: false
        });
        await cargarUsuariosTabla(operadorRol);
    } catch (err) {
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err.message
        });
    }
}