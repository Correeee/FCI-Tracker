// 1. Función de dibujo (Sin cambios)
async function generarIconoColor(color) {
  const canvas = new OffscreenCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(64, 64, 60, 0, 2 * Math.PI); ctx.fill();
  ctx.strokeStyle = "white"; ctx.lineWidth = 10; ctx.beginPath();
  if (color === "#27ae60") { ctx.moveTo(34, 74); ctx.lineTo(64, 44); ctx.lineTo(94, 74); }
  else { ctx.moveTo(34, 54); ctx.lineTo(64, 84); ctx.lineTo(94, 54); }
  ctx.stroke();
  const blob = await canvas.convertToBlob();
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// 2. Alarmas
chrome.alarms.create("checkFCI", { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkFCI") checkUpdates();
});

// 3. Escuchador de mensajes
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "testNotif") {
    checkUpdates(true).then(() => {
      sendResponse({ status: "Notificación enviada" });
    }).catch(err => {
      sendResponse({ status: "Error: " + err.message });
    });
    return true; 
  }
});

// 4. Lógica principal consultando MEMORIA (storage)
async function checkUpdates(esTest = false) {
  // Traemos el historial guardado por la extensión
  const res = await chrome.storage.sync.get(['fondoNombre', 'ultimaFechaNotificada', 'cuotas', 'historial']);
  
  if (!res.fondoNombre || !res.cuotas || !res.historial || res.historial.length === 0) {
      console.warn("⚠️ No hay datos suficientes en la memoria de la extensión");
      return;
  }

  try {
    let cotizacionOficial = 1425; 

    // Intentar actualizar Dólar para la conversión
    try {
        const dolarRes = await fetch(`https://dolarapi.com/v1/dolares/oficial`);
        if (dolarRes.ok) {
            const dolarData = await dolarRes.json();
            cotizacionOficial = dolarData.venta;
        }
    } catch (e) { console.warn("Usando dólar fallback"); }

    // El historial ya viene ordenado por el popup, pero nos aseguramos el más reciente primero
    const historial = res.historial.reverse();

    // BUSQUEDA EN MEMORIA: Buscamos el último registro con variación != 0
    const registroConRendimiento = historial.find(f => f.variacion !== 0) || historial[0];
    
    // El saldo lo calculamos siempre con el VCP más nuevo que tengamos en memoria
    const ultimoVCP = historial[0].vcp;
    const fechaUltima = registroConRendimiento.fecha;
    const variacion = registroConRendimiento.variacion;
    
    const misCuotas = parseFloat(res.cuotas);
    const saldoActual = misCuotas * ultimoVCP;
    
    // Calculamos ganancia basada en ese rendimiento encontrado
    const gananciaPesos = (saldoActual * variacion) / 100;
    
    const esPositivo = variacion >= 0;
    const color = esPositivo ? "#27ae60" : "#e74c3c";
    const icon = await generarIconoColor(color);
    const saldoUSD = saldoActual / cotizacionOficial;

    // Solo notificar si es Test o si el cierre es nuevo
    if (esTest || (fechaUltima !== res.ultimaFechaNotificada)) {
      
      chrome.notifications.create("fci_memoria_" + fechaUltima, {
        type: 'basic',
        iconUrl: icon,
        title: `Saldo: $${saldoActual.toLocaleString('es-AR', {minimumFractionDigits: 2})}`,
        message: `Cierre: ${fechaUltima.split('-').reverse().join('/')}\nRendimiento: ${esPositivo ? '▲' : '▼'} ${variacion.toFixed(2)}% (+$${gananciaPesos.toLocaleString('es-AR', {minimumFractionDigits: 2})})\nUSD: u$s ${saldoUSD.toLocaleString('en-US', {minimumFractionDigits: 2})}`,
        priority: 2
      });

      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: color });
      
      if (!esTest) chrome.storage.sync.set({ ultimaFechaNotificada: fechaUltima });
    }
  } catch (e) { 
      console.error("❌ Error en checkUpdates:", e.message); 
  }
}