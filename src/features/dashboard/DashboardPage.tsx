import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  Skeleton,
  Stat,
  Text,
} from "@chakra-ui/react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarDays,
  PackageSearch,
  ReceiptText,
  RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

import { ListaDesplazable } from "@/components/data/ListaDesplazable";
import { PageHeader, Panel, PanelHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/features/auth/auth.store";
import { mensajeDeError } from "@/features/clients/clients.service";
import {
  fechaCortaAgenda,
  horaActualAgenda,
} from "@/features/agenda/agenda.service";
import {
  formatCantidad,
  formatFecha,
  formatFechaCalendario,
  formatFechaHora,
  formatHora,
  formatMoneda,
  formatMonedaUSD,
  formatTiempoRelativo,
} from "@/lib/formato";
import {
  usePanelDashboard,
  type CajaPanel,
  type CitaPanel,
  type CitasPanel,
  type InventarioPanel,
  type LoteCritico,
  type MontoPanel,
  type ProductoBajoStock,
  type VentaPanel,
  type VentasPanel,
} from "./dashboard.service";

/**
 * Pantalla de inicio.
 *
 * Muestra lo que cambia el trabajo del día: agenda, caja, últimas facturas y
 * alertas de inventario. No repite el menú lateral ni ofrece accesos rápidos a
 * módulos que ya están a un clic en la barra de navegación.
 */
export function DashboardPage() {
  const { usuario, veterinaria, estadoSuscripcion, puede } = useAuth();
  const [timestampActual] = useState(Date.now);
  const panel = usePanelDashboard();
  const datos = panel.data;

  const hora = horaActualAgenda(timestampActual);
  const saludo =
    hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";

  // El trial sólo ocupa espacio cuando hay algo que avisar. Un plan vigente no
  // necesita una tarjeta permanente que diga que funciona.
  const mostrarTrial =
    puede("suscripcion.ver") &&
    Boolean(
      estadoSuscripcion &&
      (estadoSuscripcion.enTrial || estadoSuscripcion.enZonaDeAviso),
    );

  const hayLateral = Boolean(datos?.caja || mostrarTrial);
  const hayFilaFacturas = Boolean(datos?.ventas || datos?.inventario);
  const sinDatos = Boolean(
    datos &&
    !datos.citas &&
    !datos.caja &&
    !datos.ventas &&
    !datos.inventario &&
    !mostrarTrial,
  );

  return (
    <Box>
      <PageHeader
        titulo={`${saludo}, ${usuario?.nombre ?? ""}`}
        descripcion={
          veterinaria
            ? `${veterinaria.nombreComercial} · ${fechaCortaAgenda(timestampActual)}`
            : undefined
        }
      />

      {panel.isError && (
        <Panel mb="5">
          <Flex align="center" gap="3" p="4" wrap="wrap">
            <AlertTriangle size={20} color="var(--chakra-colors-danger-fg)" />
            <Box flex="1" minW="12rem">
              <Text fontWeight="semibold" color="ink.900" fontSize="sm">
                No se pudo cargar el inicio
              </Text>
              <Text fontSize="xs" color="ink.500" mt="0.5">
                {mensajeDeError(panel.error)}
              </Text>
            </Box>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void panel.refetch()}
            >
              <RefreshCw size={14} />
              Reintentar
            </Button>
          </Flex>
        </Panel>
      )}

      {/* ── Indicadores del día ───────────────────────────────────────── */}
      <Grid
        templateColumns={{ base: "1fr", sm: "1fr 1fr", xl: "repeat(4, 1fr)" }}
        gap="4"
        mb="5"
      >
        {panel.isPending ? (
          <EsqueletoIndicadores />
        ) : (
          <>
            {datos?.ventas && (
              <TarjetaIndicador
                icono={ReceiptText}
                etiqueta="Ventas de hoy"
                valor={valorVentasHoy(datos.ventas)}
                detalle={detalleVentasHoy(datos.ventas)}
                color="success"
              />
            )}

            {datos?.caja && (
              <TarjetaIndicador
                icono={Banknote}
                etiqueta="Caja"
                valor={
                  datos.caja.abierta
                    ? monto(datos.caja.moneda, datos.caja.esperado)
                    : "Cerrada"
                }
                detalle={
                  datos.caja.abierta
                    ? "Saldo esperado en efectivo"
                    : "Sin caja abierta"
                }
                color={datos.caja.abierta ? "success" : "warning"}
              />
            )}

            {datos?.citas && (
              <TarjetaIndicador
                icono={CalendarDays}
                etiqueta="Agenda de hoy"
                valor={String(datos.citas.total)}
                detalle={
                  datos.citas.total === 0
                    ? "Sin citas para hoy"
                    : `${datos.citas.porAtender} por atender`
                }
                color="brand"
              />
            )}

            {datos?.inventario && (
              <TarjetaIndicador
                icono={PackageSearch}
                etiqueta="Por vencer"
                valor={String(datos.inventario.porVencer)}
                detalle={`${datos.inventario.vencidos} vencidos · ${datos.inventario.bajoStock} bajo stock`}
                color={datos.inventario.vencidos > 0 ? "red" : "warning"}
              />
            )}
          </>
        )}
      </Grid>

      {panel.isPending ? (
        <EsqueletoPaneles />
      ) : (
        datos && (
          <>
            {(datos.citas || hayLateral) && (
              <Grid
                templateColumns={{
                  base: "1fr",
                  xl: datos.citas && hayLateral ? "3fr 2fr" : "1fr",
                }}
                gap="5"
                mb="5"
              >
                {datos.citas && <PanelAgenda citas={datos.citas} />}

                <Flex direction="column" gap="5">
                  {datos.caja && <PanelCaja caja={datos.caja} />}

                  {mostrarTrial && (
                    <Panel>
                      <PanelHeader
                        titulo={
                          estadoSuscripcion?.enTrial
                            ? "Tu período de prueba"
                            : "Tu plan"
                        }
                      />
                      <Box p="5">
                        <TrialResumen />
                      </Box>
                    </Panel>
                  )}
                </Flex>
              </Grid>
            )}

            {hayFilaFacturas && (
              <Grid
                templateColumns={{
                  base: "1fr",
                  xl: datos.ventas && datos.inventario ? "3fr 2fr" : "1fr",
                }}
                gap="5"
              >
                {datos.ventas && <PanelFacturas ventas={datos.ventas} />}
                {datos.inventario && (
                  <PanelInventario inventario={datos.inventario} />
                )}
              </Grid>
            )}

            {sinDatos && (
              <Panel>
                <ListaVacia
                  icono={CalendarDays}
                  titulo="No hay información para mostrar"
                  detalle="Tu rol no tiene acceso a agenda, ventas, caja ni inventario. Entrá a tus módulos desde el menú."
                />
              </Panel>
            )}
          </>
        )
      )}
    </Box>
  );
}

