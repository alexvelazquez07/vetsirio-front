import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { http } from "@/services/api";

/**
 * Catálogo de departamentos y ciudades de Paraguay.
 *
 * El catálogo vive en el backend y se cachea acá para no descargarlo en cada
 * apertura de formulario. Con un `staleTime` de 24 horas alcanza: son datos
 * que cambian una vez cada varios años, y volver a pedirlos en cada pantalla
 * sólo agrega latencia.
 */

export interface Ciudad {
  id: string;
  nombre: string;
  departamento: string;
}

export interface Departamento {
  nombre: string;
  ciudades: Ciudad[];
}

/** Elimina acentos y pasa a minúsculas, para comparar sin sorpresas. */
export function normalizar(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

interface RespuestaParaguay {
  departamentos: Departamento[];
  totalCiudades: number;
}

export interface CatalogoParaguay {
  departamentos: Departamento[];
  ciudades: Ciudad[];
  totalCiudades: number;
  nombresDepartamentos: string[];
}

export function useCatalogoParaguay() {
  return useQuery({
    queryKey: ["catalogo", "paraguay"],
    queryFn: () => http.get<RespuestaParaguay>("/catalogos/paraguay"),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    // El catálogo es crítico para varios formularios a la vez: conviene
    // tener el dato aunque una pantalla haya fallado al cargarlo.
    retry: 2,
  });
}

/** Departamentos y ciudades aplanados, listos para los selectores. */
export interface CiudadesConIndices {
  ciudades: Ciudad[];
  indices: IndiceCiudad;
  nombresDepartamentos: string[];
  cargando: boolean;
  error: Error | null;
}

/**
 * Catálogo cargado + índices de búsqueda, listos para usar.
 *
 * Los índices se construyen una sola vez por descarga del catálogo, no en cada
 * keystroke: sin eso, escribir en el autocompletado recorrería 119 ciudades por
 * pulsación.
 */
export function useCiudadesParaguay(): CiudadesConIndices {
  const consulta = useCatalogoParaguay();

  const valor = useMemo<{ ciudades: Ciudad[]; indices: IndiceCiudad; nombresDepartamentos: string[] }>(
    () => {
      const departamentos = consulta.data?.departamentos ?? [];
      const ciudades = departamentos.flatMap((d) => d.ciudades);

      const porNombre = new Map<string, Ciudad[]>();
      const porDepartamento = new Map<string, Ciudad[]>();
      const porPrefijo = new Map<string, Ciudad[]>();

      const claves = [
        ...ciudades.map((c) => normalizar(c.nombre)),
        ...departamentos.map((d) => normalizar(d.nombre)),
        "",
      ];

      for (const clave of claves) {
        porNombre.set(clave, []);
        porPrefijo.set(clave, []);
        porDepartamento.set(clave, []);
      }

      for (const ciudad of ciudades) {
        const claveNombre = normalizar(ciudad.nombre);
        const claveDepto = normalizar(ciudad.departamento);

        porNombre.get(claveNombre)?.push(ciudad);

        if (!porNombre.has(claveNombre)) porNombre.set(claveNombre, [ciudad]);

        for (let largo = 1; largo <= claveNombre.length; largo++) {
          const prefijo = claveNombre.slice(0, largo);
          if (porPrefijo.has(prefijo)) porPrefijo.get(prefijo)?.push(ciudad);
        }

        if (!porDepartamento.has(claveDepto)) porDepartamento.set(claveDepto, []);
        porDepartamento.get(claveDepto)?.push(ciudad);
      }

      // Los prefijos se completan con los nombres que empiezan por él, para
      // que "enc" devuelva Encarnación aunque nadie la haya tipeado entera.
      for (const [prefijo, accumulated] of porPrefijo) {
        if (accumulated.length > 0) continue;
        const encontrados = ciudades.filter((c) =>
          normalizar(c.nombre).startsWith(prefijo),
        );
        porPrefijo.set(prefijo, encontrados);
      }

      for (const [clave, accumulated] of porDepartamento) {
        if (accumulated.length > 0 || clave === "") continue;
        const encontrados = ciudades.filter(
          (c) => normalizar(c.departamento) === clave,
        );
        porDepartamento.set(clave, encontrados);
      }

      return {
        ciudades,
        indices: { porNombre, porPrefijo, porDepartamento },
        nombresDepartamentos: departamentos.map((d) => d.nombre),
      };
    },
    [consulta.data],
  );

  return {
    ciudades: valor.ciudades,
    indices: valor.indices,
    nombresDepartamentos: valor.nombresDepartamentos,
    cargando: consulta.isLoading,
    error: (consulta.error as Error | null) ?? null,
  };
}

export interface IndiceCiudad {
  porNombre: Map<string, Ciudad[]>;
  porPrefijo: Map<string, Ciudad[]>;
  porDepartamento: Map<string, Ciudad[]>;
}

/**
 * Busca ciudades sincrónicamente sobre el catálogo ya cargado.
 *
 * Va en el frontend y no contra el endpoint porque el autocomplete necesita
 * responder en el mismo frame en que se escribe. Un request por tecla se
 * siente lento aunque la red esté bien.
 */
export function filtrarCiudades(
  termino: string,
  indices: IndiceCiudad,
  limite = 8,
): Ciudad[] {
  const clave = normalizar(termino);

  if (clave.length === 0) return [];

  const vistos = new Set<string>();
  const resultado: Ciudad[] = [];

  const agregar = (lista: Ciudad[] | undefined) => {
    if (!lista) return;

    for (const ciudad of lista) {
      if (resultado.length >= limite) return;
      if (vistos.has(ciudad.id)) continue;
      vistos.add(ciudad.id);
      resultado.push(ciudad);
    }
  };

  agregar(indices.porNombre.get(clave));
  agregar(indices.porPrefijo.get(clave));
  agregar(indices.porDepartamento.get(clave));

  return resultado;
}

/** ¿Es un departamento conocido? Para decidir entre aceptar o descartar. */
export function esDepartamentoValido(
  nombre: string,
  indices: IndiceCiudad,
): boolean {
  return indices.porDepartamento.get(normalizar(nombre)) !== undefined;
}