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
import { initComprobantes } from './modulos/comprobanteModule.js';

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
    initComprobantes();

    // --- Mobile Sidebar Drawer Toggle ---
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const hamburgerBtn = document.getElementById('hamburgerBtn');

    function openSidebar() {
        sidebar.classList.add('open');
        overlay.classList.add('active');
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }

    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', () => {
            if (sidebar.classList.contains('open')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
    }

    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
    }

    // Close sidebar when a submenu link is clicked on mobile
    document.querySelectorAll('.submenu-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });
});


// Expose `switchView` to inline onclick handlers in HTML
window.switchView = switchView;
