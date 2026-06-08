<script setup lang="ts">
import type { UploadChangeParam } from 'antdv-next';

import { ref } from 'vue';

import { Profile, VCropper } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Button, message, Modal, Upload } from 'antdv-next';

import {
  createUploadedFileDownloadUrl,
  updateCurrentUserProfileApi,
  uploadFileApi,
} from '#/api';

import ProfileBase from './base-setting.vue';

const userStore = useUserStore();

const tabsValue = ref<string>('basic');
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

function openAvatarModal() {
  avatarModalOpen.value = true;
}

function preventAutoUpload() {
  return false;
}

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

async function rotateAvatar(degrees: number) {
  if (!avatarSource.value) return;

  avatarRotation.value = (avatarRotation.value + degrees + 360) % 360;
  avatarImage.value = await rotateImage(
    avatarSource.value,
    avatarRotation.value,
  );
}

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

    const file = new File([cropped], 'avatar.jpg', { type: 'image/jpeg' });
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

function resetAvatarCrop() {
  avatarImage.value = '';
  avatarSource.value = '';
  avatarFileName.value = '';
  avatarRotation.value = 0;
}

function createAvatarObjectName() {
  const userId = userStore.userInfo?.userId || userStore.userInfo?.id || 'user';

  return `avatars/${userId}/${Date.now()}-avatar.jpg`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result || '')));
    reader.addEventListener('error', () => reject(new Error('图片读取失败')));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('图片加载失败')));
    image.src = src;
  });
}

async function rotateImage(src: string, degrees: number) {
  const image = await loadImage(src);
  const normalized = ((degrees % 360) + 360) % 360;
  const isQuarterTurn = normalized === 90 || normalized === 270;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = isQuarterTurn ? image.height : image.width;
  canvas.height = isQuarterTurn ? image.width : image.height;

  if (!ctx) return src;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((normalized * Math.PI) / 180);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);

  return canvas.toDataURL('image/jpeg', 0.92);
}
</script>
<template>
  <div class="h-full">
    <Profile
      v-model:model-value="tabsValue"
      avatar-editable
      title="个人中心"
      :user-info="userStore.userInfo"
      :tabs="tabs"
      @avatar-click="openAvatarModal"
    >
      <template #content>
        <ProfileBase v-if="tabsValue === 'basic'" />
      </template>
    </Profile>

    <Modal
      v-model:open="avatarModalOpen"
      title="更换头像"
      ok-text="保存头像"
      cancel-text="取消"
      :confirm-loading="avatarSaving"
      :ok-button-props="{ disabled: !avatarImage }"
      width="720px"
      @ok="saveAvatar"
      @after-close="resetAvatarCrop"
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center gap-3">
          <Upload
            accept="image/*"
            :max-count="1"
            :before-upload="preventAutoUpload"
            :show-upload-list="false"
            @change="selectAvatarFile"
          >
            <Button>选择图片</Button>
          </Upload>
          <span class="text-sm text-foreground/70">
            {{ avatarFileName || '请选择图片后裁切头像' }}
          </span>
        </div>

        <div v-if="avatarImage" class="flex flex-wrap items-start gap-5">
          <VCropper
            ref="cropperRef"
            :img="avatarImage"
            aspect-ratio="1:1"
            :width="420"
            :height="420"
          />
          <div class="flex min-w-32 flex-col gap-2">
            <Button @click="rotateAvatar(-90)">向左旋转</Button>
            <Button @click="rotateAvatar(90)">向右旋转</Button>
          </div>
        </div>

        <div
          v-else
          class="flex h-72 items-center justify-center rounded border border-dashed text-sm text-foreground/60"
        >
          点击“选择图片”上传头像素材
        </div>
      </div>
    </Modal>
  </div>
</template>
