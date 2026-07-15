// modules/comprobantes.js
const BASE_URL = '/api/facturas';

export function initComprobantes() {
    const btnConsultar = document.getElementById('btnConsultarComprobante');
    const comprobanteInput = document.getElementById('comprobanteIdInput');

    if (!btnConsultar || !comprobanteInput) return;

    btnConsultar.addEventListener('click', () => {
        const idBuscar = comprobanteInput.value.trim();
        
        if (!idBuscar) {
            Swal.fire({
                title: 'Campo requerido',
                text: 'Por favor, ingrese un identificador de comprobante válido.',
                icon: 'warning',
                confirmButtonText: 'Aceptar'
            });
            return;
        }

        const idSanitizado = encodeURIComponent(idBuscar);
        const urlIndividual = `${BASE_URL}/comprobantes/${idSanitizado}/render`;
        
        window.open(urlIndividual, '_blank');
    });
}