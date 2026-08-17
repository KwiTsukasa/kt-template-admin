import { requestClient } from '#/api/request';

interface UploadFileParams {
  file: File;
  onError?: (error: Error) => void;
  onProgress?: (progress: { percent: number }) => void;
  onSuccess?: (data: any, file: File) => void;
}
/**
 * 以 multipart 表单上传示例文件，并把上传进度交给调用方。
 */
export async function upload_file({
  file,
  onError,
  onProgress,
  onSuccess,
}: UploadFileParams) {
  try {
    onProgress?.({ percent: 0 });

    const data = await requestClient.upload('/upload', { file });

    onProgress?.({ percent: 100 });
    onSuccess?.(data, file);
  } catch (error) {
    onError?.(
      (() => {
        if (error instanceof Error) {
          return error;
        }
        return new Error(String(error));
      })(),
    );
  }
}
