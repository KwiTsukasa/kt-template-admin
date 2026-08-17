import type { VbenFormSchema } from '@vben/common-ui';

import { computed, defineComponent, ref } from 'vue';

import { AuthenticationCodeLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { message } from 'antdv-next';

const CODE_LENGTH = 6;

export default defineComponent({
  name: 'CodeLogin',
  setup() {
    const loading = ref(false);
    const loginRef = ref<InstanceType<typeof AuthenticationCodeLogin>>();

    /**
     * 模拟发送手机验证码并展示进度提示，延迟结束后返回固定验证码与目标手机号。
     *
     * @param phoneNumber - 接收登录验证码的手机号码。
     * @returns 延迟完成后解析为固定验证码和目标手机号的模拟发送结果。
     */
    function sendCodeApi(phoneNumber: string) {
      message.loading({
        content: $t('page.auth.sendingCode'),
        duration: 0,
        key: 'sending-code',
      });
      return new Promise((resolve) => {
        setTimeout(() => {
          message.success({
            content: $t('page.auth.codeSentTo', [phoneNumber]),
            duration: 3,
            key: 'sending-code',
          });
          resolve({ code: '123456', phoneNumber });
        }, 3000);
      });
    }

    const formSchema = computed((): VbenFormSchema[] => [
      {
        component: 'VbenInput',
        componentProps: {
          placeholder: $t('authentication.mobile'),
        },
        fieldName: 'phoneNumber',
        label: $t('authentication.mobile'),
        rules: z
          .string()
          .min(1, { message: $t('authentication.mobileTip') })
          .refine((value) => /^\d{11}$/.test(value), {
            message: $t('authentication.mobileErrortip'),
          }),
      },
      {
        component: 'VbenPinInput',
        componentProps: {
          codeLength: CODE_LENGTH,
          createText: (countdown: number) => {
            if (countdown > 0) {
              return $t('authentication.sendText', [countdown]);
            }
            return $t('authentication.sendCode');
          },
          handleSendCode: async () => {
            loading.value = true;
            const formApi = loginRef.value?.getFormApi();
            if (!formApi) {
              loading.value = false;
              throw new Error('formApi is not ready');
            }
            await formApi.validateField('phoneNumber');
            const isPhoneReady = await formApi.isFieldValid('phoneNumber');
            if (!isPhoneReady) {
              loading.value = false;
              throw new Error('Phone number is not Ready');
            }
            const { phoneNumber } = await formApi.getValues();
            await sendCodeApi(phoneNumber);
            loading.value = false;
          },
          placeholder: $t('authentication.code'),
        },
        fieldName: 'code',
        label: $t('authentication.code'),
        rules: z.string().length(CODE_LENGTH, {
          message: $t('authentication.codeTip', [CODE_LENGTH]),
        }),
      },
    ]);

    /**
     * 当验证码登录占位表单提交时，仅短暂切换按钮加载状态，不发起实际登录请求。
     */
    function handleLogin() {
      loading.value = true;
      loading.value = false;
    }

    return () => (
      <AuthenticationCodeLogin
        formSchema={formSchema.value}
        loading={loading.value}
        onSubmit={handleLogin}
        ref={loginRef}
      />
    );
  },
});
