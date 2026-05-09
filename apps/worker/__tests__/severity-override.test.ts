import { applySeverityOverride } from '../../../packages/shared/utils/index';
import type { PlainSeverityRule } from '../../../packages/shared/utils/index';

function rule(overrides: Partial<PlainSeverityRule> & { entity_id: string; threshold: PlainSeverityRule['threshold'] }): PlainSeverityRule {
  return {
    condition_type: 'always',
    event_kind: null,
    geo_country_code: null,
    ...overrides,
  };
}

describe('applySeverityOverride', () => {
  describe('override on match', () => {
    test('always condition matches any event for the entity', () => {
      const rules = [rule({ entity_id: 'ent1', condition_type: 'always', threshold: 'critical' })];
      const result = applySeverityOverride(rules, ['ent1'], 'flood', 'IN', 'low');
      expect(result).toBe('critical');
    });

    test('event_kind condition matches when event type equals rule event_kind', () => {
      const rules = [rule({ entity_id: 'ent1', condition_type: 'event_kind', event_kind: 'conflict', threshold: 'high' })];
      const result = applySeverityOverride(rules, ['ent1'], 'conflict', 'IN', 'low');
      expect(result).toBe('high');
    });

    test('event_kind+geo condition matches when both event type and country code match', () => {
      const rules = [rule({
        entity_id: 'ent1',
        condition_type: 'event_kind+geo',
        event_kind: 'strike',
        geo_country_code: 'YE',
        threshold: 'critical',
      })];
      const result = applySeverityOverride(rules, ['ent1'], 'strike', 'YE', 'medium');
      expect(result).toBe('critical');
    });

    test('geo comparison is case-insensitive', () => {
      const rules = [rule({
        entity_id: 'ent1',
        condition_type: 'event_kind+geo',
        event_kind: 'flood',
        geo_country_code: 'IN',
        threshold: 'high',
      })];
      const result = applySeverityOverride(rules, ['ent1'], 'flood', 'in', 'low');
      expect(result).toBe('high');
    });

    test('when multiple rules match, highest severity wins', () => {
      const rules = [
        rule({ entity_id: 'ent1', condition_type: 'always', threshold: 'medium' }),
        rule({ entity_id: 'ent1', condition_type: 'event_kind', event_kind: 'conflict', threshold: 'critical' }),
      ];
      const result = applySeverityOverride(rules, ['ent1'], 'conflict', 'IN', 'low');
      expect(result).toBe('critical');
    });

    test('override applies only to matched entity IDs, not all entities', () => {
      const rules = [rule({ entity_id: 'ent2', condition_type: 'always', threshold: 'critical' })];
      const result = applySeverityOverride(rules, ['ent1'], 'conflict', 'IN', 'low');
      expect(result).toBe('low');
    });
  });

  describe('fallback on miss', () => {
    test('returns default severity when no rules exist', () => {
      const result = applySeverityOverride([], ['ent1'], 'flood', 'IN', 'medium');
      expect(result).toBe('medium');
    });

    test('returns default when event_kind does not match', () => {
      const rules = [rule({ entity_id: 'ent1', condition_type: 'event_kind', event_kind: 'conflict', threshold: 'critical' })];
      const result = applySeverityOverride(rules, ['ent1'], 'flood', 'IN', 'medium');
      expect(result).toBe('medium');
    });

    test('returns default when event_kind+geo geo does not match', () => {
      const rules = [rule({
        entity_id: 'ent1',
        condition_type: 'event_kind+geo',
        event_kind: 'flood',
        geo_country_code: 'YE',
        threshold: 'critical',
      })];
      const result = applySeverityOverride(rules, ['ent1'], 'flood', 'IN', 'low');
      expect(result).toBe('low');
    });

    test('returns default when entity not in matched list', () => {
      const rules = [rule({ entity_id: 'ent-other', condition_type: 'always', threshold: 'critical' })];
      const result = applySeverityOverride(rules, ['ent1'], 'flood', 'IN', 'high');
      expect(result).toBe('high');
    });

    test('does not downgrade severity below default via override', () => {
      // Rule says 'low' but default is already 'critical' — should keep 'critical'
      const rules = [rule({ entity_id: 'ent1', condition_type: 'always', threshold: 'low' })];
      const result = applySeverityOverride(rules, ['ent1'], 'flood', 'IN', 'critical');
      expect(result).toBe('critical');
    });

    test('empty entity list means no rule can match', () => {
      const rules = [rule({ entity_id: 'ent1', condition_type: 'always', threshold: 'critical' })];
      const result = applySeverityOverride(rules, [], 'flood', 'IN', 'medium');
      expect(result).toBe('medium');
    });
  });
});
