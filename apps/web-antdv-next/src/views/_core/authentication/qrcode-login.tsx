import { defineComponent } from 'vue';

import { AuthenticationQrCodeLogin } from '@vben/common-ui';
import { LOGIN_PATH } from '@vben/constants';

export default defineComponent({
  name: 'QrCodeLogin',
  setup() {
    return () => <AuthenticationQrCodeLogin loginPath={LOGIN_PATH} />;
  },
});
