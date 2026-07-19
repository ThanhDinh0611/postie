export function toErrorMessage(err: unknown, fallback = 'Đã xảy ra lỗi'): string {
  if (err instanceof Error) return err.message;
  return String(err) || fallback;
}
