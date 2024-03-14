/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      backgroundColor : {
        skin :{
          'btn-primary' : '#4F52B2',
          'btn-secondary': '#ffffff',
          'secondary' : '#F5F5F5'
        }
      },
      textColor : {
        skin : {
          'btn-primary' : '#f7f7f7',
          'btn-secondary': '#000000'
        }
      },
      borderColor : {
        skin : {
          'primary' : '#D1D1D1'
        }
      }
    },
  },
  plugins: [],
};