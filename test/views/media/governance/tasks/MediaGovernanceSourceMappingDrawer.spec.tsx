/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file, vue/require-default-prop */

import type { MediaGovernanceSourceMappingDrawerExposed } from '@test-source/apps/web-antdv-next/src/views/media/governance/tasks/components/MediaGovernanceSourceMappingDrawer';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';

import MediaGovernanceSourceMappingDrawer from '@test-source/apps/web-antdv-next/src/views/media/governance/tasks/components/MediaGovernanceSourceMappingDrawer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  tableDataSource: [] as any[],
  tableVirtual: false,
}));

vi.mock('#/api/media-governance', () => ({
  bindMediaGovernanceSubtitleContract: vi.fn(async () => undefined),
  getMediaGovernanceTask: vi.fn(async () => ({})),
  updateMediaGovernanceSourceSelection: vi.fn(async () => undefined),
}));

vi.mock('#/components/kt-table', () => ({
  KtTable: defineComponent({
    name: 'MockKtTable',
    inheritAttrs: false,
    props: {
      columns: { default: () => [], type: Array },
      dataSource: { default: () => [], type: Array },
      virtual: Boolean,
    },
    setup(props, { slots }) {
      return () => {
        mocks.tableDataSource = [...props.dataSource];
        mocks.tableVirtual = props.virtual;
        const firstRow = props.dataSource[0];
        let firstFileCell;
        if (firstRow) {
          firstFileCell = slots.bodyCell?.({
            column: { key: 'file' },
            record: firstRow,
          });
        }
        return h('section', { 'data-testid': 'mapping-table' }, [
          firstFileCell,
        ]);
      };
    },
  }),
}));

vi.mock('antdv-next', () => {
  const SlotStub = defineComponent({
    name: 'SlotStub',
    inheritAttrs: false,
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    },
  });
  const DrawerStub = defineComponent({
    name: 'MockDrawer',
    inheritAttrs: false,
    props: {
      open: Boolean,
      title: String,
    },
    setup(props, { slots }) {
      return () =>
        h('aside', { 'data-open': String(props.open) }, [
          h('h2', props.title),
          slots.default?.(),
          slots.footer?.(),
        ]);
    },
  });

  return {
    Alert: SlotStub,
    Button: SlotStub,
    Checkbox: SlotStub,
    Drawer: DrawerStub,
    InputNumber: SlotStub,
    Select: SlotStub,
    Space: SlotStub,
    Tag: SlotStub,
    message: { success: vi.fn() },
  };
});

beforeEach(() => {
  mocks.tableDataSource = [];
  mocks.tableVirtual = false;
});

describe('media governance source mapping drawer large manifest', () => {
  it('opts 1,317 rows into KtTable virtual mode and reads visible files through the index map', async () => {
    const rowCount = 1317;
    const manifest = Array.from({ length: rowCount }, (_, index) => ({
      executable: false,
      index,
      relativePath: `S01/Show.S01E${index + 1}.mkv`,
      sizeBytes: 1000 + index,
    }));
    const findManifest = vi.fn();
    Object.defineProperty(manifest, 'find', {
      configurable: true,
      value: findManifest,
    });
    const task = {
      id: 'media-task-c7debf14-dfbf-43a8-ac3e-e7bd5befbefa',
      mediaType: 'tv',
      revision: 7,
      units: [{ id: 'media-unit-s01', seasonNumber: 'S01' }],
    } as MediaGovernanceApi.Task;
    const source = {
      id: 'media-source-aa4f6f19-6a20-41b0-a235-66624b595c0c',
      manifest,
      releaseGroup: 'DBD-Raws',
      seasonNumbers: ['S01'],
      selectedFileMappings: Array.from({ length: rowCount }, (_, index) => ({
        episodeNumber: index + 1,
        fileRole: 'video' as const,
        index,
        language: null,
        unitId: 'media-unit-s01',
      })),
    } as MediaGovernanceApi.Source;
    const wrapper = mount(MediaGovernanceSourceMappingDrawer);

    (wrapper.vm as unknown as MediaGovernanceSourceMappingDrawerExposed).open(
      task,
      source,
    );
    await nextTick();
    await nextTick();

    expect(mocks.tableVirtual).toBe(true);
    expect(mocks.tableDataSource).toHaveLength(rowCount);
    expect(wrapper.get('[data-testid="mapping-table"]').text()).toContain(
      'S01/Show.S01E1.mkv',
    );
    expect(findManifest).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
