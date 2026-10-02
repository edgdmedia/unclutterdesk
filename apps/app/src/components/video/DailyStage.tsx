import React, { useEffect, useState } from 'react';
import Daily, { type DailyCall } from '@daily-co/daily-js';
import {
  DailyAudio,
  DailyProvider,
  DailyVideo,
  useAudioTrack,
  useDaily,
  useLocalSessionId,
  useParticipantIds,
  useScreenShare,
  useVideoTrack,
} from '@daily-co/daily-react';
import type { CallControls, RenderBar } from './types';
import { WaitingPanel } from './WaitingPanel';

/** VID-01: a Daily room, drawn with our own tiles and controls. */
export function DailyStage({ roomUrl, token, waitingFor, renderBar }: { roomUrl: string; token: string; waitingFor: string; renderBar: RenderBar }) {
  const [call, setCall] = useState<DailyCall | null>(null);

  useEffect(() => {
    // React's development double-mount would otherwise trip Daily's one-instance rule.
    const c = Daily.createCallObject({ allowMultipleCallInstances: true });
    setCall(c);
    void c.join({ url: roomUrl, token });
    return () => {
      void c.destroy();
    };
  }, [roomUrl, token]);

  if (!call) return null;
  return (
    <DailyProvider callObject={call}>
      <DailyCall waitingFor={waitingFor} renderBar={renderBar} />
    </DailyProvider>
  );
}

function DailyCall({ waitingFor, renderBar }: { waitingFor: string; renderBar: RenderBar }) {
  const call = useDaily();
  const localId = useLocalSessionId();
  const remote = useParticipantIds({ filter: 'remote' });
  const mic = useAudioTrack(localId);
  const cam = useVideoTrack(localId);
  const { isSharingScreen, screens } = useScreenShare();
  const shared = screens?.[0];

  const controls: CallControls = {
    muted: mic.isOff,
    cameraOff: cam.isOff,
    sharing: isSharingScreen,
    toggleMic: () => call?.setLocalAudio(mic.isOff),
    toggleCamera: () => call?.setLocalVideo(cam.isOff),
    toggleShare: () => (isSharingScreen ? call?.stopScreenShare() : call?.startScreenShare()),
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="relative flex-1 min-h-[320px] overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0B1220]">
        {shared ? (
          <DailyVideo sessionId={shared.session_id} type="screenVideo" fit="contain" className="h-full w-full" />
        ) : remote[0] ? (
          <DailyVideo sessionId={remote[0]} fit="cover" className="h-full w-full" />
        ) : (
          <WaitingPanel text={`Waiting for ${waitingFor} to join`} />
        )}
        {localId ? (
          <div className="absolute bottom-4 right-4 h-[110px] w-[150px] sm:h-[140px] sm:w-[200px] overflow-hidden rounded-[16px] border border-white/15 bg-[#101A28] shadow-2xl">
            <DailyVideo sessionId={localId} automirror fit="cover" className="h-full w-full" />
          </div>
        ) : null}
        <DailyAudio />
      </div>
      {renderBar(controls)}
    </div>
  );
}
