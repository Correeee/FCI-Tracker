// 1. CONFIGURACIÓN Y VARIABLES GLOBALES
const MIS_CUOTAPARTES_BACKUP = 50.188484;
const INVERSION_INICIAL_FIJA = 1802902.48; 
let historialBase = []; 
let cotizacionDolar = 0;
let miGrafico = null;

// --- NUEVAS VARIABLES PARA PAGINACIÓN ---
let paginaActual = 1;
const registrosPorPagina = 10;
let historialFiltradoActual = []; 

// 2. OBTENER DÓLAR Y ACTUALIZAR UI (Sin cambios)
async function obtenerDolar() {
    try {
        const response = await fetch('https://dolarapi.com/v1/dolares/oficial');
        const data = await response.json();
        cotizacionDolar = data.venta;
        const dolarDisplay = document.getElementById('cotizacionHoy') || document.querySelector('.dolar-oficial-valor');
        if (dolarDisplay) {
            dolarDisplay.textContent = `Dólar Oficial: $${data.venta}`;
        }
        return data.venta;
    } catch (e) {
        console.warn("⚠️ Usando respaldo de dólar $1390");
        cotizacionDolar = 1390;
        return 1390;
    }
}

// 3. GENERAR / ACTUALIZAR GRÁFICO (Sin cambios)
function crearGrafico(historial, precioDolar) {
    const canvas = document.getElementById('graficoEvolucion');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (miGrafico) miGrafico.destroy();
    const labels = historial.map(h => h.fecha.split('-').reverse().slice(0, 2).join('/'));
    const datosARS = historial.map(h => h.dinero);
    const datosUSD = historial.map(h => h.dinero / precioDolar);
    miGrafico = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Saldo ARS',
                    data: datosARS,
                    borderColor: '#0984e3',
                    backgroundColor: 'rgba(9, 132, 227, 0.05)',
                    borderWidth: 3,
                    yAxisID: 'y',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Saldo USD',
                    data: datosUSD,
                    borderColor: '#27ae60',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    yAxisID: 'y1',
                    tension: 0.3,
                    pointRadius: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { type: 'linear', position: 'left', ticks: { callback: v => '$' + v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) } },
                y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: v => 'u$s ' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) } }
            }
        }
    });
}

