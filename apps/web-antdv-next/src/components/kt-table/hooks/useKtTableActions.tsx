import type { VNodeChild } from 'vue';

import type {
  KtTableButton,
  KtTableContext,
  KtTableRecord,
  KtTableResolvedProps,
  KtTableRowAction,
} from '../types';
import type { useKtTableRuntimeHooks } from './useKtTableHooks';
import type { useKtTablePermission } from './useKtTablePermission';

import { computed } from 'vue';

import { Search, SearchX } from '@vben/icons';

import { Button, Modal, Tooltip } from 'antdv-next';

import { $t } from '#/locales';

import { assertSingleActionAvailabilityStrategy } from '../helpers/actionAvailability';

const AButton = Button as any;
const ATooltip = Tooltip as any;

type PermissionHelpers = Pick<
  ReturnType<typeof useKtTablePermission>,
  'filterVisibleActions' | 'filterVisibleButtons' | 'resolveBoolean'
>;

type RunHook = ReturnType<typeof useKtTableRuntimeHooks>['runHook'];

interface UseKtTableActionsOptions {
  context: KtTableContext;
  permissions: PermissionHelpers;
  props: KtTableResolvedProps;
  reload: () => Promise<void>;
  reset: () => Promise<void>;
  runHook: RunHook;
  search: () => Promise<void>;
}

/**
 * 管理 KtTable 的默认按钮、自定义按钮和行操作渲染。
 *
 * @param options - 头部按钮、行操作、权限上下文和表格 API 依赖。
 * @returns 按钮与行操作的响应式集合、执行方法和渲染方法。
 */
