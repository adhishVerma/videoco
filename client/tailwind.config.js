/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
      },
      colors: {
        // brand: indigo, used for primary actions and accents everywhere
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
        },
        // the call room is dark: video is easier to look at against a dark
        // backdrop and nothing competes with the faces
        room: {
          bg: '#0B1020',
          tile: '#141B2D',
          raised: '#1B2438',
          border: '#2A3550',
        },
      },
      boxShadow: {
        tile: '0 8px 30px rgba(0, 0, 0, 0.35)',
      },
      keyframes: {
        // opacity only: for elements already positioned with a transform
        // (centred overlays) - a keyframe that sets `transform` replaces it
        // while it runs, making them jump sideways on mount
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
