/**
 * Provenance coverage gate.
 *
 * Asserts that every place in the app that renders an LLM-generated string
 * imports and uses the <Provenance> wrapper component, and that the provenance
 * component family is coherent and importable.
 *
 * This is a static-analysis test — it reads source files and checks for
 * the import + usage patterns without spinning up a server.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath));
}

// ---------------------------------------------------------------------------
// 1. Component files exist
// ---------------------------------------------------------------------------

describe('Provenance component family — file existence', () => {
  const components = [
    'components/intel/SourceBadge.tsx',
    'components/intel/ProvenanceTooltip.tsx',
    'components/intel/Provenance.tsx',
    'components/intel/ProvenanceTrail.tsx',
  ];

  test.each(components)('%s exists', (file) => {
    expect(fileExists(file)).toBe(true);
  });

  test('Forecast detail page exists', () => {
    expect(fileExists('app/app/[orgSlug]/forecasts/[id]/page.tsx')).toBe(true);
  });

  test('ForecastClaimGraph client component exists', () => {
    expect(fileExists('app/app/[orgSlug]/forecasts/[id]/ForecastClaimGraph.tsx')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. SourceBadge exports AdmiraltyCode and SourceBadge
// ---------------------------------------------------------------------------

describe('SourceBadge.tsx', () => {
  const src = readFile('components/intel/SourceBadge.tsx');

  test('exports SourceBadge function', () => {
    expect(src).toMatch(/export function SourceBadge/);
  });

  test('exports AdmiraltyCode type', () => {
    expect(src).toMatch(/export type AdmiraltyCode/);
  });

  test('uses admiralty_code, reliability_pct, source_name props', () => {
    expect(src).toMatch(/admiralty_code/);
    expect(src).toMatch(/reliability_pct/);
    expect(src).toMatch(/source_name/);
  });

  test('imports tokens, not raw hex values for sizing', () => {
    expect(src).toMatch(/from '@syntra\/ui\/tokens'/);
    // All 6 Admiralty tiers must be defined
    expect(src).toMatch(/'A'/);
    expect(src).toMatch(/'F'/);
  });
});

// ---------------------------------------------------------------------------
// 3. ProvenanceTooltip.tsx
// ---------------------------------------------------------------------------

describe('ProvenanceTooltip.tsx', () => {
  const src = readFile('components/intel/ProvenanceTooltip.tsx');

  test('is a client component', () => {
    expect(src).toMatch(/'use client'/);
  });

  test('exports ProvenanceTooltip', () => {
    expect(src).toMatch(/export function ProvenanceTooltip/);
  });

  test('accepts claims and children props', () => {
    expect(src).toMatch(/claims.*ProvenanceClaim/);
    expect(src).toMatch(/children.*React\.ReactNode/);
  });

  test('imports SourceBadge for Admiralty display', () => {
    expect(src).toMatch(/from '\.\/SourceBadge'/);
  });
});

// ---------------------------------------------------------------------------
// 4. Provenance.tsx (LLM wrapper)
// ---------------------------------------------------------------------------

describe('Provenance.tsx', () => {
  const src = readFile('components/intel/Provenance.tsx');

  test('is a client component', () => {
    expect(src).toMatch(/'use client'/);
  });

  test('exports Provenance function', () => {
    expect(src).toMatch(/export function Provenance/);
  });

  test('renders a "Why?" trigger button', () => {
    expect(src).toMatch(/Why\?/);
  });

  test('opens a modal with ProvenanceTrail', () => {
    expect(src).toMatch(/ProvenanceTrail/);
    expect(src).toMatch(/modalOpen/);
  });

  test('accepts claims, context, and children props', () => {
    expect(src).toMatch(/claims.*ProvenanceClaim/);
    expect(src).toMatch(/children.*React\.ReactNode/);
  });
});

// ---------------------------------------------------------------------------
// 5. Alert detail page — LLM strings wrapped with <Provenance>
// ---------------------------------------------------------------------------

describe('Alert detail page — provenance coverage of LLM context', () => {
  const src = readFile('app/app/[orgSlug]/alerts/[id]/page.tsx');

  test('imports Provenance component', () => {
    expect(src).toMatch(/import.*Provenance.*from.*intel\/Provenance/);
  });

  test('imports SourceBadge component', () => {
    expect(src).toMatch(/import.*SourceBadge.*from.*intel\/SourceBadge/);
  });

  test('imports ProvenanceTrail component', () => {
    expect(src).toMatch(/import.*ProvenanceTrail.*from.*intel\/ProvenanceTrail/);
  });

  test('fetches IntelClaim for this alert', () => {
    expect(src).toMatch(/IntelClaim\.find/);
  });

  test('wraps why_matters with <Provenance>', () => {
    expect(src).toMatch(/<Provenance[\s\S]*claims={provenanceClaims}/);
    expect(src).toMatch(/why_matters/);
  });

  test('wraps recommended_actions with <Provenance>', () => {
    expect(src).toMatch(/recommended_actions\.map/);
    // Each action should be wrapped
    expect(src).toMatch(/Provenance[\s\S]*Recommended action/);
  });

  test('renders ProvenanceTrail section', () => {
    expect(src).toMatch(/<ProvenanceTrail/);
    expect(src).toMatch(/claims={provenanceClaims}/);
  });

  test('shows SourceBadge on event sources', () => {
    expect(src).toMatch(/<SourceBadge/);
  });
});

// ---------------------------------------------------------------------------
// 6. Forecast detail page — claim graph + provenance trail
// ---------------------------------------------------------------------------

describe('Forecast detail page — provenance coverage', () => {
  const src = readFile('app/app/[orgSlug]/forecasts/[id]/page.tsx');

  test('imports ForecastClaimGraph', () => {
    expect(src).toMatch(/import.*ForecastClaimGraph.*from.*ForecastClaimGraph/);
  });

  test('imports ProvenanceTrail', () => {
    expect(src).toMatch(/import.*ProvenanceTrail.*from.*intel\/ProvenanceTrail/);
  });

  test('imports SourceBadge', () => {
    expect(src).toMatch(/import.*SourceBadge.*from.*intel\/SourceBadge/);
  });

  test('fetches supporting IntelClaims', () => {
    expect(src).toMatch(/IntelClaim\.find/);
  });

  test('renders ForecastClaimGraph', () => {
    expect(src).toMatch(/<ForecastClaimGraph/);
  });

  test('renders ProvenanceTrail', () => {
    expect(src).toMatch(/<ProvenanceTrail/);
  });
});

// ---------------------------------------------------------------------------
// 7. ForecastClaimGraph — React Flow usage
// ---------------------------------------------------------------------------

describe('ForecastClaimGraph.tsx', () => {
  const src = readFile('app/app/[orgSlug]/forecasts/[id]/ForecastClaimGraph.tsx');

  test('is a client component', () => {
    expect(src).toMatch(/'use client'/);
  });

  test('imports ReactFlow', () => {
    expect(src).toMatch(/from 'reactflow'/);
  });

  test('defines forecast root node and claim nodes', () => {
    expect(src).toMatch(/ForecastRootNode/);
    expect(src).toMatch(/ClaimNodeComponent/);
  });

  test('exports ForecastClaimGraph', () => {
    expect(src).toMatch(/export function ForecastClaimGraph/);
  });
});

// ---------------------------------------------------------------------------
// 8. Decisions page — IntelClaim chain count column
// ---------------------------------------------------------------------------

describe('Decisions page — IntelClaim integration', () => {
  const src = readFile('app/app/[orgSlug]/decisions/page.tsx');

  test('imports IntelClaim model', () => {
    expect(src).toMatch(/IntelClaim/);
  });

  test('aggregates claim counts per alert', () => {
    expect(src).toMatch(/claimCountMap/);
  });

  test('renders claims column with link to provenance', () => {
    expect(src).toMatch(/provenance/);
  });
});

// ---------------------------------------------------------------------------
// 9. Forecasts list page — SourceBadge + View Detail link
// ---------------------------------------------------------------------------

describe('Forecasts list page — provenance surface', () => {
  const src = readFile('app/app/[orgSlug]/forecasts/page.tsx');

  test('imports SourceBadge', () => {
    expect(src).toMatch(/import.*SourceBadge.*from.*intel\/SourceBadge/);
  });

  test('renders "View detail" link per forecast', () => {
    expect(src).toMatch(/View detail/);
  });

  test('renders SourceBadge for top source', () => {
    expect(src).toMatch(/<SourceBadge/);
  });
});