type Tono = "brand" | "success" | "warning" | "red";

function TarjetaIndicador({
  icono: Icono,
  etiqueta,
  valor,
  detalle,
  color = "brand",
}: {
  icono: LucideIcon;
  etiqueta: string;
  valor: string;
  detalle: string;
  color?: Tono;
}) {
  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="ink.200"
      borderRadius="xl"
      p={{ base: "4", md: "5" }}
      boxShadow="sm"
    >
      <Flex align="flex-start" justify="space-between" gap="3">
        <Stat.Root minW="0" gap="1">
          <Stat.Label fontSize="sm" color="ink.600">
            {etiqueta}
          </Stat.Label>
          <Stat.ValueText
            fontSize={{ base: "xl", md: "2xl" }}
            fontWeight="bold"
            color="ink.900"
            fontVariantNumeric="tabular-nums"
            truncate
          >
            {valor}
          </Stat.ValueText>
          <Stat.HelpText fontSize="xs" color="ink.500">
            {detalle}
          </Stat.HelpText>
        </Stat.Root>

        <Flex
          align="center"
          justify="center"
          w="10"
          h="10"
          flexShrink={0}
          borderRadius="lg"
          bg={`${color}.subtle`}
          color={`${color}.fg`}
        >
          <Icono size={20} />
        </Flex>
      </Flex>
    </Box>
  );
}

