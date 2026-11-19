import {
  Avatar,
  Badge,
  Box,
  Flex,
  Grid,
  Skeleton,
  Tabs,
  Text,
  chakra,
} from "@chakra-ui/react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  HeartPulse,
  Mail,
  MapPin,
  MessageCircle,
  PawPrint,
  Phone,
  Scissors,
  ShieldCheck,
  Stethoscope,
  Syringe,
  UserRound,
  Weight,
} from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { urlFotoPaciente, usePacienteFicha } from "./patients.service";
import {
  formatCantidad,
  formatFecha,
  formatFechaCalendario,
  formatFechaHora,
  formatMoneda,
  formatTelefono,
  soloDigitos,
} from "@/lib/formato";
import type {
  ClienteResumen,
  FichaCita,
  FichaConsulta,
  FichaPaciente as DatosFichaPaciente,
  FichaTratamiento,
  FichaVacunacion,
  PacienteFicha,
} from "@/types/dominio";
import { mensajeDeError } from "@/features/clients/clients.service";

/**
 * Ficha 360 de una mascota.
 *
 * Se abre desde el buscador global, encima de la pantalla actual, sin navegar.
 * El objetivo es que quien atiende vea en segundos quién es el paciente, a
 * quién llamar y qué le pasó la última vez, sin recorrer cinco módulos.
 *
 * La información se agrupa en pestañas porque una sola columna con todo el
 * historial sería una pared de texto. El resumen queda siempre primero: foto,
 * alertas y números clave; el detalle clínico vive en las pestañas.
 */

interface Props {
  pacienteId: number;
  onVolver: () => void;
}

const TAMANO_AVATAR = { base: "xl", md: "2xl" } as const;

export function FichaPaciente({ pacienteId, onVolver }: Props) {
  const consulta = usePacienteFicha(pacienteId);

  if (consulta.isLoading) {
    return <FichaCargando onVolver={onVolver} />;
  }

  if (consulta.isError || !consulta.data) {
    return (
      <Flex direction="column" h="full" bg="ink.50">
        <CabeceraVolver onVolver={onVolver} />
        <Box p="6">
          <Alert status="error" title="No pudimos abrir la ficha">
            {mensajeDeError(consulta.error)}
          </Alert>
        </Box>
      </Flex>
    );
  }

  return (
    <FichaContenido datos={consulta.data} onVolver={onVolver} />
  );
}

