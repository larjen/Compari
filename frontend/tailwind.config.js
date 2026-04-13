/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  /**
   * Safelist prevents Tailwind from purging dynamically referenced color classes.
   * 
   * These classes are used in DIMENSION_COLORS (utils.ts) for criteria dimension
   * visualization. Since the dimension keys come from runtime data, Tailwind cannot
   * detect these class references during static analysis.
   * 
   * @see frontend/src/lib/utils.ts > DIMENSION_COLORS
   */
  safelist: [
    // Blue (core_competencies)
    'bg-blue-50', 'text-blue-700', 'border-blue-200', 'border-blue-400',
    // Purple (experience)
    'bg-purple-50', 'text-purple-700', 'border-purple-200', 'border-purple-400',
    // Green (soft_skills)
    'bg-green-50', 'text-green-700', 'border-green-200', 'border-green-400',
    // Orange (domain_knowledge)
    'bg-orange-50', 'text-orange-700', 'border-orange-200', 'border-orange-400',
    // Pink (cultural_fit)
    'bg-pink-50', 'text-pink-700', 'border-pink-200', 'border-pink-400',
    // Gray (uncategorized)
    'bg-gray-50', 'text-gray-700', 'border-gray-200', 'border-gray-400',
    // Indigo
    'bg-indigo-50', 'text-indigo-700', 'border-indigo-200', 'border-indigo-400',
    // Teal
    'bg-teal-50', 'text-teal-700', 'border-teal-200', 'border-teal-400',
    // Rose
    'bg-rose-50', 'text-rose-700', 'border-rose-200', 'border-rose-400',
    // Amber
    'bg-amber-50', 'text-amber-700', 'border-amber-200', 'border-amber-400',
    // Fuchsia
    'bg-fuchsia-50', 'text-fuchsia-700', 'border-fuchsia-200', 'border-fuchsia-400',
    // Cyan
    'bg-cyan-50', 'text-cyan-700', 'border-cyan-200', 'border-cyan-400',
    // Violet
    'bg-violet-50', 'text-violet-700', 'border-violet-200', 'border-violet-400',
  ],
  theme: {
    extend: {
      colors: {
        background: '#FAF9F6',
        foreground: '#1A2F24',
        'foreground-muted': '#4A5568',
        accent: {
          sage: '#8FA98F',
          'sage-light': '#B5C9B4',
          sand: '#D4C5A9',
          forest: '#1A2F24',
          'forest-light': '#2D4A3A',
        },
        card: {
          DEFAULT: '#FFFFFF',
          hover: '#F7F6F4',
        },
        border: {
          DEFAULT: '#E8E5DF',
          light: '#F0EDE8',
        },
        status: {
          waiting: '#D4C5A9',
          preparing: '#8FA98F',
          sent: '#6B8E7D',
          finished: '#1A2F24',
        },
      },
      fontFamily: {
        serif: ['Playfair Display', 'Merriweather', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
