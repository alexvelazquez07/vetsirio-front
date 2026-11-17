const fs = require('fs');
let c = fs.readFileSync('C:\\Desarrollo\\vet_sirio\\front\\src\\features\\ventas\\VentaForm.tsx','utf8');

// Find 'const registrarPago = useRegistrarPagoVenta();' and add the handler after it
const target = '  const registrarPago = useRegistrarPagoVenta();';
const handler = '  const registrarPagoHandler = () => {\n    if (!pagoMetodo || !pagoMonto) return;\n    setSubiendoPago(true);\n    registrarPago.mutate({\n      id: ventaInicial?.id ?? 0,\n      pago: { metodo: pagoMetodo, monto: aNumero(pagoMonto), referencia: pagoReferencia },\n    });\n  };';

if (c.includes(target)) {
  c = c.replace(target, target + handler);
  console.log('Added registrarPagoHandler');
} else {
  console.log('Target not found');
}

// Write the file
fs.writeFileSync('C:\\Desarrollo\\vet_sirio\\front\\src\\features\\ventas\\VentaForm.tsx', c);
console.log('File updated, length:', c.length);