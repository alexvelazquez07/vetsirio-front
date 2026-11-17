import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

/**
 * Sistema de diseño de VetSirio.
 *
 * Todos los colores de marca salen de tokens, nunca de valores sueltos en los
 * componentes. Eso permite que cada veterinaria aplique su color primario
 * (campo `color_primario` de la tabla veterinarias) sobrewriting únicamente
 * esta escala, sin tocar una sola pantalla.
 */

const config = defineConfig({
  globalCss: {
    "html, body, #root": {
      height: "100%",
    },
    body: {
      // Evita el rebote de scroll horizontal en móvil al abrir drawers.
      overflowX: "hidden",
    },
    "*::selection": {
      background: "brand.muted",
      color: "brand.fg",
    },
  },

  theme: {
    breakpoints: {
      sm: "30rem", //  480px
      md: "48rem", //  768px  tablet
      lg: "62rem", //  992px  laptop
      xl: "80rem", // 1280px  desktop
      "2xl": "96rem", // 1536px
    },

    tokens: {
      fonts: {
        heading: {
          value:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        },
        body: {
          value:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        },
        mono: {
          value:
            "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
        },
      },

      colors: {
        /**
         * Escala de marca. El 500 es el color por defecto del producto
         * (verde clínico) y es el valor que la veterinaria puede cambiar.
         */
        brand: {
          50: { value: "#E7F7F3" },
          100: { value: "#C4ECE1" },
          200: { value: "#95DACB" },
          300: { value: "#61C4B0" },
          400: { value: "#34AE98" },
          500: { value: "#0D9E87" },
          600: { value: "#0B8271" },
          700: { value: "#09685C" },
          800: { value: "#075047" },
          900: { value: "#053B34" },
        },

        /**
         * Neutros con un matiz ligeramente frío. Frente al gris puro de
         * fábrica, da una sensación menos plana cuando conviven superficies
         * blancas, grises y muy claras en la misma pantalla.
         */
        ink: {
          0: { value: "#FFFFFF" },
          50: { value: "#F7F9FA" },
          100: { value: "#EEF1F4" },
          200: { value: "#DFE4EA" },
          300: { value: "#C4CCD6" },
          400: { value: "#94A1B2" },
          500: { value: "#6B7A8D" },
          600: { value: "#4E5D6E" },
          700: { value: "#3A4757" },
          800: { value: "#253243" },
          900: { value: "#131C29" },
          950: { value: "#0A111C" },
        },

        success: {
          50: { value: "#ECFDF3" },
          100: { value: "#D1FADF" },
          500: { value: "#12A150" },
          600: { value: "#0C8342" },
          700: { value: "#0A6735" },
        },
        warning: {
          50: { value: "#FFFAEB" },
          100: { value: "#FEF0C7" },
          500: { value: "#F79009" },
          600: { value: "#DC6803" },
          700: { value: "#B54708" },
        },
        danger: {
          50: { value: "#FEF3F2" },
          100: { value: "#FEE4E2" },
          500: { value: "#F04438" },
          600: { value: "#D92D20" },
          700: { value: "#B42318" },
        },
        info: {
          50: { value: "#EFF8FF" },
          100: { value: "#D1E9FF" },
          500: { value: "#2E90FA" },
          600: { value: "#1570EF" },
          700: { value: "#175CD3" },
        },
      },

      radii: {
        sm: { value: "0.375rem" },
        md: { value: "0.5rem" },
        lg: { value: "0.75rem" },
        xl: { value: "1rem" },
        "2xl": { value: "1.25rem" },
      },

      shadows: {
        /**
         * Sombras en dos capas (llave + ambiente). Una sola sombra se ve
         * pegada; dos capas reproducen la luz real de una ventana y es lo que
         * separa un aspecto "premium" de uno plano.
         */
        xs: { value: "0 1px 2px 0 rgb(19 28 41 / 0.05)" },
        sm: {
          value:
            "0 1px 3px 0 rgb(19 28 41 / 0.08), 0 1px 2px -1px rgb(19 28 41 / 0.06)",
        },
        md: {
          value:
            "0 4px 8px -2px rgb(19 28 41 / 0.08), 0 2px 4px -2px rgb(19 28 41 / 0.05)",
        },
        lg: {
          value:
            "0 12px 20px -4px rgb(19 28 41 / 0.10), 0 4px 8px -4px rgb(19 28 41 / 0.05)",
        },
        xl: {
          value:
            "0 20px 32px -8px rgb(19 28 41 / 0.14), 0 8px 16px -8px rgb(19 28 41 / 0.06)",
        },
        focus: {
          value:
            "0 0 0 3px color-mix(in srgb, var(--chakra-colors-brand-500) 32%, transparent)",
        },
      },

      spacing: {
        // Escala base de 4px, ampliada con intermedios para maquetar con
        // precisión sin recurrir a valores arbitrarios.
        18: { value: "4.5rem" },
        22: { value: "5.5rem" },
        30: { value: "7.5rem" },
      },
    },

    semanticTokens: {
      colors: {
        brand: {
          solid: { value: "{colors.brand.500}" },
          contrast: { value: "white" },
          fg: { value: "{colors.brand.700}" },
          muted: { value: "{colors.brand.100}" },
          subtle: { value: "{colors.brand.50}" },
          emphasized: { value: "{colors.brand.200}" },
          focusRing: { value: "{colors.brand.500}" },
        },
        success: {
          solid: { value: "{colors.success.500}" },
          contrast: { value: "white" },
          fg: { value: "{colors.success.700}" },
          muted: { value: "{colors.success.100}" },
          subtle: { value: "{colors.success.50}" },
        },
        warning: {
          solid: { value: "{colors.warning.500}" },
          contrast: { value: "white" },
          fg: { value: "{colors.warning.700}" },
          muted: { value: "{colors.warning.100}" },
          subtle: { value: "{colors.warning.50}" },
        },
        danger: {
          solid: { value: "{colors.danger.500}" },
          contrast: { value: "white" },
          fg: { value: "{colors.danger.700}" },
          muted: { value: "{colors.danger.100}" },
          subtle: { value: "{colors.danger.50}" },
        },
        info: {
          solid: { value: "{colors.info.500}" },
          contrast: { value: "white" },
          fg: { value: "{colors.info.700}" },
          muted: { value: "{colors.info.100}" },
          subtle: { value: "{colors.info.50}" },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);