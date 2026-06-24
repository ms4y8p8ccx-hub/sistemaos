import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./types/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        borda: "hsl(var(--borda))",
        entrada: "hsl(var(--entrada))",
        anel: "hsl(var(--anel))",
        fundo: "hsl(var(--fundo))",
        texto: "hsl(var(--texto))",
        primario: {
          DEFAULT: "hsl(var(--primario))",
          texto: "hsl(var(--primario-texto))"
        },
        secundario: {
          DEFAULT: "hsl(var(--secundario))",
          texto: "hsl(var(--secundario-texto))"
        },
        alerta: {
          DEFAULT: "hsl(var(--alerta))",
          texto: "hsl(var(--alerta-texto))"
        },
        suave: {
          DEFAULT: "hsl(var(--suave))",
          texto: "hsl(var(--suave-texto))"
        }
      },
      borderRadius: {
        lg: "var(--raio)",
        md: "calc(var(--raio) - 2px)",
        sm: "calc(var(--raio) - 4px)"
      }
    }
  },
  plugins: []
};

export default config;
