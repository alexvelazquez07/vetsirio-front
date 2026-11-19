import {
  Avatar,
  Badge,
  Box,
  Flex,
  Skeleton,
  Text,
  chakra,
} from "@chakra-ui/react";
import {
  ArrowRight,
  CornerDownLeft,
  ChevronRight,
  PawPrint,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useBusquedaDiferida } from "@/components/data/Paginacion";
import { DialogContent, DialogRoot } from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/auth.store";
import { FichaPaciente } from "@/features/patients/FichaPaciente";
import {
  urlFotoPaciente,
  useBuscarPacientesGlobal,
} from "@/features/patients/patients.service";
import { MENU, type ItemMenu } from "@/routes/menu";
import type { Paciente } from "@/types/dominio";

/**
 * Buscador global.
 *
 * Dos búsquedas en una: módulos por nombre y mascotas por nombre, raza,
 * microchip, especie o responsable. Elegir una mascota no navega a otra URL:
 * abre su ficha 360 encima de la pantalla actual, como una capa de trabajo.
 * Esa decisión evita perder el formulario que la persona tenía abierto detrás.
 *
 * Atajos: Ctrl/Cmd + K o "/" abren la paleta; ↑/↓ recorren; Enter abre.
 */

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

interface ModuloResultado {
  item: ItemMenu;
  grupo: string;
}

type Resultado =
  | { tipo: "paciente"; paciente: Paciente }
  | { tipo: "modulo"; modulo: ModuloResultado };

