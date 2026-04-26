"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { AppForm } from "@/components/forms/app-form";
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferenceRecord,
} from "@/lib/api/client";
import { isEffectivelyOnline, queueOfflineAction } from "@/lib/offline/sync";
import { queryKeys } from "@/lib/query/keys";

const preferencesSchema = z.object({
  preferences: z.array(
    z.object({
      id: z.string(),
      eventType: z.string(),
      channel: z.enum(["IN_APP", "EMAIL", "SMS", "WEBHOOK"]),
      enabled: z.boolean(),
    }),
  ),
});

type PreferencesFormValues = z.infer<typeof preferencesSchema>;

export default function NotificationPreferencesPage() {
  const { data: session } = useSession();
  const preferences = useQuery({
    queryKey: queryKeys.notificationPreferences,
    queryFn: () => getNotificationPreferences({ accessToken: session?.accessToken }),
  });

  if (preferences.isLoading) {
    return <section className="surface" style={{ padding: "1.25rem" }}>Loading notification preferences...</section>;
  }

  const defaultValues: PreferencesFormValues = {
    preferences: (preferences.data ?? []).map((item) => ({
      id: item.id,
      eventType: item.eventType,
      channel: item.channel,
      enabled: item.enabled,
    })),
  };

  return (
    <AppForm<PreferencesFormValues>
      key={JSON.stringify(defaultValues)}
      title="Notification preferences"
      description="Low-risk preference edits can queue offline with visible sync state, while higher-risk module actions remain online-only."
      schema={preferencesSchema}
      defaultValues={defaultValues}
      submitLabel="Save preferences"
      onSubmit={async (values) => {
        if (!isEffectivelyOnline()) {
          await queueOfflineAction("notification-preferences", {
            preferences: values.preferences,
          });
          return;
        }

        await saveNotificationPreferences(values.preferences as NotificationPreferenceRecord[], {
          accessToken: session?.accessToken,
        });
      }}
    >
      {(methods) => (
        <div style={{ display: "grid", gap: "0.85rem" }}>
          {methods.watch("preferences").map((preference, index) => (
            <label
              key={preference.id}
              className="surface"
              style={{
                padding: "1rem",
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                alignItems: "center",
                boxShadow: "none",
              }}
            >
              <div>
                <div className="eyebrow">{preference.channel}</div>
                <strong style={{ display: "block", marginBottom: "0.25rem" }}>{preference.eventType}</strong>
                <span className="muted">Keep channel-level delivery behavior explicit and reviewable.</span>
              </div>
              <input
                type="checkbox"
                aria-label={`${preference.eventType} ${preference.channel}`}
                {...methods.register(`preferences.${index}.enabled`)}
              />
            </label>
          ))}
        </div>
      )}
    </AppForm>
  );
}
