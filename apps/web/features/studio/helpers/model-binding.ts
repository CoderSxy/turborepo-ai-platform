import {
  isProviderConnected,
} from "../../models/state/model-page-types";
import {
  parseModelPickerValue,
  resolveModelRoute,
  resolveModelRouteForCoreAction,
  resolveReadyModelBinding,
  type LocalModelSettings,
} from "../../../lib/model-settings";
import type { InkosCoreAction } from "@repo/inkos-adapter";
import type {
  ModelBindingError,
  ModelPickerGroup,
  ReadyModelBinding,
} from "../state/studio-types";

export function isModelPickerValueAvailable(
  value: string,
  groups: ModelPickerGroup[],
): boolean {
  const parsed = parseModelPickerValue(value);

  if (!parsed) {
    return false;
  }

  return groups.some(
    (group) =>
      group.service === parsed.providerId &&
      group.models.some((model) => model.id === parsed.model),
  );
}

export function resolveChatModelBinding(
  settings: LocalModelSettings,
  selectedModelValue: string,
): ReadyModelBinding | ModelBindingError {
  const parsed = parseModelPickerValue(selectedModelValue);
  const fallback = resolveModelRoute(settings, "global.default");

  if (parsed) {
    const provider = settings.providers.find((item) => item.id === parsed.providerId);
    if (provider && isProviderConnected(provider)) {
      const base = fallback.status === "ready" ? fallback : null;
      return {
        provider,
        model: parsed.model,
        temperature: base?.temperature ?? 0.8,
        maxTokens: base?.maxTokens ?? 3200,
        routeKey: "chat.override",
      };
    }
  }

  const ready = resolveReadyModelBinding(fallback);
  if ("error" in ready) {
    return ready;
  }

  return ready;
}

export function resolveCoreActionModelBinding(
  settings: LocalModelSettings,
  action: InkosCoreAction,
): ReadyModelBinding | ModelBindingError {
  return resolveReadyModelBinding(resolveModelRouteForCoreAction(settings, action));
}
