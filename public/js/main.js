import { switchView } from './modulos/ui.js';
import { initUploadForm } from './modulos/uploadFacturaModule.js';
import { initBuscarModulo } from './modulos/buscarFacturaModule.js';
import { initHistorialModulo } from './modulos/historialModule.js';
import { initProveedoresModulo } from './modulos/proveedoresModule.js';
import { initUsuariosModulo } from './modulos/usuariosModule.js';
import { initPerfilModulo } from './modulos/perfilEmpresaModule.js';
import { initCategoriasModulo } from './modulos/categoriasModule.js';
import { initEditarFacturaModulo } from './modulos/editarFacturaModule.js';
import { initReportes } from './modulos/generarReporteModule.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- Session guard: redirect to login if session is no longer valid ---
    try {
        const sessionCheck = await fetch('/api/users/session-info', { credentials: 'include' });
        if (!sessionCheck.ok) {
            window.location.replace('/');
            return;
        }
    } catch (e) {
        window.location.replace('/');
        return;
    }

    const primerMenuItem = document.querySelector('.menu-item');
    if (primerMenuItem) primerMenuItem.classList.add('active');

    document.querySelectorAll('.menu-btn').forEach(button => {
        button.addEventListener('click', () => {
            const menuItem = button.parentElement;
            const isAlreadyActive = menuItem.classList.contains('active');
            document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
            if (!isAlreadyActive) {
                menuItem.classList.add('active');
            }
        });
    });

    initUploadForm();
    initBuscarModulo();
    initHistorialModulo();
    initProveedoresModulo();
    initUsuariosModulo();
    initPerfilModulo();
    initCategoriasModulo();
    initEditarFacturaModulo();
    initReportes();
});


// Expose `switchView` to inline onclick handlers in HTML
window.switchView = switchView;
