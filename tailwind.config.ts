import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0A2540',
          50: '#E8EFF6',
          100: '#C5D5E8',
          200: '#9FBAD8',
          500: '#0A2540',
          600: '#081D33',
          700: '#061526',
          900: '#020A10',
        },
        accent: {
          DEFAULT: '#FF6B35',
          50: '#FFF3EE',
          100: '#FFD9C9',
          200: '#FFB89A',
          500: '#FF6B35',
          600: '#E55A25',
          700: '#C44A18',
        },
        cream: '#FFF8F0',
        success: '#16A34A',
        whatsapp: '#25D366',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        devanagari: ['var(--font-noto-devanagari)', 'sans-serif'],
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, rgba(10,37,64,0.95) 0%, rgba(10,37,64,0.7) 60%, rgba(10,37,64,0.3) 100%)',
        'cta-gradient': 'linear-gradient(135deg, #FF6B35 0%, #E55A25 100%)',
      },
      boxShadow: {
        'form': '0 4px 40px rgba(10,37,64,0.12)',
        'badge': '0 2px 8px rgba(10,37,64,0.15)',
        'card': '0 2px 20px rgba(10,37,64,0.08)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
