import type { UploadChangeParam } from 'antdv-next';

import { defineComponent, ref } from 'vue';

import { Profile, VCropper } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Button, message, Modal, Upload } from 'antdv-next';

import {
  createUploadedFileDownloadUrl,
  updateCurrentUserProfileApi,
  uploadFileApi,
} from '#/api';

import ProfileBase from './base-setting.vue';

const AButton = Button as any;
const AModal = Modal as any;
const AUpload = Upload as any;

export default defineComponent({
  name: 'ProfilePage',
  setup() {
    const userStore = useUserStore();
    const tabsValue = ref<string | undefined>('basic');
    const tabs = ref([
      {
        label: '基本设置',
        value: 'basic',
      },
    ]);

    const avatarModalOpen = ref(false);
    const avatarSaving = ref(false);
    const avatarImage = ref('');
    const avatarSource = ref('');
    const avatarFileName = ref('');
    const avatarRotation = ref(0);
    const cropperRef = ref<InstanceType<typeof VCropper>>();

    /**
     * 把头像裁剪弹窗切换为可见状态。
     */
    function openAvatarModal() {
      avatarModalOpen.value = true;
    }

    /**
     * 阻止上传组件自动提交文件，使业务表单统一控制实际上传时机。
     *
     * @returns 固定返回 false，阻止上传组件自动发起请求。
     */
    function preventAutoUpload() {
      return false;
    }

    /**
     * 读取用户选中的头像文件并生成预览，未选择文件时保持当前头像。
     *
     * @param event - 头像文件输入框触发的 change 事件。
     */
    async function selectAvatarFile(event: UploadChangeParam) {
      const file = event.fileList.at(-1)?.originFileObj as File | undefined;
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        message.error('请选择图片文件');
        return;
      }

      avatarFileName.value = file.name;
      avatarRotation.value = 0;
      avatarSource.value = await readFileAsDataUrl(file);
      avatarImage.value = avatarSource.value;
    }

    /**
     * 将头像图像按指定角度旋转并更新裁剪画布预览。
     *
     * @param degrees - 图片或头像顺时针旋转的角度。
     */
    async function rotateAvatar(degrees: number) {
      if (!avatarSource.value) return;

      avatarRotation.value = (avatarRotation.value + degrees + 360) % 360;
      avatarImage.value = await rotateImage(
        avatarSource.value,
        avatarRotation.value,
      );
    }

    /**
     * 裁切并上传所选头像，更新用户资料后关闭弹窗；缺少图片或裁切失败时只提示用户。
     */
    async function saveAvatar() {
      if (!cropperRef.value || !avatarImage.value) {
        message.warning('请先选择头像图片');
        return;
      }

      avatarSaving.value = true;
      try {
        const cropped = await cropperRef.value.getCropImage(
          'image/jpeg',
          0.92,
          'blob',
          320,
          320,
        );

        if (!(cropped instanceof Blob) || cropped.size === 0) {
          message.error('头像裁切失败');
          return;
        }

        const file = new File([cropped], 'avatar.jpg', {
          type: 'image/jpeg',
        });
        const uploaded = await uploadFileApi(file, {
          objectName: createAvatarObjectName(),
        });
        const data = await updateCurrentUserProfileApi({
          avatar: createUploadedFileDownloadUrl(uploaded),
        });

        userStore.setUserInfo(data);
        avatarModalOpen.value = false;
        message.success('头像已更新');
      } finally {
        avatarSaving.value = false;
      }
    }

    /**
     * 清空头像源图、预览与文件名，并把旋转角度归零，使裁剪界面回到未选文件状态。
     */
    function resetAvatarCrop() {
      avatarImage.value = '';
      avatarSource.value = '';
      avatarFileName.value = '';
      avatarRotation.value = 0;
    }

    /**
     * 按当前用户标识和时间戳生成隔离的头像对象存储路径。
     *
     * @returns 包含用户标识与时间戳的头像对象存储路径。
     */
    function createAvatarObjectName() {
      const userId =
        userStore.userInfo?.userId || userStore.userInfo?.id || 'user';

      return `avatars/${userId}/${Date.now()}-avatar.jpg`;
    }

    /**
     * 通过 FileReader 把头像文件读取为数据地址，读取失败时拒绝 Promise。
     *
     * @param file - 要由 FileReader 转换为数据地址的头像文件。
     * @returns FileReader 读取出的头像数据地址；读取失败时拒绝 Promise。
     */
    function readFileAsDataUrl(file: File) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () =>
          resolve(String(reader.result || '')),
        );
        reader.addEventListener('error', () =>
          reject(new Error('图片读取失败')),
        );
        reader.readAsDataURL(file);
      });
    }

    /**
     * 异步加载图片地址并返回已完成解码事件的 HTMLImageElement；加载失败时拒绝 Promise。
     *
     * @param src - 要赋给 Image 并等待加载完成的图片地址。
     * @returns 图片加载成功时解析为 HTMLImageElement，失败时拒绝的 Promise。
     */
    function loadImage(src: string) {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', () =>
          reject(new Error('图片加载失败')),
        );
        image.src = src;
      });
    }

    /**
     * 在画布中按指定角度重绘图片，并返回旋转后的数据地址。
     *
     * @param src - 要载入画布并按角度旋转的源图片地址。
     * @param degrees - 图片或头像顺时针旋转的角度。
     * @returns 旋转后画布生成的图片数据地址。
     */
    async function rotateImage(src: string, degrees: number) {
      const image = await loadImage(src);
      const normalized = ((degrees % 360) + 360) % 360;
      const isQuarterTurn = normalized === 90 || normalized === 270;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (isQuarterTurn) {
        canvas.width = image.height;
      } else {
        canvas.width = image.width;
      }
      if (isQuarterTurn) {
        canvas.height = image.width;
      } else {
        canvas.height = image.height;
      }

      if (!ctx) return src;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((normalized * Math.PI) / 180);
      ctx.drawImage(image, -image.width / 2, -image.height / 2);

      return canvas.toDataURL('image/jpeg', 0.92);
    }

    return () => (
      <div class="h-full">
        <Profile
          avatarEditable
          modelValue={tabsValue.value}
          onAvatarClick={openAvatarModal}
          onUpdate:modelValue={(value: string | undefined) => {
            tabsValue.value = value;
          }}
          tabs={tabs.value}
          title="个人中心"
          userInfo={userStore.userInfo}
          v-slots={{
            content: () => {
              if (tabsValue.value === 'basic') {
                return <ProfileBase />;
              }
              return null;
            },
          }}
        />

        <AModal
          afterClose={resetAvatarCrop}
          cancelText="取消"
          confirmLoading={avatarSaving.value}
          okButtonProps={{ disabled: !avatarImage.value }}
          okText="保存头像"
          onOk={saveAvatar}
          onUpdate:open={(open: boolean) => {
            avatarModalOpen.value = open;
          }}
          open={avatarModalOpen.value}
          title="更换头像"
          width="720px"
        >
          <div class="flex flex-col gap-4">
            <div class="flex flex-wrap items-center gap-3">
              <AUpload
                accept="image/*"
                beforeUpload={preventAutoUpload}
                maxCount={1}
                onChange={selectAvatarFile}
                showUploadList={false}
              >
                <AButton>选择图片</AButton>
              </AUpload>
              <span class="text-sm text-foreground/70">
                {avatarFileName.value || '请选择图片后裁切头像'}
              </span>
            </div>

            {(() => {
              if (avatarImage.value) {
                return (
                  <div class="flex flex-wrap items-start gap-5">
                    <VCropper
                      aspectRatio="1:1"
                      height={420}
                      img={avatarImage.value}
                      ref={cropperRef}
                      width={420}
                    />
                    <div class="flex min-w-32 flex-col gap-2">
                      <AButton onClick={() => void rotateAvatar(-90)}>
                        向左旋转
                      </AButton>
                      <AButton onClick={() => void rotateAvatar(90)}>
                        向右旋转
                      </AButton>
                    </div>
                  </div>
                );
              }
              return (
                <div class="flex h-72 items-center justify-center rounded border border-dashed text-sm text-foreground/60">
                  点击“选择图片”上传头像素材
                </div>
              );
            })()}
          </div>
        </AModal>
      </div>
    );
  },
});
