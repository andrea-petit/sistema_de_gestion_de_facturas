// modules/comprobantes.js
const BASE_URL = 'http://localhost:3000/api/facturas';

export function initComprobantes() {
    const btnConsultar = document.getElementById('btnConsultarComprobante');
    const comprobanteInput = document.getElementById('comprobanteIdInput');

    if (!btnConsultar || !comprobanteInput) return;

    btnConsultar.addEventListener('click', () => {
        const idBuscar = comprobanteInput.value.trim();
        
        if (!idBuscar) {
            alert("Por favor, ingrese un identificador de comprobante válido.");
            return;
        }

        const idSanitizado = encodeURIComponent(idBuscar);
        const urlIndividual = `${BASE_URL}/comprobantes/${idSanitizado}/render`;
        
        window.open(urlIndividual, '_blank');
    });
}