function FichaContenido({
  datos,
  onVolver,
}: {
  datos: DatosFichaPaciente;
  onVolver: () => void;
}) {
  const { paciente, resumen } = datos;
  const foto = urlFotoPaciente(paciente.fotoUrl);
  const responsable = paciente.cliente;
  const edad = edadPaciente(paciente);
  const whatsapp = whatsappUrl(responsable?.whatsapp ?? responsable?.telefono);

  return (
    <Flex
      direction="column"
      h="full"
      bg="ink.50"
      animation="vetsirio-ficha 240ms cubic-bezier(0.16, 1, 0.3, 1)"
    >
      <Box
        position="relative"
        flexShrink={0}
        px={{ base: "4", md: "7" }}
        pt={{ base: "4", md: "5" }}
        pb={{ base: "5", md: "6" }}
        color="white"
        overflow="hidden"
        bg="linear-gradient(135deg, var(--chakra-colors-brand-700) 0%, var(--chakra-colors-brand-500) 52%, var(--chakra-colors-info-600) 100%)"
      >
        <DecoracionCabecera />

        <Flex position="relative" align="center" gap="2" mb={{ base: "4", md: "5" }}>
          <BotonBlanco onClick={onVolver} etiqueta="Volver al buscador">
            <ArrowLeft size={18} />
          </BotonBlanco>

          <Text fontSize="sm" fontWeight="medium" opacity={0.82}>
            Ficha del paciente
          </Text>

          <Badge
            ml="auto"
            colorPalette={paciente.activo ? "success" : "gray"}
            variant="solid"
            size="sm"
          >
            {paciente.activo ? "Activo" : "Inactivo"}
          </Badge>
        </Flex>

        <Flex
          position="relative"
          direction={{ base: "column", sm: "row" }}
          align={{ base: "flex-start", sm: "center" }}
          gap={{ base: "4", md: "5" }}
        >
          <Avatar.Root
            size={TAMANO_AVATAR}
            colorPalette="brand"
            borderWidth="4px"
            borderColor="whiteAlpha.700"
            boxShadow="0 18px 40px -12px rgb(0 0 0 / 0.55)"
            flexShrink={0}
          >
            {foto && <Avatar.Image src={foto} alt={`Foto de ${paciente.nombre}`} />}
            <Avatar.Fallback bg="whiteAlpha.300" color="white">
              <PawPrint size={44} />
            </Avatar.Fallback>
          </Avatar.Root>

          <Box minW={0}>
            <Text
              fontSize={{ base: "2xl", md: "3xl" }}
              fontWeight="bold"
              lineHeight="1.1"
              letterSpacing="-0.02em"
            >
              {paciente.nombre}
            </Text>

            <Flex wrap="wrap" gap="2" mt="2.5" align="center">
              <EtiquetaBlanca icono={<PawPrint size={13} />}>
                {paciente.especie?.nombre ?? "Especie sin definir"}
              </EtiquetaBlanca>
              {paciente.raza && <EtiquetaBlanca>{paciente.raza}</EtiquetaBlanca>}
              {paciente.sexo && (
                <EtiquetaBlanca>
                  {paciente.sexo === "macho" ? "Macho" : "Hembra"}
                </EtiquetaBlanca>
              )}
              <EtiquetaBlanca>{edad}</EtiquetaBlanca>
              {paciente.esterilizado && (
                <EtiquetaBlanca icono={<CheckCircle2 size={13} />}>
                  Esterilizado
                </EtiquetaBlanca>
              )}
              {paciente.desparasitado && (
                <EtiquetaBlanca icono={<ShieldCheck size={13} />}>
                  Desparasitado
                </EtiquetaBlanca>
              )}
            </Flex>

            <Flex
              mt="4"
              gap={{ base: "3", md: "5" }}
              wrap="wrap"
              fontSize="sm"
              opacity={0.94}
            >
              {responsable && (
                <DatoContacto icono={<UserRound size={14} />}>
                  {nombreResponsable(responsable)}
                </DatoContacto>
              )}
              {(responsable?.telefono || responsable?.whatsapp) && (
                <DatoContacto icono={<Phone size={14} />}>
                  {formatTelefono(responsable.telefono ?? responsable.whatsapp)}
                </DatoContacto>
              )}
              {responsable?.email && (
                <DatoContacto icono={<Mail size={14} />}>
                  {responsable.email}
                </DatoContacto>
              )}
              {responsable?.ciudad && (
                <DatoContacto icono={<MapPin size={14} />}>
                  {responsable.ciudad}
                </DatoContacto>
              )}
            </Flex>
          </Box>

          <Flex
            ml={{ sm: "auto" }}
            gap="2"
            align="center"
            flexShrink={0}
            alignSelf={{ base: "stretch", sm: "center" }}
          >
            {whatsapp && (
              <BotonAccion
                href={whatsapp}
                icono={<MessageCircle size={16} />}
                etiqueta="WhatsApp"
              />
            )}
            {responsable?.telefono && (
              <BotonAccion
                href={`tel:${soloDigitos(responsable.telefono)}`}
                icono={<Phone size={16} />}
                etiqueta="Llamar"
              />
            )}
          </Flex>
        </Flex>
      </Box>

      <Box flex="1" overflowY="auto" px={{ base: "4", md: "7" }} py={{ base: "5", md: "6" }}>
        {paciente.alergias && (
          <Alert
            status="warning"
            title="Alerta de salud: alergias"
            mb="4"
            rounded="lg"
            startElement={<AlertTriangle size={18} />}
          >
            {paciente.alergias}
          </Alert>
        )}

        <Grid
          templateColumns={{
            base: "repeat(2, minmax(0, 1fr))",
            md: "repeat(3, minmax(0, 1fr))",
            xl: "repeat(6, minmax(0, 1fr))",
          }}
          gap="3"
          mb="5"
        >
          <TarjetaEstadistica
            icono={<Stethoscope size={17} />}
            etiqueta="Consultas"
            valor={resumen.totalConsultas}
            detalle={
              resumen.ultimaConsulta
                ? `Última ${formatFecha(resumen.ultimaConsulta)}`
                : "Sin consultas"
            }
          />
          <TarjetaEstadistica
            icono={<Syringe size={17} />}
            etiqueta="Vacunas"
            valor={resumen.totalVacunaciones}
            detalle={
              resumen.proximaVacuna?.fechaProxima
                ? `Próxima ${formatFechaCalendario(resumen.proximaVacuna.fechaProxima)}`
                : "Sin refuerzos"
            }
          />
          <TarjetaEstadistica
            icono={<ClipboardList size={17} />}
            etiqueta="Tratamientos"
            valor={resumen.tratamientosActivos}
            detalle={`${resumen.totalTratamientos} en total`}
            acento={resumen.tratamientosActivos > 0 ? "warning" : undefined}
          />
          <TarjetaEstadistica
            icono={<CalendarDays size={17} />}
            etiqueta="Citas"
            valor={resumen.totalCitas}
            detalle={
              resumen.proximaCita
                ? `Próxima ${formatFechaCalendario(resumen.proximaCita.fechaInicio)}`
                : "Sin citas próximas"
            }
          />
          <TarjetaEstadistica
            icono={<Weight size={17} />}
            etiqueta="Peso"
            valor={
              (resumen.ultimoPeso?.pesoKg ?? paciente.pesoKg) !== null
                ? `${formatCantidad(resumen.ultimoPeso?.pesoKg ?? paciente.pesoKg, 2)} kg`
                : "—"
            }
            detalle={
              resumen.ultimoPeso
                ? `Medido ${formatFecha(resumen.ultimoPeso.fecha)}`
                : "Sin medición"
            }
          />
          <TarjetaEstadistica
            icono={<Scissors size={17} />}
            etiqueta="Grooming"
            valor={resumen.totalGrooming}
            detalle={
              resumen.totalGrooming === 1 ? "1 sesión" : `${resumen.totalGrooming} sesiones`
            }
          />
        </Grid>

        <Tabs.Root defaultValue="resumen" variant="line" size="md">
          <Tabs.List
            borderBottomWidth="1px"
            borderColor="ink.200"
            gap="1"
            overflowX="auto"
            flexWrap="nowrap"
          >
            <Tabs.Trigger value="resumen">
              <Activity size={15} /> Resumen
            </Tabs.Trigger>
            <Tabs.Trigger value="consultas">
              <Stethoscope size={15} /> Consultas
              <Contador>{resumen.totalConsultas}</Contador>
            </Tabs.Trigger>
            <Tabs.Trigger value="vacunas">
              <Syringe size={15} /> Vacunas
              <Contador>{resumen.totalVacunaciones}</Contador>
            </Tabs.Trigger>
            <Tabs.Trigger value="tratamientos">
              <ClipboardList size={15} /> Tratamientos
              <Contador>{resumen.tratamientosActivos}</Contador>
            </Tabs.Trigger>
            <Tabs.Trigger value="agenda">
              <CalendarDays size={15} /> Agenda
            </Tabs.Trigger>
            <Tabs.Trigger value="grooming">
              <Scissors size={15} /> Grooming
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="resumen" pt="5">
            <Grid templateColumns={{ base: "1fr", xl: "1.15fr 0.85fr" }} gap="5">
              <Box>
                <PanelTitulo icono={<Activity size={16} />}>
                  Actividad de los últimos 6 meses
                </PanelTitulo>
                <GraficoActividad actividad={resumen.actividad} />

                <PanelTitulo icono={<Stethoscope size={16} />} mt="5">
                  Últimas consultas
                </PanelTitulo>
                {datos.consultas.length === 0 ? (
                  <SinDatos texto="Todavía no hay consultas registradas." />
                ) : (
                  <Flex direction="column" gap="2">
                    {datos.consultas.slice(0, 3).map((consulta) => (
                      <FilaConsulta key={consulta.id} consulta={consulta} />
                    ))}
                  </Flex>
                )}
              </Box>

              <Box>
                <PanelTitulo icono={<PawPrint size={16} />}>
                  Datos del paciente
                </PanelTitulo>
                <Box
                  bg="white"
                  borderWidth="1px"
                  borderColor="ink.200"
                  borderRadius="xl"
                  p="4"
                >
                  <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap="4">
                    <Dato etiqueta="Especie" valor={paciente.especie?.nombre ?? "—"} />
                    <Dato etiqueta="Raza" valor={paciente.raza ?? "—"} />
                    <Dato
                      etiqueta="Nacimiento"
                      valor={
                        paciente.fechaNacimiento
                          ? formatFechaCalendario(paciente.fechaNacimiento)
                          : "—"
                      }
                    />
                    <Dato etiqueta="Edad" valor={edad} />
                    <Dato
                      etiqueta="Sexo"
                      valor={
                        paciente.sexo
                          ? paciente.sexo === "macho"
                            ? "Macho"
                            : "Hembra"
                          : "—"
                      }
                    />
                    <Dato etiqueta="Color" valor={paciente.color ?? "—"} />
                    <Dato etiqueta="Microchip" valor={paciente.chipId ?? "—"} />
                    <Dato
                      etiqueta="En el sistema desde"
                      valor={formatFecha(paciente.creadoEn)}
                    />
                  </Grid>
                </Box>

                {(paciente.notas || paciente.alergias) && (
                  <>
                    <PanelTitulo icono={<HeartPulse size={16} />} mt="5">
                      Notas clínicas
                    </PanelTitulo>
                    <Flex direction="column" gap="3">
                      {paciente.alergias && (
                        <Nota titulo="Alergias" tono="warning">
                          {paciente.alergias}
                        </Nota>
                      )}
                      {paciente.notas && (
                        <Nota titulo="Observaciones">{paciente.notas}</Nota>
                      )}
                    </Flex>
                  </>
                )}
              </Box>
            </Grid>
          </Tabs.Content>

          <Tabs.Content value="consultas" pt="5">
            {datos.consultas.length === 0 ? (
              <SinDatos texto="Todavía no hay consultas registradas para esta mascota." />
            ) : (
              <Flex direction="column" gap="3">
                {datos.consultas.map((consulta) => (
                  <TarjetaConsulta key={consulta.id} consulta={consulta} />
                ))}
              </Flex>
            )}
          </Tabs.Content>

          <Tabs.Content value="vacunas" pt="5">
            {datos.vacunaciones.length === 0 ? (
              <SinDatos texto="No hay vacunas aplicadas." />
            ) : (
              <Grid templateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))" }} gap="3">
                {datos.vacunaciones.map((vacuna) => (
                  <TarjetaVacuna key={vacuna.id} vacuna={vacuna} />
                ))}
              </Grid>
            )}
          </Tabs.Content>

          <Tabs.Content value="tratamientos" pt="5">
            {datos.tratamientos.length === 0 ? (
              <SinDatos texto="No hay tratamientos registrados." />
            ) : (
              <Flex direction="column" gap="3">
                {datos.tratamientos.map((tratamiento) => (
                  <TarjetaTratamiento
                    key={tratamiento.id}
                    tratamiento={tratamiento}
                  />
                ))}
              </Flex>
            )}
          </Tabs.Content>

          <Tabs.Content value="agenda" pt="5">
            <PanelTitulo icono={<CalendarDays size={16} />}>
              Próximas citas
            </PanelTitulo>
            {datos.proximasCitas.length === 0 ? (
              <SinDatos texto="No tiene citas agendadas." />
            ) : (
              <Flex direction="column" gap="2" mb="6">
                {datos.proximasCitas.map((cita) => (
                  <FilaCita key={cita.id} cita={cita} />
                ))}
              </Flex>
            )}

            <PanelTitulo icono={<Clock3 size={16} />}>
              Historial de citas
            </PanelTitulo>
            {datos.ultimasCitas.length === 0 ? (
              <SinDatos texto="Sin citas anteriores." />
            ) : (
              <Flex direction="column" gap="2">
                {datos.ultimasCitas.map((cita) => (
                  <FilaCita key={cita.id} cita={cita} pasada />
                ))}
              </Flex>
            )}
          </Tabs.Content>

          <Tabs.Content value="grooming" pt="5">
            {datos.grooming.length === 0 ? (
              <SinDatos texto="No hay sesiones de grooming registradas." />
            ) : (
              <Flex direction="column" gap="2">
                {datos.grooming.map((sesion) => (
                  <Box
                    key={sesion.id}
                    bg="white"
                    borderWidth="1px"
                    borderColor="ink.200"
                    borderRadius="xl"
                    p="4"
                  >
                    <Flex align="start" gap="3">
                      <IconoRedondo color="brand">
                        <Scissors size={16} />
                      </IconoRedondo>
                      <Box minW={0} flex="1">
                        <Flex align="center" gap="2" wrap="wrap">
                          <Text fontWeight="semibold" color="ink.900">
                            {sesion.tipoServicio ?? "Sesión de grooming"}
                          </Text>
                          <Badge
                            size="sm"
                            variant="subtle"
                            colorPalette={
                              sesion.estado === "finalizada" ? "success" : "info"
                            }
                          >
                            {sesion.estado.replace("_", " ")}
                          </Badge>
                        </Flex>
                        <Text fontSize="sm" color="ink.500" mt="0.5">
                          {formatFechaHora(sesion.fechaInicio)}
                          {sesion.peluquero
                            ? ` · ${[sesion.peluquero.nombre, sesion.peluquero.apellido].filter(Boolean).join(" ")}`
                            : ""}
                        </Text>
                        {sesion.observaciones && (
                          <Text fontSize="sm" color="ink.600" mt="1.5">
                            {sesion.observaciones}
                          </Text>
                        )}
                      </Box>
                      <Text fontWeight="semibold" color="ink.900" whiteSpace="nowrap">
                        {formatMoneda(sesion.precio)}
                      </Text>
                    </Flex>
                  </Box>
                ))}
              </Flex>
            )}
          </Tabs.Content>
        </Tabs.Root>
      </Box>
    </Flex>
  );
}

