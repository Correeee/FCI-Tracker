// 1. Función de dibujo (Vital para los colores)
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
chrome.alarms.create("checkFCI", { periodInMinutes: 30 });
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

// 4. Lógica principal corregida (Sincronizada con la ruta del Popup)
async function checkUpdates(esTest = false) {
  const res = await chrome.storage.sync.get(['monto', 'fondoNombre', 'ultimaFechaNotificada', 'tipo']);
  if (!res.fondoNombre || !res.monto) {
      console.warn("⚠️ Falta fondo o monto en storage");
      return;
  }

  try {
    // CORRECCIÓN: Forzamos rentaFija si no hay tipo, igual que en el popup
    let tipo = res.tipo || 'rentaFija';
    
    let cotizacionOficial = 1390; 

    // Bloque independiente para el Dólar
    try {
        const dolarRes = await fetch(`https://dolarapi.com/v1/dolares/oficial`);
        if (dolarRes.ok) {
            const dolarData = await dolarRes.json();
            cotizacionOficial = dolarData.venta;
            console.log("✅ Dólar actualizado:", cotizacionOficial);
        }
    } catch (e) {
        console.warn("⚠️ Falló API Dólar, usando fallback.");
    }

    // Fetch del FCI - Usando la ruta CamelCase que confirmaste que funciona
    console.log(`📡 Consultando FCI: ${tipo}...`);
    const urlFCI = `https://api.argentinadatos.com/v1/finanzas/fci/${tipo}/ultimo?t=${Date.now()}`;
    const fciRes = await fetch(urlFCI);
    
    if (!fciRes.ok) {
        throw new Error(`Error API FCI: ${fciRes.status} en ruta ${tipo}`);
    }

    const data = await fciRes.json();
    
    // Buscador flexible para encontrar tu fondo
    const miFondo = data.find(f => f.fondo.toUpperCase().includes(res.fondoNombre.toUpperCase()));
    
    const hoy = new Date().toISOString().split('T')[0];

    if (miFondo) {
      console.log("🎯 Fondo encontrado:", miFondo.fondo, "VCP:", miFondo.vcp);

      if (esTest || (miFondo.fecha === hoy && res.ultimaFechaNotificada !== hoy)) {
        const variacion = miFondo.variacion || 0;
        const montoInv = parseFloat(res.monto);
        const ganancia = (montoInv * variacion) / 100;
        const saldoFinal = montoInv + ganancia;
        
        const esPositivo = variacion >= 0;
        const color = esPositivo ? "#27ae60" : "#e74c3c";
        const icon = await generarIconoColor(color);

        const saldoUSD = saldoFinal / cotizacionOficial;

        chrome.notifications.create({
          type: 'basic',
          iconUrl: icon,
          title: `${esPositivo ? '🟢' : '🔴'} Saldo: $${saldoFinal.toLocaleString('es-AR', {minimumFractionDigits: 2})}`,
          message: `Rendimiento: ${esPositivo ? '+' : ''}${variacion.toFixed(2)}% (+$${ganancia.toLocaleString('es-AR', {minimumFractionDigits: 2})})\nEquivalente: u$s ${saldoUSD.toLocaleString('en-US', {minimumFractionDigits: 2})}`,
          priority: 2
        });

        chrome.action.setBadgeText({ text: "!" });
        chrome.action.setBadgeBackgroundColor({ color: color });
        
        if (!esTest) chrome.storage.sync.set({ ultimaFechaNotificada: hoy });
      } else {
          console.log("ℹ️ No hay actualización de fecha o ya fue notificado hoy.");
      }
    } else {
        console.warn("⚠️ No se encontró el fondo:", res.fondoNombre);
    }
  } catch (e) { 
      console.error("❌ Error crítico en background:", e.message); 
  }
}


/* TEST: Este comando sobreescribe el valor mal guardado por el correcto
chrome.storage.sync.set({ tipo: 'rentaFija' }, () => {
    console.log("✅ Valor de 'tipo' corregido a rentaFija en el Storage.");
    // Ahora ejecutamos el test de nuevo
    checkUpdates(true);
}); */