export function BuscadorGlobal({ abierto, onCerrar }: Props) {
  const navegar = useNavigate();
  const { puede } = useAuth();
  const { texto, setTexto, busqueda } = useBusquedaDiferida("", 220);
  const [indice, setIndice] = useState(0);
  const [pacienteId, setPacienteId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const consulta = useBuscarPacientesGlobal(busqueda);
  const pacientes = useMemo(
    () => consulta.data?.items ?? [],
    [consulta.data],
  );

  const modulos = useMemo<ModuloResultado[]>(() => {
    const termino = busqueda.toLowerCase();

    return MENU.flatMap((grupo) =>
      grupo.items
        .filter((item) => item.permiso !== "__superadmin__")
        .filter((item) => !item.permiso || puede(item.permiso))
        .filter((item) => !item.oculto)
        .filter((item) => {
          if (!termino) return true;
          return (
            item.etiqueta.toLowerCase().includes(termino) ||
            grupo.etiqueta.toLowerCase().includes(termino)
          );
        })
        .map((item) => ({ item, grupo: grupo.etiqueta })),
    );
  }, [busqueda, puede]);

  const resultados = useMemo<Resultado[]>(
    () => [
      ...pacientes.map((paciente) => ({ tipo: "paciente" as const, paciente })),
      ...modulos.map((modulo) => ({ tipo: "modulo" as const, modulo })),
    ],
    [pacientes, modulos],
  );

  // Al cambiar el término, la selección vuelve arriba: mantener el índice
  // anterior sobre una lista distinta abriría una mascota que el usuario no
  // estaba mirando. Se ajusta durante el render (patrón recomendado por React)
  // en vez de en un efecto, para no pintar una lista con la fila equivocada.
  const [terminoPrevio, setTerminoPrevio] = useState(busqueda);
  if (terminoPrevio !== busqueda) {
    setTerminoPrevio(busqueda);
    setIndice(0);
  }

  useEffect(() => {
    if (!abierto) return;

    const temporizador = window.setTimeout(() => {
      if (pacienteId === null) inputRef.current?.focus();
    }, 40);

    return () => window.clearTimeout(temporizador);
  }, [abierto, pacienteId]);

  // Mantener visible la fila activa cuando se navega con el teclado.
  useEffect(() => {
    if (pacienteId !== null) return;
    document
      .getElementById(`buscador-item-${indice}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [indice, pacienteId]);

  const elegir = (resultado: Resultado) => {
    if (resultado.tipo === "paciente") {
      setPacienteId(resultado.paciente.id);
      return;
    }

    onCerrar();
    navegar(resultado.modulo.item.ruta);
  };

  const alTeclear = (evento: React.KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setIndice((actual) =>
        resultados.length === 0
          ? 0
          : Math.min(resultados.length - 1, actual + 1),
      );
      return;
    }

    if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setIndice((actual) => Math.max(0, actual - 1));
      return;
    }

    if (evento.key === "Enter") {
      evento.preventDefault();
      const seleccionado = resultados[indice];
      if (seleccionado) elegir(seleccionado);
    }
  };

  const cerrar = () => {
    setPacienteId(null);
    setTexto("");
    onCerrar();
  };

  return (
    <DialogRoot
      open={abierto}
      onOpenChange={({ open }) => {
        if (!open) cerrar();
      }}
      placement="center"
      size="lg"
      scrollBehavior="inside">
      <DialogContent
        p="0"
        gap="0"
        overflow="hidden"
        bg="white"
        borderColor="ink.200"
        boxShadow="0 32px 80px -24px rgb(19 28 41 / 0.45)"
        borderRadius={{ base: "none", md: "2xl" }}
        maxW="none"
        w={{
          base: "100vw",
          md: pacienteId ? "min(97vw, 96rem)" : "min(96vw, 54rem)",
        }}
        h={{
          base: "100dvh",
          md: pacienteId ? "min(94dvh, 62rem)" : "min(82dvh, 40rem)",
        }}
        transition="width 0.22s ease, height 0.22s ease"
        animation="vetsirio-entrada 200ms cubic-bezier(0.16, 1, 0.3, 1)">
        {pacienteId !== null ? (
          <FichaPaciente
            pacienteId={pacienteId}
            onVolver={() => {
              setPacienteId(null);
              inputRef.current?.focus();
            }}
          />
        ) : (
          <Flex direction="column" h="full" minH={0}>
            <Flex
              align="center"
              gap="3"
              px={{ base: "3.5", md: "4" }}
              py="3"
              borderBottomWidth="1px"
              borderColor="ink.200"
              flexShrink={0}>
              <Search size={19} color="var(--chakra-colors-brand-600)" />

              <chakra.input
                ref={inputRef}
                value={texto}
                onChange={(evento) => setTexto(evento.target.value)}
                onKeyDown={alTeclear}
                placeholder="Buscar mascota, dueño, microchip o módulo…"
                aria-label="Buscar mascota, dueño, microchip o módulo"
                role="combobox"
                aria-expanded="true"
                aria-controls="buscador-global-resultados"
                aria-activedescendant={
                  resultados.length > 0 ? `buscador-item-${indice}` : undefined
                }
                autoComplete="off"
                spellCheck={false}
                flex="1"
                minW={0}
                bg="transparent"
                border="none"
                outline="none"
                fontSize={{ base: "sm", md: "md" }}
                color="ink.900"
                _placeholder={{ color: "ink.400" }}
              />

              {consulta.isFetching && (
                <chakra.span
                  w="3.5"
                  h="3.5"
                  borderRadius="full"
                  borderWidth="2px"
                  borderColor="brand.200"
                  borderTopColor="brand.500"
                  animation="vetsirio-giro 700ms linear infinite"
                  aria-label="Buscando"
                />
              )}

              {texto ? (
                <chakra.button
                  type="button"
                  onClick={() => setTexto("")}
                  aria-label="Limpiar búsqueda"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  w="7"
                  h="7"
                  borderRadius="md"
                  color="ink.500"
                  _hover={{ bg: "ink.100", color: "ink.800" }}>
                  <X size={15} />
                </chakra.button>
              ) : (
                <Tecla>Esc</Tecla>
              )}
            </Flex>

            <Box
              id="buscador-global-resultados"
              role="listbox"
              aria-label="Resultados del buscador"
              flex="1"
              minH={0}
              overflowY="auto"
              p="2">
              {consulta.isLoading ? (
                <CargandoResultados />
              ) : resultados.length === 0 ? (
                <SinResultados termino={texto} />
              ) : (
                <>
                  {pacientes.length > 0 && (
                    <Seccion titulo={busqueda ? "Mascotas" : "Mascotas recientes"}>
                      {pacientes.map((paciente, posicion) => (
                        <FilaPaciente
                          key={paciente.id}
                          paciente={paciente}
                          activo={indice === posicion}
                          indice={posicion}
                          onElegir={() => setPacienteId(paciente.id)}
                          onSenalar={() => setIndice(posicion)}
                        />
                      ))}
                    </Seccion>
                  )}

                  {modulos.length > 0 && (
                    <Seccion titulo="Módulos">
                      {modulos.map((modulo, posicion) => {
                        const indiceGlobal = pacientes.length + posicion;

                        return (
                          <FilaModulo
                            key={modulo.item.ruta}
                            modulo={modulo}
                            activo={indice === indiceGlobal}
                            indice={indiceGlobal}
                            onElegir={() => elegir({ tipo: "modulo", modulo })}
                            onSenalar={() => setIndice(indiceGlobal)}
                          />
                        );
                      })}
                    </Seccion>
                  )}
                </>
              )}
            </Box>

            <Flex
              align="center"
              justify="space-between"
              gap="3"
              px="4"
              py="2.5"
              borderTopWidth="1px"
              borderColor="ink.200"
              bg="ink.50"
              flexShrink={0}
              fontSize="xs"
              color="ink.500"
              wrap="wrap">
              <Flex align="center" gap="3" wrap="wrap">
                <Atajo tecla="↑ ↓">navegar</Atajo>
                <Atajo tecla="Enter">
                  <CornerDownLeft size={12} /> abrir
                </Atajo>
              </Flex>
              <Text display={{ base: "none", sm: "block" }}>
                Buscá por nombre, responsable o microchip
              </Text>
            </Flex>
          </Flex>
        )}
      </DialogContent>
    </DialogRoot>
  );
}

/* ── Filas ─────────────────────────────────────────────────────────────── */

function FilaPaciente({
  paciente,
  activo,
  indice,
  onElegir,
  onSenalar,
}: {
  paciente: Paciente;
  activo: boolean;
  indice: number;
  onElegir: () => void;
  onSenalar: () => void;
}) {
  const foto = urlFotoPaciente(paciente.fotoUrl);

  return (
    <Fila
      id={`buscador-item-${indice}`}
      activo={activo}
      onClick={onElegir}
      onMouseEnter={onSenalar}
      ariaLabel={`Abrir ficha de ${paciente.nombre}`}>
      <Avatar.Root size="md" colorPalette="brand" flexShrink={0}>
        {foto && <Avatar.Image src={foto} alt="" />}
        <Avatar.Fallback>
          <PawPrint size={18} />
        </Avatar.Fallback>
      </Avatar.Root>

      <Box minW={0} flex="1">
        <Flex align="center" gap="2">
          <Text fontSize="sm" fontWeight="semibold" color="ink.900" truncate>
            {paciente.nombre}
          </Text>
          {!paciente.activo && (
            <Badge size="sm" variant="subtle" colorPalette="gray">
              Inactivo
            </Badge>
          )}
        </Flex>
        <Text fontSize="xs" color="ink.500" truncate>
          {[paciente.especie?.nombre, paciente.raza].filter(Boolean).join(" · ") ||
            "Especie sin definir"}
          {paciente.cliente ? ` · ${responsable(paciente)}` : ""}
        </Text>
      </Box>

      <Text
        fontSize="xs"
        color="ink.500"
        whiteSpace="nowrap"
        display={{ base: "none", md: "block" }}>
        {paciente.chipId ? `Chip ${paciente.chipId}` : edad(paciente)}
      </Text>

      <Box color={activo ? "brand.600" : "ink.300"} flexShrink={0}>
        <ChevronRight size={17} />
      </Box>
    </Fila>
  );
}

function FilaModulo({
  modulo,
  activo,
  indice,
  onElegir,
  onSenalar,
}: {
  modulo: ModuloResultado;
  activo: boolean;
  indice: number;
  onElegir: () => void;
  onSenalar: () => void;
}) {
  const Icono = modulo.item.icono;

  return (
    <Fila
      id={`buscador-item-${indice}`}
      activo={activo}
      onClick={onElegir}
      onMouseEnter={onSenalar}
      ariaLabel={`Ir a ${modulo.item.etiqueta}`}>
      <Flex
        align="center"
        justify="center"
        w="9"
        h="9"
        borderRadius="lg"
        bg={activo ? "white" : "brand.subtle"}
        color="brand.fg"
        flexShrink={0}>
        <Icono size={17} />
      </Flex>

      <Box minW={0} flex="1">
        <Text fontSize="sm" fontWeight="medium" color="ink.900" truncate>
          {modulo.item.etiqueta}
        </Text>
        <Text fontSize="xs" color="ink.500">
          {modulo.grupo}
        </Text>
      </Box>

      <Box color={activo ? "brand.600" : "ink.300"} flexShrink={0}>
        <ArrowRight size={16} />
      </Box>
    </Fila>
  );
}

function Fila({
  children,
  activo,
  id,
  onClick,
  onMouseEnter,
  ariaLabel,
}: {
  children: React.ReactNode;
  activo: boolean;
  id: string;
  onClick: () => void;
  onMouseEnter: () => void;
  ariaLabel: string;
}) {
  return (
    <chakra.button
      id={id}
      type="button"
      role="option"
      aria-selected={activo}
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      w="full"
      display="flex"
      alignItems="center"
      gap="3"
      px="2.5"
      py="2"
      borderRadius="lg"
      textAlign="left"
      bg={activo ? "brand.subtle" : "transparent"}
      boxShadow={activo ? "inset 0 0 0 1px var(--chakra-colors-brand-200)" : "none"}
      transition="background 0.12s ease, box-shadow 0.12s ease"
      _hover={{ bg: activo ? "brand.subtle" : "ink.50" }}
      _focusVisible={{ outline: "2px solid", outlineColor: "brand.500", outlineOffset: "-2px" }}>
      {children}
    </chakra.button>
  );
}

/* ── Estados ───────────────────────────────────────────────────────────── */

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <Box mb="2" _last={{ mb: 0 }}>
      <Text
        px="2.5"
        py="1.5"
        fontSize="xs"
        fontWeight="semibold"
        color="ink.500"
        textTransform="uppercase"
        letterSpacing="0.06em">
        {titulo}
      </Text>
      <Flex direction="column" gap="0.5">
        {children}
      </Flex>
    </Box>
  );
}

function CargandoResultados() {
  return (
    <Flex direction="column" gap="1" p="1" aria-label="Cargando resultados">
      {Array.from({ length: 4 }).map((_, indice) => (
        <Flex key={indice} align="center" gap="3" px="2.5" py="2">
          <Skeleton boxSize="9" borderRadius="full" />
          <Box flex="1">
            <Skeleton h="3.5" w={`${55 + indice * 8}%`} mb="1.5" />
            <Skeleton h="3" w="40%" />
          </Box>
        </Flex>
      ))}
    </Flex>
  );
}

function SinResultados({ termino }: { termino: string }) {
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      textAlign="center"
      minH="16rem"
      px="6"
      gap="3">
      <Flex
        align="center"
        justify="center"
        w="14"
        h="14"
        borderRadius="2xl"
        bg="ink.100"
        color="ink.500">
        <PawPrint size={26} />
      </Flex>
      <Box>
        <Text fontWeight="semibold" color="ink.900">
          No encontramos coincidencias
        </Text>
        <Text fontSize="sm" color="ink.500" mt="1" maxW="24rem">
          {termino.trim()
            ? `Ninguna mascota ni módulo coincide con «${termino.trim()}». Probá con el nombre del dueño o el microchip.`
            : "Todavía no hay mascotas ni módulos para mostrar."}
        </Text>
      </Box>
    </Flex>
  );
}

/* ── Utilidades ────────────────────────────────────────────────────────── */

function Tecla({ children }: { children: React.ReactNode }) {
  return (
    <chakra.kbd
      px="1.5"
      py="0.5"
      borderRadius="sm"
      bg="ink.50"
      borderWidth="1px"
      borderColor="ink.200"
      color="ink.500"
      fontSize="xs"
      fontFamily="mono"
      flexShrink={0}>
      {children}
    </chakra.kbd>
  );
}

function Atajo({
  tecla,
  children,
}: {
  tecla: string;
  children: React.ReactNode;
}) {
  return (
    <Flex align="center" gap="1.5">
      <Tecla>{tecla}</Tecla>
      <Flex align="center" gap="1">
        {children}
      </Flex>
    </Flex>
  );
}

function responsable(paciente: Paciente) {
  const cliente = paciente.cliente;
  if (!cliente) return "Sin responsable";

  return (
    [cliente.nombres, cliente.apellidos].filter(Boolean).join(" ") ||
    cliente.documento
  );
}

function edad(paciente: Paciente) {
  if (paciente.edadAnios !== null) {
    return `${paciente.edadAnios} ${paciente.edadAnios === 1 ? "año" : "años"}`;
  }
  if (!paciente.fechaNacimiento) return "Edad no registrada";

  const nacimiento = new Date(paciente.fechaNacimiento);
  const hoy = new Date();
  let anios = hoy.getFullYear() - nacimiento.getFullYear();
  const aniversarioPendiente =
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() &&
      hoy.getDate() < nacimiento.getDate());
  if (aniversarioPendiente) anios -= 1;

  return anios < 1
    ? "Menos de 1 año"
    : `${anios} ${anios === 1 ? "año" : "años"}`;
}
