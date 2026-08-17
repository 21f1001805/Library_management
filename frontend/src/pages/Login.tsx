import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { Button, Input } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/api';
import { loginSchema, type LoginFormValues } from '@/lib/authSchema';
import { renderGoogleSignInButton } from '@/lib/googleIdentity';
import { useAuth, type Role } from '@/providers/AuthProvider';

import { AuthPosterColumns } from './AuthPosterColumns';

const ROLES: Role[] = ['admin', 'member', 'manager', 'it-head', 'guardian'];
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// ponytail: the role buttons below stay for now (dev preview of ProtectedRoute/RoleRoute
// guards) — remove them before production, per team decision.
// Redirecting is left entirely to PublicRoute (guards.tsx) reacting to the auth-state
// change — navigating here too would race PublicRoute's own redirect.
export function Login() {
  const { t } = useTranslation();
  const { login, loginWithCredentials, loginWithGoogleToken } = useAuth();
  const googleButtonRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) return;
    renderGoogleSignInButton(googleButtonRef.current, GOOGLE_CLIENT_ID, (idToken) => {
      loginWithGoogleToken(idToken).catch((err: unknown) => {
        toast.error(getErrorMessage(err, 'Google sign-in failed'));
      });
    }).catch(() => toast.error('Could not load Google sign-in'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signInAs(role: Role) {
    try {
      await login(role);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not preview this role'));
    }
  }

  async function onSubmit(values: LoginFormValues) {
    try {
      await loginWithCredentials(values.email, values.password);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Log in failed'));
    }
  }

  return (
    <div className="flex lg:min-h-160">
      <div className="relative hidden w-1/2 overflow-hidden bg-surface lg:block xl:w-3/5">
        <div className="absolute inset-0 p-4">
          <AuthPosterColumns />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background via-transparent to-background" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-linear-to-l from-background to-transparent" />
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('auth.login.title')}</h1>
        </div>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input
            label={t('auth.login.email')}
            type="email"
            autoComplete="email"
            error={errors.email?.message ? t(errors.email.message) : undefined}
            {...register('email')}
          />
          <Input
            label={t('auth.login.password')}
            type="password"
            autoComplete="current-password"
            error={errors.password?.message ? t(errors.password.message) : undefined}
            {...register('password')}
          />
          <Link
            to={ROUTES.FORGOT_PASSWORD}
            className="self-end text-sm font-medium text-primary hover:underline"
          >
            {t('auth.login.forgotPassword')}
          </Link>
          <Button type="submit" isLoading={isSubmitting}>
            {t('auth.login.logInWithPassword')}
          </Button>
        </form>

        <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          {t('auth.login.or')}
          <div className="h-px flex-1 bg-border" />
        </div>

        {GOOGLE_CLIENT_ID ? (
          <div ref={googleButtonRef} className="flex justify-center" />
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            Google sign-in isn't configured (missing VITE_GOOGLE_CLIENT_ID).
          </p>
        )}

        <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          {t('auth.login.orPreviewRole')}
          <div className="h-px flex-1 bg-border" />
        </div>

        {ROLES.map((role) => (
          <Button
            key={role}
            variant="outline"
            className="justify-start capitalize"
            onClick={() => signInAs(role)}
          >
            {t('auth.login.continueAs', { role: t(`auth.login.roles.${role}`) })}
          </Button>
        ))}
      </div>
    </div>
  );
}
