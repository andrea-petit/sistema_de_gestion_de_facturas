// Variables de control de estado para la paginación del SGAF
let paginaActual = 1;
const limitePorPagina = 5; // Cantidad de proveedores por tabla

export function initProveedoresModulo() {
  // Primera carga inicializada
  cargarProveedores(paginaActual);

  const formEdicion = document.getElementById("formEdicionProveedor");
  if (!formEdicion) return;

  // Reemplaza el evento 'submit' dentro de initProveedoresModulo() con esto:
  formEdicion.addEventListener("submit", async (e) => {
    e.preventDefault();

    const idProveedor = document.getElementById("editProvId").value;
    const btnSubmit = formEdicion.querySelector('button[type="submit"]');

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerText = "Guardando...";
    }

    //  Recolectamos todos los campos en un solo objeto
    const datosActualizados = {
      rif: document.getElementById("editProvRif")?.value.trim() || "",
      razon_social:
        document.getElementById("editProvRazon")?.value.trim() || "",
      direccion:
        document.getElementById("editProvDireccion")?.value.trim() || "",
      telefono: document.getElementById("editProvTelefono")?.value.trim() || "",
      tipo_contribuyente:
        document.getElementById("editProvContribuyente")?.value || "",
    };

    try {
      //  Un solo viaje al servidor
      const response = await fetch(`/api/proveedores/${idProveedor}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datosActualizados),
      });

      const resultado = await response.json();

      if (response.ok) {
        await Swal.fire({
          icon: "success",
          title: "Proveedor actualizado",
          text: "Nuevos cambios consolidados",
          timer: 2000,
          showConfirmButton: false,
        });

        await cargarProveedores(paginaActual);

        const placeholder = document.getElementById("editorPlaceholder");
        if (placeholder) {
          placeholder.style.display = "block";
          placeholder.classList.remove("hidden");
        }
        formEdicion.style.display = "none";
        formEdicion.classList.add("hidden");
        formEdicion.reset();
      } else {
        throw new Error(resultado.msg || "No se pudieron salvar los cambios.");
      }
    } catch (error) {
      console.error("[SGAF Error Proveedores]:", error);
      await Swal.fire({
        icon: "error",
        title: "Error al actualizar",
        text: error.message || "No se pudo comunicar con el servidor.",
      });
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerText = "Guardar Cambios";
      }
    }
  });
}

export async function cargarProveedores(pagina = 1) {
  const cuerpoTabla = document.getElementById("listaProveedoresCuerpo");
  if (!cuerpoTabla) return;

  paginaActual = pagina;

  try {
    const response = await fetch(
      `/api/proveedores?page=${paginaActual}&limit=${limitePorPagina}`,
      {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      },
    );

    const resultado = await response.json();
    if (!response.ok)
      throw new Error(resultado.msg || "Error al recuperar proveedores.");

    const proveedores = resultado.data || [];
    const infoPaginacion = resultado.paginacion || null;

    if (proveedores.length === 0) {
      cuerpoTabla.innerHTML = `<tr><td colspan="4" style="padding: 20px; text-align: center; color: var(--text-muted);">No existen proveedores registrados.</td></tr>`;
      renderizarControlesPaginacion(0);
      return;
    }

    cuerpoTabla.innerHTML = "";
    proveedores.forEach((prov) => {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid var(--border)";
      tr.style.transition = "background 0.2s";

      // ====================================================================
      //  SOLUCIÓN A LA DOBLE LETRA: Formateo Condicional Inteligente
      // ====================================================================
      let rifCompleto = prov.rif || "S/RIF";
      const tipoDocPrefix = prov.tipo_documento
        ? `${prov.tipo_documento.toUpperCase()}-`
        : "";

      if (
        prov.tipo_documento &&
        rifCompleto.startsWith(prov.tipo_documento.toUpperCase())
      ) {
        rifCompleto = rifCompleto.substring(1);
      }

      const rifVisual = `${tipoDocPrefix}${rifCompleto}`;

      tr.innerHTML = `
                <td class="td-prov" style="font-weight: 600; color: #0f172a;">${rifVisual}</td>
                <td class="td-prov" style="color: #334155; font-weight: 500;">${prov.razon_social}</td>
                <td class="td-prov td-tel" style=" display: none; color: #64748b;">${prov.telefono || "N/A"}</td>
                <td class="td-prov" style="text-align: right;">
                    <button class="btn-editar-prov" title="Editar" style="background: #f1f5f9; color: var(--primary); border: 1px solid var(--border); font-size: 12px; font-weight: 600; border-radius: 4px; cursor: pointer; transition: all 0.2s;">
                        <i class="fas fa-edit show-on-mobile"></i><span class="hide-on-mobile">Editar</span>
                    </button>
                </td>
            `;

      const btnEditar = tr.querySelector(".btn-editar-prov");
      if (btnEditar) {
        btnEditar.addEventListener("click", () => {
          document
            .querySelectorAll("#listaProveedoresCuerpo tr")
            .forEach((r) => (r.style.background = "transparent"));
          tr.style.background = "#eff6ff";

          // Ocultamos el placeholder usando estilos directos y clases utilitarias de visibilidad
          const placeholder = document.getElementById("editorPlaceholder");
          if (placeholder) {
            placeholder.style.display = "none";
            placeholder.classList.add("hidden");
          }

          // Forzamos la apertura del formulario removiendo cualquier rastro de 'hidden'
          const formEdicion = document.getElementById("formEdicionProveedor");
          if (formEdicion) {
            formEdicion.style.display = "flex";
            formEdicion.classList.remove("hidden");
          }

          // Inyección de valores controlada contra fallos de elementos nulos en el DOM
          const mapearInput = (id, valor) => {
            const inputElement = document.getElementById(id);
            if (inputElement) inputElement.value = valor || "";
          };

          mapearInput("editProvId", prov.id);
          mapearInput("editProvRif", prov.rif);
          mapearInput("editProvRazon", prov.razon_social);
          mapearInput("editProvDireccion", prov.direccion);
          mapearInput("editProvTelefono", prov.telefono);
          mapearInput("editProvContribuyente", prov.tipo_contribuyente);
        });
      }

      cuerpoTabla.appendChild(tr);
    });

    if (infoPaginacion) {
      renderizarControlesPaginacion(infoPaginacion.paginasTotales);
    }
  } catch (error) {
    console.error("[SGAF Error Tabla Proveedores]:", error);
    cuerpoTabla.innerHTML = `<tr><td colspan="4" style="padding: 20px; text-align: center; color: #ef4444;">❌ Error al procesar listado: ${error.message}</td></tr>`;
  }
}

function renderizarControlesPaginacion(paginasTotales) {
  let contenedorPaginacion = document.getElementById(
    "paginacionProveedoresContenedor",
  );

  if (!contenedorPaginacion) {
    const tabla = document
      .getElementById("listaProveedoresCuerpo")
      .closest("table");
    contenedorPaginacion = document.createElement("div");
    contenedorPaginacion.id = "paginacionProveedoresContenedor";
    contenedorPaginacion.style.cssText =
      "display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 15px; padding: 10px;";
    tabla.parentNode.insertBefore(contenedorPaginacion, tabla.nextSibling);
  }

  contenedorPaginacion.innerHTML = "";

  if (paginasTotales <= 1) return;

  const btnAnt = document.createElement("button");
  btnAnt.innerText = "◀";
  btnAnt.disabled = paginaActual === 1;
  btnAnt.style.cssText =
    "padding: 5px 10px; cursor: pointer; border-radius: 4px; border: 1px solid var(--border); background: #ffffff;";
  btnAnt.onclick = () => {
    if (paginaActual > 1) cargarProveedores(paginaActual - 1);
  };
  contenedorPaginacion.appendChild(btnAnt);

  const indicador = document.createElement("span");
  indicador.innerText = `Pág. ${paginaActual} de ${paginasTotales}`;
  indicador.style.cssText =
    "font-weight: 600; font-size: 13px; color: #334155;";
  contenedorPaginacion.appendChild(indicador);

  const btnSig = document.createElement("button");
  btnSig.innerText = "▶";
  btnSig.disabled = paginaActual === paginasTotales;
  btnSig.style.cssText =
    "padding: 5px 10px; cursor: pointer; border-radius: 4px; border: 1px solid var(--border); background: #ffffff;";
  btnSig.onclick = () => {
    if (paginaActual < paginasTotales) cargarProveedores(paginaActual + 1);
  };
  contenedorPaginacion.appendChild(btnSig);
}
