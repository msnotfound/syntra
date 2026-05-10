import type { Config } from 'tailwindcss';
import { colors, radii, spacing, typography } from '../../packages/ui/tokens';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/components/**/*.{ts,tsx}',
  ],
  theme: {
    boxShadow: {
      sm: 'none',
      DEFAULT: 'none',
      md: 'none',
      lg: 'none',
      xl: 'none',
      '2xl': 'none',
      inner: 'none',
      none: 'none',
    },
    extend: {
      colors: {
        bg: {
          base:     colors.bg.base,
          surface:  colors.bg.surface,
          'surface-2': colors.bg.surface2,
          'surface-3': colors.bg.surface3,
        },
        border: {
          subtle:  colors.border.subtle,
          default: colors.border.default,
          strong:  colors.border.strong,
        },
        text: {
          primary:   colors.text.primary,
          secondary: colors.text.secondary,
          muted:     colors.text.muted,
          disabled:  colors.text.disabled,
        },
        accent: {
          DEFAULT: colors.accent.DEFAULT,
          hover:   colors.accent.hover,
          muted:   colors.accent.muted,
        },
        severity: {
          critical: colors.severity.critical,
          high:     colors.severity.high,
          medium:   colors.severity.medium,
          low:      colors.severity.low,
          info:     colors.severity.info,
        },
        success: colors.state.success,
        warning: colors.state.warning,
        error: colors.state.error,
        map: {
          bg: colors.map.bg,
          water: colors.map.water,
          land: colors.map.land,
          border: colors.map.border,
          pin: colors.map.watchlistPin,
        },
      },
      spacing: {
        7: spacing.px[7],
        9: spacing.px[9],
      },
      borderRadius: {
        sm: radii.sm,
        md: radii.md,
        DEFAULT: radii.md,
      },
      transitionDuration: {
        instant: '0',
        DEFAULT: '150',
        quick: '150',
        poised: '250',
        considered: '400',
      },
      transitionTimingFunction: {
        DEFAULT: 'ease-out',
        poised: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      fontFamily: {
        sans: typography.fonts.body.split(', '),
        mono: typography.fonts.mono.split(', '),
      },
      fontSize: {
        xs:   ['11px', { lineHeight: '16px' }],
        sm:   ['13px', { lineHeight: '20px' }],
        base: ['14px', { lineHeight: '22px' }],
        md:   ['16px', { lineHeight: '24px' }],
        lg:   ['20px', { lineHeight: '28px' }],
        xl:   ['24px', { lineHeight: '32px' }],
        '2xl': ['32px', { lineHeight: '40px' }],
      },
      fontWeight: {
        light:    String(typography.weights.light),
        regular:  '400',
        medium:   '500',
        semibold: '600',
      },
      keyframes: {
        'fade-up-poised': {
          '0%': { opacity: '0', transform: 'translateY(0.5rem)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer-restrained': {
          '0%': { backgroundPosition: '-120% 0' },
          '100%': { backgroundPosition: '120% 0' },
        },
        'focus-pulse': {
          '0%, 100%': { outlineColor: 'rgb(59 130 246 / 0.45)' },
          '50%': { outlineColor: 'rgb(59 130 246 / 0.75)' },
        },
      },
      animation: {
        'fade-up-poised': 'fade-up-poised 250ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'shimmer-restrained': 'shimmer-restrained 600ms ease-out infinite',
        'focus-pulse': 'focus-pulse 400ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
