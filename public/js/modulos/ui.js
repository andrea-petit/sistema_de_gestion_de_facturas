export function switchView(viewId, element) {
    if (!element) {
        element = document.querySelector(`.submenu-link[href="#${viewId}"]`);
    }
    if (!element) {
        console.warn(`switchView: elemento no encontrado para viewId=${viewId}`);
        return;
    }

    document.querySelectorAll('.submenu-link').forEach(link => link.classList.remove('active'));
    element.classList.add('active');

    document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));
    const targetPanel = document.getElementById(`view-${viewId}`);
    if (targetPanel) {
        targetPanel.classList.add('active');
    }

    const parentMenu = element.closest('.menu-item');
    const parentMenuName = parentMenu ? parentMenu.querySelector('.menu-btn')?.innerText : '';
    const topBarTitle = document.getElementById('topBarTitle');
    if (topBarTitle) {
        topBarTitle.innerText = parentMenuName ? `${parentMenuName} > ${element.innerText}` : element.innerText;
    }
}