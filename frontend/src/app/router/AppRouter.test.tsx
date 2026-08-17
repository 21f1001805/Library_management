import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppProviders } from '@/providers/AppProviders';

describe('AppRouter', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/dashboard');
  });

  it('redirects unauthenticated users away from protected routes to login', async () => {
    const { AppRouter } = await import('./AppRouter');

    render(
      <AppProviders>
        <AppRouter />
      </AppProviders>,
    );

    expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument();
  });
});
