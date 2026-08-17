import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { PageTitle } from '@/components/common';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Switch,
} from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { LANGUAGES } from '@/i18n/languages';
import { getErrorMessage } from '@/lib/api';
import { isValidEmail } from '@/lib/email';
import { useAuth, type Role } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';

interface TogglePref {
  id: string;
  labelKey: string;
  enabled: boolean;
}

const initialNotificationPrefs: TogglePref[] = [
  {
    id: 'dueDateReminders',
    labelKey: 'settings.notifications.items.dueDateReminders',
    enabled: true,
  },
  {
    id: 'reservationReady',
    labelKey: 'settings.notifications.items.reservationReady',
    enabled: true,
  },
  {
    id: 'eventAnnouncements',
    labelKey: 'settings.notifications.items.eventAnnouncements',
    enabled: false,
  },
  {
    id: 'achievementBadges',
    labelKey: 'settings.notifications.items.achievementBadges',
    enabled: true,
  },
];

const initialAdminPreferences: TogglePref[] = [
  {
    id: 'autoApproveSmallRefunds',
    labelKey: 'settings.adminPreferences.items.autoApproveSmallRefunds',
    enabled: false,
  },
  {
    id: 'lowStockAlerts',
    labelKey: 'settings.adminPreferences.items.lowStockAlerts',
    enabled: true,
  },
  {
    id: 'pendingRequestDigest',
    labelKey: 'settings.adminPreferences.items.pendingRequestDigest',
    enabled: true,
  },
  {
    id: 'financialActivityAlerts',
    labelKey: 'settings.adminPreferences.items.financialActivityAlerts',
    enabled: true,
  },
];

const initialManagerPreferences: TogglePref[] = [
  {
    id: 'walkInRequestAlerts',
    labelKey: 'settings.managerPreferences.items.walkInRequestAlerts',
    enabled: true,
  },
  {
    id: 'registrationRequestAlerts',
    labelKey: 'settings.managerPreferences.items.registrationRequestAlerts',
    enabled: true,
  },
  {
    id: 'pendingPaymentReminders',
    labelKey: 'settings.managerPreferences.items.pendingPaymentReminders',
    enabled: true,
  },
  {
    id: 'endOfDaySummary',
    labelKey: 'settings.managerPreferences.items.endOfDaySummary',
    enabled: false,
  },
];

const initialItHeadPreferences: TogglePref[] = [
  {
    id: 'accessRequestAlerts',
    labelKey: 'settings.itHeadPreferences.items.accessRequestAlerts',
    enabled: true,
  },
  {
    id: 'issueTicketAlerts',
    labelKey: 'settings.itHeadPreferences.items.issueTicketAlerts',
    enabled: true,
  },
  {
    id: 'feeOutstandingDigest',
    labelKey: 'settings.itHeadPreferences.items.feeOutstandingDigest',
    enabled: false,
  },
  {
    id: 'bookRecordAlerts',
    labelKey: 'settings.itHeadPreferences.items.bookRecordAlerts',
    enabled: true,
  },
];

const preferencesByRole: Partial<Record<Role, TogglePref[]>> = {
  admin: initialAdminPreferences,
  manager: initialManagerPreferences,
  'it-head': initialItHeadPreferences,
};

const preferencesTitleKeyByRole: Partial<Record<Role, string>> = {
  admin: 'settings.adminPreferences.title',
  manager: 'settings.managerPreferences.title',
  'it-head': 'settings.itHeadPreferences.title',
};

export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { role, fullName, email, logout, deleteAccount } = useAuth();
  const hasStaffAccount = role === 'admin' || role === 'manager' || role === 'it-head';
  const [togglePrefs, setTogglePrefs] = useState(
    () => (role && preferencesByRole[role]) ?? initialNotificationPrefs,
  );
  const [guardianEmail, setGuardianEmail] = useState<string | null>(null);
  const [guardianEmailInput, setGuardianEmailInput] = useState('');
  const [guardianEmailError, setGuardianEmailError] = useState<string | undefined>();

  function handleLinkGuardian(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = guardianEmailInput.trim();
    if (!isValidEmail(trimmed)) {
      setGuardianEmailError(t('settings.guardianLink.invalidEmail'));
      return;
    }
    setGuardianEmailError(undefined);
    setGuardianEmail(trimmed);
    setGuardianEmailInput('');
  }

  function handleUnlinkGuardian() {
    setGuardianEmail(null);
  }

  function toggleTogglePref(id: string) {
    setTogglePrefs((prev) =>
      prev.map((pref) => (pref.id === id ? { ...pref, enabled: !pref.enabled } : pref)),
    );
  }

  function handleLogOut() {
    logout();
    navigate(ROUTES.HOME);
  }

  async function handleDeleteAccount() {
    if (!window.confirm(t('settings.account.deleteAccountConfirm'))) return;
    try {
      await deleteAccount();
      toast.success(t('settings.account.deleteAccountSuccess'));
      navigate(ROUTES.HOME);
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t('settings.pageTitle')} description={t('settings.pageDescription')} />

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.language.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            label={t('settings.language.label')}
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            options={LANGUAGES.map((option) => ({ value: option.code, label: option.nativeName }))}
            className="max-w-xs"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {t((role && preferencesTitleKeyByRole[role]) ?? 'settings.notifications.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {togglePrefs.map((pref) => (
            <Switch
              key={pref.id}
              id={pref.id}
              checked={pref.enabled}
              onCheckedChange={() => toggleTogglePref(pref.id)}
              label={t(pref.labelKey)}
            />
          ))}
        </CardContent>
      </Card>

      {role === 'member' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.guardianLink.title')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {t('settings.guardianLink.description')}
            </p>
            {guardianEmail ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                <div>
                  <Badge variant="success">{t('settings.guardianLink.linked')}</Badge>
                  <p className="mt-1 text-sm text-foreground">{guardianEmail}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleUnlinkGuardian}>
                  {t('settings.guardianLink.unlink')}
                </Button>
              </div>
            ) : (
              <form
                onSubmit={handleLinkGuardian}
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
              >
                <Input
                  label={t('settings.guardianLink.emailLabel')}
                  type="email"
                  placeholder={t('settings.guardianLink.emailPlaceholder')}
                  value={guardianEmailInput}
                  onChange={(event) => setGuardianEmailInput(event.target.value)}
                  error={guardianEmailError}
                  className="flex-1"
                />
                <Button type="submit" className="w-fit">
                  {t('settings.guardianLink.linkButton')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.account.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {hasStaffAccount ? (
            <p className="text-sm font-medium text-foreground">{t(`auth.login.roles.${role}`)}</p>
          ) : (
            <div>
              <p className="text-sm font-medium text-foreground">{fullName}</p>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="w-fit" onClick={() => navigate(ROUTES.PROFILE)}>
              {t('userMenu.profile')}
            </Button>
            <Button variant="outline" className="w-fit" onClick={handleLogOut}>
              {t('settings.account.logOut')}
            </Button>
          </div>

          {!hasStaffAccount && (
            <div className="flex flex-col gap-2 rounded-md border border-danger/30 bg-danger/5 p-4">
              <p className="text-sm font-medium text-danger">{t('settings.account.dangerZone')}</p>
              <p className="text-sm text-muted-foreground">
                {t('settings.account.deleteAccountHint')}
              </p>
              <Button
                variant="danger"
                size="sm"
                className="w-fit"
                onClick={handleDeleteAccount}
              >
                {t('settings.account.deleteAccount')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
