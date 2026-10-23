"use client";

import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ContentSelection } from "@/application/game-content/policy";
import type { PlayerAccessActionResult } from "@/application/player-access/types";
import type { ContentManifestV1 } from "@/contracts/v2";
import { Icon } from "@/components/shared/icon";
import { ActionMessage } from "./action-message";
import {
  buildContentSelection,
  getContentAdjustments,
  getContentModules,
  getContentSelectionLiveSummary,
  getModuleSelectionState,
  getSelectedMissionIds,
  hasContentAdjustments,
} from "./content-selection-model";
import styles from "./portal.module.css";

const initialState: PlayerAccessActionResult = { ok: false, message: "" };

export type ContentPickerAction = (
  previous: PlayerAccessActionResult,
  formData: FormData,
) => Promise<PlayerAccessActionResult>;

export type ContentPickerProps = {
  manifest: ContentManifestV1;
  classGroupId: string;
  /** Starting point: null means "everything", like a class with no default. */
  initialSelection: ContentSelection | null;
  /** Server action that receives `classGroupId`, `selection` and the default flag. */
  action: ContentPickerAction;
  submitLabel: string;
  pendingLabel?: string;
  /** Shows "Salvar como padrão da turma" (session start only). */
  showSaveAsDefault?: boolean;
  /** Shows the choice without any way to change or submit it. */
  readOnly?: boolean;
  /** Blocks submission (inactive class, no ready players, no permission). */
  disabled?: boolean;
  /** Explains why `disabled` is set, shown next to the live summary. */
  disabledReason?: string;
  /** Renders a cancel/close button when provided. */
  onCancel?: () => void;
  cancelLabel?: string;
  onSuccess?: () => void;
};

function missionText(count: number) {
  return `${count} ${count === 1 ? "missão" : "missões"}`;
}

