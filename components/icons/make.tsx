import type { SVGProps } from "react";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children" | "dangerouslySetInnerHTML"> & {
  size?: number;
  /** linear for resting states, bulk (two tone) for active and emphasised states */
  variant?: "linear" | "bulk";
};

/** Icons are decorative: pair every icon with visible or sr-only text. */
export function makeIcon(name: string, linear: string, bulk: string) {
  function Icon({ size = 20, variant = "linear", ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        focusable="false"
        {...rest}
        // Static markup generated from the icon set at build time, never user input.
        dangerouslySetInnerHTML={{ __html: variant === "bulk" ? bulk : linear }}
      />
    );
  }
  Icon.displayName = name;
  return Icon;
}
