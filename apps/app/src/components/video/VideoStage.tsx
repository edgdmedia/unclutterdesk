import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../utils/apiClient';
import { ControlBar } from './ControlBar';
import { DailyStage } from './DailyStage';
import { JaasStage } from './JaasStage';
import { LinkStage } from './LinkStage';
import { WaitingPanel } from './WaitingPanel';
import { useHeartbeat } from './useHeartbeat';
import type { CallControls, ControlButton, JoinResponse } from './types';

type State = { kind: 'loading' } | { kind: 'closed'; message: string } | { kind: 'ready'; room: JoinResponse };

/**
 * VID-01: a session's video, whichever provider hosts it. Asks the API for
 * this booking's room, then shows Daily or JaaS inside the page, or a button
 * for a room that opens in a new tab. The API decides who may join and when;
 * its refusal ("This room opens at 9:45 AM.") is shown as is.
 */
export function VideoStage({
  bookingId,
  waitingFor,
  endLabel,
  onLeft,
  extraButtons,
}: {
  bookingId: string;
  waitingFor: string;
  endLabel: string;
  onLeft(): void;
  extraButtons?: ControlButton[];
}) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const join = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const room = await api.post<JoinResponse>(`/v1/video/bookings/${bookingId}/join`, {});
      setState({ kind: 'ready', room });
    } catch (err) {
      setState({ kind: 'closed', message: err instanceof Error ? err.message : 'The room could not be opened.' });
    }
  }, [bookingId]);

  useEffect(() => {
    void join();
  }, [join]);

  useHeartbeat(state.kind === 'ready' ? state.room.participantId : null);

  const renderBar = (controls: CallControls | null) => (
    <ControlBar controls={controls} extraButtons={extraButtons} endLabel={endLabel} onEnd={onLeft} />
  );

  if (state.kind !== 'ready') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="relative flex-1 min-h-[320px] overflow-hidden rounded-[22px] border border-white/[0.06]">
          {state.kind === 'loading' ? (
            <WaitingPanel text="Opening the room…" />
          ) : (
            <WaitingPanel text={state.message}>
              <button
                type="button"
                onClick={() => void join()}
                className="inline-flex h-[40px] items-center rounded-[12px] bg-white/10 px-4 text-[12.5px] font-bold text-white hover:bg-white/20 cursor-pointer"
              >
                Check again
              </button>
            </WaitingPanel>
          )}
        </div>
        {renderBar(null)}
      </div>
    );
  }

  const room = state.room;
  switch (room.provider) {
    case 'DAILY':
      return (
        <DailyStage
          roomUrl={room.roomUrl}
          token={room.token}
          waitingFor={waitingFor}
          renderBar={renderBar}
          onFailed={() => setState({ kind: 'closed', message: 'The video call could not start. Check your connection and try again.' })}
        />
      );
    case 'JAAS':
      return <JaasStage appId={room.appId} roomName={room.roomName} jwt={room.jwt} renderBar={renderBar} />;
    default:
      return <LinkStage url={room.url} provider={room.provider} renderBar={renderBar} />;
  }
}
