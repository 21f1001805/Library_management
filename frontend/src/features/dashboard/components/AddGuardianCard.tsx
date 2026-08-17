import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { useAuth, type MemberSummary } from '@/providers/AuthProvider';

import { MemberPicker } from './MemberPicker';

// Manager-side counterpart to the member's own "link a guardian" settings card —
// here the manager links an already-registered, active student to an already-registered,
// active guardian account by searching each one by name or email.
export function AddGuardianCard() {
  const { t } = useTranslation();
  const { linkGuardian } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState<MemberSummary | null>(null);
  const [selectedGuardian, setSelectedGuardian] = useState<MemberSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit() {
    if (!selectedStudent || !selectedGuardian) return;
    setIsSubmitting(true);
    try {
      await linkGuardian({
        student_email: selectedStudent.email,
        guardian_email: selectedGuardian.email,
      });
      toast.success(
        t('managerDashboard.addGuardian.successToast', {
          studentEmail: selectedStudent.email,
          guardianEmail: selectedGuardian.email,
        }),
      );
      setSelectedStudent(null);
      setSelectedGuardian(null);
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit = selectedStudent !== null && selectedGuardian !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('managerDashboard.addGuardian.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t('managerDashboard.addGuardian.description')}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <MemberPicker
            className="flex-1"
            selectedMember={selectedStudent}
            onSelect={setSelectedStudent}
            role="member"
            activeOnly
            label={t('managerDashboard.addGuardian.studentEmailLabel')}
            searchPlaceholder={t('managerDashboard.addGuardian.studentEmailPlaceholder')}
            changeLabel={t('managerDashboard.billingRequest.changeMember')}
            noResultsLabel={t('managerDashboard.billingRequest.noMembersFound')}
          />
          <MemberPicker
            className="flex-1"
            selectedMember={selectedGuardian}
            onSelect={setSelectedGuardian}
            role="guardian"
            activeOnly
            label={t('managerDashboard.addGuardian.guardianEmailLabel')}
            searchPlaceholder={t('managerDashboard.addGuardian.guardianEmailPlaceholder')}
            changeLabel={t('managerDashboard.billingRequest.changeMember')}
            noResultsLabel={t('managerDashboard.billingRequest.noMembersFound')}
          />
          <Button
            type="button"
            isLoading={isSubmitting}
            disabled={!canSubmit}
            onClick={onSubmit}
            className="w-fit"
          >
            {t('managerDashboard.addGuardian.submit')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
