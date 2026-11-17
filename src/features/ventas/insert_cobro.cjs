const fs = require('fs');
let c = fs.readFileSync('C:\\Desarrollo\\vet_sirio\\front\\src\\features\\ventas\\VentaForm.tsx','utf8');

// Insert the cobro area just before </chakra.form>
// Position found: 87260
const cierreIdx = c.lastIndexOf('</chakra.form>');
console.log('Position of </chakra.form>:', cierreIdx);

if (cierreIdx >= 0) {
  const area = '\n      {/* Area de cobro */}\n      <Grid templateColumns={{ base: "1fr", lg: "1.2fr 0.8fr 1fr" }} gap="4" alignItems="start">\n        <Stack gap="2.5">\n          <Box>\n            <Flex align="center" justify="space-between" mb="1">\n              <Text fontSize="xs" fontWeight="medium" color="ink.800">\n                Cobro\n              </Text>\n            </Flex>\n            <Flex gap="1" align="flex-start" minW="0">\n              <NativeSelect.Root size="sm" onChange={(e) => setPagoMetodo(e.target.value as MetodoPagoVenta)}>\n                <NativeSelect.Field mr="1" disabled>\n                  <option value="">Medio de pago</option>\n                </NativeSelect.Field>\n                <NativeSelect.Indicator />\n                <option value="efectivo">Efectivo</option>\n                <option value="tarjeta_debito">Tarjeta debito</option>\n                <option value="tarjeta_credito">Tarjeta credito</option>\n                <option value="transferencia">Transferencia</option>\n                <option value="giro">Giro</option>\n              </NativeSelect.Root>\n              <Input\n                size="sm"\n                type="number"\n                min="0"\n                step="0.01"\n                value={pagoMonto}\n                onChange={(evento) => setPagoMonto(evento.target.value)}\n                placeholder="0"\n                mr="1"\n              />\n              <Input\n                size="sm"\n                type="text"\n                value={pagoReferencia ?? ""}\n                onChange={(evento) => setPagoReferencia(evento.target.value || undefined)}\n                placeholder="Referencia / N\\u00f6 approbaci\\u00f3"\n                mr="1"\n                w="3"\n              />\n              <Button\n                size="sm"\n                mr="1"\n                onClick={registrarPagoHandler}\n                loading={subiendoPago}\n                colorPalette="brand">\n                {subiendoPago ? "Registrando..." : "Registrar pago"}\n              </Button>\n            </Flex>\n            {pagoRealizado && (\n              <Flex align="center" gap="1" mt="1" color="green.600" fontSize="xs">\n                Pago de ${formatearMonto(moneda, pagoRealizado.monto)} — Saldo: ${formatearMonto(moneda, pagoRealizado.saldo)}\n              </Flex>\n            )}\n          </Box>\n        </Stack>\n      </Grid>\n';
  
  const antes = c.substring(0, cierreIdx);
  const despues = c.substring(cierreIdx);
  c = antes + area + despues;
  fs.writeFileSync('C:\\Desarrollo\\vet_sirio\\front\\src\\features\\ventas\\VentaForm.tsx', c);
  console.log('Insercion completada, nueva longitud:', c.length);
} else {
  console.log('No se encontro </chakra.form>');
}