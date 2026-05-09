/**
 * withCostGate — wraps any FeedProvider with a daily INR spend cap.
 * Free providers (cost_per_request_inr === 0) are returned unchanged.
 * For paid providers, each fetch() call estimates cost and checks against the cap.
 * When cap is exceeded, FeedCapExceededError is thrown and getMockData() is returned.
 *
 * Per-org daily spend is tracked in-process (Map). Production implementations
 * should persist to the feed_usage collection (see CCR m33-1 / contract §06).
 */

export class FeedCapExceededError extends Error {
  constructor(
    public readonly provider_id: string,
    public readonly org_id: string,
    public readonly cap_inr_daily: number,
  ) {
    super(
      `[${provider_id}] Daily INR cap of ${cap_inr_daily} exceeded for org ${org_id}. Mock data returned.`,
    );
    this.name = 'FeedCapExceededError';
  }
}

type CostModel = 'free' | 'freemium' | 'paid';
interface RateLimit { requests_per_minute: number; requests_per_day: number }

export interface FeedProvider<TQuery, TResponse> {
  readonly id: string;
  readonly name: string;
  readonly cost_model: CostModel;
  readonly cost_per_request_inr: number;
  readonly rate_limit: RateLimit;
  fetch(query: TQuery, opts: { org_id: string }): Promise<TResponse>;
  getMockData(query: TQuery): TResponse;
  estimateCost(query: TQuery): number;
  withCostGate(opts: { org_id: string; cap_inr_daily: number }): FeedProvider<TQuery, TResponse>;
}

// In-process daily spend tracker. Key: `${org_id}:${provider_id}:${date}`.
const dailySpend = new Map<string, number>();

function spendKey(org_id: string, provider_id: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${org_id}:${provider_id}:${date}`;
}

export function withCostGate<TQuery, TResponse>(
  provider: FeedProvider<TQuery, TResponse>,
  opts: { org_id: string; cap_inr_daily: number },
): FeedProvider<TQuery, TResponse> {
  if (provider.cost_per_request_inr === 0) return provider;

  const { org_id, cap_inr_daily } = opts;

  return {
    id: provider.id,
    name: provider.name,
    cost_model: provider.cost_model,
    cost_per_request_inr: provider.cost_per_request_inr,
    rate_limit: provider.rate_limit,
    getMockData: (q: TQuery) => provider.getMockData(q),
    estimateCost: (q: TQuery) => provider.estimateCost(q),
    async fetch(query: TQuery, fetchOpts: { org_id: string }): Promise<TResponse> {
      const cost = provider.estimateCost(query);
      const key = spendKey(org_id, provider.id);
      const current = dailySpend.get(key) ?? 0;

      if (current + cost > cap_inr_daily) {
        throw new FeedCapExceededError(provider.id, org_id, cap_inr_daily);
      }

      const result = await provider.fetch(query, fetchOpts);
      dailySpend.set(key, current + cost);
      return result;
    },
    withCostGate(newOpts) {
      return withCostGate(provider, newOpts);
    },
  };
}
