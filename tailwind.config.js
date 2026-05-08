/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        brand: {
          graphite: "#464A50",
          cyan: "#05C3D4",
          "cyan-light": "#27E6F2",
          "cyan-dark": "#0099A8",
          black: "#15171A",
        },
      },
      fontFamily: {
        heading: ['"Exo 2"', "sans-serif"],
        sans: ["Manrope", "sans-serif"],
        mono: ['"Space Mono"', "monospace"],
      },
      borderRadius: {
        "2xl": "28px",
        xl: "18px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "hero-blob": {
          "0%, 100%": {
            transform: "translate(0, 0) scale(1)",
            backgroundColor: "rgba(5, 195, 212, 0.15)",
          },
          "33%": {
            transform: "translate(30px, -50px) scale(1.1)",
            backgroundColor: "rgba(39, 230, 242, 0.2)",
          },
          "66%": {
            transform: "translate(-20px, 20px) scale(0.9)",
            backgroundColor: "rgba(0, 153, 168, 0.1)",
          },
        },
        "hero-blob-slow": {
          "0%, 100%": {
            transform: "translate(0, 0) scale(1)",
            backgroundColor: "rgba(70, 74, 80, 0.2)",
          },
          "50%": {
            transform: "translate(-40px, 40px) scale(1.2)",
            backgroundColor: "rgba(21, 23, 26, 0.3)",
          },
        },
        "hero-blob-reverse": {
          "0%, 100%": {
            transform: "translate(0, 0) scale(1)",
            backgroundColor: "rgba(5, 195, 212, 0.05)",
          },
          "40%": {
            transform: "translate(50px, 30px) scale(0.8)",
            backgroundColor: "rgba(0, 153, 168, 0.15)",
          },
          "75%": {
            transform: "translate(-30px, -20px) scale(1.1)",
            backgroundColor: "rgba(39, 230, 242, 0.05)",
          },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
      },
      animation: {
        "hero-blob": "hero-blob 20s infinite ease-in-out",
        "hero-blob-slow": "hero-blob-slow 25s infinite ease-in-out",
        "hero-blob-reverse": "hero-blob-reverse 18s infinite ease-in-out",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