/* ── Piezas de la cabecera ─────────────────────────────────────────────── */

function DecoracionCabecera() {
  return (
    <Box position="absolute" inset="0" pointerEvents="none" aria-hidden="true">
      <Box
        position="absolute"
        top="-4rem"
        right="-3rem"
        w="15rem"
        h="15rem"
        borderRadius="full"
        bg="whiteAlpha.200"
      />
      <Box
        position="absolute"
        top="3rem"
        right="7rem"
        w="5rem"
        h="5rem"
        borderRadius="full"
        borderWidth="1px"
        borderColor="whiteAlpha.300"
      />
      <PawPrint
        size={150}
        strokeWidth={1}
        style={{
          position: "absolute",
          right: "1.5rem",
          bottom: "-3.25rem",
          opacity: 0.14,
          transform: "rotate(-14deg)",
        }}
      />
    </Box>
  );
}

function EtiquetaBlanca({
  children,
  icono,
}: {
  children: React.ReactNode;
  icono?: React.ReactNode;
}) {
  return (
    <Flex
      align="center"
      gap="1"
      px="2.5"
      py="1"
      borderRadius="full"
      bg="whiteAlpha.200"
      borderWidth="1px"
      borderColor="whiteAlpha.300"
      fontSize="xs"
      fontWeight="medium"
      backdropFilter="blur(4px)"
    >
      {icono}
      {children}
    </Flex>
  );
}

