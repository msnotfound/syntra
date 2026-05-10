import { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import {
  User,
  Organization,
  Alert,
  Exposure,
  Counterparty,
  Shipment,
  WatchlistEntity,
  AssistantThread,
  UsageEvent,
} from '@syntra/db';
import { ensureDb } from '@/lib/db';
import { streamAssistantTurn } from '@syntra/llm';
import { checkUserRateLimit, extractClaimIds } from '@/lib/assistant/utils';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerAuth();
  if (!session) return new Response('Unauthorized', { status: 401 });

  if (!checkUserRateLimit(session.userId)) {
    return new Response(
      JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Max 60 queries per hour reached.' } }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );
  }

  await ensureDb();

  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return new Response('User not found', { status: 404 });

  const org = await Organization.findById(user.org_id).lean();
  if (!org) return new Response('Organization not found', { status: 404 });

  // Monthly token budget gate
  const monthlyBudget = org.settings.assistant_token_budget_monthly ?? 200_000;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const usageAgg = await UsageEvent.aggregate<{ total: number }>([
    {
      $match: {
        org_id: user.org_id,
        type: 'assistant_query',
        created_at: { $gte: monthStart },
      },
    },
    { $group: { _id: null, total: { $sum: '$metadata.tokens_used' } } },
  ]);
  const tokensUsedThisMonth = usageAgg[0]?.total ?? 0;
  if (tokensUsedThisMonth >= monthlyBudget) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'BUDGET_EXHAUSTED',
          message: 'Monthly assistant token budget exhausted. Contact your admin to increase the limit.',
        },
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let body: {
    conversation_id: string;
    prompt: string;
    context: { page: string; entity_ids: string[] };
  };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { conversation_id, prompt, context } = body;
  if (!conversation_id || !prompt) {
    return new Response('Missing required fields: conversation_id, prompt', { status: 400 });
  }

  const entityIds: string[] = context?.entity_ids ?? [];

  // Load prior turns for conversation context
  const existingThread = await AssistantThread.findOne({
    org_id: user.org_id,
    conversation_id,
  }).lean();
  const priorTurns = existingThread?.turns ?? [];

  // Resolve org documents referenced in the current page context
  const resolvedDocs: string[] = [];
  if (entityIds.length > 0) {
    const [alerts, exposures, counterparties, shipments, entities] = await Promise.all([
      Alert.find({ _id: { $in: entityIds }, org_id: user.org_id }).lean(),
      Exposure.find({ _id: { $in: entityIds }, org_id: user.org_id }).lean(),
      Counterparty.find({ _id: { $in: entityIds }, org_id: user.org_id }).lean(),
      Shipment.find({ _id: { $in: entityIds }, org_id: user.org_id }).lean(),
      WatchlistEntity.find({ _id: { $in: entityIds }, org_id: user.org_id }).lean(),
    ]);

    for (const a of alerts) {
      const alert = a as Record<string, unknown>;
      resolvedDocs.push(
        `ALERT [${String(a._id)}]: ${alert.title} — ${alert.description ?? ''} (severity: ${alert.severity})`,
      );
    }
    for (const e of exposures) {
      const exp = e as Record<string, unknown>;
      resolvedDocs.push(
        `EXPOSURE [${String(e._id)}]: entity=${exp.entity_name ?? ''} value=${exp.exposure_value ?? ''} currency=${exp.currency ?? ''}`,
      );
    }
    for (const c of counterparties) {
      const cp = c as Record<string, unknown>;
      resolvedDocs.push(
        `COUNTERPARTY [${String(c._id)}]: ${cp.name} (${cp.country_code ?? ''}, role: ${cp.role ?? ''})`,
      );
    }
    for (const s of shipments) {
      const ship = s as Record<string, unknown>;
      resolvedDocs.push(
        `SHIPMENT [${String(s._id)}]: ref=${ship.reference_number ?? ''} status=${ship.status ?? ''}`,
      );
    }
    for (const w of entities) {
      const ent = w as Record<string, unknown>;
      resolvedDocs.push(
        `WATCHLIST_ENTITY [${String(w._id)}]: ${ent.name} (type: ${ent.type}, country: ${ent.country_code ?? ''})`,
      );
    }
  }

  const systemPrompt = `You are a risk intelligence assistant for ${org.name}, a ${org.industry ?? 'supply chain'} company using the Syntra platform.

ROLE: You have read-only access to this organisation's risk data. Answer questions based ONLY on the provided context documents. If a fact comes from a specific document, cite it inline as [claim:<document_id>] — for example "Red Sea disruptions are ongoing [claim:64a1b2c3d4e5f6a7b8c9d0e1]". If the answer requires external knowledge not present in the context, say so clearly and briefly.

RULES:
- Never fabricate data or make up document IDs.
- Be concise, factual, and professional. One or two short paragraphs unless detail is requested.
- When referencing a document, use the exact ID shown in square brackets at the start of each context line.

CURRENT PAGE: ${context?.page ?? 'unknown'}

ORG CONTEXT DOCUMENTS:
${resolvedDocs.length > 0 ? resolvedDocs.join('\n') : '(No specific entity context loaded. The user is viewing a general page.)'}`;

  const llmMessages = [
    ...priorTurns.map(t => ({ role: t.role as 'user' | 'assistant', content: t.text })),
    { role: 'user' as const, content: prompt },
  ];

  const orgId = user.org_id;
  const userId = session.userId;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = '';

      const enqueue = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // client disconnected
        }
      };

      let usage = { input_tokens: 0, output_tokens: 0 };
      try {
        const result = await streamAssistantTurn(systemPrompt, llmMessages, text => {
          enqueue(`event: token\ndata: ${JSON.stringify({ text })}\n\n`);
        });
        fullText = result.fullText;
        usage = result.usage;
      } catch {
        enqueue(`event: error\ndata: ${JSON.stringify({ message: 'LLM error — please try again.' })}\n\n`);
        try { controller.close(); } catch { /* ignored */ }
        return;
      }

      const citedClaimIds = extractClaimIds(fullText);
      const now = new Date();

      try {
        await AssistantThread.findOneAndUpdate(
          { org_id: orgId, conversation_id },
          {
            $set: {
              user_id: userId,
              context_page: context?.page ?? null,
              context_entity_ids: entityIds,
            },
            $push: {
              turns: {
                $each: [
                  { role: 'user',      text: prompt,   cited_claim_ids: [],            created_at: now },
                  { role: 'assistant', text: fullText, cited_claim_ids: citedClaimIds, created_at: new Date(now.getTime() + 1) },
                ],
              },
            },
          },
          { upsert: true },
        );

        const totalTokens = usage.input_tokens + usage.output_tokens;
        if (totalTokens > 0) {
          await UsageEvent.create({
            org_id: orgId,
            type: 'assistant_query',
            metadata: { conversation_id, tokens_used: totalTokens, user_id: userId },
          });
        }
      } catch {
        // Persist failure must not abort the already-streamed response
      }

      enqueue(`event: done\ndata: ${JSON.stringify({ conversation_id, cited_claim_ids: citedClaimIds })}\n\n`);
      try { controller.close(); } catch { /* ignored */ }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
