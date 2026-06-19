import type { QqbotApi } from '#/api/qqbot';

import { defineComponent } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Alert, Button, Space, Steps, Typography } from 'antdv-next';

import { getNapcatNewDeviceStatusMessage } from '#/api/qqbot/napcat';

import { useNapcatLoginSession } from './useNapcatLoginSession';

const AButton = Button as any;
const ASteps = Steps as any;
const ATypographyLink = Typography.Link as any;
const ATypographyText = Typography.Text as any;

export type NapcatLoginModalExposed = {
  openCreate: () => Promise<void>;
  openRefresh: (row: QqbotApi.Account) => Promise<void>;
};

export default defineComponent({
  name: 'NapcatLoginModal',
  emits: ['success'],
  setup(_, { emit, expose }) {
    let cleanupScanSession = () => {};
    let closeScanModal = () => {};
    const [ScanModal, scanModalApi] = useVbenModal({
      class: 'w-[520px]',
      fullscreenButton: false,
      onBeforeClose() {
        cleanupScanSession();
        return true;
      },
      onCancel() {
        closeScanModal();
      },
    });
    const session = useNapcatLoginSession({
      closeModal: () => scanModalApi.close(),
      onSuccess: () => {
        emit('success');
      },
      openModal: (title) => {
        scanModalApi.setState({ title }).open();
      },
    });
    cleanupScanSession = session.cleanupScanSession;
    closeScanModal = session.closeScanModal;

    expose({
      openCreate: session.openCreate,
      openRefresh: session.openRefresh,
    } satisfies NapcatLoginModalExposed);

    return () => (
      <ScanModal
        title={session.scanTitle.value}
        v-slots={{
          footer: () => [
            <AButton key="close" onClick={session.closeScanModal}>
              关闭
            </AButton>,
            <AButton
              disabled={
                !session.scanState.sessionId ||
                !!session.scanState.captchaUrl ||
                !!session.scanState.newDeviceStatus
              }
              key="refresh"
              loading={session.scanLoading.value}
              onClick={session.refreshScanQrcode}
            >
              刷新二维码
            </AButton>,
            <AButton
              disabled={!session.scanState.sessionId}
              key="check"
              loading={session.scanLoading.value}
              onClick={session.pollScanStatus}
              type="primary"
            >
              检查状态
            </AButton>,
          ],
        }}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            message={session.getScanMessage()}
            showIcon
            type={session.getScanAlertType() as any}
          />
          {session.scanState.containerName ? (
            <Alert
              message={`NapCat 容器：${session.scanState.containerName}${
                session.scanState.webuiPort
                  ? `，WebUI 端口：${session.scanState.webuiPort}`
                  : ''
              }`}
              showIcon
              type="info"
            />
          ) : null}
          {session.scanState.newDeviceStatus ? (
            <Alert
              description={
                <Space direction="vertical">
                  <ATypographyText>
                    请使用手机 QQ 扫描下方新设备验证二维码，并在手机端确认登录。
                  </ATypographyText>
                  {session.scanState.deviceVerifyUrl ? (
                    <ATypographyLink
                      href={session.scanState.deviceVerifyUrl}
                      target="_blank"
                    >
                      打开新设备验证链接
                    </ATypographyLink>
                  ) : null}
                </Space>
              }
              message={getNapcatNewDeviceStatusMessage(
                session.scanState.newDeviceStatus,
              )}
              showIcon
              type={
                session.getNewDeviceAlertType(
                  session.scanState.newDeviceStatus,
                ) as any
              }
            />
          ) : null}
          {session.scanState.captchaUrl &&
          !session.scanState.newDeviceStatus ? (
            <Alert
              description={
                <Space>
                  <ATypographyText>
                    请在当前页面完成腾讯安全验证，验证结果会自动提交到对应
                    NapCat 容器。
                  </ATypographyText>
                  <AButton
                    loading={session.scanLoading.value}
                    onClick={session.submitScanCaptcha}
                    type="primary"
                  >
                    完成安全验证
                  </AButton>
                </Space>
              }
              message="QQ 密码登录需要安全验证"
              showIcon
              type="warning"
            />
          ) : null}
          {session.scanProgressItems.value.length > 0 ? (
            <ASteps
              current={session.scanProgressCurrent.value}
              direction="vertical"
              items={session.scanProgressItems.value}
              size="small"
            />
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {session.scanQrcodeText.value ? (
              <img
                alt="qqbot-login-qrcode"
                onError={session.onQrcodeImageError}
                src={session.scanQrcodeImageSrc.value}
                style={{
                  background: '#fff',
                  borderRadius: '8px',
                  height: '240px',
                  padding: '12px',
                  width: '240px',
                }}
              />
            ) : (
              <div
                style={{
                  alignItems: 'center',
                  background: 'hsl(var(--muted))',
                  border: '1px dashed hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--muted-foreground))',
                  display: 'flex',
                  height: '240px',
                  justifyContent: 'center',
                  width: '240px',
                }}
              >
                {session.scanQrcodePlaceholderText.value}
              </div>
            )}
          </div>
          {session.scanQrcodeText.value ? (
            <ATypographyLink
              href={session.scanQrcodeOpenHref.value}
              target="_blank"
            >
              打开扫码链接
            </ATypographyLink>
          ) : null}
        </Space>
      </ScanModal>
    );
  },
});
