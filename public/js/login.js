const formLogin = document.getElementById("formulario-login");
const formRecuperacion = document.getElementById("formulario-recuperacion");
const formCodigo = document.getElementById("formulario-codigo");
const formCambiarClave = document.getElementById("formulario-cambiar-clave");
const linkOlvido = document.getElementById("olvido-clave");
const btnVolverLogin = document.getElementById("btn-volver-login");
const btnVolverLogin2 = document.getElementById("btn-volver-login-2");
const btnVolverLogin3 = document.getElementById("btn-volver-login-3");
const codigoUsuarioLabel = document.getElementById("codigo-usuario-label");
const errorDiv = document.getElementById("caja-error");
const notificationDiv = document.getElementById("caja-notificacion");
const vistaLogin = document.getElementById("login_container");

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
  formLogin.classList.add("hidden");
  formRecuperacion.classList.add("hidden");
  formCodigo.classList.add("hidden");
  formCambiarClave.classList.add("hidden");

  if (section === "login") formLogin.classList.remove("hidden");
  if (section === "recuperacion") formRecuperacion.classList.remove("hidden");
  if (section === "codigo") formCodigo.classList.remove("hidden");
  if (section === "cambiar-clave") formCambiarClave.classList.remove("hidden");

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

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const nombre_usuario = document.getElementById("usuario").value.trim();
  const contraseña = document.getElementById("clave").value;

  if (!nombre_usuario || !contraseña) {
    return showError('Debes completar usuario y contraseña.');
  }

  try {
    const respuesta = await fetch("/api/users/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre_usuario, contraseña }),
    });

    const datos = await respuesta.json();

    if (datos.ok) {
      localStorage.setItem("token", datos.token);
      const rol = (datos.data && datos.data.rol) || datos.rol || null;
      if (rol) localStorage.setItem('userRol', rol);
      vistaLogin.classList.add("hidden");
      await showToast('success', 'Acceso concedido', datos.msg || 'Redirigiendo al dashboard...');
      window.location.replace('/dashboard');
      return;
    }

    return showError(datos.msg || 'Usuario o contraseña incorrectos.');
  } catch (error) {
    console.error(error);
    return showError('Error de conexión con el servidor.');
  }
});

linkOlvido.addEventListener("click", (e) => {
  e.preventDefault();
  switchTo("recuperacion");
});

btnVolverLogin.addEventListener("click", () => switchTo("login"));
btnVolverLogin2.addEventListener("click", () => switchTo("login"));
btnVolverLogin3.addEventListener("click", () => switchTo("login"));

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
    switchTo("login");
  } catch (error) {
    console.error(error);
    showError('Error de conexión con el servidor.');
  }
});
