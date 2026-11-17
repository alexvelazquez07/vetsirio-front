const fs = require('fs');
let c = fs.readFileSync('C:\\Desarrollo\\vet_sirio\\front\\src\\features\\ventas\\VentaForm.tsx','utf8');

// Check various patterns
const checks = {
  'pagoMetodo state': c.includes('const [pagoMetodo'),
  'pagoMonto state': c.includes('const [pagoMonto'),
  'pagoReferencia state': c.includes('const [pagoReferencia'),
  'subiendoPago state': c.includes('const [subiendoPago'),
  'pagoRealizado state': c.includes('pagoRealizado'),
  'cobro area comment': c.includes('/* Area de cobro */') || c.includes('/* Área de cobro */'),
  'Grid with 3 cols': c.includes('1.2fr 0.8fr 1fr'),
  'registrarPagoHandler': c.includes('registrarPagoHandler'),
  'pagoMetodo && pagoMonto': c.includes('pagoMetodo && pagoMonto'),
  'useRegistrarPagoVenta': c.includes('useRegistrarPagoVenta'),
  'onGuardar pagos': c.includes('pagos: [{ metodo')
};

for (const [name, result] of Object.entries(checks)) {
  console.log(name + ':', result ? 'YES' : 'NO');
}

// Show the last part of the file (after the Grid sticky)
console.log('\n--- Últimas 200 chars ---');
console.log(c.slice(-200));

// Show the onGuardar function area
console.log('\n--- onGuardar with pagos ---');
const idx = c.indexOf('pagoMetodo && pagoMonto');
if (idx >= 0) {
  console.log(c.substring(idx, idx + 120));
}