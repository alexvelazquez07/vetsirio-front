import { Box, Flex, Text, chakra } from "@chakra-ui/react";
import { FileText } from "lucide-react";
import { useEffect, useState } from "react";

import {
  tamanoHoja,
  type ConfiguracionImpresion,
} from "@/features/settings/impresion";
import { crearDocumentoHoja } from "./hoja";
import type { TicketOrganizacion, TicketVentaDatos } from "./ticket";

/**
 * Vista previa del comprobante de hoja completa.
 *
 * No se reimplementa el diseño con componentes: se genera el mismo PDF que va
 * a la impresora y se muestra embebido. Así no hay diferencias entre lo que se
 * ve en configuración y lo que sale en papel.
 */
export function HojaPreview({
  datos,
  organizacion,
  configuracion,
}: {
  datos: TicketVentaDatos;
  organizacion: TicketOrganizacion;
  configuracion: ConfiguracionImpresion;
}) {
  const hoja = tamanoHoja(configuracion.tamanoHoja);
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);

  // Los datos llegan como objetos nuevos en cada render; la clave serializada
  // evita regenerar el PDF cuando nada relevante cambió.
  const clave = JSON.stringify({ datos, organizacion, configuracion });

  useEffect(() => {
    let vigente = true;
    let urlCreada = "";

    setError(false);

    crearDocumentoHoja(datos, organizacion, configuracion)
      .then((pdf) => {
        if (!vigente) return;
        urlCreada = URL.createObjectURL(pdf.output("blob"));
        setUrl(urlCreada);
      })
      .catch(() => {
        if (vigente) setError(true);
      });

    return () => {
      vigente = false;
      if (urlCreada) URL.revokeObjectURL(urlCreada);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  if (error) {
    return (
      <Flex
        align="center"
        justify="center"
        direction="column"
        gap="2"
        p="6"
        borderRadius="md"
        bg="white"
        color="ink.500"
        textAlign="center"
      >
        <FileText size={22} />
        <Text fontSize="sm">No se pudo generar la vista previa del PDF.</Text>
      </Flex>
    );
  }

  return (
    <Box
      w="full"
      maxW="430px"
      mx="auto"
      overflow="hidden"
      borderRadius="md"
      bg="white"
      boxShadow="0 12px 32px -12px rgba(16, 24, 40, 0.35)"
    >
      {url ? (
        <chakra.iframe
          title="Vista previa del comprobante en PDF"
          src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          w="full"
          display="block"
          borderWidth="0"
          style={{ aspectRatio: `${hoja.anchoMm} / ${hoja.altoMm}` }}
        />
      ) : (
        <Flex
          align="center"
          justify="center"
          w="full"
          bg="ink.50"
          color="ink.500"
          style={{ aspectRatio: `${hoja.anchoMm} / ${hoja.altoMm}` }}
        >
          <Text fontSize="sm">Generando PDF…</Text>
        </Flex>
      )}
    </Box>
  );
}
