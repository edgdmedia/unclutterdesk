import React, { useId } from 'react';

export const authInputCls =
  'flex-1 min-w-0 bg-transparent border-none outline-none text-[14.5px] text-[#0F172A]';

interface AuthFieldProps {
  label: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  labelRow?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * One labelled auth input. The visible label is tied to the input with
 * aria-labelledby (an outer <label> would also swallow clicks on the trailing
 * show-password button), so screen readers announce it and tests can find the
 * field by its label.
 */
export function AuthField({ label, icon, trailing, labelRow, children }: AuthFieldProps) {
  const labelId = useId();
  const field = React.Children.map(children, (child) =>
    React.isValidElement<{ 'aria-labelledby'?: string; 'aria-label'?: string }>(child) &&
    (child.type === 'input' || child.type === 'select' || child.type === 'textarea') &&
    !child.props['aria-label'] &&
    !child.props['aria-labelledby']
      ? React.cloneElement(child, { 'aria-labelledby': labelId })
      : child,
  );
  return (
    <div>
      <div className="flex items-baseline mb-2">
        <span id={labelId} className="text-[11.5px] font-bold text-[#475569]">{label}</span>
        {labelRow}
      </div>
      <div className="flex items-center gap-[11px] h-[52px] px-[15px] border border-[#E2E8F0] rounded-[14px] bg-[#F8FAFC]">
        {icon}
        {field}
        {trailing}
      </div>
    </div>
  );
}