function TriStateCheckbox({
  indeterminate,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  indeterminate: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" {...props} />;
}

export function ContentPicker({
  manifest,
  classGroupId,
  initialSelection,
  action,
  submitLabel,
  pendingLabel = "Iniciando…",
  showSaveAsDefault = false,
  readOnly = false,
  disabled = false,
  disabledReason,
  onCancel,
  cancelLabel = "Cancelar",
  onSuccess,
}: ContentPickerProps) {
  const id = useId();
  const modules = useMemo(() => getContentModules(manifest), [manifest]);
  const [missionIds, setMissionIds] = useState<ReadonlySet<string>>(
    () => new Set(getSelectedMissionIds(manifest, initialSelection)),
  );
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [presets, setPresets] = useState<Record<string, string>>(() => ({
    ...(initialSelection?.activity_presets ?? {}),
  }));
  const [options, setOptions] = useState<Record<string, boolean | string>>(
    () => ({ ...(initialSelection?.options ?? {}) }),
  );
  const [state, formAction, pending] = useActionState(
    async (previous: PlayerAccessActionResult, formData: FormData) => {
      const next = await action(previous, formData);
      if (next.ok) onSuccess?.();
      return next;
    },
    initialState,
  );

  const draft = { enabled_mission_ids: [...missionIds] };
  const selection = buildContentSelection(manifest, {
    missionIds,
    presets,
    options,
  });
  const showAdjustments = hasContentAdjustments(manifest, draft);
  const adjustments = getContentAdjustments(manifest, draft);
  const empty = missionIds.size === 0;

  function toggleMissions(ids: string[], on: boolean) {
    setMissionIds((current) => {
      const next = new Set(current);
      for (const missionId of ids) {
        if (on) next.add(missionId);
        else next.delete(missionId);
      }
      return next;
    });
  }

  function toggleExpanded(moduleId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(moduleId)) next.add(moduleId);
      return next;
    });
  }

  return (
    <form action={formAction} className={styles.contentPicker}>
      <input type="hidden" name="classGroupId" value={classGroupId} />
      <input type="hidden" name="selection" value={JSON.stringify(selection)} />
      <fieldset className={styles.contentPickerBody} disabled={pending}>
        <legend className={styles.srOnly}>Conteúdo da sessão</legend>
        <ul className={styles.contentModuleList}>
          {modules.map((contentModule) => {
            const moduleState = getModuleSelectionState(
              manifest,
              contentModule.module_id,
              draft,
            );
            const open = expanded.has(contentModule.module_id);
            const baseId = `${id}-${contentModule.module_id}`;
            const missionIdsOfModule = contentModule.missions.map(
              (mission) => mission.mission_id,
            );
            return (
              <li
                key={contentModule.module_id}
                className={`${styles.contentModule} ${
                  moduleState === "none" ? "" : styles.contentModuleOn
                }`}
              >
                <div className={styles.contentModuleHead}>
                  <label className={styles.contentCheck}>
                    <TriStateCheckbox
                      checked={moduleState === "all"}
                      disabled={readOnly}
                      indeterminate={moduleState === "partial"}
                      aria-labelledby={`${baseId}-title`}
                      aria-describedby={`${baseId}-summary`}
                      onChange={(event) =>
                        toggleMissions(
                          missionIdsOfModule,
                          event.currentTarget.checked,
                        )
                      }
                    />
                    <span>
                      <strong id={`${baseId}-title`}>
                        {contentModule.title}
                      </strong>
                      <small id={`${baseId}-summary`}>
                        {contentModule.summary}
                      </small>
                    </span>
                  </label>
                  <span className={styles.contentModuleCount}>
                    {missionText(contentModule.missionCount)}
                  </span>
                  <button
                    className={styles.contentExpand}
                    type="button"
                    aria-expanded={open}
                    aria-controls={`${baseId}-missions`}
                    aria-label={`${open ? "Ocultar" : "Ver"} missões de ${contentModule.title}`}
                    onClick={() => toggleExpanded(contentModule.module_id)}
                  >
                    <Icon name="chevron" />
                  </button>
                </div>
                <ul
                  id={`${baseId}-missions`}
                  className={styles.contentMissionList}
                  hidden={!open}
                >
                  {contentModule.missions.map((mission) => (
                    <li key={mission.mission_id}>
                      <label className={styles.contentCheck}>
                        <input
                          type="checkbox"
                          checked={missionIds.has(mission.mission_id)}
                          disabled={readOnly}
                          aria-describedby={`${baseId}-${mission.mission_id}-summary`}
                          onChange={(event) =>
                            toggleMissions(
                              [mission.mission_id],
                              event.currentTarget.checked,
                            )
                          }
                        />
                        <span>
                          <strong>{mission.title}</strong>
                          <small id={`${baseId}-${mission.mission_id}-summary`}>
                            {mission.summary}
                          </small>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
        {showAdjustments && (
          <details className={styles.contentAdjustments}>
            <summary>Ajustes</summary>
            {adjustments.activities.map((activity) => {
              const chosen =
                presets[activity.activity_id] ??
                activity.presets.find((preset) => preset.default)?.preset_id ??
                activity.presets[0]?.preset_id;
              return (
                <fieldset
                  key={activity.activity_id}
                  className={styles.contentPresetGroup}
                >
                  <legend>{activity.title}</legend>
                  <div className={styles.contentSegments}>
                    {activity.presets.map((preset) => (
                      <label key={preset.preset_id}>
                        <input
                          type="radio"
                          name={`${id}-preset-${activity.activity_id}`}
                          checked={chosen === preset.preset_id}
                          disabled={readOnly}
                          onChange={() =>
                            setPresets((current) => ({
                              ...current,
                              [activity.activity_id]: preset.preset_id,
                            }))
                          }
                        />
                        <span>{preset.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
            {adjustments.options.map((option) => (
              <label key={option.option_id} className={styles.contentCheck}>
                <input
                  type="checkbox"
                  checked={Boolean(options[option.option_id] ?? option.default)}
                  disabled={readOnly}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setOptions((current) => ({
                      ...current,
                      [option.option_id]: checked,
                    }));
                  }}
                />
                <span>
                  <strong>{option.label}</strong>
                </span>
              </label>
            ))}
          </details>
        )}
      </fieldset>
      <div className={styles.contentPickerFooter}>
        {showSaveAsDefault && !readOnly && (
          <label className={styles.contentCheck}>
            <input
              type="checkbox"
              name="saveAsClassDefault"
              disabled={pending}
            />
            <span>
              <strong>Salvar como padrão da turma</strong>
            </span>
          </label>
        )}
        <p className={styles.contentLiveSummary} role="status">
          <strong>
            {empty
              ? "Nenhuma missão selecionada"
              : getContentSelectionLiveSummary(manifest, draft)}
          </strong>
          {!readOnly && empty && <span>Selecione ao menos uma missão.</span>}
          {!readOnly && !empty && disabled && disabledReason && (
            <span>{disabledReason}</span>
          )}
        </p>
        <ActionMessage state={state} />
        <div className={styles.contentPickerActions}>
          {onCancel && (
            <button
              className={styles.buttonGhost}
              type="button"
              onClick={onCancel}
              disabled={pending}
            >
              {cancelLabel}
            </button>
          )}
          {!readOnly && (
            <button
              className={styles.button}
              type="submit"
              disabled={disabled || pending || empty}
            >
              <Icon name="play" />
              {pending ? pendingLabel : submitLabel}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
