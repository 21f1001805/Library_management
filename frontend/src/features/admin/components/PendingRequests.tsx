import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { useAuth, type BillingRequestRecord, type BillingRequestType } from '@/providers/AuthProvider';

const typeLabelKey: Record<BillingRequestType, string> = {
  refund: 'admin.pendingRequests.types.refundRequest',
  fee_waiver: 'admin.pendingRequests.types.feeWaiverRequest',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type PendingAction = { request: BillingRequestRecord; kind: 'approve' | 'reject' };

export interface PendingRequestsProps {
  requests: BillingRequestRecord[];
  onDecided: () => void;
}

// Financial actions get a confirmation step since approving/rejecting money requests
// shouldn't be a single misclick.
export function PendingRequests({ requests, onDecided }: PendingRequestsProps) {
  const { t } = useTranslation();
  const { approveBillingRequest, rejectBillingRequest } = useAuth();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isDeciding, setIsDeciding] = useState(false);

  async function confirm() {
    if (!pendingAction) return;
    const { request, kind } = pendingAction;
    setIsDeciding(true);
    try {
      await (kind === 'approve' ? approveBillingRequest : rejectBillingRequest)(request.id);
      toast.success(
        t(
          kind === 'approve' ? 'admin.pendingRequests.approveToast' : 'admin.pendingRequests.rejectToast',
          { name: request.member_name },
        ),
      );
      setPendingAction(null);
      onDecided();
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    } finally {
      setIsDeciding(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.pendingRequests.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {requests.map((request) => (
          <div
            key={request.id}
            className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{t(typeLabelKey[request.type])}</Badge>
                <span className="font-medium text-foreground">
                  ₹{request.amount.toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-muted-foreground">{formatDate(request.created_at)}</span>
              </div>
              <p className="mt-1 text-sm text-foreground">{request.reason}</p>
              <p className="text-xs text-muted-foreground">
                {t('admin.pendingRequests.from', { name: request.member_name })}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="danger"
                onClick={() => setPendingAction({ request, kind: 'reject' })}
              >
                {t('common.actions.reject')}
              </Button>
              <Button
                size="sm"
                variant="success"
                onClick={() => setPendingAction({ request, kind: 'approve' })}
              >
                {t('common.actions.approve')}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={confirm}
        isConfirming={isDeciding}
        title={t(
          pendingAction?.kind === 'reject'
            ? 'admin.pendingRequests.confirmRejectTitle'
            : 'admin.pendingRequests.confirmApproveTitle',
        )}
        description={
          pendingAction
            ? t('admin.pendingRequests.confirmDescription', {
                name: pendingAction.request.member_name,
                amount: `₹${pendingAction.request.amount.toLocaleString('en-IN')}`,
              })
            : undefined
        }
        confirmLabel={t(
          pendingAction?.kind === 'reject' ? 'common.actions.reject' : 'common.actions.approve',
        )}
        confirmVariant={pendingAction?.kind === 'reject' ? 'danger' : 'success'}
      />
    </Card>
  );
}
