import { useEffect, useState } from 'react';
import { CalendarCheck, CalendarPlus, CalendarX, Percent, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatisticCard, EventCard, PageHeader } from '@/components/common';
import { Button, EmptyState, Loader } from '@/components/ui';
import { apiGet, apiPost, apiDelete, ApiError } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';

import { CreateEventModal } from '../components/CreateEventModal';
import { EventDetailsDrawer } from '../components/EventDetailsDrawer';

interface Registrant {
  id: string;
  full_name: string;
  email: string;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  attendees: number;
  capacity: number;
  registered: boolean;
  registrants: Registrant[];
  assigned_managers: Registrant[];
}

interface EventListResponse {
  items: Event[];
  total: number;
}

interface AttendanceSummary {
  total_events_this_month: number;
  total_attendees: number;
  average_attendance_rate: number;
}

export function EventsPage() {
  const { t } = useTranslation();
  const { token, role } = useAuth();
  const canManage = role === 'admin' || role === 'manager';
  const [events, setEvents] = useState<Event[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>({
    total_events_this_month: 0,
    total_attendees: 0,
    average_attendance_rate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const activeEvent = events.find((e) => e.id === activeEventId) ?? null;

  useEffect(() => {
    fetchEvents();
  }, [token]);

  function fetchEvents() {
    setLoading(true);
    Promise.all([
      apiGet<EventListResponse>('/events?page_size=100', token ?? undefined),
      apiGet<AttendanceSummary>('/events/summary'),
    ])
      .then(([list, s]) => {
        setEvents(list.items);
        setSummary(s);
      })
      .finally(() => setLoading(false));
  }

  async function toggleRegistration(event: Event) {
    if (!token) return;
    try {
      let updated: Event;
      if (event.registered) {
        updated = await apiDelete<Event>(`/events/${event.id}/register`, token);
      } else {
        updated = await apiPost<Event>(`/events/${event.id}/register`, undefined, token);
      }
      setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    } catch (err) {
      if (err instanceof ApiError) console.error(err.message);
    }
  }

  async function removeRegistrant(eventId: string, memberId: string) {
    if (!token) return;
    try {
      const updated = await apiDelete<Event>(`/events/${eventId}/registrants/${memberId}`, token);
      setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    } catch (err) {
      if (err instanceof ApiError) console.error(err.message);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('events.pageTitle')}
        description={t('events.pageDescription')}
        actions={
          canManage ? (
            <Button leadingIcon={<CalendarPlus className="size-4" />} onClick={() => setCreateOpen(true)}>
              Create Event
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatisticCard
          icon={CalendarCheck}
          label={t('events.stats.eventsThisMonth')}
          value={String(summary.total_events_this_month)}
        />
        <StatisticCard
          icon={Users}
          label={t('events.stats.totalAttendees')}
          value={String(summary.total_attendees)}
        />
        <StatisticCard
          icon={Percent}
          label={t('events.stats.avgAttendanceRate')}
          value={`${Math.round(summary.average_attendance_rate * 100)}%`}
        />
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title={t('events.empty.title')}
          description={t('events.empty.description')}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard
              key={event.id}
              title={event.title}
              date={new Date(event.date).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
              location={event.location}
              attendees={event.attendees}
              capacity={event.capacity}
              registered={event.registered}
              onViewDetails={() => setActiveEventId(event.id)}
            />
          ))}
        </div>
      )}

      <EventDetailsDrawer
        event={activeEvent}
        onClose={() => setActiveEventId(null)}
        onToggleRegistration={toggleRegistration}
        onRemoveRegistrant={removeRegistrant}
        onEdit={(event) => {
          setActiveEventId(null);
          setEditingEvent(event);
        }}
      />

      <CreateEventModal
        open={createOpen || editingEvent !== null}
        event={editingEvent}
        onClose={() => {
          setCreateOpen(false);
          setEditingEvent(null);
        }}
        onSaved={fetchEvents}
      />
    </div>
  );
}

