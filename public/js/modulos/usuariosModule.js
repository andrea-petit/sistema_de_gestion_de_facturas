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
        btnModoRegistro.onclick = () => setFormModo('REGISTRO', null, operadorRol);
    }
    if (btnCancelarEdicion) {
        btnCancelarEdicion.onclick = () => setFormModo('REGISTRO', null, operadorRol);
    }
}

export function setFormModo(modo, usuarioData = null, operadorRol = 'admin') {
    modoFormUsuario = modo;
    const form = document.getElementById('formGestionUsuario');
    const titulo = document.getElementById('formUsuarioTitulo');
    const desc = document.getElementById('formUsuarioDescripcion');
    const btnSubmit = document.getElementById('btnSubmitUsuario');
    const btnCancelar = document.getElementById('btnCancelarEdicion');
    const groupRol = document.getElementById('groupFormRol');
    const labelPass = document.getElementById('labelFormPassword');
    const helpPass = document.getElementById('helpFormPassword');
    const inputPass = document.getElementById('userFormPassword');

    if (!form) return;
    form.reset();

    const colorPrimario = "var(--primary, #2563eb)";
    const colorAdvertencia = "var(--warning, #eab308)";

    if (modo === 'REGISTRO') {
        if (titulo) titulo.innerText = "Registrar Nuevo Usuario";
        if (desc) desc.innerText = "Completa los datos para asignar credenciales de acceso al sistema.";
        if (btnSubmit) {
            btnSubmit.innerText = "Crear Usuario";
            btnSubmit.style.backgroundColor = colorPrimario;
        }
        if (btnCancelar) btnCancelar.style.display = 'none';
        if (groupRol) groupRol.style.display = 'flex';
        if (labelPass) labelPass.innerText = "Contraseña de Acceso:";
        if (helpPass) helpPass.style.display = 'none';
        if (inputPass) inputPass.required = true;

        const inputUser = document.getElementById('userFormUsername');
        if (inputUser) inputUser.disabled = false;
    } else if (modo === 'EDICION' && usuarioData) {
        if (titulo) titulo.innerText = `Editar: @${usuarioData.nombre_usuario}`;
        if (desc) desc.innerText = "Modifica los campos del operador. El rol no puede alterarse.";
        if (btnSubmit) {
            btnSubmit.innerText = "Guardar Cambios";
            btnSubmit.style.backgroundColor = colorAdvertencia;
        }
        if (btnCancelar) btnCancelar.style.display = 'block';
        if (groupRol) groupRol.style.display = 'none';
        if (labelPass) labelPass.innerText = "Resetear Contraseña (Opcional):";
        if (helpPass) helpPass.style.display = 'block';
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
            tr.style.borderBottom = '1px solid var(--border, #e2e8f0)';
            
            const estaActivo = user.activo !== false;
            const badgeEstado = estaActivo
                ? `<span style="background: #dcfce7; color: #16a34a; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 11px;">Activo</span>`
                : `<span style="background: #fee2e2; color: #ef4444; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 11px;">Inactivo</span>`;

            tr.innerHTML = `
                <td style="padding: 12px 10px; font-weight: 600; color: #0f172a;">@${user.nombre_usuario || 'S/U'}</td>
                <td style="padding: 12px 10px; color: #334155;">${user.nombre_completo || 'Sin Nombre'}</td>
                <td style="padding: 12px 10px;"><span style="text-transform: capitalize; font-size: 12px; color: #475569; font-weight: 500;">${user.rol || 'Sin Rol'}</span></td>
                <td style="padding: 12px 10px;">${badgeEstado}</td>
                <td style="padding: 12px 10px; text-align: right;" class="acciones-zona"></td>
            `;

            const zonaAcciones = tr.querySelector('.acciones-zona');
            if (operadorRol === 'admin' && (user.rol === 'admin' || user.rol === 'superadmin')) {
                if (zonaAcciones) zonaAcciones.innerHTML = `<span style="color: ${colorMuted}; font-size: 12px; font-style: italic;">Protegido</span>`;
            } else {
                const btnEdit = document.createElement('button');
                btnEdit.innerText = "✏️";
                btnEdit.style = "background: none; border: none; cursor: pointer; margin-right: 10px; font-size: 13px;";
                btnEdit.onclick = () => setFormModo('EDICION', user, operadorRol);

                const btnInactivar = document.createElement('button');
                btnInactivar.innerText = estaActivo ? "❌" : "✅";
                btnInactivar.style = "background: none; border: none; cursor: pointer; font-size: 13px;";
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
        cuerpo.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #ef4444;">❌ Error al procesar usuarios: ${err.message}</td></tr>`;
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

            alert('¡Usuario guardado con éxito!');
            setFormModo('REGISTRO', null, operadorRol);
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
            alert('¡Información de usuario modificada con éxito!');
            setFormModo('REGISTRO', null, operadorRol);
            await cargarUsuariosTabla(operadorRol);
        }
    } catch (err) {
        alert(`Error: ${err.message}`);
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

export async function alternarEstadoUsuario(id, username, operadorRol) {
    if (!confirm(`¿Deseas cambiar el estado de actividad de @${username}?`)) return;

    try {
        const res = await fetch(`/api/users/${id}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.msg || 'No se pudo procesar la solicitud.');

        alert(`Estado de @${username} modificado.`);
        await cargarUsuariosTabla(operadorRol);
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}