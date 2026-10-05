import { Injectable } from '@nestjs/common';

/**
 * SET-13: Cloudflare for SaaS plumbing.
 *
 * A practice's own domain becomes a "custom hostname" on our zone; traffic for
 * it enters our zone and is routed to the tenant-router Worker — which already
 * serves any host — before origin resolution ever happens. Everything
 * Cloudflare-facing lives behind this service so the rest of the app behaves
 * exactly as before when the platform has not been enrolled: `configured()` is
 * the single switch, and callers fall back to the old store-and-PENDING path.
 *
 * Docs: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/
 */

export interface CfVerificationRecord {
  name: string;
  type: string;
  data: string;
  target?: string;
}

export interface CfHostnameResult {
  id: string;
  status: string;
  sslStatus: string;
  /** Where the practice's CNAME must ultimately point. */
  cnameTarget: string | null;
  verificationRecords: CfVerificationRecord[];
}

interface CfJson {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result?: any;
}

@Injectable()
export class CloudflareSaasService {
  private readonly apiToken = process.env.CLOUDFLARE_API_TOKEN || '';
  private readonly authEmail = process.env.CLOUDFLARE_AUTH_EMAIL || '';
  private readonly authKey = process.env.CLOUDFLARE_API_KEY || '';
  private readonly zoneId = process.env.CLOUDFLARE_ZONE_ID || '';
  private readonly workerScript = process.env.CLOUDFLARE_WORKER_SCRIPT || 'unclutterdesk-tenant-router';
  private readonly apiBase = 'https://api.cloudflare.com/client/v4';

  /**
   * Custom hostnames are one of the few Cloudflare API areas that reject
   * scoped API tokens — the endpoints accept only the legacy Global API key
   * (X-Auth-Email + X-Auth-Key) or OAuth. The zone id and either credential
   * are required; the token headers stay supported in case the platform
   * broadens auth for these routes later.
   */
  configured(): boolean {
    return Boolean(this.zoneId && (this.authKey || this.apiToken));
  }

  /**
   * Create the custom hostname with a CNAME-validated certificate and return
   * the records the practice must publish at its own DNS provider.
   */
  async createHostname(hostname: string, tenantId: string): Promise<CfHostnameResult> {
    const body = {
      hostname,
      ssl: { method: 'cname', settings: { min_tls_version: '1.2' } },
      custom_metadata: { tenant: tenantId },
    };
    const result = await this.call(`/zones/${this.zoneId}/custom_hostnames`, 'POST', body);
    return {
      id: String(result.id),
      status: String(result.status || 'pending'),
      sslStatus: String(result.ssl?.status || 'pending'),
      cnameTarget: result.cname_target || result.ssl?.cname?.target || null,
      verificationRecords: (result.ssl?.verification_records || result.ssl?.validate_records || []).map(
        (r: any) => ({ name: r.name ?? '', type: r.type ?? '', data: r.data ?? '', target: r.target ?? undefined }),
      ),
    };
  }

  async getStatus(id: string): Promise<{ status: string; sslStatus: string }> {
    const result = await this.call(`/zones/${this.zoneId}/custom_hostnames/${id}`, 'GET');
    return { status: String(result.status || 'pending'), sslStatus: String(result.ssl?.status || 'pending') };
  }

  /** Live verification material for the UI, re-read from Cloudflare. */
  async getVerification(id: string): Promise<CfHostnameResult> {
    const result = await this.call(`/zones/${this.zoneId}/custom_hostnames/${id}`, 'GET');
    return {
      id: String(result.id),
      status: String(result.status || 'pending'),
      sslStatus: String(result.ssl?.status || 'pending'),
      cnameTarget: result.cname_target || result.ssl?.cname?.target || null,
      verificationRecords: (result.ssl?.verification_records || result.ssl?.validate_records || []).map(
        (r: any) => ({ name: r.name ?? '', type: r.type ?? '', data: r.data ?? '', target: r.target ?? undefined }),
      ),
    };
  }

  /** 1009 "could not find content" means it is already gone — that is success. */
  async deleteHostname(id: string): Promise<void> {
    try {
      await this.call(`/zones/${this.zoneId}/custom_hostnames/${id}`, 'DELETE');
    } catch (err) {
      if (!/could not find|1009/i.test(String((err as Error).message))) throw err;
    }
  }

  /**
   * Send this hostname's traffic to the tenant-router Worker. Idempotent: the
   * list is checked first so a re-save of the same domain does not fail on a
   * duplicate route pattern.
   */
  async ensureRoute(hostname: string): Promise<void> {
    const pattern = `${hostname}/*`;
    const list = await this.callRaw(`/zones/${this.zoneId}/workers/routes`, 'GET');
    const existing: any[] = list.result || [];
    if (existing.some((r) => r.pattern === pattern)) return;
    await this.call(`/zones/${this.zoneId}/workers/routes`, 'POST', { pattern, script: this.workerScript });
  }

  async removeRoute(hostname: string): Promise<void> {
    const pattern = `${hostname}/*`;
    const list = await this.callRaw(`/zones/${this.zoneId}/workers/routes`, 'GET');
    const found = ((list.result || []) as any[]).find((r) => r.pattern === pattern);
    if (found) {
      try {
        await this.call(`/zones/${this.zoneId}/workers/routes/${found.id}`, 'DELETE');
      } catch {
        // A route that cannot be removed is swept by the cron later.
      }
    }
  }

  /** All hostnames on the zone — used by the orphan sweep. */
  async listHostnames(): Promise<Array<{ id: string; hostname: string; tenantId: string | null }>> {
    const list = await this.callRaw(`/zones/${this.zoneId}/custom_hostnames?per_page=800`, 'GET');
    return ((list.result || []) as any[]).map((h) => ({
      id: String(h.id),
      hostname: String(h.hostname),
      tenantId: h.custom_metadata?.tenant ? String(h.custom_metadata.tenant) : null,
    }));
  }

  private async call(path: string, method: string, body?: unknown): Promise<any> {
    const parsed = await this.callRaw(path, method, body);
    return parsed.result;
  }

  private async callRaw(path: string, method: string, body?: unknown): Promise<CfJson> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch(`${this.apiBase}${path}`, {
        method,
        headers: {
          ...(this.authKey && this.authEmail
            ? { 'X-Auth-Email': this.authEmail, 'X-Auth-Key': this.authKey }
            : { Authorization: `Bearer ${this.apiToken}` }),
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      throw new Error(`Cloudflare request failed: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
    const parsed = (await response.json().catch(() => null)) as CfJson | null;
    if (!parsed) throw new Error(`Cloudflare returned no answer (${response.status})`);
    if (!parsed.success) {
      const first = parsed.errors?.[0];
      throw new Error(first ? `Cloudflare ${first.code}: ${first.message}` : 'Cloudflare request failed');
    }
    return parsed;
  }
}
