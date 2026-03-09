let fondosData = [];
let fondoSeleccionadoObj = null;
let bloqueado = false;
let saldoOculto = false;

// 1. CONFIGURACIÓN INICIAL
const INVERSION_INICIAL_PESOS = 1802902.48;
let CUOTAPARTES_TOTALES = 50.188484;

chrome.action.setBadgeText({ text: "" });

async function obtenerDolarOficial() {
    console.log("🔍 [1] Llamando API Dólar...");
    try {
        const response = await fetch('https://dolarapi.com/v1/dolares/oficial');
        const data = await response.json();
        console.log("💵 [1] Dólar obtenido:", data.venta);
        return data.venta;
    } catch (e) {
        console.warn("⚠️ [1] Error Dólar, usando fallback 1390");
        return 1390;
    }
}

// Función para formatear montos con máximo 2 decimales
function f(monto, ocultar = false) {
    return ocultar ? "******" : monto.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

async function renderizarDesdeStorage() {
    console.log("📦 [2] Leyendo Storage...");
    const res = await new Promise(r => chrome.storage.sync.get(['monto', 'usuario', 'historial', 'cuotas', 'saldoOculto'], r));

    if (res.cuotas) {
        CUOTAPARTES_TOTALES = parseFloat(res.cuotas);
    }
    saldoOculto = res.saldoOculto || false;

    const content = document.getElementById('content');
    const precioDolar = await obtenerDolarOficial();

    if (res.historial && res.historial.length > 0) {
        const historial = res.historial;
        const ultimo = historial[historial.length - 1];
        const vcpActual = ultimo.vcp;
        const saldoActual = CUOTAPARTES_TOTALES * vcpActual;

        // --- CÁLCULO DE CAPITAL VIVO PARA GANANCIA TOTAL ---
        let capitalVivo = INVERSION_INICIAL_PESOS;
        historial.forEach(h => {
            if (h.nota && (h.nota.includes("Suscripción") || h.nota.includes("Rescate") || h.nota.includes("(+)") || h.nota.includes("(-)"))) {
                capitalVivo += (h.ganancia || 0);
            }
        });
        
        const gananciaTotalPesos = saldoActual - capitalVivo;

        // Sincronizar inputs con 2 decimales
        document.getElementById('miInversion').value = saldoActual.toFixed(2);
        document.getElementById('valVCP').textContent = vcpActual.toFixed(2);
        document.getElementById('fechaVCP').textContent = ultimo.fecha.split('-').reverse().join('/');

        // CÁLCULO TASAS PROMEDIO (7 DÍAS)
        const registrosValidos = historial.filter(h => h.variacion !== undefined && !h.nota?.includes("(+)") && !h.nota?.includes("(-)"));
        const ultimos7 = registrosValidos.slice(-7);
        const promedioDiario = ultimos7.reduce((acc, curr) => acc + curr.variacion, 0) / (ultimos7.length || 1);

        const diariaDecimal = promedioDiario / 100;
        const tna = diariaDecimal * 365 * 100;
        const tea = (Math.pow(1 + diariaDecimal, 365) - 1) * 100;

        const posTotal = gananciaTotalPesos >= 0;
        const varDiaria = ultimo.variacion || 0;

        content.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 15px;">
                <div class="balance">$${f(saldoActual, saldoOculto)}</div>
                <span id="btnOjo" style="cursor:pointer; font-size: 20px; opacity: 0.6;">${saldoOculto ? '👁️‍🗨️' : '👁️'}</span>
            </div>
            <div style="margin-bottom: 15px; font-size: 12px; color: var(--text-sub); line-height: 1.6; border-top: 1px solid #f0f0f0; padding-top: 15px; font-family:'Inter'">
                <div style="display: flex; justify-content: space-between;">Capital Inicial: <strong style="font-family:'Inter'">$${f(INVERSION_INICIAL_PESOS, saldoOculto)}</strong></div>
                <div style="display: flex; justify-content: space-between;">Cuotas totales: <strong style="font-family:'Inter'">${CUOTAPARTES_TOTALES.toFixed(2)}</strong></div>
                <div style="display: flex; justify-content: space-between; margin-top: 4px;">Ganancia Total: 
                    <span style="color:${posTotal ? 'var(--positive)' : 'var(--negative)'}; font-weight:800; font-family:'Inter'">
                        ${posTotal ? '+' : '-'} $${f(Math.abs(gananciaTotalPesos), saldoOculto)} 
                    </span>
                </div>
                <div style="margin-top: 10px; border-top: 1px dashed #eee; padding-top: 10px; color: var(--text-main); font-weight: 600; text-align: center;">
                    Promedio (7d): <span style="color:var(--positive)">TNA ${tna.toFixed(1)}%</span> | <span style="color:#0984e3">TEA ${tea.toFixed(1)}%</span>
                </div>
            </div>
            <div style="color:${varDiaria >= 0 ? 'var(--positive)' : 'var(--negative)'}; font-weight:800; background: ${varDiaria >= 0 ? '#eafff2' : '#fff0f0'}; padding: 6px 16px; border-radius: 10px; display: inline-block; font-size: 13px; font-family:'Inter'">
                Hoy: ${varDiaria >= 0 ? '▲' : '▼'} ${Math.abs(varDiaria).toFixed(2)}%
            </div>
        `;

        document.getElementById('btnOjo').onclick = () => {
            saldoOculto = !saldoOculto;
            chrome.storage.sync.set({ saldoOculto: saldoOculto }, () => renderizarDesdeStorage());
        };

        const usdContent = document.getElementById('usdContent');
        if (usdContent) {
            usdContent.style.display = 'block';
            document.getElementById('valUSD').textContent = `u$s ${f((saldoActual / precioDolar), saldoOculto)}`;
            document.getElementById('cotizacionMEP').textContent = `Dólar Oficial: $${precioDolar.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
        }
    } else {
        console.warn("ℹ️ [2] El historial está vacío.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 [3] Popup Iniciado");
    const miInversion = document.getElementById('miInversion');
    const nombreUsuarioInput = document.getElementById('nombreUsuario');
    const btnGuardar = document.getElementById('btnGuardar');
    const displayFondo = document.getElementById('fondoElegidoDisplay');

    chrome.storage.sync.get(['monto', 'tipo', 'fondoNombre', 'isLocked', 'usuario', 'cuotas', 'historial'], (res) => {
        if (res.usuario) nombreUsuarioInput.value = res.usuario;
        if (res.cuotas) CUOTAPARTES_TOTALES = parseFloat(res.cuotas);
        if (res.fondoNombre) {
            displayFondo.textContent = res.fondoNombre;
            displayFondo.style.display = 'block';
        }
        if (res.isLocked) {
            bloqueado = true;
            miInversion.readOnly = true;
            nombreUsuarioInput.readOnly = true;
            btnGuardar.textContent = "Editar";
        }
        renderizarDesdeStorage();
        cargarFondos(res.tipo || 'rentaFija', res.fondoNombre);
    });

    btnGuardar.onclick = () => {
        if (!displayFondo.textContent) return alert("❌ Selecciona un fondo");
        bloqueado = !bloqueado;
        miInversion.readOnly = bloqueado;
        nombreUsuarioInput.readOnly = bloqueado;
        btnGuardar.textContent = bloqueado ? "Editar" : "Guardar";
        chrome.storage.sync.set({
            monto: miInversion.value,
            usuario: nombreUsuarioInput.value,
            isLocked: bloqueado,
            cuotas: CUOTAPARTES_TOTALES
        }, () => { if (bloqueado) renderizarDesdeStorage(); });
    };

    document.getElementById('btnAgregarDinero').onclick = () => {
        const sec = document.getElementById('sectionAporte');
        sec.style.display = sec.style.display === 'block' ? 'none' : 'block';
    };

    document.getElementById('btnConfirmarAporte').onclick = () => {
        const montoMov = parseFloat(document.getElementById('inputNuevoAporte').value);
        const vcp = parseFloat(document.getElementById('valVCP').textContent);
        if (!montoMov || isNaN(vcp)) return alert("Monto o VCP inválido");

        const operacion = document.querySelector('input[name="tipoMov"]:checked').value;
        const cuotasMov = montoMov / vcp;
        CUOTAPARTES_TOTALES += (operacion === 'sumar' ? 1 : -1) * cuotasMov;

        chrome.storage.sync.get(['historial'], (res) => {
            let historial = res.historial || [];
            historial.push({
                fecha: new Date().toISOString().split('T')[0],
                vcp: vcp,
                dinero: CUOTAPARTES_TOTALES * vcp,
                ganancia: (operacion === 'sumar' ? montoMov : -montoMov),
                variacion: 0,
                nota: operacion === 'sumar' ? "Suscripción (+)" : "Rescate (-)"
            });
            chrome.storage.sync.set({ cuotas: CUOTAPARTES_TOTALES, historial: historial }, () => {
                document.getElementById('inputNuevoAporte').value = "";
                document.getElementById('sectionAporte').style.display = 'none';
                renderizarDesdeStorage();
            });
        });
    };

    document.getElementById('buscador').oninput = (e) => {
        const term = e.target.value.toUpperCase();
        const lista = document.getElementById('listaFondos');
        const filtrados = fondosData.filter(f => f.fondo.toUpperCase().includes(term));
        lista.innerHTML = '';
        if (filtrados.length && e.target.value) {
            lista.style.display = 'block';
            filtrados.slice(0, 5).forEach(f => {
                const div = document.createElement('div');
                div.className = 'fondo-item'; div.textContent = f.fondo;
                div.onclick = () => {
                    fondoSeleccionadoObj = f;
                    displayFondo.textContent = f.fondo;
                    displayFondo.style.display = 'block';
                    lista.style.display = 'none';
                    chrome.storage.sync.set({ fondoNombre: f.fondo });
                    renderizarDesdeStorage();
                };
                lista.appendChild(div);
            });
        } else lista.style.display = 'none';
    };

    document.getElementById('btnReset').onclick = () => { if (confirm("⚠️ ¿Resetear?")) chrome.storage.sync.clear(() => location.reload()); };
    document.getElementById('btnRecargar').onclick = () => location.reload();
    document.getElementById('btnVerMas').onclick = () => chrome.tabs.create({ url: 'dashboard.html' });
});

async function cargarFondos(tipo, preseleccionado = null) {
    try {
        const url = `https://api.argentinadatos.com/v1/finanzas/fci/rentaFija/ultimo?t=${Date.now()}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Error en API FCI: " + response.status);
        fondosData = await response.json();

        const miFondoApi = fondosData.find(f =>
            f.fondo.toUpperCase().includes("SBS") &&
            f.fondo.toUpperCase().includes("RENTA FIJA")
        );

        if (miFondoApi) {
            chrome.storage.sync.get(['historial'], (res) => {
                let historial = res.historial || [];
                const ultimoRegistro = historial[historial.length - 1];

                if (!ultimoRegistro || ultimoRegistro.fecha !== miFondoApi.fecha) {
                    let variacion = 0;
                    if (ultimoRegistro) {
                        variacion = ((miFondoApi.vcp - ultimoRegistro.vcp) / ultimoRegistro.vcp) * 100;
                    }

                    historial.push({
                        fecha: miFondoApi.fecha,
                        vcp: miFondoApi.vcp,
                        dinero: CUOTAPARTES_TOTALES * miFondoApi.vcp,
                        variacion: variacion,
                        nota: "Actualización automática"
                    });

                    chrome.storage.sync.set({ historial: historial }, () => {
                        renderizarDesdeStorage();
                    });
                }
            });
        }
    } catch (e) { console.error("❌ [6] Error API FCI:", e.message); }
}