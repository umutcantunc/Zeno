import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#6D28D9",
          hover: "#5B21B6",
          light: "#7C3AED",
          subtle: "rgba(109,40,217,0.15)",
        },
        // Arka plan renklerini biraz açık yap — göz yorulmayı azalt
        slate: {
          950: "#0F0F1A",
          900: "#13132A",
        },
      },
    },
  },
  plugins: [],
};
export default config;