function DatoContacto({
  children,
  icono,
}: {
  children: React.ReactNode;
  icono: React.ReactNode;
}) {
  return (
    <Flex align="center" gap="1.5" minW={0}>
      <Box opacity={0.85} flexShrink={0}>
        {icono}
      </Box>
      <Text truncate>{children}</Text>
    </Flex>
  );
}

function BotonBlanco({
  children,
  onClick,
  etiqueta,
}: {
  children: React.ReactNode;
  onClick: () => void;
  etiqueta: string;
}) {
  return (
    <chakra.button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      display="flex"
      alignItems="center"
      justifyContent="center"
      w="9"
      h="9"
      borderRadius="lg"
      bg="whiteAlpha.200"
      borderWidth="1px"
      borderColor="whiteAlpha.300"
      color="white"
      _hover={{ bg: "whiteAlpha.300" }}
      _focusVisible={{ outline: "2px solid white", outlineOffset: "2px" }}
    >
      {children}
    </chakra.button>
  );
}

function BotonAccion({
  href,
  icono,
  etiqueta,
}: {
  href: string;
  icono: React.ReactNode;
  etiqueta: string;
}) {
  return (
    <chakra.a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      display="inline-flex"
      alignItems="center"
      gap="2"
      px="3"
      h="9"
      borderRadius="lg"
      bg="whiteAlpha.200"
      borderWidth="1px"
      borderColor="whiteAlpha.400"
      fontSize="sm"
      fontWeight="semibold"
      color="white"
      whiteSpace="nowrap"
      _hover={{ bg: "whiteAlpha.300", textDecoration: "none" }}
    >
      {icono}
      {etiqueta}
    </chakra.a>
  );
}

