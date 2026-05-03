import type { Config } from 'tailwindcss';
import { colors, radii, transitions } from '../../packages/ui/tokens';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/components/**/*.{ts,tsx}',
  ],
  theme: {
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
          hover:   '#60A5FA',
          muted:   '#1E3A8A',
        },
        severity: {
          critical: colors.severity.critical,
          high:     colors.severity.high,
          medium:   colors.severity.medium,
          low:      colors.severity.low,
          info:     colors.severity.info,
        },
      },
      borderRadius: {
        sm: radii.sm,
        md: radii.md,
        DEFAULT: radii.md,
      },
      transitionDuration: {
        DEFAULT: '150',
        fast: '150',
      },
      transitionTimingFunction: {
        DEFAULT: 'ease-out',
      },
      fontFamily: {
        sans: ['Inter', 'Geist Sans', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'ui-monospace', 'monospace'],
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
        regular:  '400',
        medium:   '500',
        semibold: '600',
      },
    },
  },
  plugins: [],
};

export default config;
