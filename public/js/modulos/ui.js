export async function switchView(viewId, element) {
    if (!element) {
        element = document.querySelector(`.submenu-link[href="#${viewId}"]`);
    }
    if (!element) {
        console.warn(`switchView: elemento no encontrado para viewId=${viewId}`);
        return;
    }

    // 1. Control de estados activos en los enlaces del menú
    document.querySelectorAll('.submenu-link').forEach(link => link.classList.remove('active'));
    element.classList.add('active');

    // 2. Control de estados activos en los paneles visuales
    document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));
    const targetPanel = document.getElementById(`view-${viewId}`);
    if (targetPanel) {
        targetPanel.classList.add('active');
    }

    // 3. Actualización dinámica del título en la TopBar
    const parentMenu = element.closest('.menu-item');
    const parentMenuName = parentMenu ? parentMenu.querySelector('.menu-btn')?.innerText : '';
    const topBarTitle = document.getElementById('topBarTitle');
    if (topBarTitle) {
        topBarTitle.innerText = parentMenuName ? `${parentMenuName} 🡆 ${element.innerText}` : element.innerText;
    }


    console.log(`[SGAF Router] Navegando hacia la vista: ${viewId}`);
    
    const cacheBuster = `?t=${Date.now()}`; 

    switch (viewId) {
        case 'categoria-gastos': 
            try {
                // 🛠️ CORRECCIÓN: Quitamos el "modulos/" extra. Ajustamos a la ruta real.
                // Si ui.js está en la raíz de /js, la ruta correcta es './modulos/...'
                // Si ui.js ya está DENTRO de /js/modulos, la ruta correcta es './...'
                const { initCategoriasModulo } = await import(`./categoriasModule.js${cacheBuster}`);
                await initCategoriasModulo(true);
            } catch (err) {
                console.error("Error al refrescar dinámicamente el panel de categorías:", err);
            }
            break;

        case 'ver-historial': 
            try {
                // 🛠️ CORRECCIÓN: Quitamos el "modulos/" extra.
                const { initHistorialModulo } = await import(`./historialModule.js${cacheBuster}`);
                await initHistorialModulo(true); 
            } catch (err) {
                console.error("Error al inicializar el módulo de historial:", err);
            }
            break;

        default:
            break;
    }
}