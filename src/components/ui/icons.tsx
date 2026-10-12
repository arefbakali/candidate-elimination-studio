/**
 * Small inline icon set (24×24, 1.75 stroke) — keeps the bundle free of icon dependencies.
 */
import * as React from 'react';

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

function make(paths: React.ReactNode, name: string) {
  const Icon = ({ size = 16, ...props }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths}
    </svg>
  );
  Icon.displayName = name;
  return Icon;
}

export const PlayIcon = make(<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />, 'PlayIcon');
export const PauseIcon = make(
  <>
    <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
  </>,
  'PauseIcon',
);
export const NextIcon = make(<path d="m9 6 6 6-6 6" />, 'NextIcon');
export const PrevIcon = make(<path d="m15 6-6 6 6 6" />, 'PrevIcon');
export const FirstIcon = make(<path d="M6 5v14M18 6l-7 6 7 6" />, 'FirstIcon');
export const LastIcon = make(<path d="M18 5v14M6 6l7 6-7 6" />, 'LastIcon');
export const ResetIcon = make(<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />, 'ResetIcon');
export const ZoomInIcon = make(<path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4M11 8v6M8 11h6" />, 'ZoomInIcon');
export const ZoomOutIcon = make(<path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4M8 11h6" />, 'ZoomOutIcon');
export const FitIcon = make(<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />, 'FitIcon');
export const ExpandIcon = make(<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />, 'ExpandIcon');
export const SunIcon = make(<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />, 'SunIcon');
export const MoonIcon = make(<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />, 'MoonIcon');
export const UploadIcon = make(<path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />, 'UploadIcon');
export const DownloadIcon = make(<path d="M12 3v12M7 10l5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />, 'DownloadIcon');
export const PlusIcon = make(<path d="M12 5v14M5 12h14" />, 'PlusIcon');
export const TrashIcon = make(<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />, 'TrashIcon');
export const UpIcon = make(<path d="m6 15 6-6 6 6" />, 'UpIcon');
export const DownIcon = make(<path d="m6 9 6 6 6-6" />, 'DownIcon');
export const CloseIcon = make(<path d="M6 6l12 12M18 6 6 18" />, 'CloseIcon');
export const PresentIcon = make(<path d="M3 4h18v12H3zM8 20h8M12 16v4M10 8l5 2.5-5 2.5z" />, 'PresentIcon');
export const LatticeIcon = make(
  <>
    <circle cx="12" cy="4" r="2" />
    <circle cx="5" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
    <circle cx="12" cy="20" r="2" />
    <path d="M10.6 5.4 6.4 10.6M13.4 5.4l4.2 5.2M6.4 13.4l4.2 5.2M17.6 13.4l-4.2 5.2" />
  </>,
  'LatticeIcon',
);
export const TableIcon = make(<path d="M3 5h18v14H3zM3 10h18M3 15h18M9 5v14" />, 'TableIcon');
export const TargetIcon = make(
  <>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="0.8" fill="currentColor" />
  </>,
  'TargetIcon',
);
export const ChartIcon = make(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />, 'ChartIcon');
export const FileIcon = make(<path d="M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h6" />, 'FileIcon');
export const SparkIcon = make(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />, 'SparkIcon');
export const InfoIcon = make(<path d="M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" />, 'InfoIcon');
export const AlertIcon = make(<path d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />, 'AlertIcon');
export const CheckIcon = make(<path d="m5 12 5 5 9-10" />, 'CheckIcon');
export const XIcon = make(<path d="M7 7l10 10M17 7 7 17" />, 'XIcon');
export const MenuIcon = make(<path d="M4 6h16M4 12h16M4 18h16" />, 'MenuIcon');
