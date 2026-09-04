import type { Config } from 'tailwindcss';

interface ReferenceTokens {
  colors: Record<string, string>;
  fontFamily: Record<string, string[]>;
  maxWidth: Record<string, string>;
  boxShadow: Record<string, string>;
}

interface ExtendedTokens {
  colors: Record<string, string>;
  fontFamily: Record<string, string[]>;
  transitionTimingFunction: Record<string, string>;
  transitionDuration: Record<string, string>;
}

const inventoriedFromReference: ReferenceTokens = {
  colors: {
    khmBg: '#f6f4ee',
    khmDark: '#121212',
    khmGray: '#767676',
    khmBorder: '#dedbd2'
  },
  fontFamily: {
    serif: ['"Times New Roman"', 'Times', 'Baskerville', 'Georgia', 'serif'],
    sans: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'Helvetica',
      'Arial',
      'sans-serif'
    ]
  },
  maxWidth: {
    container: '1400px'
  },
  boxShadow: {
    sticker: '0 2px 6px rgba(0, 0, 0, 0.06)'
  }
};

const extendedForTrancheTrade: ExtendedTokens = {
  colors: {
    khmAlert: '#8a2b22',
    khmAlertBg: '#f4eae7',
    khmPositive: '#2f5d3a',
    khmPositiveBg: '#eef1ec',
    khmMuted: '#a8a49a'
  },
  fontFamily: {
    mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
  },
  transitionTimingFunction: {
    beat: 'cubic-bezier(0.16, 1, 0.3, 1)'
  },
  transitionDuration: {
    beat: '900ms'
  }
};

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    borderRadius: {
      none: '0'
    },
    extend: {
      colors: {
        ...inventoriedFromReference.colors,
        ...extendedForTrancheTrade.colors
      },
      fontFamily: {
        ...inventoriedFromReference.fontFamily,
        ...extendedForTrancheTrade.fontFamily
      },
      maxWidth: inventoriedFromReference.maxWidth,
      boxShadow: inventoriedFromReference.boxShadow,
      transitionTimingFunction: extendedForTrancheTrade.transitionTimingFunction,
      transitionDuration: extendedForTrancheTrade.transitionDuration
    }
  },
  plugins: []
};

export default config;
