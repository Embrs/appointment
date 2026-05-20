// 將 slot.reason 映射為本地化文字（badge / tooltip）
// 與 server/utils/availability.ts/SlotUnavailableReason 對齊
export const UseSlotReason = () => {
  const { t } = useI18n();

  const GetReasonLabel = (reason?: SlotUnavailableReason): string => {
    if (!reason) return '';
    return t(`slot.reason.${reason}`);
  };

  const GetReasonTooltip = (reason?: SlotUnavailableReason): string => {
    if (!reason) return '';
    return t(`slot.reasonTooltip.${reason}`);
  };

  return {
    GetReasonLabel,
    GetReasonTooltip
  };
};
