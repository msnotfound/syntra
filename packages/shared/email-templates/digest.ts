export interface DigestAlertItem {
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  country: string;
  occurred_at: Date;
  executive_summary: string;
  recommended_actions: string[];
}

export interface DigestEmailProps {
  orgName: string;
  digestType: 'daily' | 'weekly' | 'monthly';
  periodLabel: string;
  alerts: DigestAlertItem[];
  alertCountBySeverity: Record<string, number>;
  hotEntities: Array<{ name: string; type: string; var_usd: number | null }>;
  generatedAt: Date;
}

const SEV_COLOR: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  low: '#60A5FA',
};

function fmt(n: number | null): string {
  if (n === null) return 'N/A';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function renderDigestHtml(props: DigestEmailProps): string {
  const { orgName, digestType, periodLabel, alerts, alertCountBySeverity, hotEntities, generatedAt } = props;
  const total = alerts.length;

  const alertRows = alerts.map(a => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #1E2530;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${SEV_COLOR[a.severity] ?? '#94A3B8'};margin-right:6px;vertical-align:middle;"></span>
        <strong style="color:#FAFAFA;font-size:13px;">${a.title}</strong>
        <div style="color:#94A3B8;font-size:12px;margin-top:3px;">${a.country} &middot; ${new Date(a.occurred_at).toLocaleDateString('en-IN')}</div>
        <div style="color:#94A3B8;font-size:12px;margin-top:4px;">${a.executive_summary}</div>
        ${a.recommended_actions.length ? `<ul style="margin:6px 0 0;padding-left:18px;color:#94A3B8;font-size:12px;">${a.recommended_actions.map(r => `<li>${r}</li>`).join('')}</ul>` : ''}
      </td>
    </tr>
  `).join('');

  const sevSummary = Object.entries(alertCountBySeverity)
    .filter(([, c]) => c > 0)
    .map(([s, c]) => `<span style="display:inline-block;margin-right:12px;font-size:12px;color:#94A3B8;"><span style="color:${SEV_COLOR[s] ?? '#94A3B8'};font-weight:600;">${c}</span> ${cap(s)}</span>`)
    .join('');

  const entityRows = hotEntities.length
    ? hotEntities.map(e => `
    <tr>
      <td style="padding:8px 16px;border-bottom:1px solid #1E2530;color:#FAFAFA;font-size:13px;">${e.name}</td>
      <td style="padding:8px 16px;border-bottom:1px solid #1E2530;color:#94A3B8;font-size:12px;text-transform:capitalize;">${e.type}</td>
      <td style="padding:8px 16px;border-bottom:1px solid #1E2530;color:#FAFAFA;font-size:13px;font-family:monospace;">${fmt(e.var_usd)}</td>
    </tr>
  `).join('')
    : `<tr><td colspan="3" style="padding:16px;color:#64748B;font-size:12px;text-align:center;">No exposure data available</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0B0E14;font-family:Inter,'Geist Sans',system-ui,sans-serif;color:#FAFAFA;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B0E14;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#151921;border-radius:6px;border:1px solid #1E2530;overflow:hidden;">
        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #1E2530;">
            <span style="font-size:18px;font-weight:600;color:#FAFAFA;">Syntra</span>
            <span style="font-size:12px;color:#64748B;margin-left:8px;">${cap(digestType)} Risk Digest</span>
            <div style="font-size:20px;font-weight:600;color:#FAFAFA;margin-top:12px;">${orgName}</div>
            <div style="font-size:13px;color:#94A3B8;margin-top:4px;">${periodLabel}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-bottom:1px solid #1E2530;background:#1E2530;">
            <div style="font-size:12px;color:#94A3B8;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">Alert Summary</div>
            <div style="font-size:24px;font-weight:600;color:#FAFAFA;margin-bottom:8px;">${total} alert${total !== 1 ? 's' : ''}</div>
            <div>${sevSummary}</div>
          </td>
        </tr>
        ${total > 0 ? `
        <tr><td style="padding:20px 32px 8px;"><div style="font-size:11px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.06em;">Alerts This Period</div></td></tr>
        <tr><td style="padding:0 16px;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1E2530;border-radius:4px;overflow:hidden;">${alertRows}</table></td></tr>
        ` : `<tr><td style="padding:32px;text-align:center;color:#64748B;font-size:13px;">No alerts during this period. All clear.</td></tr>`}
        <tr><td style="padding:20px 32px 8px;border-top:1px solid #1E2530;"><div style="font-size:11px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.06em;">Top Entities by Exposure</div></td></tr>
        <tr><td style="padding:0 16px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1E2530;border-radius:4px;overflow:hidden;">
            <tr style="background:#1E2530;">
              <th style="padding:8px 16px;text-align:left;font-size:11px;color:#94A3B8;font-weight:500;">Entity</th>
              <th style="padding:8px 16px;text-align:left;font-size:11px;color:#94A3B8;font-weight:500;">Type</th>
              <th style="padding:8px 16px;text-align:left;font-size:11px;color:#94A3B8;font-weight:500;">VaR (USD)</th>
            </tr>
            ${entityRows}
          </table>
        </td></tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #1E2530;background:#0B0E14;">
            <div style="font-size:11px;color:#64748B;">Generated ${new Date(generatedAt).toUTCString()} &middot; Syntra is built on the Warfront geopolitical intelligence platform</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
