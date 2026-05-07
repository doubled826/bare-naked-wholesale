interface SupabaseLikeClient {
  from: (table: string) => any;
}

interface ApplyRetailerCreditsParams {
  adminClient: SupabaseLikeClient;
  retailerId: string;
  orderId: string;
  subtotal: number;
  currentCreditApplied?: number;
  maxApplyAmount?: number;
}

interface AppliedRetailerCredit {
  creditId: string;
  appliedAmount: number;
}

interface ApplyRetailerCreditsResult {
  creditApplied: number;
  totalAfterCredit: number;
  remainingAvailableCredit: number;
  applications: AppliedRetailerCredit[];
}

export async function applyRetailerCredits({
  adminClient,
  retailerId,
  orderId,
  subtotal,
  currentCreditApplied = 0,
  maxApplyAmount,
}: ApplyRetailerCreditsParams): Promise<ApplyRetailerCreditsResult> {
  const normalizedApplyLimit = Math.max(0, Number(maxApplyAmount ?? subtotal));

  if (!retailerId || !orderId || subtotal <= 0 || normalizedApplyLimit <= 0) {
    return {
      creditApplied: 0,
      totalAfterCredit: subtotal,
      remainingAvailableCredit: 0,
      applications: [],
    };
  }

  const { data: credits, error: creditsError } = await adminClient
    .from('retailer_credits')
    .select('id, total_amount, remaining_amount, status, created_at')
    .eq('retailer_id', retailerId)
    .in('status', ['available', 'partially_applied'])
    .gt('remaining_amount', 0)
    .order('created_at', { ascending: true });

  if (creditsError) {
    throw creditsError;
  }

  let remainingToApply = normalizedApplyLimit;
  let totalApplied = 0;
  const applications: AppliedRetailerCredit[] = [];
  const availableBefore = (credits || []).reduce(
    (sum: number, credit: { remaining_amount: number | string }) => sum + Number(credit.remaining_amount || 0),
    0
  );

  for (const credit of credits || []) {
    if (remainingToApply <= 0) break;

    const availableAmount = Number(credit.remaining_amount || 0);
    if (availableAmount <= 0) continue;

    const appliedAmount = Math.min(availableAmount, remainingToApply);
    if (appliedAmount <= 0) continue;

    const { error: applicationError } = await adminClient
      .from('retailer_credit_applications')
      .insert({
        credit_id: credit.id,
        order_id: orderId,
        applied_amount: appliedAmount,
      });

    if (applicationError) {
      throw applicationError;
    }

    const { error: creditUpdateError } = await adminClient
      .from('retailer_credits')
      .update({
        remaining_amount: Math.max(0, availableAmount - appliedAmount),
      })
      .eq('id', credit.id);

    if (creditUpdateError) {
      throw creditUpdateError;
    }

    applications.push({
      creditId: credit.id,
      appliedAmount,
    });
    totalApplied += appliedAmount;
    remainingToApply -= appliedAmount;
  }

  const totalAfterCredit = Math.max(0, subtotal - currentCreditApplied - totalApplied);

  if (totalApplied > 0) {
    const { error: orderUpdateError } = await adminClient
      .from('orders')
      .update({
        credit_applied: currentCreditApplied + totalApplied,
        total: totalAfterCredit,
      })
      .eq('id', orderId);

    if (orderUpdateError) {
      throw orderUpdateError;
    }
  }

  return {
    creditApplied: totalApplied,
    totalAfterCredit,
    remainingAvailableCredit: Math.max(0, availableBefore - totalApplied),
    applications,
  };
}
