import type { BotApi } from '#/api/bot';

import { defineComponent } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Alert, Button, Space, Steps, Typography } from 'antdv-next';

import { getNapcatNewDeviceStatusMessage } from '#/api/bot/napcat';

import { useNapcatLoginSession } from './useNapcatLoginSession';

const AButton = Button as any;
const ASteps = Steps as any;
const ATypographyLink = Typography.Link as any;
const ATypographyText = Typography.Text as any;

export type NapcatLoginModalExposed = {
  openCreate: () => Promise<void>;
  openRefresh: (row: BotApi.Account) => Promise<void>;
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
      /**
       * 扫码弹窗关闭前清理轮询与事件订阅，并允许本次关闭。
       *
       * @returns 固定返回 true，允许清理完成后关闭扫码弹窗。
       */
      onBeforeClose() {
        cleanupScanSession();
        return true;
      },
      /**
       * 用户取消扫码登录时关闭当前扫码弹窗。
       */
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
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            showIcon
            title={session.getScanMessage()}
            type={session.getScanAlertType() as any}
          />
          {(() => {
            if (session.scanState.containerName) {
              return (
                <Alert
                  showIcon
                  title={`NapCat 容器：${session.scanState.containerName}${(() => {
                    if (session.scanState.webuiPort) {
                      return `，WebUI 端口：${session.scanState.webuiPort}`;
                    }
                    return '';
                  })()}`}
                  type="info"
                />
              );
            }
            return null;
          })()}
          {(() => {
            if (session.scanState.newDeviceStatus) {
              return (
                <Alert
                  description={
                    <Space orientation="vertical">
                      <ATypographyText>
                        请使用手机 QQ
                        扫描下方新设备验证二维码，并在手机端确认登录。
                      </ATypographyText>
                      {(() => {
                        if (session.scanState.deviceVerifyUrl) {
                          return (
                            <ATypographyLink
                              href={session.scanState.deviceVerifyUrl}
                              target="_blank"
                            >
                              打开新设备验证链接
                            </ATypographyLink>
                          );
                        }
                        return null;
                      })()}
                    </Space>
                  }
                  showIcon
                  title={getNapcatNewDeviceStatusMessage(
                    session.scanState.newDeviceStatus,
                  )}
                  type={
                    session.getNewDeviceAlertType(
                      session.scanState.newDeviceStatus,
                    ) as any
                  }
                />
              );
            }
            return null;
          })()}
          {(() => {
            if (
              session.scanState.captchaUrl &&
              !session.scanState.newDeviceStatus
            ) {
              return (
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
                  showIcon
                  title="QQ 密码登录需要安全验证"
                  type="warning"
                />
              );
            }
            return null;
          })()}
          {(() => {
            if (session.scanProgressItems.value.length > 0) {
              return (
                <ASteps
                  current={session.scanProgressCurrent.value}
                  items={session.scanProgressItems.value}
                  orientation="vertical"
                  size="small"
                />
              );
            }
            return null;
          })()}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {(() => {
              if (session.scanQrcodeText.value) {
                return (
                  <img
                    alt="bot-login-qrcode"
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
                );
              }
              return (
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
              );
            })()}
          </div>
          {(() => {
            if (session.scanQrcodeText.value) {
              return (
                <ATypographyLink
                  href={session.scanQrcodeOpenHref.value}
                  target="_blank"
                >
                  打开扫码链接
                </ATypographyLink>
              );
            }
            return null;
          })()}
        </Space>
      </ScanModal>
    );
  },
});
