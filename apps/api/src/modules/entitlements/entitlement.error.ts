import { HttpException, HttpStatus } from '@nestjs/common';
import { TIER_NAMES, type EntitlementKey, type Tier } from './entitlements';

/**
 * A feature the practice's plan does not include. 402 so the app can tell it
 * apart from a permission problem and show an upgrade prompt instead.
 */
export class EntitlementError extends HttpException {
  constructor(
    readonly feature: EntitlementKey | string,
    readonly requiredTier: Tier,
    message?: string,
  ) {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: 'ENTITLEMENT_REQUIRED',
        feature,
        requiredTier,
        message: message ?? `This needs the ${TIER_NAMES[requiredTier]} plan. Upgrade in Settings → Subscription.`,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
