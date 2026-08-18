import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Flame,
  Info,
  Star,
  Target,
  Trophy,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageTitle, Pagination, TableToolbar } from '@/components/common';
import { ErrorState, LoadingState, NoResults } from '@/components/feedback';
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
import { usePagination, useSortedItems } from '@/hooks';
import { cn } from '@/lib/cn';
import { getErrorMessage } from '@/lib/api';
import { useAuth, type LeaderboardEntry } from '@/providers/AuthProvider';

const PAGE_SIZE = 10;
const medalColor: Record<number, string> = {
  1: 'text-amber-500 fill-amber-500/20',
  2: 'text-slate-400 fill-slate-400/20',
  3: 'text-amber-700 fill-amber-700/20',
};

const BADGE_CONFIG: Record<string, { icon: string; titleKey: string; descKey: string }> = {
  bookworm: {
    icon: '📚',
    titleKey: 'leaderboard.badges.bookworm',
    descKey: 'leaderboard.badges.bookwormDesc',
  },
  '7_day_streak': {
    icon: '🔥',
    titleKey: 'leaderboard.badges.7_day_streak',
    descKey: 'leaderboard.badges.7_day_streakDesc',
  },
  top_reviewer: {
    icon: '⭐',
    titleKey: 'leaderboard.badges.top_reviewer',
    descKey: 'leaderboard.badges.top_reviewerDesc',
  },
  perfect_returner: {
    icon: '🎯',
    titleKey: 'leaderboard.badges.perfect_returner',
    descKey: 'leaderboard.badges.perfect_returnerDesc',
  },
  reading_champion: {
    icon: '🏆',
    titleKey: 'leaderboard.badges.reading_champion',
    descKey: 'leaderboard.badges.reading_championDesc',
  },
  community_star: {
    icon: '🌟',
    titleKey: 'leaderboard.badges.community_star',
    descKey: 'leaderboard.badges.community_starDesc',
  },
};

type LeaderboardView = 'top50' | 'all';
type LeaderboardSort = 'scoreHigh' | 'scoreLow' | 'nameAsc' | 'nameDesc';