// 4. FUNCIÓN DE RENDERIZADO (Actualizada con lógica de paginación)
function renderizarDashboard(historialFiltrado, reiniciarPagina = false) {
    if (reiniciarPagina) paginaActual = 1;
    historialFiltradoActual = historialFiltrado;

    const cantDisplay = document.getElementById('cantRegistros');
    if (cantDisplay) cantDisplay.textContent = historialFiltrado.length;
    crearGrafico(historialFiltrado, cotizacionDolar);
    
    const tbody = document.getElementById('cuerpoTablaFull');
    if (!tbody) return;

    const inicio = (paginaActual - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;
    const historialSegmentado = [...historialFiltrado].reverse().slice(inicio, fin);

    tbody.innerHTML = historialSegmentado.map((h) => {
        const esSuscripcion = h.nota && h.nota.includes("Suscripción");
        const esRescate = h.nota && h.nota.includes("Rescate");
        const esMovimientoManual = esSuscripcion || esRescate;

        let montoValor = h.ganancia || 0;
        
        if (!esMovimientoManual && montoValor === 0) {
            const idxOriginal = historialBase.findIndex(item => item.fecha === h.fecha);
            if (idxOriginal > 0) {
                const previo = historialBase[idxOriginal - 1];
                montoValor = h.dinero - previo.dinero;
            }
        }

        let etiquetaTipo = esMovimientoManual ? h.nota : "Ganancia Diaria";
        let subtextoDesc = esMovimientoManual ? "Movimiento de Capital" : `u$s ${(montoValor / cotizacionDolar).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        let claseCSS = montoValor >= 0 ? 'positive' : 'negative';
        let variacionFinal = (h.variacion || 0).toFixed(2) + "%";
        let estiloFila = "";

        const gananciaAcumulada = h.dinero - INVERSION_INICIAL_FIJA;
        const claseAcumulada = gananciaAcumulada >= 0 ? 'positive' : 'negative';

        if (esMovimientoManual) {
            variacionFinal = "---";
            if (esSuscripcion) estiloFila = 'background-color: #f0fff4; border-left: 5px solid #27ae60;'; 
            else if (esRescate) estiloFila = 'background-color: #fff5f5; border-left: 5px solid #e74c3c;';
        }

        return `
            <tr style="${estiloFila}">
                <td>${h.fecha.split('-').reverse().join('/')}</td>
                <td>
                    <span class="total-cell">$${h.dinero.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <div style="font-size: 10px; color: #7f8c8d; margin-top: 4px;">
                        Acumulado: <strong class="${claseAcumulada}">$${gananciaAcumulada.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                </td>
                <td><div class="usd-cell">u$s ${(h.dinero / cotizacionDolar).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></td>
                <td class="${claseCSS}">
                    <div style="font-size: 9px; text-transform: uppercase; font-weight: bold; opacity: 0.7; margin-bottom: 3px;">
                        ${etiquetaTipo}
                    </div>
                    <strong>$${montoValor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    <br><small style="font-size: 10px;">(${subtextoDesc})</small>
                </td>
                <td class="${claseCSS}" style="font-weight: bold; font-size: 13px;">
                    ${esMovimientoManual ? '---' : (h.variacion >= 0 ? '▲ ' : '▼ ') + variacionFinal}
                </td>
            </tr>
        `;
    }).join('');

    renderizarControlesPaginacion();
}

function renderizarControlesPaginacion() {
    const contenedor = document.getElementById('controlesPaginacion');
    if (!contenedor) return;
    const totalPaginas = Math.ceil(historialFiltradoActual.length / registrosPorPagina);
    contenedor.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-top: 20px; padding-bottom: 20px;">
            <button id="btnPrev" ${paginaActual === 1 ? 'disabled' : ''} style="padding: 6px 12px; cursor: pointer; border-radius: 4px; border: 1px solid #ddd; background: white;">Anterior</button>
            <span style="font-size: 13px; font-weight: bold; color: #2d3436;">${paginaActual} / ${totalPaginas || 1}</span>
            <button id="btnNext" ${paginaActual >= totalPaginas ? 'disabled' : ''} style="padding: 6px 12px; cursor: pointer; border-radius: 4px; border: 1px solid #ddd; background: white;">Siguiente</button>
        </div>
    `;
    document.getElementById('btnPrev').onclick = () => {
        if (paginaActual > 1) {
            paginaActual--;
            renderizarDashboard(historialFiltradoActual);
        }
    };
    document.getElementById('btnNext').onclick = () => {
        const totalPaginas = Math.ceil(historialFiltradoActual.length / registrosPorPagina);
        if (paginaActual < totalPaginas) {
            paginaActual++;
            renderizarDashboard(historialFiltradoActual);
        }
    };
}

// 5. INICIALIZACIÓN
async function inicializarDashboard() {
    await obtenerDolar();
    chrome.storage.sync.get(['historial', 'usuario', 'fondoNombre', 'cuotas'], async (res) => {
        const cuotasActuales = res.cuotas ? parseFloat(res.cuotas) : MIS_CUOTAPARTES_BACKUP;
        if (!res.historial || res.historial.length === 0) return;

        historialBase = res.historial.map(h => ({
            ...h,
            dinero: h.dinero || (h.vcp * cuotasActuales)
        }));

        if (res.usuario) document.getElementById('displayUsuario').textContent = res.usuario;
        if (res.fondoNombre) document.getElementById('badgeFondo').textContent = res.fondoNombre;

        const ultimoRegistro = historialBase[historialBase.length - 1];
        const vcpDisplay = document.getElementById('vcpInfo');
        
        if (vcpDisplay && ultimoRegistro.vcp) {
            const vcpARS = ultimoRegistro.vcp.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const vcpUSD = (ultimoRegistro.vcp / cotizacionDolar).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            
            const registrosValidos = historialBase.filter(h => h.variacion !== undefined && !h.nota?.includes("Suscripción") && !h.nota?.includes("Rescate"));
            
            let variacionAcumulada7d = 0;
            let gananciaAcumulada7d = 0;
            let gananciaAcumulada7dUSD = 0;
            
            if (registrosValidos.length > 0) {
                const ultimos7 = registrosValidos.slice(-7);
                const dineroFinal7d = ultimos7[ultimos7.length - 1].dinero;
                const vcpFinal = ultimos7[ultimos7.length - 1].vcp;
                const indexPrimero = historialBase.indexOf(ultimos7[0]);
                const registroBase = indexPrimero > 0 ? historialBase[indexPrimero - 1] : ultimos7[0];
                const vcpInicial = registroBase.vcp;
                const dineroInicial7d = registroBase.dinero;

                variacionAcumulada7d = ((vcpFinal - vcpInicial) / vcpInicial) * 100;
                gananciaAcumulada7d = dineroFinal7d - dineroInicial7d;
                gananciaAcumulada7dUSD = gananciaAcumulada7d / cotizacionDolar;
            }

            const ultimos7Tasa = registrosValidos.slice(-7);
            const promedioDiario = ultimos7Tasa.reduce((acc, curr) => acc + curr.variacion, 0) / (ultimos7Tasa.length || 1);
            const diariaDecimal = promedioDiario / 100;
            
            const tna = diariaDecimal * 365 * 100;
            const tea = (Math.pow(1 + diariaDecimal, 365) - 1) * 100;
            const mensualTNA = diariaDecimal * 30 * 100; 
            const mensualTEA = (Math.pow(1 + diariaDecimal, 30) - 1) * 100;

            const saldoARSActual = ultimoRegistro.dinero;
            const saldoUSDActual = saldoARSActual / cotizacionDolar;
            const proyARS_Nominal = saldoARSActual * (1 + (mensualTNA / 100));
            const proyARS_Efectiva = saldoARSActual * (1 + (mensualTEA / 100));

            const gananciaProyNominal = proyARS_Nominal - saldoARSActual;
            const gananciaProyEfectiva = proyARS_Efectiva - saldoARSActual;

            vcpDisplay.innerHTML = `
                <div style="font-size: 16px;">Valor Cuotaparte: <strong>$${vcpARS}</strong> | <strong>u$s ${vcpUSD}</strong></div>
                <div style="margin-top: 8px; color: #2d3436; font-size: 13px; line-height: 1.6;">
                    <div>Rendimiento proyectado (Promedio 7d): 
                        <span class="positive" style="font-weight: bold;">TNA: ${tna.toFixed(2)}%</span> | 
                        <span class="positive" style="color: #0984e3; font-weight: bold;">TEA: ${tea.toFixed(2)}%</span>
                    </div>
                    <div style="font-size: 11px; margin-top: 4px; color: #636e72; background: #ebf5fb; padding: 4px 10px; border-radius: 4px; display: inline-block;">
                        Proyección mensual (30d): 
                        Nominal: <strong style="color: #2980b9;">${mensualTNA.toFixed(2)}%</strong> | 
                        Efectivo: <strong style="color: #27ae60;">${mensualTEA.toFixed(2)}%</strong>
                    </div>
                    <div style="margin-top: 8px; padding: 5px 12px; background: #f8f9fa; border-radius: 6px; display: block; border: 1px solid #e9ecef;">
                        <div style="display: flex; align-items: center; margin-bottom: 4px;">
                            Últimos 7 días: 
                            <strong style="color: ${variacionAcumulada7d >= 0 ? '#27ae60' : '#e74c3c'}; margin-left: 5px;">
                                ${variacionAcumulada7d >= 0 ? '▲' : '▼'} ${variacionAcumulada7d.toFixed(2)}%
                            </strong>
                            <span style="margin: 0 8px; color: #ccc;">|</span>
                            Ganancia acumulada: 
                            <strong style="color: ${gananciaAcumulada7d >= 0 ? '#27ae60' : '#e74c3c'}; margin-left: 5px;">
                                +$${gananciaAcumulada7d.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </strong>
                            <span style="color: #636e72; font-size: 11px; margin-left: 4px;">
                                (u$s ${gananciaAcumulada7dUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                            </span>
                        </div>
                        <div style="border-top: 1px dashed #ddd; margin-top: 4px; padding-top: 4px; font-size: 13px;">
                            <strong>DINERO TOTAL ACTUAL:</strong> 
                            <span style="color: #2d3436;">$${saldoARSActual.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> | 
                            <span style="color: #27ae60;">u$s ${saldoUSDActual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div style="border-top: 1px solid #eee; margin-top: 4px; padding-top: 4px; font-size: 12px;">
                            <strong>Proyección Saldo (30d):</strong> 
                            Nominal: <span style="color: #2980b9; font-weight: bold;">$${proyARS_Nominal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> | 
                            Efectiva: <span style="color: #27ae60; font-weight: bold;">$${proyARS_Efectiva.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div style="font-size: 11px; margin-top: 2px; color: #7f8c8d; opacity: 0.9;">
                            <strong>Ganancia proyectada (30d):</strong> 
                            Nominal: <span style="color: #2980b9;">+$${gananciaProyNominal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> | 
                            Efectiva: <span style="color: #27ae60;">+$${gananciaProyEfectiva.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        renderizarDashboard(historialBase, true);

        const fDesde = document.getElementById('fechaDesde');
        const fHasta = document.getElementById('fechaHasta');
        const aplicarFiltro = () => {
            const desde = fDesde.value;
            const hasta = fHasta.value;
            const filtrado = historialBase.filter(h => {
                let ok = true;
                if (desde) ok = ok && h.fecha >= desde;
                if (hasta) ok = ok && h.fecha <= hasta;
                return ok;
            });
            renderizarDashboard(filtrado, true);
        };
        fDesde.addEventListener('change', aplicarFiltro);
        fHasta.addEventListener('change', aplicarFiltro);
        document.getElementById('resetFiltro').onclick = () => {
            fDesde.value = '';
            fHasta.value = '';
            renderizarDashboard(historialBase, true);
        };
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(inicializarDashboard, 150);
});