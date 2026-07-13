const formLogin = document.getElementById("formulario-login");
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
