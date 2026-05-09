import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISanctionsEntry {
  name: string;
  aliases: string[];
  country: string | null;
  dob: string | null;
  id_numbers: string[];
  programs: string[];
  source_url: string;
}

export interface ISanctionsList extends Document {
  list_name: 'ofac_sdn' | 'un_consolidated' | 'eu_restricted' | 'uk_hmt' | 'india_mea';
  version: string;
  entries: ISanctionsEntry[];
  updated_at: Date;
  entry_count: number;
}

const SanctionsEntrySchema = new Schema<ISanctionsEntry>(
  {
    name:       { type: String, required: true },
    aliases:    { type: [String], default: [] },
    country:    { type: String, default: null },
    dob:        { type: String, default: null },
    id_numbers: { type: [String], default: [] },
    programs:   { type: [String], default: [] },
    source_url: { type: String, required: true },
  },
  { _id: false },
);

const SanctionsListSchema = new Schema<ISanctionsList>(
  {
    list_name: {
      type: String,
      enum: ['ofac_sdn', 'un_consolidated', 'eu_restricted', 'uk_hmt', 'india_mea'],
      required: true,
    },
    version:     { type: String, required: true },
    entries:     { type: [SanctionsEntrySchema], default: [] },
    updated_at:  { type: Date, required: true },
    entry_count: { type: Number, required: true, default: 0 },
  },
  { timestamps: false },
);

SanctionsListSchema.index({ list_name: 1, version: -1 }, { unique: true });
SanctionsListSchema.index({ list_name: 1, updated_at: -1 });

export const SanctionsList: Model<ISanctionsList> =
  mongoose.models.SanctionsList ??
  mongoose.model<ISanctionsList>('SanctionsList', SanctionsListSchema);
