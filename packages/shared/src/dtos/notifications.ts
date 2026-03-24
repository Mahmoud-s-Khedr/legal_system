import { NotificationChannel, NotificationType } from "../enums/index";
import type { ApiListResponse } from "../types/common";

export interface NotificationDto {
  id: string;
  firmId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export type NotificationListResponseDto = ApiListResponse<NotificationDto>;

export interface NotificationPreferenceDto {
  id: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}

export interface UpdatePreferenceDto {
  enabled: boolean;
}

export interface UpsertPreferenceDto {
  type: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}
