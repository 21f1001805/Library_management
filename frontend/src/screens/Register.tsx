'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { toast } from 'sonner';

import { Button, Checkbox, Input, Select } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/api';
import { registerSchema, type RegisterFormValues } from '@/lib/authSchema';
import { usePlanOptions } from '@/lib/planOptions';
import { useAuth } from '@/providers/AuthProvider';

import { AuthPosterColumns } from './AuthPosterColumns';

// ponytail: membershipPlan is collected but not sent to /auth/register — no plan/pricing
// model exists on the backend yet (see FRONTEND_VS_SPEC.md). It only decides the amount
// forwarded to Payment.
//
// Redirecting to Payment is left to RedirectIfAuthenticated (providers/AuthGuard.tsx)
// reacting to the auth-state change, same as Login.tsx does — navigating here too would
// race its own redirect and lose, landing the new user on the dashboard instead.
export function Register() {
  const { t } = useTranslation();
  const { registerAccount } = useAuth();
  const { options: planOptions, isLoading: isLoadingPlans } = usePlanOptions();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
      membershipPlan: '1m',
      acceptTerms: false,
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    try {
      const plan = planOptions.find((option) => option.value === values.membershipPlan);
      const paymentRedirect = `${ROUTES.PAYMENT}?plan=${values.membershipPlan}&label=${encodeURIComponent(plan?.label ?? '')}`;
      await registerAccount(
        {
          email: values.email,
          password: values.password,
          full_name: values.name,
          phone: values.phoneNumber,
        },
        paymentRedirect,
      );
    } catch (err) {
      toast.error(getErrorMessage(err, 'Registration failed'));
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
          <h1 className="text-2xl font-semibold text-foreground">{t('auth.register.title')}</h1>
        </div>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input
            label={t('auth.register.fullName')}
            autoComplete="name"
            error={errors.name?.message ? t(errors.name.message) : undefined}
            {...register('name')}
          />
          <Input
            label={t('auth.register.email')}
            type="email"
            autoComplete="email"
            error={errors.email?.message ? t(errors.email.message) : undefined}
            {...register('email')}
          />
          <Input
            label={t('auth.register.phoneNumber')}
            type="tel"
            autoComplete="tel"
            placeholder={t('auth.register.phoneNumberPlaceholder')}
            maxLength={10}
            error={errors.phoneNumber?.message ? t(errors.phoneNumber.message) : undefined}
            {...register('phoneNumber', {
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                e.target.value = digits;
                setValue('phoneNumber', digits, { shouldValidate: true });
              },
            })}
          />
          <Input
            label={t('auth.register.password')}
            type="password"
            autoComplete="new-password"
            error={errors.password?.message ? t(errors.password.message) : undefined}
            {...register('password')}
          />
          <Input
            label={t('auth.register.confirmPassword')}
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message ? t(errors.confirmPassword.message) : undefined}
            {...register('confirmPassword')}
          />
          <Select
            label={t('auth.register.membershipPlan')}
            disabled={isLoadingPlans}
            error={errors.membershipPlan?.message ? t(errors.membershipPlan.message) : undefined}
            options={planOptions.map(({ value, label }) => ({ value, label }))}
            {...register('membershipPlan')}
          />
          <Checkbox
            label={t('auth.register.terms')}
            error={errors.acceptTerms?.message ? t(errors.acceptTerms.message) : undefined}
            {...register('acceptTerms')}
          />
          <Button type="submit" isLoading={isSubmitting} disabled={isLoadingPlans}>
            {t('auth.register.createAccount')}
          </Button>
        </form>
        <p className="text-sm text-muted-foreground">
          {t('auth.register.alreadyHaveAccount')}{' '}
          <Link href={ROUTES.LOGIN} className="font-medium text-primary-gradient hover:underline">
            {t('auth.register.logIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
