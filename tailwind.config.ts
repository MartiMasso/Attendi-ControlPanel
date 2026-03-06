import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./services/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        surface: "var(--surface)",
        "surface-elevated": "var(--surface-elevated)",
        "surface-muted": "var(--surface-muted)",
        border: "var(--border)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        primary: "var(--primary)",
        "primary-strong": "var(--primary-strong)",
        danger: "var(--danger)",
        warning: "var(--warning)",
        success: "var(--success)"
      },
      boxShadow: {
        card: "0 1px 2px rgba(4, 16, 34, 0.06), 0 12px 28px rgba(4, 16, 34, 0.05)"
      }
    }
  },
  plugins: []
};

export default config;
