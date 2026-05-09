import mongoose, { Schema, Document, Model } from 'mongoose';

export type AdmiraltyCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface ISourceReliability extends Document {
  source_id: string;       // stable slug: "reuters", "al-jazeera", etc.
  source_name: string;
  admiralty_code: AdmiraltyCode;
  reliability_pct: number; // 0–100
  last_assessed_at: Date;
}

const SourceReliabilitySchema = new Schema<ISourceReliability>(
  {
    source_id:        { type: String, required: true, unique: true },
    source_name:      { type: String, required: true },
    admiralty_code:   { type: String, enum: ['A','B','C','D','E','F'], required: true },
    reliability_pct:  { type: Number, required: true, min: 0, max: 100 },
    last_assessed_at: { type: Date, required: true },
  },
  { timestamps: false },
);

SourceReliabilitySchema.index({ source_id: 1 }, { unique: true });

export const SourceReliability: Model<ISourceReliability> =
  mongoose.models.SourceReliability ??
  mongoose.model<ISourceReliability>('SourceReliability', SourceReliabilitySchema);

// ---------------------------------------------------------------------------
// Pre-seed known sources (idempotent — uses upsert).
// ---------------------------------------------------------------------------

export interface KnownSourceSeed {
  source_id: string;
  source_name: string;
  admiralty_code: AdmiraltyCode;
  reliability_pct: number;
  last_assessed_at: Date;
}

export const KNOWN_SOURCES: KnownSourceSeed[] = [
  { source_id: 'reuters',      source_name: 'Reuters',          admiralty_code: 'A', reliability_pct: 95, last_assessed_at: new Date('2026-01-01') },
  { source_id: 'ap',           source_name: 'AP News',          admiralty_code: 'A', reliability_pct: 95, last_assessed_at: new Date('2026-01-01') },
  { source_id: 'bloomberg',    source_name: 'Bloomberg News',   admiralty_code: 'A', reliability_pct: 93, last_assessed_at: new Date('2026-01-01') },
  { source_id: 'al-jazeera',   source_name: 'Al Jazeera',       admiralty_code: 'B', reliability_pct: 78, last_assessed_at: new Date('2026-01-01') },
  { source_id: 'lloyds-list',  source_name: "Lloyd's List",     admiralty_code: 'B', reliability_pct: 82, last_assessed_at: new Date('2026-01-01') },
  { source_id: 'bbc',          source_name: 'BBC News',         admiralty_code: 'B', reliability_pct: 80, last_assessed_at: new Date('2026-01-01') },
  { source_id: 'ft',           source_name: 'Financial Times',  admiralty_code: 'B', reliability_pct: 85, last_assessed_at: new Date('2026-01-01') },
  { source_id: 'gdelt',        source_name: 'GDELT Project',    admiralty_code: 'C', reliability_pct: 60, last_assessed_at: new Date('2026-01-01') },
  { source_id: 'local-news',   source_name: 'Local News',       admiralty_code: 'D', reliability_pct: 40, last_assessed_at: new Date('2026-01-01') },
  { source_id: 'social-media', source_name: 'Social Media',     admiralty_code: 'E', reliability_pct: 20, last_assessed_at: new Date('2026-01-01') },
];

export async function seedSourceReliability(): Promise<void> {
  const ops = KNOWN_SOURCES.map((s: KnownSourceSeed) => ({
    updateOne: {
      filter: { source_id: s.source_id },
      update: { $setOnInsert: s },
      upsert: true,
    },
  }));
  await SourceReliability.bulkWrite(ops);
}
