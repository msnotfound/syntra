export class Queue {
  name: string;
  constructor(name: string, _opts?: unknown) { this.name = name; }
  async add(_jobName: string, _data: unknown, _opts?: unknown) { return { id: 'mock-job-id' }; }
  async close() {}
}

export class Worker {
  constructor(_name: string, _processor: unknown, _opts?: unknown) {}
  on(_event: string, _handler: unknown) { return this; }
  async close() {}
}

export class QueueEvents {
  constructor(_name: string, _opts?: unknown) {}
  on(_event: string, _handler: unknown) { return this; }
  async close() {}
}
