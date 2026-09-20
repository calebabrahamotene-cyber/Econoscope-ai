import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F5F8FD",
        surface: "#FFFFFF",
        surfaceAlt: "#EEF3FC",
        border: "#DCE6F5",
        ink: "#0E1B33",
        inkSoft: "#4C5A75",
        inkFaint: "#8896B3",
        primary: "#1642C8",
        primaryDark: "#0B2258",
        bullish: "#127A52",
        bearish: "#B43A3A",
        amber: "#93650E",
      },
    },
  },
  plugins: [],
};
export default config;