/* ── Resumen ───────────────────────────────────────────────────────────── */

function TarjetaEstadistica({
  icono,
  etiqueta,
  valor,
  detalle,
  acento,
}: {
  icono: React.ReactNode;
  etiqueta: string;
  valor: number | string;
  detalle: string;
  acento?: "warning";
}) {
  const color = acento === "warning" ? "warning.700" : "brand.700";
  const fondo = acento === "warning" ? "warning.subtle" : "brand.subtle";

  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="ink.200"
      borderRadius="xl"
      p="3.5"
      boxShadow="xs"
    >
      <Flex align="center" gap="2" color="ink.500" fontSize="xs" fontWeight="medium">
        <Flex
          align="center"
          justifyContent="center"
          w="7"
          h="7"
          borderRadius="md"
          bg={fondo}
          color={color}
          flexShrink={0}
        >
          {icono}
        </Flex>
        <Text truncate>{etiqueta}</Text>
      </Flex>
      <Text
        mt="2"
        fontSize="2xl"
        fontWeight="bold"
        lineHeight="1"
        color="ink.900"
        fontVariantNumeric="tabular-nums"
      >
        {valor}
      </Text>
      <Text mt="1.5" fontSize="xs" color="ink.500" truncate>
        {detalle}
      </Text>
    </Box>
  );
}

function GraficoActividad({ actividad }: { actividad: { mes: string; consultas: number }[] }) {
  const maximo = Math.max(1, ...actividad.map((item) => item.consultas));

  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="ink.200"
      borderRadius="xl"
      p="4"
      boxShadow="xs"
    >
      <Flex align="end" gap={{ base: "2", md: "3" }} h="28">
        {actividad.map((item) => {
          const altura = Math.max(6, Math.round((item.consultas / maximo) * 100));

          return (
            <Flex key={item.mes} direction="column" align="center" flex="1" gap="2" h="full" justify="end">
              <Text fontSize="xs" fontWeight="semibold" color="ink.700">
                {item.consultas}
              </Text>
              <Box
                w="full"
                maxW="10"
                h={`${altura}%`}
                minH="1.5"
                borderRadius="md"
                bg={
                  item.consultas === 0
                    ? "ink.100"
                    : "linear-gradient(180deg, var(--chakra-colors-brand-400), var(--chakra-colors-brand-600))"
                }
                transition="height 0.3s ease"
              />
              <Text fontSize="xs" color="ink.500" textTransform="capitalize">
                {nombreMes(item.mes)}
              </Text>
            </Flex>
          );
        })}
      </Flex>
    </Box>
  );
}

function PanelTitulo({
  children,
  icono,
  mt,
}: {
  children: React.ReactNode;
  icono: React.ReactNode;
  mt?: string;
}) {
  return (
    <Flex align="center" gap="2" mb="2.5" mt={mt} color="ink.800">
      <Box color="brand.600">{icono}</Box>
      <Text fontSize="sm" fontWeight="semibold">
        {children}
      </Text>
    </Flex>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Box minW={0}>
      <Text fontSize="xs" color="ink.500" textTransform="uppercase" letterSpacing="0.04em">
        {etiqueta}
      </Text>
      <Text fontSize="sm" fontWeight="medium" color="ink.900" mt="0.5" truncate>
        {valor}
      </Text>
    </Box>
  );
}

function Nota({
  titulo,
  children,
  tono,
}: {
  titulo: string;
  children: React.ReactNode;
  tono?: "warning";
}) {
  return (
    <Box
      bg={tono === "warning" ? "warning.subtle" : "white"}
      borderWidth="1px"
      borderColor={tono === "warning" ? "warning.muted" : "ink.200"}
      borderRadius="xl"
      p="4"
    >
      <Text fontSize="xs" fontWeight="semibold" color={tono === "warning" ? "warning.fg" : "ink.600"} textTransform="uppercase" letterSpacing="0.04em">
        {titulo}
      </Text>
      <Text mt="1.5" fontSize="sm" color="ink.800" whiteSpace="pre-wrap">
        {children}
      </Text>
    </Box>
  );
}

/* ── Consultas ─────────────────────────────────────────────────────────── */

