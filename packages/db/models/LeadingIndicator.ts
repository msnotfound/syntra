import mongoose, { Schema, Document, Model } from 'mongoose';

export type ThresholdBreach = 'normal' | 'elevated' | 'critical';

export interface ILeadingIndicator extends Document {
  org_id: string;          // 'system' for global indicators
  name: string;
  description: string;
  formula_doc: string;     // inline documentation of the computation formula
  source_modules: string[];
  current_value: number;   // 0–1 normalised
  baseline_value: number;  // historical median
  sigma: number;           // std dev of recent readings used for threshold
  computed_at: Date;
  threshold_breach: ThresholdBreach;
  trend: 'rising' | 'stable' | 'falling';
}

const LeadingIndicatorSchema = new Schema<ILeadingIndicator>(
  {
    org_id:           { type: String, required: true, default: 'system' },
    name:             { type: String, required: true },
    description:      { type: String, required: true },
    formula_doc:      { type: String, required: true },
    source_modules:   { type: [String], required: true },
    current_value:    { type: Number, required: true, min: 0, max: 1, default: 0 },
    baseline_value:   { type: Number, required: true, min: 0, max: 1, default: 0 },
    sigma:            { type: Number, required: true, default: 0 },
    computed_at:      { type: Date, required: true, default: () => new Date() },
    threshold_breach: { type: String, enum: ['normal','elevated','critical'], default: 'normal' },
    trend:            { type: String, enum: ['rising','stable','falling'], default: 'stable' },
  },
  { timestamps: false },
);

LeadingIndicatorSchema.index({ name: 1 }, { unique: true });
LeadingIndicatorSchema.index({ threshold_breach: 1 });

export const LeadingIndicator: Model<ILeadingIndicator> =
  mongoose.models.LeadingIndicator ??
  mongoose.model<ILeadingIndicator>('LeadingIndicator', LeadingIndicatorSchema);

// ---------------------------------------------------------------------------
// 8 system indicators — seeded on first boot
// ---------------------------------------------------------------------------

type SeedEntry = Pick<ILeadingIndicator, 'org_id' | 'name' | 'description' | 'formula_doc' | 'source_modules'>;

export const INDICATOR_SEEDS: SeedEntry[] = [
  {
    org_id: 'system',
    name: 'port-call-rate-anomaly',
    description: 'Deviation in vessel port-call frequency at monitored ports. Rising anomaly suggests congestion or blockage.',
    formula_doc: 'Count VesselPosition docs with nav_status in ["moored","at anchor","aground"] in last 7 days as a fraction of all positions. Normalise to [0,1] by dividing by the 30-day peak fraction. Baseline = median of 30 daily fractions over the prior 90 days. σ = std dev of those 30 daily fractions. Threshold: >1σ above baseline = elevated, >2σ = critical.',
    source_modules: ['M34-VesselPosition', 'M33-DataFeed'],
  },
  {
    org_id: 'system',
    name: 'sanctions-list-velocity',
    description: 'Rate of new entity additions to sanctions lists. Rapid additions signal escalating geopolitical pressure.',
    formula_doc: 'Delta of SanctionsList.entry_count across all lists in last 7 days vs prior 7-day period. Normalise by dividing by 500 (max meaningful delta). Baseline = median of 13 weekly deltas over last 90 days, normalised the same way. σ = std dev of those normalised weekly deltas. Threshold: >1σ = elevated, >2σ = critical.',
    source_modules: ['M17-SanctionsList'],
  },
  {
    org_id: 'system',
    name: 'shipping-deviation-frequency',
    description: 'Fraction of vessel positions reporting speed < 1 knot (stopped). High deviation rate precedes route blockage events.',
    formula_doc: 'Count VesselPosition docs with speed_knots < 1 in last 7 days, divided by total positions. Baseline = median of 30 daily stopped-rates over last 90 days. σ = std dev of those daily rates. Threshold: >1σ = elevated, >2σ = critical.',
    source_modules: ['M34-VesselPosition'],
  },
  {
    org_id: 'system',
    name: 'currency-volatility',
    description: 'Std dev of exposure_delta_usd values as a proxy for currency-driven trade cost variability.',
    formula_doc: 'Compute std dev of |Exposure.exposure_delta_usd| for all non-null values in last 30 days. Normalise by the 90-day max observed std dev. Baseline = median of rolling 30-day std devs over the prior 90 days (60 rolling windows). σ = std dev of those normalised rolling std devs. Threshold: >1σ above baseline = elevated, >2σ = critical.',
    source_modules: ['M30-Exposure'],
  },
  {
    org_id: 'system',
    name: 'commodity-price-spike',
    description: 'Frequency of commodity price spike terms in intelligence claims. Leading indicator for supply-side cost shocks.',
    formula_doc: 'Count IntelClaims in last 7 days matching regex /(oil price|fuel surcharge|commodity|freight rate|bunker)/i, as a fraction of total claims that period. Baseline = median of 30 daily hit-rates over last 90 days. σ = std dev of those daily rates. Threshold: >1σ = elevated, >2σ = critical.',
    source_modules: ['M28-IntelClaim', 'M35-CustomSource'],
  },
  {
    org_id: 'system',
    name: 'regulatory-mention-frequency',
    description: 'Frequency of regulatory/compliance terms in intel claims. Precedes formal sanctions and trade restriction announcements.',
    formula_doc: 'Count IntelClaims in last 7 days matching regex /(regulation|compliance|sanctions|export control|embargo|restriction|OFAC|EU regulation)/i, as a fraction of total claims. Baseline = median of 30 daily rates over last 90 days. σ = std dev of those rates. Threshold: >1σ = elevated, >2σ = critical.',
    source_modules: ['M28-IntelClaim'],
  },
  {
    org_id: 'system',
    name: 'vessel-position-anomaly',
    description: 'Proportion of AIS reports with anomalous nav status (not under command / restricted manoeuvrability). Precedes route disruptions.',
    formula_doc: 'Count VesselPosition docs with nav_status in ["not under command","restricted manoeuvrability"] in last 7 days, divided by total positions that period. Baseline = median of 30 daily anomaly rates over last 90 days. σ = std dev of those rates. Threshold: >1σ = elevated, >2σ = critical.',
    source_modules: ['M34-VesselPosition'],
  },
  {
    org_id: 'system',
    name: 'supplier-news-velocity',
    description: 'Rate of intel claims mentioning tracked supplier entities. Spikes indicate operational disruption risk.',
    formula_doc: 'Count IntelClaims in last 7 days whose claim_text matches any WatchlistEntity.name of type "supplier". Divide by supplier count (min 1) to get mentions-per-supplier. Normalise to [0,1] assuming 10 mentions/supplier = max signal. Baseline = median mentions-per-supplier over 30 daily windows in last 90 days. σ = std dev of those daily values. Threshold: >1σ = elevated, >2σ = critical.',
    source_modules: ['M28-IntelClaim', 'M31-WatchlistEntity'],
  },
];

export async function seedLeadingIndicators(): Promise<void> {
  for (const seed of INDICATOR_SEEDS) {
    await LeadingIndicator.updateOne(
      { name: seed.name },
      {
        $setOnInsert: {
          ...seed,
          current_value: 0,
          baseline_value: 0,
          sigma: 0,
          computed_at: new Date(),
          threshold_breach: 'normal',
          trend: 'stable',
        },
      },
      { upsert: true },
    );
  }
}
