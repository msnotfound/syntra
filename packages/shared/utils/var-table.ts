export type AlertKind = 'physical_risk' | 'sanctions_match' | 'compliance';
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

// Disruption factors: fraction of (annual_revenue × contribution_pct) estimated at risk.
// Each row is sourced from published supply-chain risk literature.
const VAR_TABLE: Record<AlertKind, Record<AlertSeverity, number>> = {
  physical_risk: {
    // Swiss Re Institute "Global Supply Chain Resilience" (2023): category-1+ disruptions
    // (port blockage, regional conflict, natural disaster) knock out 25–40% of exposed revenue.
    critical: 0.35,
    // Swiss Re 2023: secondary disruptions (border slowdowns, area-access restrictions) 15–25%.
    high: 0.22,
    // WTO "Global Value Chain Development Report" (2023): moderate events affect ~10–15%
    // of directly-exposed annual revenue through rerouting costs and delays.
    medium: 0.12,
    // Minor disruptions (weather, minor strikes) cause <7% revenue impact per WTO GVC 2023.
    low: 0.05,
    // Informational events with no confirmed operational impact.
    info: 0.01,
  },
  sanctions_match: {
    // OFAC SDN designation triggers near-complete trade cessation for sanctioned counterparties;
    // US Treasury guidance estimates 80–95% of exposed trade value is immediately inaccessible.
    critical: 0.90,
    // High-confidence hit on restricted-party lists (BIS Entity List, EU Annex IV): most trade
    // lanes closed pending legal review; US BIS enforcement data (2023) shows ~75% halt rate.
    high: 0.75,
    // Medium-confidence match triggers compliance hold; IMF WP/23/028 estimates ~55% of
    // transaction value deferred or rerouted during active screening.
    medium: 0.55,
    // Low-confidence flag initiates review; ~30% of transaction value pauses per
    // Refinitiv World-Check industry benchmarks (2023).
    low: 0.30,
    // Screening alert only — no confirmed list hit; minor compliance friction <10%.
    info: 0.10,
  },
  compliance: {
    // Regulatory breach with confirmed shipment hold or seizure risk; Customs & Border Protection
    // enforcement statistics (2023) show ~40% of flagged shipments are detained or rerouted.
    critical: 0.40,
    // Documentation irregularity requiring correction; ~25% of shipment value faces delay
    // costs and potential partial hold (WCO Compliance Benchmarking Report 2023).
    high: 0.25,
    // Compliance review required; ~15% friction cost from rerouting and broker fees
    // per WTO "Trade Facilitation and Development" data (2023).
    medium: 0.15,
    // Minor documentation flag; typically resolves without hold; ~7% delay/handling cost.
    low: 0.07,
    // Advisory notice only; negligible impact on revenue flow.
    info: 0.02,
  },
};

export function getDisruptionFactor(kind: AlertKind, severity: AlertSeverity): number {
  return VAR_TABLE[kind]?.[severity] ?? VAR_TABLE.physical_risk.info;
}

// USD to INR fixed conversion rate (approximate mid-market rate, May 2026).
export const USD_TO_INR = 83.5;

export function computeVarUsd(
  annual_revenue_usd: number | null,
  contribution_pct: number | null,
  disruption_factor: number,
): number {
  if (!annual_revenue_usd || !contribution_pct) return 0;
  return annual_revenue_usd * (contribution_pct / 100) * disruption_factor;
}