function FilaConsulta({ consulta }: { consulta: FichaConsulta }) {
  return (
    <Flex
      align="start"
      gap="3"
      bg="white"
      borderWidth="1px"
      borderColor="ink.200"
      borderRadius="xl"
      p="3.5"
    >
      <IconoRedondo color="info">
        <Stethoscope size={16} />
      </IconoRedondo>
      <Box minW={0} flex="1">
        <Flex align="center" gap="2" wrap="wrap">
          <Text fontWeight="semibold" color="ink.900" fontSize="sm">
            {consulta.motivoConsulta}
          </Text>
          <Badge size="sm" variant="subtle" colorPalette={colorEstadoConsulta(consulta.estado)}>
            {etiquetaEstadoConsulta(consulta.estado)}
          </Badge>
        </Flex>
        <Text fontSize="xs" color="ink.500" mt="0.5">
          {formatFechaHora(consulta.fecha)} ·{" "}
          {[consulta.veterinario.nombre, consulta.veterinario.apellido]
            .filter(Boolean)
            .join(" ")}
        </Text>
      </Box>
    </Flex>
  );
}

function TarjetaConsulta({ consulta }: { consulta: FichaConsulta }) {
  return (
    <Box bg="white" borderWidth="1px" borderColor="ink.200" borderRadius="xl" p="4" boxShadow="xs">
      <Flex align="start" gap="3">
        <IconoRedondo color="info">
          <Stethoscope size={17} />
        </IconoRedondo>
        <Box minW={0} flex="1">
          <Flex align="center" gap="2" wrap="wrap">
            <Text fontWeight="semibold" color="ink.900">
              {consulta.motivoConsulta}
            </Text>
            <Badge size="sm" variant="subtle" colorPalette={colorEstadoConsulta(consulta.estado)}>
              {etiquetaEstadoConsulta(consulta.estado)}
            </Badge>
          </Flex>
          <Text fontSize="sm" color="ink.500" mt="0.5">
            {formatFechaHora(consulta.fecha)} ·{" "}
            {[consulta.veterinario.nombre, consulta.veterinario.apellido]
              .filter(Boolean)
              .join(" ")}
            {consulta.veterinario.especialidad
              ? ` (${consulta.veterinario.especialidad})`
              : ""}
          </Text>

          <Grid templateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))" }} gap="3" mt="3">
            {consulta.diagnostico && (
              <DatoBloque etiqueta="Diagnóstico">{consulta.diagnostico}</DatoBloque>
            )}
            {consulta.tratamientoIndicado && (
              <DatoBloque etiqueta="Tratamiento indicado">
                {consulta.tratamientoIndicado}
              </DatoBloque>
            )}
            {consulta.sintomas && (
              <DatoBloque etiqueta="Síntomas">{consulta.sintomas}</DatoBloque>
            )}
            <Flex gap="3" wrap="wrap" gridColumn={{ md: "1 / -1" }}>
              {consulta.pesoKg !== null && (
                <SignoVital etiqueta="Peso" valor={`${formatCantidad(consulta.pesoKg, 2)} kg`} />
              )}
              {consulta.temperatura !== null && (
                <SignoVital etiqueta="Temperatura" valor={`${formatCantidad(consulta.temperatura, 1)} °C`} />
              )}
              {consulta.frecuenciaCardiaca !== null && (
                <SignoVital etiqueta="Frec. cardíaca" valor={`${consulta.frecuenciaCardiaca} lpm`} />
              )}
              {consulta.frecuenciaRespiratoria !== null && (
                <SignoVital etiqueta="Frec. respiratoria" valor={`${consulta.frecuenciaRespiratoria} rpm`} />
              )}
            </Flex>
          </Grid>
        </Box>
      </Flex>
    </Box>
  );
}

function DatoBloque({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <Box>
      <Text fontSize="xs" color="ink.500" fontWeight="medium">
        {etiqueta}
      </Text>
      <Text fontSize="sm" color="ink.800" mt="0.5" whiteSpace="pre-wrap">
        {children}
      </Text>
    </Box>
  );
}

function SignoVital({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Box bg="ink.50" borderRadius="md" px="2.5" py="1.5" minW="7rem">
      <Text fontSize="xs" color="ink.500">
        {etiqueta}
      </Text>
      <Text fontSize="sm" fontWeight="semibold" color="ink.900">
        {valor}
      </Text>
    </Box>
  );
}

/* ── Vacunas ───────────────────────────────────────────────────────────── */

function TarjetaVacuna({ vacuna }: { vacuna: FichaVacunacion }) {
  const proxima = vacuna.fechaProxima ? new Date(vacuna.fechaProxima) : null;
  const vencida = proxima ? yaPaso(proxima) : false;

  return (
    <Box bg="white" borderWidth="1px" borderColor="ink.200" borderRadius="xl" p="4" boxShadow="xs">
      <Flex align="start" gap="3">
        <IconoRedondo color="success">
          <Syringe size={16} />
        </IconoRedondo>
        <Box minW={0} flex="1">
          <Text fontWeight="semibold" color="ink.900">
            {vacuna.nombreVacuna}
          </Text>
          <Text fontSize="sm" color="ink.500" mt="0.5">
            Aplicada {formatFechaCalendario(vacuna.fechaAplicacion)}
            {vacuna.lote ? ` · Lote ${vacuna.lote}` : ""}
          </Text>
          {vacuna.aplicadaPor && (
            <Text fontSize="xs" color="ink.500" mt="0.5">
              Por{" "}
              {[vacuna.aplicadaPor.nombre, vacuna.aplicadaPor.apellido]
                .filter(Boolean)
                .join(" ")}
            </Text>
          )}
          {vacuna.fechaProxima && (
            <Badge
              mt="2"
              size="sm"
              variant="subtle"
              colorPalette={vencida ? "danger" : "info"}
            >
              {vencida ? "Refuerzo vencido" : "Próxima dosis"}:{" "}
              {formatFechaCalendario(vacuna.fechaProxima)}
            </Badge>
          )}
        </Box>
      </Flex>
    </Box>
  );
}

