import type { IRiskBriefContent } from '@syntra/db';

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  low: '#60A5FA',
  info: '#94A3B8',
};

const INR_FMT = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** Renders a RiskBrief content to a PDF Buffer using @react-pdf/renderer. */
export async function renderBriefPdf(content: IRiskBriefContent): Promise<Buffer> {
  const {
    Document, Page, Text, View, StyleSheet, renderToBuffer,
  } = await import('@react-pdf/renderer');
  const { createElement: h } = await import('react');

  const styles = StyleSheet.create({
    page:        { fontFamily: 'Helvetica', fontSize: 10, padding: 40, backgroundColor: '#ffffff', color: '#1a1a2e' },
    header:      { marginBottom: 24, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 16 },
    orgName:     { fontSize: 8, color: '#64748B', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
    title:       { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 6 },
    meta:        { fontSize: 8, color: '#94A3B8', flexDirection: 'row', gap: 12 },
    metaItem:    { flexDirection: 'row', gap: 4 },
    severityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
    section:     { marginBottom: 18 },
    sectionLabel:{ fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 1.2, color: '#64748B', marginBottom: 6 },
    body:        { fontSize: 10, lineHeight: 1.5, color: '#334155' },
    entityRow:   { flexDirection: 'row', gap: 8, marginBottom: 4, alignItems: 'center' },
    entityType:  { fontSize: 7, textTransform: 'uppercase', color: '#94A3B8', width: 60 },
    entityName:  { fontSize: 9, color: '#334155' },
    varBox:      { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 4, padding: 12, marginBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    varLabel:    { fontSize: 8, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 },
    varValue:    { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
    footer:      { position: 'absolute', bottom: 24, left: 40, right: 40, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
    footerText:  { fontSize: 7, color: '#94A3B8' },
    watermark:   { fontSize: 7, color: '#94A3B8', fontFamily: 'Helvetica-Oblique' },
  });

  const severityColor = SEVERITY_COLOR[content.severity] ?? '#94A3B8';
  const varText = content.var_exposure_inr != null ? INR_FMT.format(content.var_exposure_inr) : 'Not calculated';
  const genDate = new Date(content.generated_at).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' });

  const doc = h(Document, null,
    h(Page, { size: 'A4', style: styles.page },
      // Header
      h(View, { style: styles.header },
        h(Text, { style: styles.orgName }, content.org_name),
        h(Text, { style: styles.title }, content.alert_title ?? content.entity_name ?? 'Risk Brief'),
        h(View, { style: styles.meta },
          h(View, { style: [styles.severityBadge, { backgroundColor: severityColor }] },
            h(Text, null, content.severity.toUpperCase()),
          ),
          h(Text, { style: styles.metaItem }, `Generated ${genDate}`),
        ),
      ),

      // Executive Summary
      h(View, { style: styles.section },
        h(Text, { style: styles.sectionLabel }, 'Executive Summary'),
        h(Text, { style: styles.body }, content.executive_summary),
      ),

      // Financial Exposure
      h(View, { style: styles.varBox },
        h(View, null,
          h(Text, { style: styles.varLabel }, 'Estimated Financial Exposure'),
          h(Text, { style: styles.varValue }, varText),
        ),
        content.affected_entities.length > 0
          ? h(View, null,
              h(Text, { style: styles.varLabel }, 'Affected Entities'),
              ...content.affected_entities.slice(0, 3).map(e =>
                h(View, { key: e.name, style: styles.entityRow },
                  h(Text, { style: styles.entityType }, e.type),
                  h(Text, { style: styles.entityName }, e.name),
                ),
              ),
            )
          : null,
      ),

      // Situation Overview
      h(View, { style: styles.section },
        h(Text, { style: styles.sectionLabel }, 'Situation Overview'),
        h(Text, { style: styles.body }, content.situation_overview),
      ),

      // Operational Impact
      h(View, { style: styles.section },
        h(Text, { style: styles.sectionLabel }, 'Operational Impact'),
        h(Text, { style: styles.body }, content.operational_impact),
      ),

      // Recommended Actions
      h(View, { style: styles.section },
        h(Text, { style: styles.sectionLabel }, 'Recommended Actions'),
        h(Text, { style: styles.body }, content.recommended_actions_prose),
      ),

      // Footer
      h(View, { style: styles.footer },
        h(Text, { style: styles.footerText }, `Syntra Risk Intelligence · ${content.org_name}`),
        h(Text, { style: styles.watermark }, 'Confidential — For Authorised Recipients Only'),
      ),
    ),
  );

  const buffer = await renderToBuffer(doc);
  return Buffer.from(buffer);
}
