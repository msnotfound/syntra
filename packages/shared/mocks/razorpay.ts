console.warn('[MOCK] Using mock Razorpay — set RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET in .env and restart to use real.');

function mockId(prefix: string) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const rand = Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${prefix}_${rand}`;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface RazorpaySubscription {
  id: string;
  plan_id: string;
  status: string;
  customer_id: string;
}

export async function createOrder(amountPaise: number, currency = 'INR'): Promise<RazorpayOrder> {
  return { id: mockId('order'), amount: amountPaise, currency, status: 'created' };
}

export async function createSubscription(planId: string, customerId: string): Promise<RazorpaySubscription> {
  return { id: mockId('sub'), plan_id: planId, status: 'created', customer_id: customerId };
}

export function verifyPaymentSignature(
  _orderId: string,
  _paymentId: string,
  _signature: string,
): boolean {
  return true;
}

export function verifyWebhookSignature(_body: string, _signature: string): boolean {
  return true;
}