function PanelAgenda({ citas }: { citas: CitasPanel }) {
  return (
    <Panel>
      <PanelHeader
        titulo="Agenda de hoy"
        descripcion={`${citas.total} ${
          citas.total === 1 ? "cita programada" : "citas programadas"
        }`}
        acciones={
          <Link to="/agenda">
            <Button size="sm" variant="ghost" colorPalette="brand">
              Ver agenda
              <ArrowRight size={15} />
            </Button>
          </Link>
        }
      />

      <Box p="5">
        {citas.proximas.length === 0 ? (
          <ListaVacia
            icono={CalendarDays}
            titulo="Todavía no hay citas para hoy"
            detalle="Cuando agendes una cita, aparecerá aquí con la hora, el paciente y el motivo."
          />
        ) : (
          <ListaDesplazable>
            <Flex direction="column" gap="2">
              {citas.proximas.map((cita) => (
                <Flex
                  key={cita.id}
                  align="center"
                  gap="3"
                  p="3"
                  borderRadius="md"
                  bg="ink.50"
                >
                  <Text
                    fontSize="sm"
                    fontWeight="bold"
                    color="brand.fg"
                    minW="3.5rem"
                  >
                    {formatHora(cita.fechaInicio)}
                  </Text>

                  <Box minW={0} flex="1">
                    <Text fontSize="sm" fontWeight="semibold" truncate>
                      {cita.paciente.nombre} ·{" "}
                      {cita.motivoCita?.nombre ?? cita.motivo}
                    </Text>
                    <Text fontSize="xs" color="ink.500" truncate>
                      {nombreDueno(cita)}
                      {cita.veterinario &&
                        ` · ${cita.veterinario.nombre} ${cita.veterinario.apellido}`}
                    </Text>
                  </Box>

                  <Badge
                    colorPalette={tonoEstadoCita(cita.estado)}
                    variant="subtle"
                    display={{ base: "none", sm: "inline-flex" }}
                  >
                    {etiquetaEstadoCita(cita.estado)}
                  </Badge>
                </Flex>
              ))}
            </Flex>
          </ListaDesplazable>
        )}
      </Box>
    </Panel>
  );
}

function PanelCaja({ caja }: { caja: CajaPanel }) {
  return (
    <Panel>
      <PanelHeader
        titulo="Caja"
        acciones={
          <Link to="/caja">
            <Button size="sm" variant="ghost" colorPalette="brand">
              Ver caja
              <ArrowRight size={15} />
            </Button>
          </Link>
        }
      />

      <Box p="5">
        {!caja.abierta ? (
          <ListaVacia
            icono={Banknote}
            titulo="La caja está cerrada"
            detalle="Abrila para registrar cobros y egresos de hoy."
          />
        ) : (
          <Box>
            <Text fontSize="xs" color="ink.500">
              Saldo esperado en efectivo
            </Text>
            <Heading
              as="p"
              fontSize="3xl"
              fontWeight="bold"
              color="brand.700"
              lineHeight="1"
              mt="1"
              fontVariantNumeric="tabular-nums"
            >
              {monto(caja.moneda, caja.esperado)}
            </Heading>

            <Flex direction="column" gap="2" mt="4">
              <FilaMonto
                etiqueta="Apertura"
                valor={monto(caja.moneda, caja.montoInicial)}
              />
              <FilaMonto
                etiqueta="Ingresos"
                valor={`+ ${monto(caja.moneda, caja.ingresos)}`}
                color="success.fg"
              />
              <FilaMonto
                etiqueta="Egresos"
                valor={`− ${monto(caja.moneda, caja.egresos)}`}
                color="danger.fg"
              />
            </Flex>

            <Text fontSize="xs" color="ink.500" mt="4">
              Abierta {formatFechaHora(caja.fechaApertura)}
            </Text>
          </Box>
        )}
      </Box>
    </Panel>
  );
}

