const form = document.getElementById("formulario-login");
const vistaLogin = document.getElementById("login_container");
// Nota: ya no usamos la pantalla-sistema; usaremos SweetAlert para notificaciones
const errorDiv = document.getElementById("caja-error");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorDiv.style.display = "none";

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
      vistaLogin.style.display = "none";

      // Mostrar SweetAlert y redirigir al dashboard
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'success',
          title: 'Acceso concedido',
          text: 'Redirigiendo al dashboard...',
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
      errorDiv.innerText = datos.msg;
      errorDiv.style.display = "block";
    }
  } catch (error) {
    errorDiv.innerText =
      'Error: Asegúrate de correr "node app.js" en la terminal.';
    errorDiv.style.display = "block";
  }
});
