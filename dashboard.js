// 1. VARIABLES GLOBALES
const MIS_CUOTAPARTES_BACKUP = 50.188484;
const INVERSION_INICIAL_FIJA = 1802902.48;
let historialBase = [];
let cotizacionDolar = 0;
let miGrafico = null;
let paginaActual = 1;
const registrosPorPagina = 5;
let historialFiltradoActual = [];

// 2. DÓLAR (Modificado para obtener Compra y Venta)
async function obtenerDolar() {
    try {
        const response = await fetch('https://dolarapi.com/v1/dolares/oficial');
        const data = await response.json();
        
        // Guardamos la venta para los cálculos internos
        cotizacionDolar = data.venta; 
        
        const dolarDisplay = document.getElementById('cotizacionHoy');
        if (dolarDisplay) {
            // Mostramos ambos valores en el encabezado
            dolarDisplay.textContent = `Dólar Oficial: Compra $${data.compra.toFixed(2)} | Venta $${data.venta.toFixed(2)}`;
        }
        return data.venta;
    } catch (e) {
        console.warn("⚠️ Usando respaldo de dólar $1425");
        cotizacionDolar = 1425;
        return 1425;
    }
}

// 3. GRÁFICO (Configuración de ejes ARS y USD)
function crearGrafico(historial, precioDolar) {
    const canvas = document.getElementById('graficoEvolucion');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (miGrafico) miGrafico.destroy();
    miGrafico = new Chart(ctx, {
        type: 'line',
        data: {
            labels: historial.map(h => h.fecha.split('-').reverse().slice(0, 2).join('/')),
            datasets: [{
                label: 'ARS',
                data: historial.map(h => h.dinero),
                borderColor: '#000',
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 0,
                fill: false,
                yAxisID: 'y'
            },
            {
                label: 'USD',
                data: historial.map(h => h.dinero / precioDolar),
                borderColor: '#27ae60',
                borderWidth: 2,
                borderDash: [5, 5],
                tension: 0.4,
                pointRadius: 0,
                yAxisID: 'y1',
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { 
                    type: 'linear',
                    display: true, 
                    position: 'left',
                    ticks: { 
                        font: { family: 'Inter', size: 10 },
                        callback: v => '$' + v.toLocaleString('es-AR', { maximumFractionDigits: 2 }) 
                    },
                    grid: { display: false }
                }, 
                y1: { 
                    type: 'linear',
                    display: true, 
                    position: 'right',
                    ticks: { 
                        font: { family: 'Inter', size: 10 },
                        callback: v => 'u$s ' + v.toLocaleString('en-US', { maximumFractionDigits: 2 }) 
                    },
                    grid: { display: false }
                },
                x: { 
                    grid: { display: false }, 
                    ticks: { font: { family: 'Inter', size: 10 } } 
                } 
            }
        }
    });
}

// 4. RENDERIZADO TABLA
function renderizarDashboard(historialFiltrado, reiniciarPagina = false) {
    if (reiniciarPagina) paginaActual = 1;
    historialFiltradoActual = historialFiltrado;
    const cantDisp = document.getElementById('cantRegistros');
    if (cantDisp) cantDisp.textContent = historialFiltrado.length;
    
    crearGrafico(historialFiltrado, cotizacionDolar);

    const inicio = (paginaActual - 1) * registrosPorPagina;
    const segmentado = [...historialFiltrado].reverse().slice(inicio, inicio + registrosPorPagina);

    const tbody = document.getElementById('cuerpoTablaFull');
    if (tbody) {
        tbody.innerHTML = segmentado.map((h) => {
            let ganancia = h.ganancia || 0;
            if (ganancia === 0) {
                const idx = historialBase.findIndex(item => item.fecha === h.fecha);
                if (idx > 0) ganancia = h.dinero - historialBase[idx - 1].dinero;
            }
            const acum = h.dinero - INVERSION_INICIAL_FIJA;
            const gananciaUSD = ganancia / cotizacionDolar;

            return `
                <tr>
                    <td style="font-weight: 600;">${h.fecha.split('-').reverse().join('/')}</td>
                    <td><span style="font-family:'Inter'; font-size:18px;">$${h.dinero.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</span><br><small style="color:#999; font-family:'Inter'; font-weight:500;">VCP: $${h.vcp.toFixed(2)}</small></td>
                    <td><span style="font-family:'Inter'; font-size:18px; color:#27ae60;">u$s ${(h.dinero/cotizacionDolar).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span><br><small style="color:#999; font-family:'Inter'; font-weight:500;">Acum: $${acum.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</small></td>
                    <td style="font-weight: 600; color: ${ganancia >= 0 ? '#27ae60' : '#d63031'}">
                        $${ganancia.toLocaleString('es-AR', { maximumFractionDigits: 2 })}<br>
                        <small style="opacity:0.8">u$s ${gananciaUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}</small>
                    </td>
                    <td style="font-weight: 700; color: ${h.variacion >= 0 ? '#27ae60' : '#d63031'}">${h.variacion >= 0 ? '▲' : '▼'} ${Math.abs(h.variacion).toFixed(2)}%</td>
                </tr>`;
        }).join('');
    }
    renderizarControlesPaginacion();
}

function renderizarControlesPaginacion() {
    const total = Math.ceil(historialFiltradoActual.length / registrosPorPagina);
    const contenedor = document.getElementById('controlesPaginacion');
    if (!contenedor) return;

    contenedor.innerHTML = `
        <div style="display: flex; justify-content: center; gap: 15px; margin: 25px 0;">
            <button id="btnAnterior" style="font-family:'Inter'; background:none; border:1px solid #eee; padding:8px 18px; border-radius:12px; cursor:pointer; font-weight:600; font-size:13px;" ${paginaActual === 1 ? 'disabled' : ''}>Anterior</button>
            <span style="font-weight: 700; font-family:'Inter'; font-size:14px; align-self:center;">${paginaActual} / ${total || 1}</span>
            <button id="btnSiguiente" style="font-family:'Inter'; background:none; border:1px solid #eee; padding:8px 18px; border-radius:12px; cursor:pointer; font-weight:600; font-size:13px;" ${paginaActual >= total ? 'disabled' : ''}>Siguiente</button>
        </div>`;

    document.getElementById('btnAnterior').onclick = () => cambiarPagina(-1);
    document.getElementById('btnSiguiente').onclick = () => cambiarPagina(1);
}

function cambiarPagina(dir) {
    const total = Math.ceil(historialFiltradoActual.length / registrosPorPagina);
    const nuevaPagina = paginaActual + dir;
    if (nuevaPagina >= 1 && nuevaPagina <= total) {
        paginaActual = nuevaPagina;
        renderizarDashboard(historialFiltradoActual);
    }
}

function exportarAExcel(fondoNombre) {
    if (!historialBase || historialBase.length === 0) return alert("No hay datos para exportar");
    const hoy = new Date().toLocaleDateString('es-AR').replace(/\//g, '-');
    const filename = `${fondoNombre} - ${hoy}.xls`;
    let html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="UTF-8"></head>
        <body>
        <table border="1">
            <tr style="background-color: #000; color: white; font-weight: bold; text-align: center;">
                <th>Fecha</th><th>VCP</th><th>Dinero Total (ARS)</th><th>Dinero Total (USD)</th>
                <th>Ganancia Diaria (ARS)</th><th>Ganancia Diaria (USD)</th><th>Variacion %</th>
            </tr>`;
    [...historialBase].reverse().forEach((h) => {
        let gananciaARS = h.ganancia || 0;
        if (gananciaARS === 0) {
            const idx = historialBase.findIndex(item => item.fecha === h.fecha);
            if (idx > 0) gananciaARS = h.dinero - historialBase[idx - 1].dinero;
        }
        const gananciaUSD = gananciaARS / cotizacionDolar;

        html += `
            <tr>
                <td style="text-align: center;">${h.fecha.split('-').reverse().join('/')}</td>
                <td style="text-align: right;">$${h.vcp.toFixed(2)}</td>
                <td style="text-align: right;">$${h.dinero.toFixed(2)}</td>
                <td style="text-align: right;">u$s ${(h.dinero / cotizacionDolar).toFixed(2)}</td>
                <td style="text-align: right; color: ${gananciaARS >= 0 ? '#27ae60' : '#d63031'};">$${gananciaARS.toFixed(2)}</td>
                <td style="text-align: right; color: ${gananciaARS >= 0 ? '#27ae60' : '#d63031'};">u$s ${gananciaUSD.toFixed(2)}</td>
                <td style="text-align: center;">${(h.variacion || 0).toFixed(2)}%</td>
            </tr>`;
    });
    html += `</table></body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

// 5. INICIALIZACIÓN
async function inicializarDashboard() {
    chrome.action.setBadgeText({ text: "" });
    await obtenerDolar();
    chrome.storage.sync.get(['historial', 'usuario', 'fondoNombre', 'cuotas', 'visibilidadDashboard'], async (res) => {
        const cuotas = res.cuotas ? parseFloat(res.cuotas) : MIS_CUOTAPARTES_BACKUP;
        historialBase = (res.historial || []).map(h => ({ ...h, dinero: h.dinero || (h.vcp * cuotas) }));
        
        document.getElementById('displayUsuario').textContent = res.usuario || "Maxi";
        const fondoNombre = res.fondoNombre || "SBS";
        document.getElementById('badgeFondo').textContent = fondoNombre;

        if (historialBase.length > 0) {
            const ultimo = historialBase[historialBase.length - 1];
            const validos = historialBase.filter(h => h.variacion !== undefined);
            const ganTotal = ultimo.dinero - INVERSION_INICIAL_FIJA;
            
            let variacion7dReal = 0;
            if (historialBase.length >= 2) {
                const indexUltimo = historialBase.length - 1;
                const indexHace7 = Math.max(0, indexUltimo - 7);
                const vcpHace7 = historialBase[indexHace7].vcp;
                variacion7dReal = ((ultimo.vcp - vcpHace7) / vcpHace7) * 100;
            }

            const ultimos7 = validos.slice(-7);
            const promedioDiario = ultimos7.length > 0 ? (ultimos7.reduce((acc, curr) => acc + curr.variacion, 0) / ultimos7.length) : 0;
            const tna = promedioDiario * 365;
            const mensualNominal = promedioDiario * 30;
            const mensualEf = (Math.pow(1 + (promedioDiario/100), 30) - 1) * 100;
            const dias = Math.ceil(Math.abs(new Date(ultimo.fecha) - new Date(historialBase[0].fecha)) / 86400000);

            document.getElementById('vcpInfo').innerHTML = `
                <div style="margin-top: 25px; display: flex; flex-direction: column; gap: 20px;">
                    <div style="font-family: 'Inter'; font-size: 28px; font-weight: 300; letter-spacing:-0.5px;">$${ultimo.vcp.toFixed(2)} <span style="font-family: 'Inter'; font-size: 14px; color: #888; font-weight: 500; letter-spacing:0;">ARS/Cuota</span></div>
                    
                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        <div id="rendimiento-proyectado" style="background: #f7f7f7; padding: 16px 24px; border-radius: 20px; border: 1px solid #eee; flex: 1; min-width: 220px;">
                            <span style="display: block; font-size: 10px; font-weight: 800; color: #999; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px; font-family:'Inter'">Rendimiento (7d)</span>
                            <span style="color: #27ae60; font-weight: 300; font-family:'Inter'; font-size: 18px;">TNA: ${tna.toFixed(2)}% | TEA: ${(tna*1.1).toFixed(2)}%</span>
                        </div>
                        
                        <div id="proyeccion-mensual" style="background: #f7f7f7; padding: 16px 24px; border-radius: 20px; border: 1px solid #eee; flex: 1; min-width: 220px;">
                            <span style="display: block; font-size: 10px; font-weight: 800; color: #999; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px; font-family:'Inter'">Proyección Mensual</span>
                            <span style="font-weight: 300; font-family:'Inter'; font-size: 18px;">Nominal: ${mensualNominal.toFixed(2)}% | Efectiva: ${mensualEf.toFixed(2)}%</span>
                        </div>
                    </div>

                    <div id="tarjeta-totales" style="margin-top: 5px; padding: 32px; background: #000; color: #fff; border-radius: 32px; box-shadow: 0 15px 40px rgba(0,0,0,0.12);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                            <div>
                                <span style="display: block; font-size: 11px; font-weight: 600; opacity: 0.6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-family:'Inter'">Balance Total</span>
                                <span style="font-size: 44px; font-weight: 300; letter-spacing: -2px; font-family: 'Inter';">$${ultimo.dinero.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div style="text-align: right;">
                                <span style="display: block; font-family:'Inter'; font-size: 22px; color: #27ae60; margin-bottom: 2px;">+ $${ganTotal.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</span>
                                <span style="font-size: 18px; font-family:'Inter'; opacity: 0.8;">u$s ${(ultimo.dinero/cotizacionDolar).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        <div style="font-size: 12px; opacity: 0.7; border-top: 1px solid #333; padding-top: 20px; display: flex; gap: 30px; font-family:'Inter'; font-weight:500;">
                            <span style="display: flex; align-items: center; gap: 6px;">Tendencia (7d): <strong style="color:#27ae60; font-weight:700;">▲ ${variacion7dReal.toFixed(2)}%</strong></span>
                            <span>Invertido: <strong style="color:#fff">${dias} días</strong></span>
                            <span>Proyección (30d): <strong style="color:#fff">$${(ultimo.dinero * (1 + mensualEf/100)).toLocaleString('es-AR', { maximumFractionDigits: 2 })}</strong></span>
                        </div>
                    </div>
                </div>`;
        }

        if (res.visibilidadDashboard) {
            Object.keys(res.visibilidadDashboard).forEach(id => {
                const el = document.getElementById(id);
                const cb = document.querySelector(`.toggle-vis[data-target="${id}"]`);
                if (el) el.style.display = res.visibilidadDashboard[id] ? '' : 'none';
                if (cb) cb.checked = res.visibilidadDashboard[id];
            });
        }
        
        renderizarDashboard(historialBase, true);

        const btnExp = document.getElementById('btnExportar');
        if (btnExp) btnExp.onclick = () => exportarAExcel(fondoNombre);

        const fDesde = document.getElementById('fechaDesde');
        const fHasta = document.getElementById('fechaHasta');
        if(fDesde && fHasta) {
            const filtrar = () => {
                const filtrado = historialBase.filter(h => {
                    let ok = true;
                    if (fDesde.value) ok = ok && h.fecha >= fDesde.value;
                    if (fHasta.value) ok = ok && h.fecha <= fHasta.value;
                    return ok;
                });
                renderizarDashboard(filtrado, true);
            };
            fDesde.onchange = filtrar;
            fHasta.onchange = filtrar;
            document.getElementById('resetFiltro').onclick = () => {
                fDesde.value = ''; fHasta.value = ''; renderizarDashboard(historialBase, true);
            };
        }
    });
}

const btnVis = document.getElementById('btnVisibilidad');
const menuVis = document.getElementById('menuVisibilidad');
if(btnVis) {
    btnVis.onclick = (e) => { 
        e.stopPropagation(); 
        menuVis.style.display = (menuVis.style.display === 'none' || menuVis.style.display === '') ? 'block' : 'none'; 
    };
}
document.onclick = () => { if(menuVis) menuVis.style.display = 'none'; };
if(menuVis) menuVis.onclick = (e) => e.stopPropagation();

document.querySelectorAll('.toggle-vis').forEach(cb => {
    cb.onchange = function() {
        const id = this.getAttribute('data-target');
        const el = document.getElementById(id);
        const isChecked = this.checked;

        if (el) el.style.display = isChecked ? '' : 'none';
        
        chrome.storage.sync.get(['visibilidadDashboard'], (r) => {
            let v = r.visibilidadDashboard || {};
            v[id] = this.checked;
            chrome.storage.sync.set({ visibilidadDashboard: v });
        });
    };
});

document.addEventListener('DOMContentLoaded', () => setTimeout(inicializarDashboard, 150));