function PanelFacturas({ ventas }: { ventas: VentasPanel }) {
  return (
    <Panel>
      <PanelHeader
        titulo="Últimas facturas"
        descripcion={`${ventas.hoy.cantidad} ${
          ventas.hoy.cantidad === 1 ? "comprobante hoy" : "comprobantes hoy"
        }`}
        acciones={
          <Link to="/ventas">
            <Button size="sm" variant="ghost" colorPalette="brand">
              Ver ventas
              <ArrowRight size={15} />
            </Button>
          </Link>
        }
      />

      <Box p="5">
        {ventas.recientes.length === 0 ? (
          <ListaVacia
            icono={ReceiptText}
            titulo="Todavía no hay facturas"
            detalle="Las ventas que emitas aparecerán acá con su cliente, monto y estado."
          />
        ) : (
          <ListaDesplazable>
            <Flex direction="column" gap="2">
              {ventas.recientes.map((venta) => {
                const estado = estadoVenta(venta);

                return (
                  <Flex
                    key={venta.id}
                    align="center"
                    gap="3"
                    p="3"
                    borderRadius="md"
                    bg="ink.50"
                  >
                    <Box minW={0} flex="1">
                      <Text fontSize="sm" fontWeight="semibold" truncate>
                        {venta.numeroComprobante}
                      </Text>
                      <Text fontSize="xs" color="ink.500" truncate>
                        {venta.cliente?.nombreCompleto ?? "Consumidor final"} ·{" "}
                        {formatTiempoRelativo(venta.fecha)}
                      </Text>
                    </Box>

                    <Flex
                      direction="column"
                      align="flex-end"
                      gap="1"
                      flexShrink={0}
                    >
                      <Text
                        fontSize="sm"
                        fontWeight="bold"
                        color="ink.900"
                        fontVariantNumeric="tabular-nums"
                      >
                        {monto(venta.moneda, venta.total)}
                      </Text>
                      <Badge colorPalette={estado.tono} variant="subtle">
                        {estado.etiqueta}
                      </Badge>
                    </Flex>
                  </Flex>
                );
              })}
            </Flex>
          </ListaDesplazable>
        )}
      </Box>
    </Panel>
  );
}

function PanelInventario({ inventario }: { inventario: InventarioPanel }) {
  const sinAlertas =
    inventario.lotesCriticos.length === 0 &&
    inventario.productosBajoStock.length === 0;

  return (
    <Panel>
      <PanelHeader
        titulo="Inventario por vencer"
        descripcion={`${inventario.porVencer} por vencer · ${inventario.vencidos} vencidos`}
        acciones={
          <Link to="/productos">
            <Button size="sm" variant="ghost" colorPalette="brand">
              Ver productos
              <ArrowRight size={15} />
            </Button>
          </Link>
        }
      />

      <Box p="5">
        {sinAlertas ? (
          <ListaVacia
            icono={PackageSearch}
            titulo="Sin alertas de inventario"
            detalle="Acá vas a ver los lotes próximos a vencer y los productos con bajo stock."
          />
        ) : (
          <ListaDesplazable>
            <Flex direction="column" gap="3">
              {inventario.lotesCriticos.length > 0 && (
                <Flex direction="column" gap="2">
                  {inventario.lotesCriticos.map((lote) => (
                    <FilaLote key={lote.id} lote={lote} />
                  ))}
                </Flex>
              )}

              {inventario.productosBajoStock.length > 0 && (
                <Box
                  borderTopWidth={
                    inventario.lotesCriticos.length > 0 ? "1px" : "0"
                  }
                  borderColor="ink.200"
                  pt={inventario.lotesCriticos.length > 0 ? "3" : "0"}
                >
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    color="ink.600"
                    mb="2"
                  >
                    Bajo stock
                  </Text>
                  <Flex direction="column" gap="2">
                    {inventario.productosBajoStock.map((producto) => (
                      <FilaStock key={producto.id} producto={producto} />
                    ))}
                  </Flex>
                </Box>
              )}
            </Flex>
          </ListaDesplazable>
        )}
      </Box>
    </Panel>
  );
}

function FilaLote({ lote }: { lote: LoteCritico }) {
  return (
    <Flex
      align="center"
      gap="3"
      p="3"
      borderRadius="md"
      bg={lote.vencido ? "danger.subtle" : "ink.50"}
    >
      <Box minW={0} flex="1">
        <Text fontSize="sm" fontWeight="semibold" truncate>
          {lote.producto.nombre}
        </Text>
        <Text fontSize="xs" color="ink.500" truncate>
          Lote {lote.codigoLote} · {formatCantidad(lote.cantidadActual)}{" "}
          {lote.producto.unidadMedida}
        </Text>
      </Box>

      <Box textAlign="right" flexShrink={0}>
        <Text fontSize="sm" fontWeight="medium" color="ink.900">
          {formatFechaCalendario(lote.fechaVencimiento)}
        </Text>
        <Text fontSize="xs" color={colorVencimiento(lote.diasRestantes)}>
          {textoVencimiento(lote.diasRestantes)}
        </Text>
      </Box>
    </Flex>
  );
}

