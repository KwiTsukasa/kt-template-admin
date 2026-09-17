import type { DataField } from '#/api/automation/definition';

import { describe, expect, it } from 'vitest';

import {
  bindingFieldType,
  bindingReferenceKey,
  indexBindingOptions,
} from '#/views/workflow-engine/designer/binding-options';

const field = (
  key: string,
  type: DataField['type'],
  format?: DataField['format'],
): DataField => ({ key, label: key, type, format, required: true });

describe('字段映射选项索引', () => {
  it('同一来源只进入兼容类型和日期格式，不把文本日期当成普通文本', () => {
    const options = indexBindingOptions(
      {
        fields: [
          field('count', 'integer'),
          field('ratio', 'number'),
          field('date', 'string', 'date'),
          field('text', 'string'),
        ],
      },
      [],
    );
    expect(
      options
        .get(bindingFieldType(field('target', 'number')))
        ?.input.map((item) => item.value),
    ).toEqual(['count', 'ratio']);
    expect(
      options
        .get(bindingFieldType(field('target', 'integer')))
        ?.input.map((item) => item.value),
    ).toEqual(['count']);
    expect(
      options
        .get(bindingFieldType(field('target', 'string', 'date')))
        ?.input.map((item) => item.value),
    ).toEqual(['date']);
    expect(
      options
        .get(bindingFieldType(field('target', 'string')))
        ?.input.map((item) => item.value),
    ).toEqual(['text']);
  });

  it('带点号的节点身份及属性重排不会破坏选中值或提交引用', () => {
    const options = indexBindingOptions({ fields: [] }, [
      {
        name: '检查',
        nodeId: 'source.inspect',
        schema: { fields: [field('value', 'number')] },
      },
    ]);
    const selected = options.get('number:')?.node[0];
    expect(JSON.parse(selected?.value ?? '')).toEqual({
      type: 'node',
      nodeId: 'source.inspect',
      field: 'value',
    });
    expect(selected?.value).toBe(
      bindingReferenceKey({
        field: 'value',
        nodeId: 'source.inspect',
        type: 'node',
      }),
    );
  });

  it('多个目标重复取用同类型选项时不再读取来源字段', () => {
    let reads = 0;
    const sources = Array.from({ length: 1000 }, (_, index) => {
      const value = field(`value_${index}`, 'integer');
      Object.defineProperty(value, 'type', {
        get: () => {
          reads++;
          return 'integer';
        },
      });
      return value;
    });
    const options = indexBindingOptions({ fields: sources }, []);
    const indexedReads = reads;
    for (let index = 0; index < 1000; index++)
      expect(options.get('number:')?.first).toHaveLength(1000);
    expect(reads).toBe(indexedReads);
    expect(indexedReads).toBeLessThanOrEqual(sources.length * 3);
  });
});
