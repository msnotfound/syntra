import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import type { ISanctionsEntry } from './SanctionsList.js';

export interface ISanctionsReviewQueue extends Document {
  org_id: Types.ObjectId;
  entity_id: Types.ObjectId;
  entity_name: string;
  list_name: string;
  matched_name: string;
  match_score: number;
  list_version: string;
  entry: ISanctionsEntry;
  screened_at: Date;
  status: 'pending' | 'cleared' | 'confirmed';
  reviewed_at: Date | null;
  reviewed_by_user_id: Types.ObjectId | null;
}

const SanctionsReviewQueueSchema = new Schema<ISanctionsReviewQueue>(
  {
    org_id:    { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    entity_id: { type: Schema.Types.ObjectId, ref: 'WatchlistEntity', required: true },
    entity_name:   { type: String, required: true },
    list_name:     { type: String, required: true },
    matched_name:  { type: String, required: true },
    match_score:   { type: Number, required: true, min: 0, max: 100 },
    list_version:  { type: String, required: true },
    entry: {
      name:       { type: String, required: true },
      aliases:    { type: [String], default: [] },
      country:    { type: String, default: null },
      dob:        { type: String, default: null },
      id_numbers: { type: [String], default: [] },
      programs:   { type: [String], default: [] },
      source_url: { type: String, required: true },
    },
    screened_at: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'cleared', 'confirmed'],
      default: 'pending',
    },
    reviewed_at:           { type: Date, default: null },
    reviewed_by_user_id:   { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: false },
);

SanctionsReviewQueueSchema.index({ org_id: 1, status: 1, screened_at: -1 });
SanctionsReviewQueueSchema.index({ entity_id: 1, list_name: 1 }, { unique: true });

export const SanctionsReviewQueue: Model<ISanctionsReviewQueue> =
  mongoose.models.SanctionsReviewQueue ??
  mongoose.model<ISanctionsReviewQueue>('SanctionsReviewQueue', SanctionsReviewQueueSchema);