/* ── Tratamientos ──────────────────────────────────────────────────────── */

function TarjetaTratamiento({ tratamiento }: { tratamiento: FichaTratamiento }) {
  const administradas = tratamiento.dosis.filter((dosis) => dosis.administrada).length;
  const total = tratamiento.dosis.length;
  const porcentaje = total === 0 ? 0 : Math.round((administradas / total) * 100);

  return (
    <Box bg="white" borderWidth="1px" borderColor="ink.200" borderRadius="xl" p="4" boxShadow="xs">
      <Flex align="start" gap="3">
        <IconoRedondo color={tratamiento.activo ? "warning" : "ink"}>
          <ClipboardList size={16} />
        </IconoRedondo>
        <Box minW={0} flex="1">
          <Flex align="center" gap="2" wrap="wrap">
            <Text fontWeight="semibold" color="ink.900">
              {tratamiento.nombre}
            </Text>
            <Badge
              size="sm"
              variant="subtle"
              colorPalette={tratamiento.activo ? "warning" : "gray"}
            >
              {tratamiento.activo ? "Activo" : "Finalizado"}
            </Badge>
          </Flex>
          <Text fontSize="sm" color="ink.500" mt="0.5">
            {formatFechaCalendario(tratamiento.fechaInicio)}
            {tratamiento.fechaFinPrevista
              ? ` → ${formatFechaCalendario(tratamiento.fechaFinPrevista)}`
              : ""}
            {tratamiento.veterinario
              ? ` · ${[tratamiento.veterinario.nombre, tratamiento.veterinario.apellido].filter(Boolean).join(" ")}`
              : ""}
          </Text>

          {total > 0 && (
            <Box mt="3">
              <Flex justify="space-between" fontSize="xs" color="ink.500" mb="1.5">
                <Text>
                  {administradas} de {total} dosis administradas
                </Text>
                <Text fontWeight="semibold">{porcentaje}%</Text>
              </Flex>
              <Box w="full" h="1.5" bg="ink.100" borderRadius="full" overflow="hidden">
                <Box
                  h="full"
                  w={`${porcentaje}%`}
                  bg={porcentaje === 100 ? "success.500" : "brand.500"}
                  transition="width 0.3s ease"
                />
              </Box>
            </Box>
          )}

          {tratamiento.descripcion && (
            <Text fontSize="sm" color="ink.600" mt="2.5">
              {tratamiento.descripcion}
            </Text>
          )}
        </Box>
      </Flex>
    </Box>
  );
}

/* ── Agenda y grooming ─────────────────────────────────────────────────── */

function FilaCita({ cita, pasada = false }: { cita: FichaCita; pasada?: boolean }) {
  return (
    <Flex
      align="center"
      gap="3"
      bg="white"
      borderWidth="1px"
      borderColor="ink.200"
      borderRadius="xl"
      p="3.5"
      opacity={pasada ? 0.82 : 1}
    >
      <IconoRedondo color={pasada ? "ink" : "brand"}>
        <CalendarDays size={16} />
      </IconoRedondo>
      <Box minW={0} flex="1">
        <Text fontWeight="semibold" fontSize="sm" color="ink.900" truncate>
          {cita.motivoCita?.nombre ?? cita.motivo}
        </Text>
        <Text fontSize="xs" color="ink.500" mt="0.5">
          {formatFechaHora(cita.fechaInicio)}
          {cita.veterinario
            ? ` · ${[cita.veterinario.nombre, cita.veterinario.apellido].filter(Boolean).join(" ")}`
            : ""}
        </Text>
      </Box>
      <Badge
        size="sm"
        variant="subtle"
        colorPalette={colorEstadoCita(cita.estado)}
        flexShrink={0}
      >
        {etiquetaEstadoCita(cita.estado)}
      </Badge>
    </Flex>
  );
}

/* ── Carga y estados vacíos ────────────────────────────────────────────── */

function FichaCargando({ onVolver }: { onVolver: () => void }) {
  return (
    <Flex direction="column" h="full" bg="ink.50">
      <Box
        px={{ base: "4", md: "7" }}
        py="5"
        bg="linear-gradient(135deg, var(--chakra-colors-brand-700), var(--chakra-colors-brand-500))"
      >
        <Flex align="center" gap="3">
          <BotonBlanco onClick={onVolver} etiqueta="Volver al buscador">
            <ArrowLeft size={18} />
          </BotonBlanco>
          <Skeleton h="6" w="16rem" />
        </Flex>
        <Flex gap="4" mt="5" align="center">
          <Skeleton boxSize="20" borderRadius="full" />
          <Box flex="1">
            <Skeleton h="7" w="14rem" mb="3" />
            <Skeleton h="4" w="22rem" />
          </Box>
        </Flex>
      </Box>
      <Box p={{ base: "4", md: "7" }}>
        <Grid templateColumns={{ base: "repeat(2, 1fr)", xl: "repeat(6, 1fr)" }} gap="3">
          {Array.from({ length: 6 }).map((_, indice) => (
            <Skeleton key={indice} h="24" borderRadius="xl" />
          ))}
        </Grid>
        <Skeleton mt="6" h="64" borderRadius="xl" />
      </Box>
    </Flex>
  );
}

