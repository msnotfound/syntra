import { connectDb, Alert, DigestPreference, Organization, WatchlistEntity } from '@syntra/db';
import type { IAlert, IOrganization } from '@syntra/db';
import { RISK_BRIEF_NARRATIVE } from '../../../../specs/contracts/05-llm-prompts.contract.js';
import { renderDigestHtml } from '../../../../packages/shared/email-templates/digest.js';
import type { DigestAlertItem } from '../../../../packages/shared/email-templates/digest.js';

// ---------------------------------------------------------------------------
// LLM narrative generation — uses RISK_BRIEF_NARRATIVE prompt per contract
// ---------------------------------------------------------------------------

interface DigestNarrative { executive_summary: string; recommended_actions: string[] }

let _anthropic: import('@anthropic-ai/sdk').default | null = null;

function getAnthropicClient() {
  if (!_anthropic) {
    const { default: Anthropic } = require('@anthropic-ai/sdk');
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic!;
}

async function generateNarrative(alert: IAlert, orgName: string): Promise<DigestNarrative> {
  const inputs = {
    alert_title: alert.event_snapshot.title,
    alert_severity: alert.severity as 'critical' | 'high' | 'medium' | 'low',
    event_summary: alert.event_snapshot.description,
    affected_entities: alert.watchlist_entity_ids.map(id => ({ name: String(id), type: 'entity' })),
    financial_exposure_inr: null as number | null,
    recommended_actions: alert.llm_context.recommended_actions,
    org_name: orgName,
    generated_at: new Date().toISOString(),
  };

  const fallback: DigestNarrative = {
    executive_summary: `${inputs.alert_title} — ${inputs.alert_severity} severity in ${alert.event_snapshot.country}.`,
    recommended_actions: inputs.recommended_actions.length ? inputs.recommended_actions : ['Review full alert for details.'],
  };

  if (!process.env.ANTHROPIC_API_KEY) return fallback;

  const prompt = RISK_BRIEF_NARRATIVE.template
    .replace('{{org_name}}', inputs.org_name)
    .replace('{{generated_at}}', inputs.generated_at)
    .replace('{{alert_title}}', inputs.alert_title)
    .replace('{{alert_severity}}', inputs.alert_severity)
    .replace('{{event_summary}}', inputs.event_summary)
    .replace('{{affected_entities}}', JSON.stringify(inputs.affected_entities))
    .replace('{{financial_exposure_inr}}', String(inputs.financial_exposure_inr))
    .replace('{{recommended_actions}}', JSON.stringify(inputs.recommended_actions));

  try {
    const client = getAnthropicClient();
    const msg = await client.messages.create({
      model: RISK_BRIEF_NARRATIVE.model,
      max_tokens: 512,
      system: RISK_BRIEF_NARRATIVE.system,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = (msg.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(text);
    const result = RISK_BRIEF_NARRATIVE.expected_output_format.safeParse(parsed);
    if (result.success) {
      return {
        executive_summary: result.data.executive_summary,
        recommended_actions: inputs.recommended_actions,
      };
    }
  } catch {
    // fall through
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Email dispatch
// ---------------------------------------------------------------------------

async function sendDigestEmail(to: string, subject: string, html: string): Promise<void> {
  if (!process.env.SENDGRID_API_KEY) {
    const { sendEmail } = await import('@syntra/shared/mocks/sendgrid.js');
    return sendEmail({ to, from: 'Syntra <alerts@syntra.app>', subject, html });
  }
  const sgMail = await import('@sendgrid/mail');
  await sgMail.default.send({ to, from: 'Syntra <alerts@syntra.app>', subject, html });
}

// ---------------------------------------------------------------------------
// Top VaR entities — gracefully skips if exposures collection absent
// ---------------------------------------------------------------------------

async function getTopVarEntities(
  orgId: string,
  limit: number,
): Promise<Array<{ name: string; type: string; var_usd: number | null }>> {
  try {
    const mongoose = await import('mongoose');
    const db = mongoose.connection.db;
    if (!db) return [];

    const exposures = await db.collection('exposures')
      .find({ org_id: new mongoose.Types.ObjectId(orgId) })
      .sort({ var_value_usd: -1 })
      .limit(limit)
      .toArray();

    const out: Array<{ name: string; type: string; var_usd: number | null }> = [];
    for (const exp of exposures) {
      const entity = await WatchlistEntity.findById(exp.entity_id).lean();
      if (entity) out.push({ name: entity.name, type: entity.type, var_usd: exp.var_value_usd as number });
    }
    return out;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Period label
// ---------------------------------------------------------------------------

function periodLabel(type: 'daily' | 'weekly' | 'monthly', since: Date): string {
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  if (type === 'daily') return since.toLocaleDateString('en-IN', opts);
  if (type === 'weekly') return `${since.toLocaleDateString('en-IN', opts)} – ${now.toLocaleDateString('en-IN', opts)}`;
  return since.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Main cycle — called by each cron entry point
// ---------------------------------------------------------------------------

export async function runDigestCycle(
  digestType: 'daily' | 'weekly' | 'monthly',
  since: Date,
): Promise<{ orgs: number; sent: number }> {
  await connectDb();

  const prefs = await DigestPreference.find({ frequency: digestType, enabled: true }).lean();
  const orgIds = [...new Set(prefs.map(p => String(p.org_id)))];

  let sent = 0;

  for (const orgId of orgIds) {
    const org = await Organization.findById(orgId).lean() as IOrganization | null;
    if (!org || org.status !== 'active') continue;

    const alerts = await Alert.find({
      org_id: orgId,
      created_at: { $gte: since },
    }).sort({ created_at: -1 }).limit(20).lean() as unknown as IAlert[];

    const alertsBySev: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const digestItems: DigestAlertItem[] = [];

    for (const alert of alerts) {
      alertsBySev[alert.severity] = (alertsBySev[alert.severity] ?? 0) + 1;
      const narrative = await generateNarrative(alert, org.name);
      digestItems.push({
        title: alert.event_snapshot.title,
        severity: alert.severity,
        country: alert.event_snapshot.country,
        occurred_at: alert.event_snapshot.occurred_at,
        executive_summary: narrative.executive_summary,
        recommended_actions: narrative.recommended_actions,
      });
    }

    const hotEntities = await getTopVarEntities(orgId, 3);

    const html = renderDigestHtml({
      orgName: org.name,
      digestType,
      periodLabel: periodLabel(digestType, since),
      alerts: digestItems,
      alertCountBySeverity: alertsBySev,
      hotEntities,
      generatedAt: new Date(),
    });

    const labels = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' } as const;
    const subject = `[Syntra] ${labels[digestType]} Risk Digest — ${org.name}`;

    const orgPrefs = prefs.filter(p => String(p.org_id) === orgId);
    for (const pref of orgPrefs) {
      if (pref.channels.includes('email')) {
        await sendDigestEmail(org.contact_email, subject, html);
        sent++;
      }
    }
  }

  return { orgs: orgIds.length, sent };
}
