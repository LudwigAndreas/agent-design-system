import { useId, type ReactNode } from "react";
import { cx } from "./types";

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  /** Receives the wiring the control needs for label/description/error. */
  children: (ids: FieldIds) => ReactNode;
}

export interface FieldIds {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required?: boolean;
}

/** Label, hint and error plumbing, shared by every text-like control. */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={cx("ds-field", className)}>
      {label ? (
        <label className="ds-field__label" htmlFor={id}>
          {label}
          {required ? (
            <span className="ds-field__required" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children({
        id,
        describedBy: describedBy || undefined,
        invalid: Boolean(error),
        required,
      })}
      {hint && !error ? (
        <p className="ds-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="ds-field__error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
