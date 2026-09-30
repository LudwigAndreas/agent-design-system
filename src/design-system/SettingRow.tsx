import type { ReactNode } from "react";
import { cx } from "./types";

/**
 * One setting: a label that reads as prose on the left, its control on the
 * right, hairline-separated from its neighbours.
 *
 * This is the grammar that keeps settings feeling like a structured document
 * rather than a control panel — no card per setting, no repeated boxes.
 */
export interface SettingRowProps {
  label: ReactNode;
  description?: ReactNode;
  /** `wide` gives the control a fixed column, which keeps selects aligned. */
  controlWidth?: "auto" | "wide";
  children: ReactNode;
  /** Associates the label with the control when the control is not a <label>. */
  htmlFor?: string;
  className?: string;
}

export function SettingRow({
  label,
  description,
  controlWidth = "auto",
  children,
  htmlFor,
  className,
}: SettingRowProps) {
  const Label = htmlFor ? "label" : "span";

  return (
    <div className={cx("ds-setting", className)}>
      <div className="ds-setting__text">
        <Label className="ds-setting__label" {...(htmlFor ? { htmlFor } : {})}>
          {label}
        </Label>
        {description ? <p className="ds-setting__description">{description}</p> : null}
      </div>
      <div
        className={cx("ds-setting__control", controlWidth === "wide" && "ds-setting__control--wide")}
      >
        {children}
      </div>
    </div>
  );
}
