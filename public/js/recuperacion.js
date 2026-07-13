const formRecuperacion = document.getElementById("formulario-recuperacion");
const formCodigo = document.getElementById("formulario-codigo");
const formCambiarClave = document.getElementById("formulario-cambiar-clave");
const bienvenida = document.getElementById("bienvenida-recuperacion");
const btnVolverLogin = document.getElementById("btn-volver-login");
const btnVolverLogin2 = document.getElementById("btn-volver-login-2");
const btnVolverLogin3 = document.getElementById("btn-volver-login-3");
const codigoUsuarioLabel = document.getElementById("codigo-usuario-label");
const errorDiv = document.getElementById("caja-error");
const notificationDiv = document.getElementById("caja-notificacion");

const showError = (mensaje) => {
  errorDiv.textContent = mensaje;
  errorDiv.classList.remove("hidden");
};

const hideError = () => {
  errorDiv.textContent = "";
  errorDiv.classList.add("hidden");
};

const showNotification = (mensaje) => {
  notificationDiv.textContent = mensaje;
  notificationDiv.classList.remove("hidden");
};

const hideNotification = () => {
  notificationDiv.textContent = "";
  notificationDiv.classList.add("hidden");
};

const switchTo = (section) => {
  formRecuperacion.classList.add("hidden");
  formCodigo.classList.add("hidden");
  formCambiarClave.classList.add("hidden");

  bienvenida.classList.remove("bienvenida-step-1", "bienvenida-step-2", "bienvenida-step-3");

  if (section === "recuperacion") {
    formRecuperacion.classList.remove("hidden");
    bienvenida.classList.add("bienvenida-step-1");
  }
  if (section === "codigo") {
    formCodigo.classList.remove("hidden");
    bienvenida.classList.add("bienvenida-step-2");
  }
  if (section === "cambiar-clave") {
    formCambiarClave.classList.remove("hidden");
    bienvenida.classList.add("bienvenida-step-3");
  }

  hideError();
  hideNotification();
};

const showToast = (icon, title, text) => {
  if (typeof Swal !== 'undefined') {
    return Swal.fire({
      icon,
      title,
      text,
      timer: 2200,
      showConfirmButton: false,
      timerProgressBar: true,
    });
  }
  return Promise.resolve();
};

const goToLogin = () => {
  window.location.href = '/';
};

formRecuperacion.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const usuario = document.getElementById("recuperacion-usuario").value.trim();
  if (!usuario) {
    return showError('Ingresa el usuario registrado.');
  }

  try {
    const respuesta = await fetch("/api/auth/solicitar-recuperacion", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario }),
    });

    const datos = await respuesta.json();
    if (!datos.ok) {
      showToast('error', 'Error', datos.msg || 'No se pudo enviar el código.');
      return showError(datos.msg || 'No se pudo enviar el código.');
    }

    document.getElementById("codigo-usuario").value = usuario;
    document.getElementById("cambiar-usuario").value = usuario;
    codigoUsuarioLabel.textContent = usuario;
    showNotification('Se envió el código al correo registrado con este usuario.');
    showToast('success', 'Correo enviado', datos.msg || 'Se envió el código al email registrado con este usuario.');
    switchTo("codigo");
  } catch (error) {
    console.error(error);
    showError('Error de conexión con el servidor.');
  }
});

formCodigo.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const usuario = document.getElementById("codigo-usuario").value.trim();
  const codigo = document.getElementById("codigo-valor").value.trim();

  if (!usuario || !codigo) {
    return showError('Completa el usuario y el código recibido.');
  }

  try {
    const respuesta = await fetch("/api/auth/verificar-codigo", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, codigo }),
    });

    const datos = await respuesta.json();
    if (!datos.ok) {
      showToast('error', 'Código inválido', datos.msg || 'Código incorrecto o expirado.');
      return showError(datos.msg || 'Código incorrecto o expirado.');
    }

    document.getElementById("cambiar-codigo").value = codigo;
    showNotification('Código verificado. Ingresa tu nueva contraseña.');
    showToast('success', 'Código verificado', datos.msg || 'Ahora ingresa tu nueva contraseña.');
    switchTo("cambiar-clave");
  } catch (error) {
    console.error(error);
    showError('Error de conexión con el servidor.');
  }
});

formCambiarClave.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const usuario = document.getElementById("cambiar-usuario").value.trim();
  const codigo = document.getElementById("cambiar-codigo").value.trim();
  const nuevaContrasena = document.getElementById("nueva-clave").value;
  const confirmarContrasena = document.getElementById("confirmar-clave").value;

  if (!usuario || !codigo || !nuevaContrasena || !confirmarContrasena) {
    return showError('Completa todos los campos para cambiar tu contraseña.');
  }

  if (nuevaContrasena !== confirmarContrasena) {
    return showError('Las contraseñas no coinciden.');
  }

  try {
    const respuesta = await fetch("/api/auth/cambiar-contrasena", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, codigo, nuevaContrasena }),
    });

    const datos = await respuesta.json();
    if (!datos.ok) {
      showToast('error', 'Error', datos.msg || 'No se pudo cambiar la contraseña.');
      return showError(datos.msg || 'No se pudo cambiar la contraseña.');
    }

    showToast('success', 'Contraseña actualizada', datos.msg || 'Ya puedes iniciar sesión con tu nueva contraseña.');
    goToLogin();
  } catch (error) {
    console.error(error);
    showError('Error de conexión con el servidor.');
  }
});

btnVolverLogin.addEventListener("click", goToLogin);
btnVolverLogin2.addEventListener("click", goToLogin);
btnVolverLogin3.addEventListener("click", goToLogin);