export function LeaderboardPage() {
  const { t } = useTranslation();
  const { getLeaderboard } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [view, setView] = useState<LeaderboardView>('top50');
  const [sort, setSort] = useState<LeaderboardSort>('scoreHigh');
  const [showRules, setShowRules] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);

  const loadLeaderboard = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    getLeaderboard()
      .then(setEntries)
      .catch(setLoadError)
      .finally(() => setIsLoading(false));
  }, [getLeaderboard]);

  useEffect(() => {
    const timer = setTimeout(loadLeaderboard, 0);
    return () => clearTimeout(timer);
  }, [loadLeaderboard]);

  const filteredEntries = useMemo(
    () =>
      view === 'all'
        ? entries
        : entries.filter((entry) => entry.rank <= 50 || entry.is_current_user),
    [entries, view],
  );

  const sortConfig = useMemo(
    () => ({
      compare: (a: LeaderboardEntry, b: LeaderboardEntry) => {
        switch (sort) {
          case 'scoreLow':
            return (
              a.score - b.score ||
              b.books_completed - a.books_completed ||
              b.reviews_count - a.reviews_count ||
              b.reading_streak - a.reading_streak ||
              a.full_name.localeCompare(b.full_name)
            );
          case 'nameAsc':
            return a.full_name.localeCompare(b.full_name);
          case 'nameDesc':
            return b.full_name.localeCompare(a.full_name);
          case 'scoreHigh':
          default:
            return (
              b.score - a.score ||
              b.books_completed - a.books_completed ||
              b.reviews_count - a.reviews_count ||
              b.reading_streak - a.reading_streak ||
              a.full_name.localeCompare(b.full_name)
            );
        }
      },
    }),
    [sort],
  );

  const visibleEntries = useSortedItems(filteredEntries, sortConfig);

  const { page, setPage, totalPages, paginatedItems, totalItems } = usePagination(
    visibleEntries,
    PAGE_SIZE,
  );

  function resetFilters() {
    setView('top50');
    setSort('scoreHigh');
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <PageTitle
          title={t('leaderboard.pageTitle')}
          description={t('leaderboard.pageDescription')}
        />
        <button
          type="button"
          onClick={() => setShowRules(!showRules)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Info className="size-4 text-primary" />
          {t(showRules ? 'leaderboard.rules.hide' : 'leaderboard.rules.show')}
        </button>
      </div>

      {showRules && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 text-sm space-y-4">
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2 text-base">
              <Trophy className="size-5 text-primary" />
              {t('leaderboard.rules.title')}
            </h3>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              {t('leaderboard.rules.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="rounded-lg border border-border/60 bg-background/80 p-2.5 flex flex-col items-start gap-1">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <BookOpen className="size-3.5" /> {t('leaderboard.pointsAmount', { points: 100 })}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('leaderboard.rules.labels.completeBook')}
              </span>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/80 p-2.5 flex flex-col items-start gap-1">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <Star className="size-3.5" /> {t('leaderboard.pointsAmount', { points: 25 })}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('leaderboard.rules.labels.writeReview')}
              </span>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/80 p-2.5 flex flex-col items-start gap-1">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
                <Calendar className="size-3.5" /> {t('leaderboard.pointsAmount', { points: 30 })}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('leaderboard.rules.labels.attendEvent')}
              </span>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/80 p-2.5 flex flex-col items-start gap-1">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400">
                <CheckCircle2 className="size-3.5" />{' '}
                {t('leaderboard.pointsAmount', { points: 15 })}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('leaderboard.rules.labels.onTimeReturn')}
              </span>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/80 p-2.5 flex flex-col items-start gap-1">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <Flame className="size-3.5" /> {t('leaderboard.pointsAmount', { points: 50 })}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('leaderboard.rules.labels.streakBonus')}
              </span>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/80 p-2.5 flex flex-col items-start gap-1">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-400">
                <Target className="size-3.5" /> {t('leaderboard.penaltyAmount', { points: 10 })}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('leaderboard.rules.labels.lateReturn')}
              </span>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingState label="Loading leaderboard" />
      ) : loadError ? (
        <ErrorState
          className="min-h-48"
          description={getErrorMessage(loadError, t('common.errors.generic'))}
          onRetry={loadLeaderboard}
        />
      ) : entries.length === 0 ? (
        <NoResults
          icon={Award}
          title={t('leaderboard.empty.title')}
          description={t('leaderboard.empty.description')}
        />
      ) : (
        <>
          <TableToolbar
            filters={[
              {
                label: 'Show',
                value: view,
                onChange: (value) => {
                  setView(value as LeaderboardView);
                  setPage(1);
                },
                options: [
                  { value: 'top50', label: 'Top 50' },
                  { value: 'all', label: 'Everyone' },
                ],
              },
            ]}
            sort={{
              label: 'Sort',
              value: sort,
              onChange: (value) => {
                setSort(value as LeaderboardSort);
                setPage(1);
              },
              options: [
                { value: 'scoreHigh', label: 'Highest Score' },
                { value: 'scoreLow', label: 'Lowest Score' },
                { value: 'nameAsc', label: 'Name A–Z' },
                { value: 'nameDesc', label: 'Name Z–A' },
              ],
            }}
            onReset={resetFilters}
            resetLabel="Reset"
          />

          {visibleEntries.length === 0 ? (
            <NoResults
              icon={Award}
              title={t('leaderboard.empty.title')}
              description={t('leaderboard.empty.description')}
              action={
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-sm font-medium text-primary-gradient"
                >
                  Reset
                </button>
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">{t('leaderboard.table.rank')}</TableHead>
                    <TableHead>{t('leaderboard.table.reader')}</TableHead>
                    <TableHead>{t('leaderboard.table.score')}</TableHead>
                    <TableHead>{t('leaderboard.table.badges')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((entry) => (
                    <TableRow
                      key={entry.member_id}
                      className={cn(entry.is_current_user && 'bg-primary/5 font-medium')}
                    >
                      <TableCell>
                        <span className="flex items-center gap-1.5 font-bold text-foreground">
                          {entry.rank <= 3 && (
                            <Award className={cn('size-4', medalColor[entry.rank])} />
                          )}
                          {entry.rank}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <Avatar
                            src={entry.avatar_url ?? undefined}
                            name={entry.full_name}
                            size="sm"
                          />
                          <span className="font-medium">{entry.full_name}</span>
                          {entry.is_current_user && (
                            <Badge variant="outline" className="ml-1 text-[11px] py-0">
                              {t('common.you')}
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-primary">
                          {entry.score.toLocaleString()}{' '}
                          <span className="text-xs font-normal text-muted-foreground">pts</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {entry.badges && entry.badges.length > 0 ? (
                            entry.badges.map((badgeKey) => {
                              const config = BADGE_CONFIG[badgeKey];
                              if (!config) return null;
                              return (
                                <span
                                  key={badgeKey}
                                  title={`${t(config.titleKey)} — ${t(config.descKey)}`}
                                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs shadow-xs hover:scale-105 transition-transform cursor-help"
                                >
                                  <span>{config.icon}</span>
                                  <span className="hidden sm:inline font-medium text-foreground text-[11px]">
                                    {t(config.titleKey)}
                                  </span>
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
