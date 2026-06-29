const form = document.getElementById("formulario-login");
const vistaLogin = document.getElementById("login_container");
// Nota: ya no usamos la pantalla-sistema; usaremos SweetAlert para notificaciones
const errorDiv = document.getElementById("caja-error");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorDiv.classList.add("hidden");

  const nombre_usuario = document.getElementById("usuario").value;
  const contraseña = document.getElementById("clave").value;

  try {
    // Llama a tu endpoint del backend
    const respuesta = await fetch("/api/users/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre_usuario, contraseña }),
    });

    const datos = await respuesta.json();

    if (datos.ok) {
      localStorage.setItem("token", datos.token);
      // Guardar rol del usuario en localStorage (si el backend lo retorna)
      try {
        const rol = (datos.data && datos.data.rol) || datos.rol || null;
        if (rol) localStorage.setItem('userRol', rol);
      } catch (e) {
        console.warn('No se pudo guardar userRol en localStorage:', e);
      }

      // Ocultar el formulario mientras mostramos la notificación
      vistaLogin.classList.add("hidden");

      // Mostrar SweetAlert y redirigir al dashboard
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'success',
          title: 'Acceso concedido',
          text: datos.msg || 'Redirigiendo al dashboard...',
          timer: 1200,
          showConfirmButton: false,
          timerProgressBar: true,
        }).then(() => {
          window.location.replace('/dashboard');
        });
      } else {
        // Fallback simple
        setTimeout(() => window.location.replace('/dashboard'), 1200);
      }
    } else {
      // Si datos.ok es falso, disparamos SweetAlert2 usando el "msg" que manda el backend
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: 'Error de ingreso',
          text: datos.msg || 'Usuario o contraseña incorrectos.',
          confirmButtonColor: '#3085d6'
        });
      } else {
        errorDiv.innerText = datos.msg || 'Usuario o contraseña incorrectos.';
        errorDiv.classList.remove("hidden");
      }
    }
  } catch (error) {
    console.error(error);
    errorDiv.innerText = 'Error de conexión con el servidor.';
    errorDiv.classList.remove("hidden");
  }
});