function FilaStock({ producto }: { producto: ProductoBajoStock }) {
  const agotado = Number(producto.stockActual) <= 0;

  return (
    <Flex align="center" gap="3">
      <Box minW={0} flex="1">
        <Text fontSize="sm" fontWeight="medium" color="ink.800" truncate>
          {producto.nombre}
        </Text>
        <Text fontSize="xs" color="ink.500" truncate>
          {producto.codigo}
        </Text>
      </Box>

      <Badge colorPalette={agotado ? "red" : "orange"} variant="subtle">
        {agotado
          ? "Agotado"
          : `${formatCantidad(producto.stockActual)} / ${formatCantidad(producto.stockMinimo)} ${producto.unidadMedida}`}
      </Badge>
    </Flex>
  );
}

function FilaMonto({
  etiqueta,
  valor,
  color = "ink.900",
}: {
  etiqueta: string;
  valor: string;
  color?: string;
}) {
  return (
    <Flex align="center" justify="space-between" gap="3">
      <Text fontSize="xs" color="ink.500">
        {etiqueta}
      </Text>
      <Text
        fontSize="sm"
        fontWeight="medium"
        color={color}
        fontVariantNumeric="tabular-nums"
      >
        {valor}
      </Text>
    </Flex>
  );
}

function EsqueletoIndicadores() {
  return (
    <>
      {Array.from({ length: 4 }, (_, indice) => (
        <Skeleton key={indice} h="7.5rem" borderRadius="xl" />
      ))}
    </>
  );
}

function EsqueletoPaneles() {
  return (
    <Grid templateColumns={{ base: "1fr", xl: "3fr 2fr" }} gap="5" mb="5">
      <Skeleton h="22rem" borderRadius="lg" />
      <Skeleton h="22rem" borderRadius="lg" />
    </Grid>
  );
}

function monto(moneda: string, valor: MontoPanel | null | undefined): string {
  return moneda === "USD" ? formatMonedaUSD(valor) : formatMoneda(valor);
}

function valorVentasHoy(ventas: VentasPanel): string {
  const principal =
    ventas.hoy.totales.find((total) => total.moneda === "PYG") ??
    ventas.hoy.totales[0];

  return principal ? monto(principal.moneda, principal.total) : formatMoneda(0);
}

function detalleVentasHoy(ventas: VentasPanel): string {
  const cantidad = ventas.hoy.cantidad;
  const comprobantes = `${cantidad} ${
    cantidad === 1 ? "comprobante" : "comprobantes"
  } hoy`;
  const dolares = ventas.hoy.totales.find((total) => total.moneda === "USD");

  return dolares
    ? `${comprobantes} · ${formatMonedaUSD(dolares.total)}`
    : comprobantes;
}

function nombreDueno(cita: CitaPanel): string {
  const cliente = cita.paciente.cliente;

  if (!cliente) return "Sin cliente";

  return (
    cliente.razonSocial ??
    (`${cliente.nombres ?? ""} ${cliente.apellidos ?? ""}`.trim() ||
      "Sin cliente")
  );
}

function etiquetaEstadoCita(estado: CitaPanel["estado"]): string {
  if (estado === "en_curso") return "En curso";
  if (estado === "no_asistio") return "No asistió";
  return estado.charAt(0).toUpperCase() + estado.slice(1);
}

function tonoEstadoCita(
  estado: CitaPanel["estado"],
): "success" | "warning" | "info" | "gray" | "red" {
  if (estado === "confirmada") return "success";
  if (estado === "pendiente") return "warning";
  if (estado === "en_curso") return "info";
  if (estado === "atendida") return "success";
  if (estado === "no_asistio") return "red";
  return "gray";
}

function estadoVenta(venta: VentaPanel): {
  etiqueta: string;
  tono: "success" | "warning" | "red";
} {
  if (venta.anulada || venta.estado === "ANULADA") {
    return { etiqueta: "Anulada", tono: "red" };
  }
  if (venta.estado === "PENDIENTE") {
    return { etiqueta: "Pendiente", tono: "warning" };
  }
  return { etiqueta: "Activa", tono: "success" };
}

