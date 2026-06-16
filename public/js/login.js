const form = document.getElementById("formulario-login");
const vistaLogin = document.getElementById("pantalla-login");
const vistaSistema = document.getElementById("pantalla-sistema");
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

      // PASAR A LA SIGUIENTE PANTALLA: Oculta Login, muestra Éxito
      vistaLogin.style.display = "none";
      vistaSistema.style.display = "block";

      document.getElementById("mensaje-bienvenida").innerText = datos.msg;
      document.getElementById("token-salida").innerText = datos.token;

      const btnIrDashboard = document.getElementById("btn-ir-dashboard");
      if (btnIrDashboard) {
        btnIrDashboard.addEventListener("click", () => {
          window.location.replace("/dashboard");
        });
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
