import { ApiReference } from '@scalar/nextjs-api-reference';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GET = ApiReference({
  specUrl: '/api/openapi.json',
  darkMode: true,
  pageTitle: 'Syntra API Reference',
  customCss: `
    :root {
      --scalar-background-1: #0D1117;
      --scalar-background-2: #151921;
      --scalar-background-3: #1E2530;
      --scalar-color-1: #FAFAFA;
      --scalar-color-2: #94A3B8;
      --scalar-color-accent: #4F8EFF;
    }
  `,
} as any);