function textoVencimiento(dias: number): string {
  if (dias < 0) {
    const diasVencido = Math.abs(dias);
    return `Vencido hace ${diasVencido} ${diasVencido === 1 ? "día" : "días"}`;
  }
  if (dias === 0) return "Vence hoy";
  return `Vence en ${dias} ${dias === 1 ? "día" : "días"}`;
}

function colorVencimiento(dias: number): string {
  if (dias < 0) return "danger.fg";
  if (dias <= 7) return "warning.fg";
  return "ink.500";
}

function TrialResumen() {
  const { estadoSuscripcion } = useAuth();

  if (!estadoSuscripcion) return null;

  const { enTrial, diasRestantes, plan, venceEn, enZonaDeAviso } =
    estadoSuscripcion;

  if (!enTrial) {
    return (
      <Box>
        <Text fontSize="sm" color="ink.600" lineHeight="1.6">
          Tu plan está activo. Volveremos a avisarte antes de que venza.
        </Text>

        <Flex
          align="center"
          justify="space-between"
          mt="4"
          pt="4"
          borderTopWidth="1px"
          borderColor="ink.200"
        >
          <Text fontSize="xs" color="ink.500">
            Plan
          </Text>
          <Text
            fontSize="sm"
            fontWeight="semibold"
            color="ink.900"
            style={{ textTransform: "capitalize" }}
          >
            {plan}
          </Text>
        </Flex>

        <Flex align="center" justify="space-between" mt="2">
          <Text fontSize="xs" color="ink.500">
            Vence
          </Text>
          <Text fontSize="sm" fontWeight="medium" color="ink.800">
            {venceEn ? formatFecha(venceEn) : "Sin vencimiento"}
          </Text>
        </Flex>
      </Box>
    );
  }

  // No se dibuja una barra de progreso porque el frontend no conoce la
  // duración total del trial: el SuperAdmin puede haber cambiado ese valor
  // entre el registro de esta clínica y hoy. Inventar un porcentaje sería
  // mostrar un dato falso.
  return (
    <Box>
      <Flex align="baseline" gap="2">
        <Heading
          as="span"
          fontSize="4xl"
          fontWeight="bold"
          color={enZonaDeAviso ? "warning.600" : "brand.700"}
          lineHeight="1"
        >
          {diasRestantes ?? 0}
        </Heading>
        <Text fontSize="sm" color="ink.600">
          {diasRestantes === 1 ? "día restante" : "días restantes"}
        </Text>
      </Flex>

      <Text fontSize="xs" color="ink.500" mt="1.5">
        El período de prueba termina el {venceEn ? formatFecha(venceEn) : "—"}.
      </Text>

      {enZonaDeAviso && (
        <Box
          mt="4"
          px="3"
          py="2.5"
          bg="warning.subtle"
          borderRadius="md"
          borderLeftWidth="3px"
          borderColor="warning.500"
        >
          <Text
            fontSize="xs"
            color="warning.fg"
            lineHeight="1.6"
            fontWeight="medium"
          >
            Activá un plan antes de que termine para no perder el acceso.
          </Text>
        </Box>
      )}

      <Text fontSize="xs" color="ink.600" lineHeight="1.6" mt="4">
        Todo lo que cargues ahora queda guardado: al activar un plan no tenés
        que volver a cargarlo.
      </Text>

      <Link to="/suscripcion">
        <Button size="sm" colorPalette="brand" variant="solid" w="full" mt="4">
          Conocer planes
        </Button>
      </Link>
    </Box>
  );
}

function ListaVacia({
  icono: Icono,
  titulo,
  detalle,
}: {
  icono: LucideIcon;
  titulo: string;
  detalle: string;
}) {
  return (
    <Flex direction="column" align="center" textAlign="center" py="8">
      <Flex
        align="center"
        justify="center"
        w="12"
        h="12"
        borderRadius="full"
        bg="ink.100"
        color="ink.400"
        mb="3"
      >
        <Icono size={22} />
      </Flex>

      <Text fontWeight="semibold" color="ink.800" fontSize="sm">
        {titulo}
      </Text>
      <Text fontSize="xs" color="ink.500" mt="1" maxW="22rem" lineHeight="1.6">
        {detalle}
      </Text>
    </Flex>
  );
}
