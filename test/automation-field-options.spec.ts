import type { DataField } from '#/api/automation/definition';

import { describe, expect, it } from 'vitest';

import {
  fieldOptionsKey,
  indexFieldOptions,
  nextFieldKey,
} from '#/components/kt-dynamic-form/field-options';

const field = (key: string, patch: Partial<DataField> = {}): DataField => ({
  key,
  label: key,
  type: 'string',
  required: false,
  ...patch,
});

describe('公用字段选项与命名', () => {
  it('兼容整数、必填和日期要求，普通文本目标可读取日期文本', () => {
    const options = indexFieldOptions([
      field('date', { format: 'date', required: true }),
      field('text'),
      field('count', { type: 'integer', required: true }),
      field('optional', { type: 'number' }),
    ]);
    const values = (target: DataField, required = false) =>
      options
        .get(fieldOptionsKey(target, required))
        ?.map((option) => option.value);
    expect(values(field('target'))).toEqual(['date', 'text']);
    expect(values(field('target', { format: 'date' }))).toEqual(['date']);
    expect(values(field('target', { type: 'number' }))).toEqual([
      'count',
      'optional',
    ]);
    expect(
      values(field('target', { type: 'number', required: true }), true),
    ).toEqual(['count']);
    const strict = indexFieldOptions(
      [field('date', { format: 'date' }), field('text')],
      true,
    );
    expect(
      strict
        .get(fieldOptionsKey(field('target')))
        ?.map((option) => option.value),
    ).toEqual(['text']);
  });
  it.each([100, 1000, 10_000])(
    '为 %i 个来源索引一次后，逐行渲染不再扫描来源',
    (count) => {
      let reads = 0;
      const fields = Array.from({ length: count }, (_, index) => ({
        ...field(`field_${count + index + 1}`),
        get type() {
          reads++;
          return 'string' as const;
        },
      }));
      expect(nextFieldKey(fields, 'field')).toBe(`field_${count * 2 + 1}`);
      const options = indexFieldOptions(fields);
      for (let index = 0; index < count; index++)
        expect(options.get(fieldOptionsKey(field('target')))?.length).toBe(
          count,
        );
      expect(reads).toBeLessThanOrEqual(count * 2);
    },
  );
});
