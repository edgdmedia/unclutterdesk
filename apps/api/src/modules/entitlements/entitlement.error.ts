import { HttpException, HttpStatus } from '@nestjs/common';
import { TIER_NAMES, type Tier } from './entitlements';

/**
 * A feature the plan does not include. 402 so the app can tell it apart from
 * a permission problem and show an upgrade prompt naming `requiredTier`.
 * `scope` says whose plan it is: the practice's, or the person's (profile).
 */
export class EntitlementError extends HttpException {
  constructor(
    readonly feature: string,
    readonly requiredTier: Tier,
    message?: string,
    readonly scope: 'practice' | 'profile' = 'practice',
  ) {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: 'ENTITLEMENT_REQUIRED',
        scope,
        feature,
        requiredTier,
        message: message ?? `This needs the ${TIER_NAMES[requiredTier]} plan. Upgrade in Settings → Subscription.`,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
