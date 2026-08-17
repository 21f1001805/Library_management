import { useEffect, useId, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Gift,
  Mail,
  MessageSquare,
  Phone,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';

import {
  AnimatedHeading,
  AnimatedText,
  FadeUp,
  IconBadge,
  Section,
  SectionHeading,
} from '@/components/common';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@/components/ui';
import { apiPost, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { isValidEmail } from '@/lib/email';

// International-friendly: an optional leading +, then 7-15 digits (spaces/dashes/parens allowed).
const PHONE_PATTERN = /^\+?[\d\s()-]{7,20}$/;

const GENERAL_EMAIL = 'hello@readingclub.org';
const GENERAL_PHONE = '+1 (555) 010-1234';

const contactUsSchema = z.object({
  name: z.string().min(1, { message: 'contactUs.errors.name' }),
  email: z.string().refine(isValidEmail, { message: 'contactUs.errors.email' }),
  phoneNumber: z.string().regex(PHONE_PATTERN, { message: 'contactUs.errors.phoneNumber' }),
  organization: z.string().min(1, { message: 'contactUs.errors.organization' }),
  subject: z.string().min(1, { message: 'contactUs.errors.subject' }),
  message: z.string().min(10, { message: 'contactUs.errors.message' }),
});

type ContactUsFormValues = z.infer<typeof contactUsSchema>;

const contactCategories: Array<{ id: string; email: string; phone: string; icon: LucideIcon }> = [
  { id: 'pricingAndFines', email: 'pricing@readingclub.org', phone: '+91 84708 12345', icon: CreditCard },
  { id: 'booksAndClubs', email: 'clubs@readingclub.org', phone: '+91 84708 12345', icon: BookOpen },
  { id: 'seatBooking', email: 'booking@readingclub.org', phone: '+91 84708 12345', icon: CalendarCheck },
  { id: 'donations', email: 'donations@readingclub.org', phone: '+91 84708 12345', icon: Gift },
];

const faqSections: Array<{ id: string; icon: LucideIcon; questions: string[] }> = [
  {
    id: 'membership',
    icon: Users,
    questions: ['becomeMember', 'renewMembership', 'updateProfile', 'resetPassword'],
  },
  {
    id: 'books',
    icon: BookOpen,
    questions: ['borrowBook', 'renewBorrowedBook', 'reserveUnavailableBook', 'requestNewBookTitle', 'loseBook'],
  },
  {
    id: 'readingClubs',
    icon: MessageSquare,
    questions: ['joinReadingClub', 'createReadingClub', 'leaveClub', 'clubMeetings'],
  },
  {
    id: 'seatBooking',
    icon: CalendarCheck,
    questions: ['reserveSeat', 'cancelReservation', 'seatUnavailable', 'bookingLimit'],
  },
  {
    id: 'finesPayments',
    icon: CreditCard,
    questions: ['overdueFines', 'payFines', 'waiveFine'],
  },
  {
    id: 'donations',
    icon: Gift,
    questions: ['donateBooks', 'donationCondition', 'donateFunds', 'donationReceipt'],
  },
  {
    id: 'events',
    icon: CalendarDays,
    questions: ['registerEvents', 'volunteer', 'organizeEvent'],
  },
];

export function ContactUsPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const messageFieldId = useId();
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set());

  function toggleQuestion(id: string) {
    setOpenQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactUsFormValues>({
    resolver: zodResolver(contactUsSchema),
    defaultValues: {
      name: '',
      email: '',
      phoneNumber: '',
      organization: '',
      subject: '',
      message: '',
    },
  });

  useEffect(() => {
    const hash = location.hash?.slice(1);
    if (!hash) return;

    const section = document.getElementById(hash);
    if (!section) return;

    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  async function onSubmit(values: ContactUsFormValues) {
    try {
      await apiPost('/contact', {
        name: values.name,
        email: values.email,
        phone_number: values.phoneNumber,
        organization: values.organization,
        subject: values.subject,
        message: values.message,
      });
      toast.success(t('contactUs.toasts.success'));
      reset();
    } catch (err) {
      toast.error(getErrorMessage(err, t('common.errors.generic')));
    }
  }

  function scrollToSection(id: string) {
    const element = document.getElementById(id);
    if (!element) return;

    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderAnswer(answer: string) {
    return answer.split('\n').map((line, index) => (
      <p key={index} className={index === 0 ? 'mt-0 text-sm text-muted-foreground' : 'mt-3 text-sm text-muted-foreground'}>
        {line}
      </p>
    ));
  }

  const quickContactMethods = [
    {
      id: 'email',
      icon: Mail,
      title: t('contactUs.actions.emailUs'),
      subtitle: t('contactUs.quickContact.email.subtitle'),
      href: `mailto:${GENERAL_EMAIL}`,
    },
    {
      id: 'call',
      icon: Phone,
      title: t('contactUs.actions.callUs'),
      subtitle: t('contactUs.quickContact.call.subtitle'),
      href: `tel:${GENERAL_PHONE.replace(/[^+0-9]/g, '')}`,
    },
    {
      id: 'message',
      icon: MessageSquare,
      title: t('contactUs.quickContact.message.title'),
      subtitle: t('contactUs.quickContact.message.subtitle'),
      onClick: () => scrollToSection('contact-us'),
    },
  ] as const;

  return (
    <>
      <Section
        ariaLabelledBy="contact-us-hero-heading"
        tone="surface"
        size="3xl"
        spacing="py-20 md:py-28"
        containerClassName="relative text-center"
        className="relative overflow-hidden"
        decorative={
          <>
            <div
              aria-hidden
              className="blob pointer-events-none absolute -top-32 left-1/2 size-128 -translate-x-1/2 opacity-[0.16] blur-3xl"
            />
            <div
              aria-hidden
              className="blob pointer-events-none absolute -right-20 top-1/3 size-72 opacity-[0.10] blur-3xl"
            />
          </>
        }
      >
        <AnimatedHeading as="h1" size="hero" id="contact-us-hero-heading" className="text-4xl md:text-5xl">
          {t('contactUs.hero.heading')}
        </AnimatedHeading>
        <AnimatedText size="lg" spacing={false} delay={1} className="mx-auto mt-5 max-w-xl">
          {t('contactUs.hero.subheading')}
        </AnimatedText>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {(['quickResponses', 'dedicatedSupportTeams', 'multilingualAssistance'] as const).map((key, index) => (
            <FadeUp key={key} delay={index + 2}>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3.5 py-1.5 text-sm font-medium text-foreground">
                <CheckCircle2 className="size-4 text-success" />
                {t(`contactUs.hero.badges.${key}`)}
              </span>
            </FadeUp>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button variant="outline" size="md" type="button" onClick={() => scrollToSection('faq')}>
            {t('contactUs.quickNav.faq')}
          </Button>
          <Button variant="outline" size="md" type="button" onClick={() => scrollToSection('contact-us')}>
            {t('contactUs.quickNav.contactUs')}
          </Button>
          <Button variant="outline" size="md" type="button" onClick={() => scrollToSection('department-contacts')}>
            {t('contactUs.quickNav.departmentContacts')}
          </Button>
        </div>
      </Section>

      <Section ariaLabel="Quick contact methods" tone="surface" spacing="py-10 md:py-14">
        <div className="mx-auto grid w-full max-w-5xl gap-4 sm:grid-cols-3">
          {quickContactMethods.map((method, index) => {
            const Icon = method.icon;
            const inner = (
              <Card className="flex h-full items-start gap-4 rounded-2xl border-border bg-surface p-5 shadow-panel transition-colors hover:border-primary/40">
                <IconBadge icon={Icon} size={11} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{method.title}</p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{method.subtitle}</p>
                </div>
                <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Card>
            );

            return (
              <FadeUp key={method.id} delay={index}>
                {'href' in method ? (
                  <a href={method.href} className="group block h-full">
                    {inner}
                  </a>
                ) : (
                  <button type="button" onClick={method.onClick} className="group block h-full w-full text-left">
                    {inner}
                  </button>
                )}
              </FadeUp>
            );
          })}
        </div>
      </Section>

      <Section id="faq" ariaLabelledBy="faq-heading" tone="surface" className="bg-surface" spacing="pt-12 pb-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12">
          <SectionHeading
            id="faq-heading"
            eyebrow={t('contactUs.quickNav.faq')}
            title={t('contactUs.faq.heading')}
            description={t('contactUs.faq.description')}
            headingClassName="max-w-3xl"
          />

          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            {faqSections.map((section) => (
              <div
                key={section.id}
                className="rounded-3xl border border-border bg-surface p-6 shadow-panel transition-colors hover:border-primary/25"
              >
                <div className="flex items-center gap-3">
                  <IconBadge icon={section.icon} shape="square" />
                  <h2 className="text-lg font-semibold text-foreground md:text-xl">
                    {t(`contactUs.faq.categories.${section.id}`)}
                  </h2>
                </div>
                <div className="mt-4 space-y-3">
                  {section.questions.map((questionId) => {
                    const question = t(`contactUs.faq.items.${questionId}.question`);
                    const answer = t(`contactUs.faq.items.${questionId}.answer`);
                    const isOpen = openQuestions.has(questionId);

                    return (
                      <div
                        key={questionId}
                        className="overflow-hidden rounded-2xl border border-border-muted bg-secondary/10"
                      >
                        <button
                          type="button"
                          onClick={() => toggleQuestion(questionId)}
                          aria-expanded={isOpen}
                          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary md:text-base"
                        >
                          {question}
                          <ChevronDown
                            className={cn(
                              'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                              isOpen && 'rotate-180',
                            )}
                          />
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              key="content"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: 'easeInOut' }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 pt-2 text-sm text-muted-foreground md:text-base">
                                {renderAnswer(answer)}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section ariaLabelledBy="contact-us-heading" className="bg-surface" spacing="pt-12 pb-12">
        {/* Grid: form and department contacts side-by-side on md+, stacked on small screens */}
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 items-start">
          {/* Contact form column */}
          <div id="contact-us" className="w-full">
            <Card className="rounded-3xl border-border bg-surface shadow-panel">
              <CardHeader>
                <CardTitle id="contact-us-heading">{t('contactUs.form.heading')}</CardTitle>
                <CardDescription>{t('contactUs.form.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)} noValidate>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Input
                      label={t('contactUs.form.name')}
                      autoComplete="name"
                      error={errors.name?.message ? t(errors.name.message) : undefined}
                      {...register('name')}
                    />
                    <Input
                      label={t('contactUs.form.email')}
                      type="email"
                      autoComplete="email"
                      error={errors.email?.message ? t(errors.email.message) : undefined}
                      {...register('email')}
                    />
                    <Input
                      label={t('contactUs.form.phoneNumber')}
                      type="tel"
                      autoComplete="tel"
                      error={errors.phoneNumber?.message ? t(errors.phoneNumber.message) : undefined}
                      {...register('phoneNumber')}
                    />
                    <Input
                      label={t('contactUs.form.organization')}
                      type="text"
                      autoComplete="organization"
                      error={errors.organization?.message ? t(errors.organization.message) : undefined}
                      {...register('organization')}
                    />
                  </div>
                  <Input
                    label={t('contactUs.form.subject')}
                    type="text"
                    autoComplete="off"
                    error={errors.subject?.message ? t(errors.subject.message) : undefined}
                    {...register('subject')}
                  />
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={messageFieldId} className="text-sm font-medium text-foreground">
                      {t('contactUs.form.message')}
                    </label>
                    <textarea
                      id={messageFieldId}
                      rows={5}
                      aria-invalid={Boolean(errors.message)}
                      aria-describedby={errors.message ? `${messageFieldId}-error` : undefined}
                      className={cn(
                        'min-h-40 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground',
                        'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        errors.message && 'border-danger focus-visible:ring-danger',
                      )}
                      {...register('message')}
                    />
                    {errors.message?.message && (
                      <p id={`${messageFieldId}-error`} className="text-sm text-danger">
                        {t(errors.message.message)}
                      </p>
                    )}
                  </div>
                  <Button type="submit" isLoading={isSubmitting} trailingIcon={<ArrowRight className="size-4" />}>
                    {t('contactUs.form.submitButton')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Department contacts column */}
          <div id="department-contacts" className="w-full">
            <Card className="rounded-3xl border-border bg-surface shadow-panel">
              <CardHeader>
                <CardTitle>{t('contactUs.table.heading')}</CardTitle>
                <CardDescription>{t('contactUs.table.description')}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {contactCategories.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border-muted bg-secondary/10 p-4 transition-colors hover:border-primary/30"
                  >
                    <div className="flex items-center gap-2.5">
                      <IconBadge icon={contact.icon} size={9} />
                      <p className="font-semibold text-foreground">{t(`contactUs.table.${contact.id}`)}</p>
                    </div>
                    <div className="flex flex-col gap-1.5 text-sm">
                      <a
                        href={`mailto:${contact.email}`}
                        className="flex items-center gap-1.5 text-primary hover:underline"
                      >
                        <Mail className="size-3.5 shrink-0" />
                        <span className="truncate">{contact.email}</span>
                      </a>
                      <a
                        href={`tel:${contact.phone.replace(/[^+0-9]/g, '')}`}
                        className="flex items-center gap-1.5 text-foreground hover:text-primary"
                        aria-label={`${t(`contactUs.table.${contact.id}`)} phone ${contact.phone}`}
                      >
                        <Phone className="size-3.5 shrink-0" />
                        {contact.phone}
                      </a>
                    </div>
                  </div>
                ))}
              </CardContent>
              <p className="px-6 pb-6 text-xs text-muted-foreground">{t('contactUs.table.caption')}</p>
            </Card>
          </div>
        </div>
      </Section>

      <Section
        ariaLabelledBy="contact-us-cta-heading"
        tone="primary"
        divider={false}
        size="3xl"
        className="relative overflow-hidden"
        containerClassName="relative flex flex-col items-center gap-3 text-center"
        decorative={
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-24 size-96 rounded-full bg-primary-foreground/10 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -left-16 bottom-0 size-72 rounded-full bg-primary-foreground/10 blur-3xl"
            />
          </>
        }
      >
        <AnimatedHeading id="contact-us-cta-heading" color="inverted">
          {t('contactUs.stillNeedHelp.title')}
        </AnimatedHeading>
        <AnimatedText tone="inverted" spacing={false} className="max-w-xl">
          {t('contactUs.stillNeedHelp.description')}
        </AnimatedText>
        <FadeUp delay={2}>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              variant="secondary"
              leadingIcon={<Mail className="size-4" />}
              onClick={() => window.location.assign(`mailto:${GENERAL_EMAIL}`)}
            >
              {t('contactUs.actions.emailUs')}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
              leadingIcon={<Phone className="size-4" />}
              onClick={() => window.location.assign(`tel:${GENERAL_PHONE.replace(/[^+0-9]/g, '')}`)}
            >
              {t('contactUs.actions.callUs')}
            </Button>
          </div>
        </FadeUp>
      </Section>
    </>
  );
}
