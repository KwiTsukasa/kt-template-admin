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
 * @param options 按钮系统初始化参数。
 * @param options.context KtTable 运行时上下文。
 * @param options.permissions 权限和显示状态解析工具。
 * @param options.props 表格最终合并后的配置。
 * @param options.reload 重新加载表格数据的函数。
 * @param options.reset 重置搜索表单和表格数据的函数。
 * @param options.runHook 运行按钮生命周期 hook 的函数。
 * @param options.search 执行表格查询的函数。
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
    return typeof icon === 'function' ? icon(targetContext) : icon;
  };

  /**
   * 执行头部或搜索区按钮动作。
   *
   * @param button 当前触发的按钮配置。
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
   * 执行单行操作按钮动作。
   *
   * @param action 当前触发的行操作配置。
   * @param row 当前行数据。
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
   * @param row 当前行数据。
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
   * 按配置决定是否弹出确认框后再执行行操作。
   *
   * @param action 当前触发的行操作配置。
   * @param row 当前行数据。
   */
  function confirmRowAction(action: KtTableRowAction, row: KtTableRecord) {
    if (!action.confirm) {
      return runRowAction(action, row);
    }

    Modal.confirm({
      cancelText: $t('common.cancel'),
      content:
        typeof action.confirm === 'function'
          ? action.confirm(row)
          : `确认${action.label}该数据吗？`,
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
    const disabled =
      typeof action.disabled === 'function'
        ? action.disabled(row, context)
        : resolveBoolean(action.disabled, false);
    const disabledReason = resolveDisabledReason(action, row, disabled);

    const button = (
      <AButton
        danger={action.danger}
        disabled={disabled}
        onClick={disabled ? undefined : () => confirmRowAction(action, row)}
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

  function resolveDisabledReason(
    action: KtTableRowAction,
    row: KtTableRecord,
    disabled: boolean,
  ): string | undefined {
    if (!disabled || !action.disabledReason) return undefined;
    return typeof action.disabledReason === 'function'
      ? action.disabledReason(row, context)
      : action.disabledReason;
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