export function useKtTableActions(options: UseKtTableActionsOptions) {
  const { context, permissions, props, reload, reset, runHook, search } =
    options;
  // 按钮 hook 只负责权限过滤、确认弹窗和回调触发，业务行为仍完全由调用方自定义。
  const { filterVisibleActions, filterVisibleButtons, resolveBoolean } =
    permissions;
  const rowActions = computed(() => {
    const actions = [
      ...props.rowActions,
      ...props.modules.flatMap((module) => module.rowActions || []),
    ];
    assertSingleActionAvailabilityStrategy(actions, 'KtTable rowActions');
    return filterVisibleActions(actions);
  });
  const defaultFormButtons = computed(() =>
    filterVisibleButtons(getDefaultButtons()),
  );
  const customButtons = computed(() => {
    const buttons = [
      ...props.buttons,
      ...props.modules.flatMap((module) => module.buttons || []),
    ];
    assertSingleActionAvailabilityStrategy(buttons, 'KtTable buttons');
    return filterVisibleButtons(buttons);
  });
  const formButtons = computed(() => [
    ...defaultFormButtons.value,
    ...customButtons.value.filter((button) => button.placement === 'form'),
  ]);
  const headerButtons = computed(() =>
    customButtons.value.filter((button) => button.placement !== 'form'),
  );

  const getDefaultButtons = (): KtTableButton[] => {
    if (!props.showDefaultButtons) return [];

    return [
      {
        icon: <Search class="kt-table__button-icon" />,
        key: 'search',
        label: '查询',
        operation: 'search',
        placement: 'form',
        type: 'primary',
      },
      {
        icon: <SearchX class="kt-table__button-icon" />,
        key: 'reset',
        label: '重置',
        operation: 'reset',
        placement: 'form',
      },
    ];
  };

  const renderIcon = (
    icon: KtTableButton['icon'],
    targetContext: KtTableContext = context,
  ) => {
    if (!icon) return null;
    if (typeof icon === 'function') {
      return icon(targetContext);
    }
    return icon;
  };

  /**
   * 根据按钮配置执行点击回调，并在完成后按需刷新表格。
   *
   * @param button - 被点击的 KtTable 头部或搜索区按钮配置。
   */
  async function runButtonAction(button: KtTableButton) {
    await runHook('onBeforeAction', button, context);

    let result: unknown;
    if (button.onClick) {
      result = await button.onClick(context);
    } else {
      switch (button.operation) {
        case 'reload': {
          result = await reload();

          break;
        }
        case 'reset': {
          result = await reset();

          break;
        }
        case 'search': {
          result = await search();

          break;
        }
        default:
      }
    }

    await runHook('onAfterAction', button, result, context);
  }

  /**
   * 根据行操作配置检查可用性，并把目标行传给点击回调。
   *
   * @param action - 要检查权限、确认配置并执行的 KtTable 行操作。
   * @param row - 行操作或权限过滤针对的 KtTable 业务记录。
   */
  async function runRowAction(action: KtTableRowAction, row: KtTableRecord) {
    await runHook('onBeforeAction', action, context);

    let result: unknown;
    if (action.onClick) {
      result = await action.onClick(row, context);
    }

    await runHook('onAfterAction', action, result, context);
  }

  /**
   * 按当前行过滤行操作，支持同一列按行状态展示不同按钮。
   *
   * @param row - 行操作或权限过滤针对的 KtTable 业务记录。
   * @returns 权限与 rowVisible 条件均允许的行操作数组。
   */
  function getVisibleRowActions(row: KtTableRecord) {
    return rowActions.value.filter((action) => {
      const { rowVisible } = action;
      if (typeof rowVisible === 'function') return rowVisible(row, context);
      if (typeof rowVisible === 'boolean') return rowVisible;
      return true;
    });
  }

  /**
   * 根据配置决定是否弹出确认框后再执行行操作。
   *
   * @param action - 要检查权限、确认配置并执行的 KtTable 行操作。
   * @param row - 行操作或权限过滤针对的 KtTable 业务记录。
   * @returns 无需确认时返回行操作 Promise；弹出确认框时返回 undefined。
   */
  function confirmRowAction(action: KtTableRowAction, row: KtTableRecord) {
    if (!action.confirm) {
      return runRowAction(action, row);
    }

    Modal.confirm({
      cancelText: $t('common.cancel'),
      content: (() => {
        if (typeof action.confirm === 'function') {
          return action.confirm(row);
        }
        return `确认${action.label}该数据吗？`;
      })(),
      okText: $t('common.confirm'),
      onOk: async () => {
        await runRowAction(action, row);
      },
      title: action.label,
    });
  }

  const renderButton = (button: KtTableButton) => {
    return (
      <AButton
        danger={button.danger}
        disabled={resolveBoolean(button.disabled, false)}
        key={button.key}
        loading={button.loading}
        onClick={() => runButtonAction(button)}
        type={button.type}
      >
        {renderIcon(button.icon)}
        {button.label}
      </AButton>
    );
  };

  const renderRowAction = (action: KtTableRowAction, row: KtTableRecord) => {
    const disabled = (() => {
      if (typeof action.disabled === 'function') {
        return action.disabled(row, context);
      }
      return resolveBoolean(action.disabled, false);
    })();
    const disabledReason = resolveDisabledReason(action, row, disabled);

    const button = (
      <AButton
        danger={action.danger}
        disabled={disabled}
        onClick={(() => {
          if (disabled) {
            return undefined;
          }
          return () => confirmRowAction(action, row);
        })()}
        type={action.type || 'link'}
      >
        {renderIcon(action.icon)}
        {action.label}
      </AButton>
    );

    if (!disabledReason) {
      return <span key={action.key}>{button}</span>;
    }

    return (
      <ATooltip key={action.key} title={disabledReason}>
        <span class="kt-table__disabled-action">{button}</span>
      </ATooltip>
    );
  };

  /**
   * 仅在行操作被禁用时读取静态原因或以当前行和表格上下文计算动态原因。
   *
   * @param action - 提供静态或动态禁用原因的行操作定义。
   * @param row - 传给动态禁用原因函数的当前表格行记录。
   * @param disabled - 行操作当前是否被判定为禁用。
   * @returns 静态或动态计算出的禁用原因；操作未禁用或未配置原因时返回 undefined。
   */
  function resolveDisabledReason(
    action: KtTableRowAction,
    row: KtTableRecord,
    disabled: boolean,
  ): string | undefined {
    if (!disabled || !action.disabledReason) return undefined;
    if (typeof action.disabledReason === 'function') {
      return action.disabledReason(row, context);
    }
    return action.disabledReason;
  }

  return {
    formButtons,
    getVisibleRowActions,
    headerButtons,
    renderButton,
    renderRowAction: renderRowAction as (
      action: KtTableRowAction,
      row: KtTableRecord,
    ) => VNodeChild,
    rowActions,
  };
}
