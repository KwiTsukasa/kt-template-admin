import {
  discoverMediaGovernanceRssSources,
  getMediaGovernanceRssIdentityCandidates,
} from '@test-source/apps/web-antdv-next/src/api/media-governance';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestClient } from '#/api/request';

vi.mock('#/api/request', () => ({
  requestClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('media governance RSS discovery api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('covers the complete bounded upstream pipeline with a dedicated timeout', async () => {
    const input = {
      provider: 'bangumi' as const,
      providerId: '530725',
      releaseYear: 2026,
    };

    await getMediaGovernanceRssIdentityCandidates('死神 千年血战篇-祸进谭-');
    await discoverMediaGovernanceRssSources(
      'media-series-bleach',
      'media-work-bleach',
      2,
      input,
    );

    expect(requestClient.get).toHaveBeenCalledWith(
      '/media-governance/series/rss-discovery/identity-candidates',
      {
        params: { keyword: '死神 千年血战篇-祸进谭-' },
        timeout: 30_000,
      },
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/media-governance/series/media-series-bleach/works/media-work-bleach/seasons/2/rss-discovery/search',
      input,
      { timeout: 30_000 },
    );
  });
});
