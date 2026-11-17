import { Box, Button, Flex, chakra } from "@chakra-ui/react";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";

export interface FormDialogProps {
  abierto: boolean;
  onClose: () => void;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  /** Texto del botón de confirmación; durante el envío se reemplaza por un spinner. */
  textoConfirmar?: string;
  textoCancelar?: string;
  guardando?: boolean;
  onConfirmar?: () => void;
  /** Oculta el botón cuando la validación impide confirmar. */
  confirmarDeshabilitado?: boolean;
  /**
   * Acciones extra alineadas a la izquierda del pie (por ejemplo, "Anular"
   * en una factura de solo lectura). Se muestran antes de Cancelar.
   */
  acciones?: ReactNode;
  /** Oculta el botón de confirmación, para diálogos que solo muestran datos. */
  ocultarConfirmar?: boolean;
  /** Ancho del diálogo. Los formularios de dirección necesitan más espacio. */
  ancho?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  /**
   * Impide cerrar con Escape o clic afuera mientras guarda.
   *
   * Sin esto, un doble clic en "Guardar" puede mandar dos requests y el
   * segundo falla por documento duplicado, con un error que ya se resolvió.
   */
  bloquearCierre?: boolean;
}

const ANCHOS = {
  sm: "26rem",
  md: "34rem",
  lg: "44rem",
  xl: "56rem",
  "2xl": "64rem",
  "3xl": "76rem",
} as const;

/**
 * Diálogo de formulario.
 *
 * Envuelve todos los formularios de alta y edición del sistema para que el
 * encabezado, el botón y el comportamiento de cierre sean idénticos en todas
 * las pantallas. La consistencia ahí no es estética: es lo que hace que el
 * usuario sepa que "Guardar" siempre hace lo mismo sin tener que pensarlo.
 */
export function FormDialog({
  abierto,
  onClose,
  titulo,
  descripcion,
  children,
  textoConfirmar = "Guardar",
  textoCancelar = "Cancelar",
  guardando,
  onConfirmar,
  confirmarDeshabilitado,
  acciones,
  ocultarConfirmar,
  ancho = "md",
  bloquearCierre,
}: FormDialogProps) {
  // Bloquea el scroll del fondo mientras el diálogo está abierto. Sin esto, en
  // móvil el contenido de atrás sigue desplazándose bajo el overlay.
  useEffect(() => {
    if (!abierto) return;

    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflowPrevio;
    };
  }, [abierto]);

  const cerrarNoGuardando = () => {
    if (bloquearCierre || guardando) return;
    onClose();
  };

  return (
    <DialogRoot
      open={abierto}
      onOpenChange={(detalle) => {
        if (!detalle.open) cerrarNoGuardando();
      }}
      size="cover"
      motionPreset="slide-in-bottom"
    >
      <DialogContent
        maxW={ANCHOS[ancho]}
        maxH="calc(100dvh - 3rem)"
        borderRadius="lg"
        boxShadow="xl"
        p="0"
        overflow="hidden"
        position="relative"
        display="flex"
        flexDirection="column"
      >
        <DialogHeader
          flexShrink={0}
          px="6"
          pt="5"
          pb="4"
          pr="14"
          bg="brand.800"
          borderBottomWidth="1px"
          borderColor="brand.900"
        >
          <Flex align="flex-start" gap="4">
            <Box minW={0}>
              <DialogTitle fontSize="lg" fontWeight="bold" color="white">
                {titulo}
              </DialogTitle>

              {descripcion && (
                <Box
                  fontSize="sm"
                  color="brand.100"
                  mt="1"
                  fontWeight="normal"
                  lineHeight="1.5"
                >
                  {descripcion}
                </Box>
              )}
            </Box>
          </Flex>
        </DialogHeader>

        <chakra.button
          type="button"
          onClick={cerrarNoGuardando}
          disabled={bloquearCierre || guardando}
          position="absolute"
          top="3"
          right="3"
          zIndex="1"
          display="flex"
          alignItems="center"
          justifyContent="center"
          w="9"
          h="9"
          p="0"
          borderRadius="full"
          color="white"
          bg="brand.700"
          transition="background 0.15s ease, color 0.15s ease"
          _hover={{ bg: "brand.600", color: "white" }}
          _focusVisible={{
            outline: "2px solid",
            outlineColor: "brand.500",
            outlineOffset: "2px",
          }}
          aria-label="Cerrar"
        >
          <X size={18} />
        </chakra.button>

        <DialogBody px="6" py="5" overflowY="auto" flex="1" minH="0">
          {children}
        </DialogBody>

        <DialogFooter
          flexShrink={0}
          px="6"
          py="4"
          borderTopWidth="1px"
          borderColor="ink.200"
          gap="2"
          bg="ink.50"
        >
          {acciones && (
            <Flex gap="2" mr="auto" wrap="wrap">
              {acciones}
            </Flex>
          )}

          <Button
            variant="ghost"
            onClick={cerrarNoGuardando}
            disabled={guardando}
            flex={{ base: "1", sm: "initial" }}
          >
            {textoCancelar}
          </Button>

          {!ocultarConfirmar && (
            <Button
              colorPalette="brand"
              onClick={onConfirmar}
              loading={guardando}
              loadingText="Guardando…"
              disabled={confirmarDeshabilitado || guardando}
              flex={{ base: "1", sm: "initial" }}
            >
              {textoConfirmar}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
