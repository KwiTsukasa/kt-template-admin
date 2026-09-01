import routes from '@test-source/apps/web-antdv-next/src/router/routes/modules/media-governance';
import { describe, expect, it } from 'vitest';

describe('media governance route module', () => {
  it('opens the canonical series board before execution history', () => {
    const root = routes[0];
    const seriesRoute = root?.children?.find(
      (route) => route.name === 'MediaGovernanceSeries',
    );
    const detailRoute = root?.children?.find(
      (route) => route.name === 'MediaGovernanceSeriesDetail',
    );

    expect(root?.redirect).toBe('/media/governance/series');
    expect(seriesRoute).toMatchObject({
      path: '/media/governance/series',
    });
    expect(detailRoute).toMatchObject({
      meta: { hideInMenu: true },
      path: '/media/governance/series/:seriesId',
    });
  });

  it('exposes NAS scrape validation as an independent page module', () => {
    const scrapeRoute = routes[0]?.children?.find(
      (route) => route.name === 'MediaScrapeValidation',
    );

    expect(scrapeRoute).toMatchObject({
      meta: {
        title: 'NAS 刮削校验',
      },
      path: '/media/scrape-validation',
    });
  });
});
