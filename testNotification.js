// Script para disparar notificación de prueba en la extensión
chrome.runtime.sendMessage({ action: "testNotif" });

// Instrucciones:
// 1. Abrí la consola de fondo de la extensión (background.js) en Chrome.
// 2. Pegá este código y ejecutalo.
// 3. Deberías ver la notificación de prueba.

// Si la notificación aparece, la funcionalidad está OK.
