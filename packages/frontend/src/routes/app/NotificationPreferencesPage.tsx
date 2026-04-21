import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  NotificationChannel,
  NotificationType,
  type NotificationPreferenceDto
} from "@elms/shared";
import { apiFetch } from "../../lib/api";
import {
  VISIBLE_NOTIFICATION_CHANNELS,
  VISIBLE_NOTIFICATION_TYPES
} from "../../lib/internetRestrictedUi";
import { PageHeader, SectionCard } from "./ui";

export function NotificationPreferencesPage() {
  const { t } = useTranslation("app");
  const qc = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () =>
      apiFetch<NotificationPreferenceDto[]>("/api/notifications/preferences")
  });

  const upsert = useMutation({
    mutationFn: (dto: {
      type: NotificationType;
      channel: NotificationChannel;
      enabled: boolean;
    }) =>
      apiFetch<NotificationPreferenceDto>("/api/notifications/preferences", {
        method: "PUT",
        body: JSON.stringify(dto)
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["notification-preferences"] })
  });

  function isEnabled(type: NotificationType, channel: NotificationChannel) {
    const pref = prefs?.find((p) => p.type === type && p.channel === channel);
    if (pref) {
      return pref.enabled;
    }
    if (!prefs?.length) {
      return channel === NotificationChannel.IN_APP;
    }
    return false;
  }

  function toggle(
    type: NotificationType,
    channel: NotificationChannel,
    enabled: boolean
  ) {
    void upsert.mutateAsync({ type, channel, enabled });
  }

  const notificationTypes = VISIBLE_NOTIFICATION_TYPES;
  const channels = [...VISIBLE_NOTIFICATION_CHANNELS];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("notifications.preferences")}
        description={t("notifications.preferencesDescriptionLocal")}
      />

      <SectionCard title={t("notifications.channelSettingsLocal")}>
        {isLoading ? (
          <p className="text-sm text-slate-500">{t("labels.loading")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="pb-3 text-start font-medium">
                    {t("notifications.eventType")}
                  </th>
                  {channels.map((ch) => (
                    <th key={ch} className="pb-3 text-center font-medium">
                      {ch.replace("_", " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {notificationTypes.map((type) => (
                  <tr key={type} className="border-t border-slate-100">
                    <td className="py-3 font-medium">
                      {type.replace(/_/g, " ")}
                    </td>
                    {channels.map((ch) => (
                      <td key={ch} className="py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isEnabled(type, ch)}
                          onChange={(e) => toggle(type, ch, e.target.checked)}
                          className="h-4 w-4 accent-accent"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
