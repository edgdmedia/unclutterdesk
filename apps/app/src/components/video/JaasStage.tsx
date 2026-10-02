import React, { useState } from 'react';
import { JaaSMeeting } from '@jitsi/react-sdk';
import type { CallControls, RenderBar } from './types';

type JitsiApi = { executeCommand(command: string, ...args: unknown[]): void; addListener(event: string, fn: (e: any) => void): void };

/**
 * VID-01: a JaaS (8x8.vc) room, embedded with Jitsi's own toolbar hidden so our
 * control bar drives it. The SDK prefixes the app id to the room name itself.
 */
export function JaasStage({ appId, roomName, jwt, renderBar }: { appId: string; roomName: string; jwt: string; renderBar: RenderBar }) {
  const [api, setApi] = useState<JitsiApi | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [sharing, setSharing] = useState(false);

  const controls: CallControls = {
    muted,
    cameraOff,
    sharing,
    toggleMic: () => api?.executeCommand('toggleAudio'),
    toggleCamera: () => api?.executeCommand('toggleVideo'),
    toggleShare: () => api?.executeCommand('toggleShareScreen'),
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="relative flex-1 min-h-[320px] overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0B1220]">
        <JaaSMeeting
          appId={appId}
          roomName={roomName}
          jwt={jwt}
          configOverwrite={{ prejoinPageEnabled: false, prejoinConfig: { enabled: false }, toolbarButtons: [], disableDeepLinking: true }}
          interfaceConfigOverwrite={{ MOBILE_APP_PROMO: false }}
          getIFrameRef={(node: HTMLDivElement) => {
            node.style.height = '100%';
            node.style.width = '100%';
          }}
          onApiReady={(external: JitsiApi) => {
            setApi(external);
            external.addListener('audioMuteStatusChanged', (e: { muted: boolean }) => setMuted(e.muted));
            external.addListener('videoMuteStatusChanged', (e: { muted: boolean }) => setCameraOff(e.muted));
            external.addListener('screenSharingStatusChanged', (e: { on: boolean }) => setSharing(e.on));
          }}
        />
      </div>
      {renderBar(controls)}
    </div>
  );
}
