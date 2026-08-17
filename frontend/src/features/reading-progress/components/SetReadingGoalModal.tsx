import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button, Input, Modal } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { useAuth, type ReadingGoal } from '@/providers/AuthProvider';

// Whole numbers only, no leading zero games needed since this is a book count — a plain
// digit-only regex is simpler and more reliable than trusting <input type="number">,
// which still lets browsers submit "1e5" or "3.5" through the DOM.
const INTEGER_PATTERN = /^[1-9]\d*$/;

const goalSchema = z.object({
  yearlyGoal: z
    .string()
    .regex(INTEGER_PATTERN, { message: 'Enter a whole number of at least 1' }),
  monthlyGoal: z
    .string()
    .regex(INTEGER_PATTERN, { message: 'Enter a whole number of at least 1' }),
});

type GoalFormValues = z.infer<typeof goalSchema>;

export interface SetReadingGoalModalProps {
  open: boolean;
  onClose: () => void;
  currentGoal: ReadingGoal | null;
  onSaved: (goal: ReadingGoal) => void;
}

export function SetReadingGoalModal({
  open,
  onClose,
  currentGoal,
  onSaved,
}: SetReadingGoalModalProps) {
  const { setReadingGoal } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    values: {
      yearlyGoal: currentGoal ? String(currentGoal.yearly_goal) : '',
      monthlyGoal: currentGoal ? String(currentGoal.monthly_goal) : '',
    },
  });

  async function onSubmit(values: GoalFormValues) {
    try {
      const goal = await setReadingGoal({
        yearly_goal: Number(values.yearlyGoal),
        monthly_goal: Number(values.monthlyGoal),
      });
      onSaved(goal);
      toast.success('Reading goal saved');
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save goal'));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Set Reading Goal">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input
          label="Yearly goal (books)"
          inputMode="numeric"
          pattern="[0-9]*"
          error={errors.yearlyGoal?.message}
          {...register('yearlyGoal')}
        />
        <Input
          label="Monthly goal (books)"
          inputMode="numeric"
          pattern="[0-9]*"
          error={errors.monthlyGoal?.message}
          {...register('monthlyGoal')}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
