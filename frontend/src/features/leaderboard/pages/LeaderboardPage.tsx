import { Award } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageTitle } from '@/components/common';
import {
  Avatar,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { useAuth, type LeaderboardEntry } from '@/providers/AuthProvider';

const medalColor: Record<number, string> = {
  1: 'text-warning',
  2: 'text-muted-foreground',
  3: 'text-danger',
};

export function LeaderboardPage() {
  const { t } = useTranslation();
  const { getLeaderboard } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    getLeaderboard().then(setEntries).catch(() => setEntries([]));
  }, [getLeaderboard]);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title={t('leaderboard.pageTitle')}
        description={t('leaderboard.pageDescription')}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('leaderboard.table.rank')}</TableHead>
            <TableHead>{t('leaderboard.table.reader')}</TableHead>
            <TableHead>{t('leaderboard.table.booksCompleted')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.member_id} className={cn(entry.is_current_user && 'bg-primary/5')}>
              <TableCell>
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  {entry.rank <= 3 && <Award className={cn('size-4', medalColor[entry.rank])} />}
                  {entry.rank}
                </span>
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2">
                  <Avatar name={entry.full_name} size="sm" />
                  {entry.full_name}
                  {entry.is_current_user && (
                    <Badge variant="outline" className="ml-1">
                      {t('common.you')}
                    </Badge>
                  )}
                </span>
              </TableCell>
              <TableCell>{entry.books_completed}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
