import { defineComponent } from 'vue';

import { IconifyIcon } from '@vben/icons';

import './automation.scss';

export default defineComponent({
  name: 'AutomationHeader',
  props: {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: 'lucide:workflow' },
  },
  setup(props, { slots }) {
    return () => (
      <header class="automation-heading">
        <div class="automation-heading__identity">
          <span class="automation-heading__icon">
            <IconifyIcon icon={props.icon} />
          </span>
          <div>
            <div class="automation-heading__eyebrow">自动化中心</div>
            <h1>{props.title}</h1>
            <p>{props.description}</p>
          </div>
        </div>
        <div class="automation-heading__actions">{slots.default?.()}</div>
      </header>
    );
  },
});
