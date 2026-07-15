const BASE_URL = '/api/facturas';

export function initReportes() {
    const tipoReporte = document.getElementById('tipoReporte');
    const contenedorQuincena = document.getElementById('contenedorQuincenaReporte');
    const mesSelect = document.getElementById('reporteMes');
    const anioSelect = document.getElementById('reporteAnio');
    const quincenaSelect = document.getElementById('reporteQuincena');
    
    const btnPdf = document.getElementById('btnExportarPdf');
    const btnExcel = document.getElementById('btnExportarExcel');

    if (!tipoReporte) return; // Salvaguarda en caso de que no se encuentre en el DOM aún

    // 🌟 1. Control de visualización condicional (Quincenas)
    tipoReporte.addEventListener('change', (e) => {
        if (e.target.value === 'retenciones') {
            contenedorQuincena.classList.remove('hidden');
        } else {
            contenedorQuincena.classList.add('hidden');
        }
    });

    // 🌟 2. Generador de URL con Query Params
    function obtenerUrlFiltros(formato) {
        const tipo = tipoReporte.value;
        const mes = mesSelect.value;
        const anio = anioSelect.value;
        
        let endpoint = '/reporte-libro';
        let params = `?mes=${mes}&anio=${anio}&format=${formato}`;

        if (tipo === 'retenciones') {
            endpoint = '/reporte-retenciones';
            params += `&quincena=${quincenaSelect.value}`;
        }

        return `${BASE_URL}${endpoint}${params}`;
    }

    // 🌟 3. Manejador para PDF (Nueva pestaña)
    btnPdf.addEventListener('click', () => {
        const url = obtenerUrlFiltros('pdf');
        window.open(url, '_blank');
    });

    // 🌟 4. Manejador para Excel (Descarga en segundo plano)
    btnExcel.addEventListener('click', () => {
        const url = obtenerUrlFiltros('excel');
        window.location.href = url;
    });
}