import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class PaystackService {
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly secretKey = process.env.PAYSTACK_SECRET_KEY || '';

  constructor() {
    if (!this.secretKey) {
      console.warn('PAYSTACK_SECRET_KEY is not set in environment variables');
    }
  }

  private async request(method: string, endpoint: string, body?: any) {
    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      console.error(`Paystack ${method} ${endpoint} failed:`, data);
      throw new InternalServerErrorException(data.message || 'Paystack request failed');
    }

    return data.data;
  }

  async initializeTransaction(dto: {
    amount: number; // in Kobo
    email: string;
    reference: string;
    subaccount?: string;
    bearer?: string; // 'account' | 'subaccount'
    split?: number; // percentage platform fee, e.g. 5
    callback_url?: string;
    plan?: string; // Paystack plan code; makes the charge a recurring subscription
  }) {
    const payload: any = {
      amount: dto.amount,
      email: dto.email,
      reference: dto.reference,
      channels: ['card', 'bank_transfer', 'ussd'],
      callback_url: dto.callback_url,
    };

    if (dto.plan) {
      payload.plan = dto.plan;
      // Recurring plans must be charged to a card; Paystack cannot auto-renew a
      // bank transfer or USSD payment.
      payload.channels = ['card'];
    }

    if (dto.subaccount) {
      payload.subaccount = dto.subaccount;
      payload.bearer = dto.bearer || 'subaccount';
      if (dto.split) {
        payload.transaction_charge = Math.round(dto.amount * (dto.split / 100));
      }
    }

    return this.request('POST', '/transaction/initialize', payload);
  }

  async resolveAccountNumber(accountNumber: string, bankCode: string) {
    return this.request('GET', `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
  }

  async verifyTransaction(reference: string) {
    return this.request('GET', `/transaction/verify/${reference}`);
  }

  async createSubaccount(dto: {
    business_name: string;
    settlement_bank: string; // bank code
    account_number: string;
    percentage_charge: number;
    description?: string;
  }) {
    return this.request('POST', '/subaccount', dto);
  }

  async createPlan(dto: {
    name: string;
    amount: number;
    interval: string; // 'monthly', 'annually'
  }) {
    return this.request('POST', '/plan', dto);
  }

  async createSubscription(dto: {
    customer: string; // customer email or code
    plan: string; // plan code
  }) {
    return this.request('POST', '/subscription', dto);
  }

  async disableSubscription(dto: {
    code: string;
    token: string;
  }) {
    return this.request('POST', '/subscription/disable', dto);
  }

  /**
   * Verifies a Paystack webhook against the exact bytes Paystack signed.
   *
   * This previously hashed `JSON.stringify(parsedBody)`. Re-serialising a
   * parsed body does not reliably reproduce the original bytes — unicode
   * escaping, number formatting and key order can all differ — so a valid
   * webhook could be rejected. The raw body is available because the Nest app
   * is created with `rawBody: true`.
   */
  verifyWebhookSignature(signature: string, rawBody: Buffer | string | undefined): boolean {
    if (!signature || !rawBody || !this.secretKey) return false;

    const expected = crypto
      .createHmac('sha512', this.secretKey)
      .update(rawBody)
      .digest('hex');

    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
}
