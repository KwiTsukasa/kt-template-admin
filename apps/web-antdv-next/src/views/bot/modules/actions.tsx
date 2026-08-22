import type { Component } from 'vue';

import { h } from 'vue';

import { Button, Popconfirm, Space } from 'antdv-next';

const AButton = Button as any;
const APopconfirm = Popconfirm as any;
const ASpace = Space as any;

export interface BotActionItem {
  confirmText?: string;
  danger?: boolean;
  disabled?: boolean;
  icon?: Component;
  key: string;
  label: string;
  loading?: boolean;
  onClick: () => Promise<void> | void;
}

export const renderBotActions = (actions: BotActionItem[]) => {
  return (
    <ASpace size="small">
      {actions.map((action) => {
        const button = (
          <AButton
            danger={action.danger}
            disabled={action.disabled}
            icon={(() => {
              if (action.icon) {
                return h(action.icon);
              }
              return undefined;
            })()}
            loading={action.loading}
            onClick={(() => {
              if (action.confirmText) {
                return undefined;
              }
              return action.onClick;
            })()}
            size="small"
            type="link"
          >
            {action.label}
          </AButton>
        );

        if (!action.confirmText) return <span key={action.key}>{button}</span>;

        return (
          <APopconfirm
            key={action.key}
            onConfirm={action.onClick}
            title={action.confirmText}
          >
            {{ default: () => button }}
          </APopconfirm>
        );
      })}
    </ASpace>
  );
};