function CabeceraVolver({ onVolver }: { onVolver: () => void }) {
  return (
    <Flex align="center" gap="3" px="4" py="4" bg="white" borderBottomWidth="1px" borderColor="ink.200">
      <chakra.button
        type="button"
        onClick={onVolver}
        aria-label="Volver al buscador"
        display="flex"
        alignItems="center"
        justifyContent="center"
        w="9"
        h="9"
        borderRadius="lg"
        bg="ink.100"
        color="ink.700"
        _hover={{ bg: "ink.200" }}
      >
        <ArrowLeft size={18} />
      </chakra.button>
      <Text fontWeight="semibold" color="ink.900">
        Volver al buscador
      </Text>
    </Flex>
  );
}

function SinDatos({ texto }: { texto: string }) {
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      textAlign="center"
      bg="white"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="ink.200"
      borderRadius="xl"
      py="10"
      px="4"
      gap="2"
    >
      <Flex align="center" justify="center" w="10" h="10" borderRadius="full" bg="ink.100" color="ink.500">
        <PawPrint size={18} />
      </Flex>
      <Text fontSize="sm" color="ink.500" maxW="24rem">
        {texto}
      </Text>
    </Flex>
  );
}

function IconoRedondo({
  children,
  color,
}: {
  children: React.ReactNode;
  color: "brand" | "info" | "success" | "warning" | "ink";
}) {
  const fondos: Record<typeof color, string> = {
    brand: "brand.subtle",
    info: "info.subtle",
    success: "success.subtle",
    warning: "warning.subtle",
    ink: "ink.100",
  };
  const colores: Record<typeof color, string> = {
    brand: "brand.fg",
    info: "info.fg",
    success: "success.fg",
    warning: "warning.fg",
    ink: "ink.600",
  };

  return (
    <Flex
      align="center"
      justify="center"
      w="8"
      h="8"
      borderRadius="lg"
      bg={fondos[color]}
      color={colores[color]}
      flexShrink={0}
    >
      {children}
    </Flex>
  );
}

function Contador({ children }: { children: React.ReactNode }) {
  return (
    <Badge size="sm" variant="subtle" colorPalette="gray" ml="1.5">
      {children}
    </Badge>
  );
}

/* ── Utilidades ────────────────────────────────────────────────────────── */

function nombreResponsable(cliente: ClienteResumen) {
  return (
    cliente.razonSocial ??
    [cliente.nombres, cliente.apellidos].filter(Boolean).join(" ") ??
    cliente.documento
  );
}

function whatsappUrl(telefono: string | null | undefined) {
  const digitos = soloDigitos(telefono ?? "");
  if (!digitos) return undefined;
  return `https://wa.me/${digitos.startsWith("0") ? `595${digitos.slice(1)}` : digitos}`;
}

/** Compara contra el reloj actual fuera del árbol de render. */
function yaPaso(fecha: Date) {
  return fecha.getTime() < Date.now();
}

function edadPaciente(paciente: PacienteFicha) {
  if (paciente.edadAnios !== null) {
    return `${paciente.edadAnios} ${paciente.edadAnios === 1 ? "año" : "años"}`;
  }
  if (!paciente.fechaNacimiento) return "Edad no registrada";

  const nacimiento = new Date(paciente.fechaNacimiento);
  const hoy = new Date();
  let anios = hoy.getFullYear() - nacimiento.getFullYear();
  const aniversarioPendiente =
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
  if (aniversarioPendiente) anios -= 1;

  return anios < 1 ? "Menos de 1 año" : `${anios} ${anios === 1 ? "año" : "años"}`;
}

function nombreMes(clave: string) {
  const [anio, mes] = clave.split("-").map(Number);
  return new Date(anio, mes - 1, 1).toLocaleDateString("es-PY", {
    month: "short",
  });
}

function etiquetaEstadoConsulta(estado: FichaConsulta["estado"]) {
  const etiquetas: Record<FichaConsulta["estado"], string> = {
    abierta: "Abierta",
    en_curso: "En curso",
    finalizada: "Finalizada",
    anulada: "Anulada",
  };
  return etiquetas[estado];
}

function colorEstadoConsulta(estado: FichaConsulta["estado"]) {
  const colores: Record<FichaConsulta["estado"], string> = {
    abierta: "info",
    en_curso: "warning",
    finalizada: "success",
    anulada: "gray",
  };
  return colores[estado];
}

function etiquetaEstadoCita(estado: string) {
  const etiquetas: Record<string, string> = {
    pendiente: "Pendiente",
    confirmada: "Confirmada",
    en_curso: "En curso",
    atendida: "Atendida",
    cancelada: "Cancelada",
    no_asistio: "No asistió",
  };
  return etiquetas[estado] ?? estado;
}

function colorEstadoCita(estado: string) {
  const colores: Record<string, string> = {
    pendiente: "info",
    confirmada: "brand",
    en_curso: "warning",
    atendida: "success",
    cancelada: "gray",
    no_asistio: "danger",
  };
  return colores[estado] ?? "gray";
}
