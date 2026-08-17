import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { NoResults } from '@/components/feedback';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import {
  useAuth,
  type MemberRecord,
  type PermissionRequestRecord,
} from '@/providers/AuthProvider';

export interface AccessControlProps {
  members: MemberRecord[];
  permissionRequests: PermissionRequestRecord[];
  onChanged: () => void;
}

export function AccessControl({ members, permissionRequests, onChanged }: AccessControlProps) {
  const { t } = useTranslation();
  const { updateAdminMember, grantPermissionRequest, denyPermissionRequest } = useAuth();

  async function handleGrant(requestId: string, name: string) {
    try {
      await grantPermissionRequest(requestId);
      toast.success(t('itHead.accessControl.grantedToast', { name }));
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    }
  }

  async function handleDeny(requestId: string, name: string) {
    try {
      await denyPermissionRequest(requestId);
      toast.success(t('itHead.accessControl.deniedToast', { name }));
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    }
  }

  async function handleToggleActive(member: MemberRecord) {
    try {
      await updateAdminMember(member.id, { is_active: !member.is_active });
      toast.success(
        member.is_active
          ? t('itHead.accessControl.deactivateToast', { name: member.full_name })
          : t('itHead.accessControl.reactivateToast', { name: member.full_name }),
      );
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('itHead.accessControl.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {members.length === 0 ? (
          <NoResults title={t('itHead.accessControl.empty')} />
        ) : (
          members.map((member) => {
            const pendingRequest = permissionRequests.find(
              (request) => request.requested_by_id === member.id && request.status === 'pending',
            );

            return (
              <div
                key={member.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{member.full_name}</p>
                    <Badge variant="outline">{t(`auth.login.roles.${member.role.name}`)}</Badge>
                    <Badge variant={member.is_active ? 'success' : 'danger'}>
                      {t(`itHead.accessControl.status.${member.is_active ? 'active' : 'deactivated'}`)}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">{member.email}</p>
                  {pendingRequest && (
                    <p className="text-xs text-muted-foreground">
                      {t('itHead.accessControl.pendingPermission', {
                        permission: pendingRequest.permission,
                      })}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {pendingRequest && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleGrant(pendingRequest.id, member.full_name)}
                      >
                        {t('itHead.accessControl.grantAccess')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeny(pendingRequest.id, member.full_name)}
                      >
                        {t('itHead.accessControl.deny')}
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleToggleActive(member)}>
                    {member.is_active
                      ? t('itHead.accessControl.deactivate')
                      : t('itHead.accessControl.reactivate')}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
