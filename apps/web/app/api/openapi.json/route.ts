import { NextResponse } from 'next/server';

const spec = {
  openapi: '3.0.0',
  info: { title: 'Syntra API', version: '1.0.0', description: 'Geopolitical risk intelligence API for supply-chain monitoring.' },
  servers: [{ url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000' }],
  security: [{ ApiKeyAuth: [] }],
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' },
    },
    schemas: {
      Severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
      EntityType: { type: 'string', enum: ['supplier', 'port', 'route', 'country', 'region', 'asset'] },
      AlertChannel: { type: 'string', enum: ['email', 'whatsapp', 'webhook'] },
      Event: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          severity: { $ref: '#/components/schemas/Severity' },
          country_code: { type: 'string', example: 'IN' },
          location: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' } } },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      Alert: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          org_id: { type: 'string' },
          severity: { $ref: '#/components/schemas/Severity' },
          acknowledged_at: { type: 'string', format: 'date-time', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          event_snapshot: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              location: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' } }, nullable: true },
            },
          },
        },
      },
      WatchlistEntity: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          type: { $ref: '#/components/schemas/EntityType' },
          name: { type: 'string' },
          latitude: { type: 'number', nullable: true },
          longitude: { type: 'number', nullable: true },
          country_code: { type: 'string', nullable: true },
          active: { type: 'boolean' },
        },
      },
      WatchlistEntityCreate: {
        type: 'object',
        required: ['type', 'name'],
        properties: {
          type: { $ref: '#/components/schemas/EntityType' },
          name: { type: 'string', minLength: 1, maxLength: 200 },
          latitude: { type: 'number', nullable: true },
          longitude: { type: 'number', nullable: true },
          country_code: { type: 'string', nullable: true },
          metadata: { type: 'object' },
        },
      },
    },
  },
  paths: {
    '/api/v1/events': {
      get: {
        summary: 'List recent events',
        tags: ['Events'],
        parameters: [
          { name: 'severity', in: 'query', schema: { $ref: '#/components/schemas/Severity' } },
          { name: 'country_code', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { 200: { description: 'List of events', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Event' } }, error: { type: 'null' } } } } } } },
      },
    },
    '/api/v1/risk': {
      get: {
        summary: 'Get risk score for coordinates',
        tags: ['Risk'],
        parameters: [
          { name: 'lat', in: 'query', required: true, schema: { type: 'number' } },
          { name: 'lng', in: 'query', required: true, schema: { type: 'number' } },
          { name: 'radius', in: 'query', schema: { type: 'number', default: 200 } },
        ],
        responses: { 200: { description: 'Risk score', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'object', properties: { score: { type: 'number' }, events: { type: 'array', items: { $ref: '#/components/schemas/Event' } } } }, error: { type: 'null' } } } } } } },
      },
    },
    '/api/v1/orgs/{orgSlug}/alerts': {
      get: {
        summary: 'List org alerts',
        tags: ['Alerts'],
        parameters: [{ name: 'orgSlug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Alerts list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Alert' } }, error: { type: 'null' } } } } } } },
      },
    },
    '/api/v1/orgs/{orgSlug}/alerts/{id}/ack': {
      patch: {
        summary: 'Acknowledge an alert',
        tags: ['Alerts'],
        parameters: [
          { name: 'orgSlug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { note: { type: 'string' } } } } } },
        responses: { 200: { description: 'Acknowledged', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Alert' }, error: { type: 'null' } } } } } } },
      },
    },
    '/api/v1/orgs/{orgSlug}/watchlist': {
      get: {
        summary: 'List watchlist entities',
        tags: ['Watchlist'],
        parameters: [{ name: 'orgSlug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Entities', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/WatchlistEntity' } }, error: { type: 'null' } } } } } } },
      },
      post: {
        summary: 'Add a watchlist entity',
        tags: ['Watchlist'],
        parameters: [{ name: 'orgSlug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/WatchlistEntityCreate' } } } },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/WatchlistEntity' }, error: { type: 'null' } } } } } },
          400: { description: 'Validation error' },
        },
      },
    },
    '/api/v1/orgs/{orgSlug}/watchlist/{id}': {
      delete: {
        summary: 'Remove a watchlist entity',
        tags: ['Watchlist'],
        parameters: [
          { name: 'orgSlug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Deleted', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'object', properties: { deleted: { type: 'boolean' } } } } } } } } },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: { 'cache-control': 'public, s-maxage=3600' },
  });
}
