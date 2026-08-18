import { BookOpen, PartyPopper, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { BookCard, ProgressBar } from '@/components/common';
import { LoadingState } from '@/components/feedback';
import { Button, EmptyState, Modal } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/api';
import {
  useAuth,
  type RecommendationAnswers,
  type RecommendationQuiz,
  type RecommendationResult,
} from '@/providers/AuthProvider';

export interface FindMyNextBookModalProps {
  open: boolean;
  onClose: () => void;
}

type Phase = 'loading' | 'quiz' | 'submitting' | 'results' | 'load_error' | 'submit_error';

export function FindMyNextBookModal({ open, onClose }: FindMyNextBookModalProps) {
  const { t } = useTranslation();
  const { getRecommendationQuiz, submitRecommendationQuiz } = useAuth();

  const [phase, setPhase] = useState<Phase>('loading');
  const [quiz, setQuiz] = useState<RecommendationQuiz | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<RecommendationAnswers>({});
  const [result, setResult] = useState<RecommendationResult | null>(null);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPhase('loading');
      setQuiz(null);
      setQuestionIndex(0);
      setAnswers({});
      setResult(null);
      loadQuiz();
    }
  }

  async function loadQuiz() {
    try {
      const response = await getRecommendationQuiz();
      setQuiz(response);
      setPhase('quiz');
    } catch (error) {
      toast.error(getErrorMessage(error, t('books.quiz.loadError')));
      setPhase('load_error');
    }
  }

  async function submit(finalAnswers: RecommendationAnswers) {
    setPhase('submitting');
    try {
      const response = await submitRecommendationQuiz(finalAnswers);
      setResult(response);
      setPhase('results');
    } catch (error) {
      toast.error(getErrorMessage(error, t('books.quiz.submitError')));
      setPhase('submit_error');
    }
  }

  function selectOption(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  function goNext() {
    if (!quiz) return;
    const isLastQuestion = questionIndex === quiz.questions.length - 1;
    if (isLastQuestion) {
      void submit(answers);
      return;
    }
    setQuestionIndex((index) => index + 1);
  }

  function goBack() {
    setQuestionIndex((index) => Math.max(0, index - 1));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('books.quiz.title')}
      blocking={phase === 'submitting'}
      className={phase === 'results' ? 'max-w-2xl' : undefined}
    >
      <div className="flex flex-col gap-4">
        {phase === 'loading' && <LoadingState variant="section" label={t('books.quiz.loading')} />}

        {phase === 'load_error' && (
          <EmptyState
            icon={Sparkles}
            title={t('books.quiz.loadError')}
            action={<Button onClick={() => void loadQuiz()}>{t('books.quiz.retry')}</Button>}
          />
        )}

        {phase === 'quiz' && quiz && quiz.questions.length === 0 && (
          <EmptyState
            icon={BookOpen}
            title={t('books.quiz.notEnoughBooksTitle')}
            description={t('books.quiz.notEnoughBooksDescription')}
          />
        )}

        {phase === 'quiz' && quiz && quiz.questions.length > 0 && (
          <QuizStep
            quiz={quiz}
            questionIndex={questionIndex}
            answers={answers}
            onSelect={selectOption}
            onBack={goBack}
            onNext={goNext}
          />
        )}

        {phase === 'submitting' && (
          <LoadingState variant="section" label={t('books.quiz.finding')} />
        )}

        {phase === 'submit_error' && (
          <EmptyState
            icon={Sparkles}
            title={t('books.quiz.submitError')}
            action={<Button onClick={() => void submit(answers)}>{t('books.quiz.retry')}</Button>}
          />
        )}

        {phase === 'results' && result && <ResultsStep result={result} onClose={onClose} />}
      </div>
    </Modal>
  );
}

interface QuizStepProps {
  quiz: RecommendationQuiz;
  questionIndex: number;
  answers: RecommendationAnswers;
  onSelect: (questionId: string, optionId: string) => void;
  onBack: () => void;
  onNext: () => void;
}

function QuizStep({ quiz, questionIndex, answers, onSelect, onBack, onNext }: QuizStepProps) {
  const { t } = useTranslation();
  const question = quiz.questions[questionIndex];
  const total = quiz.questions.length;
  const isLastQuestion = questionIndex === total - 1;
  const selected = answers[question.id];

  return (
    <>
      <ProgressBar
        percent={((questionIndex + 1) / total) * 100}
        label={t('books.quiz.questionProgress', { current: questionIndex + 1, total })}
      />
      <p className="text-sm font-medium text-foreground">{question.prompt}</p>
      <div className="flex flex-col gap-2">
        {question.options.map((option) => (
          <button
            key={option.id}
            type="button"
            data-testid="quiz-option"
            onClick={() => onSelect(question.id, option.id)}
            className={
              'rounded-lg border p-3 text-left text-sm transition-colors ' +
              (selected === option.id
                ? 'border-primary bg-primary/5 font-medium text-foreground'
                : 'border-border text-foreground hover:bg-secondary')
            }
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="flex justify-between gap-2">
        {questionIndex > 0 ? (
          <Button variant="outline" onClick={onBack}>
            {t('books.quiz.back')}
          </Button>
        ) : (
          <span />
        )}
        <Button disabled={!selected} onClick={onNext}>
          {isLastQuestion ? t('books.quiz.seeRecommendations') : t('books.quiz.next')}
        </Button>
      </div>
    </>
  );
}

interface ResultsStepProps {
  result: RecommendationResult;
  onClose: () => void;
}

function ResultsStep({ result, onClose }: ResultsStepProps) {
  const { t } = useTranslation();

  if (result.items.length === 0) {
    return (
      <>
        <EmptyState icon={BookOpen} title={t('books.quiz.resultsTitle')} description={result.message} />
        <Button onClick={onClose}>{t('books.quiz.done')}</Button>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <PartyPopper className="size-5 text-primary" />
        <p className="text-lg font-semibold text-foreground">{t('books.quiz.resultsTitle')}</p>
      </div>
      <p className="text-sm text-muted-foreground">{result.message}</p>
      <div className="grid max-h-[50vh] gap-4 overflow-y-auto sm:grid-cols-2">
        {result.items.map((item) => (
          <BookCard
            key={item.book.id}
            bookId={item.book.id}
            title={item.book.title}
            author={item.book.author}
            category={item.book.category}
            available={item.book.available}
            averageRating={item.book.average_rating}
            reviewCount={item.book.review_count}
            description={item.book.description}
            href={ROUTES.BOOK_DETAILS.replace(':bookId', item.book.id)}
          />
        ))}
      </div>
      <Button onClick={onClose}>{t('books.quiz.done')}</Button>
    </>
  );
}
