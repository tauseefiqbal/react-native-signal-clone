import {
  Call,
  CallingState,
  MemberRequest,
  StreamCall,
  useStreamVideoClient,
} from '@stream-io/video-react-native-sdk';
import { Stack, useGlobalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useChatContext } from 'stream-chat-expo';

import ScreenLoading from '@/components/ScreenLoading';
import { checkIfDMChannel } from '@/lib/utils';

const CallLayout = () => {
  const { id, updateCall, video } = useGlobalSearchParams();
  const router = useRouter();
  const [call, setCall] = useState<Call>();
  const callRef = useRef<Call | null>(null);
  const videoClient = useStreamVideoClient();
  const { client: chatClient } = useChatContext();

  useEffect(() => {
    let cancelled = false;

    const startCall = async () => {
      try {
        const isOutgoing = updateCall === 'true';
        const _call = videoClient?.call('default', id as string);
        if (!_call) {
          throw new Error('Video client is not ready');
        }

        callRef.current = _call;

        if (!isOutgoing) {
          await _call.get();
          if (cancelled) return;
          setCall(_call);
          return;
        }

        const channel = chatClient.channel('messaging', id as string);
        await channel.watch();
        const isDMChannel = checkIfDMChannel(channel);
        const members = Object.values(channel?.state.members!).map<MemberRequest>(
          (member) => ({
            user_id: member.user?.id as string,
            name: member.user?.name as string,
            role: isDMChannel ? 'admin' : undefined,
          })
        );
        const callConfig = {
          custom: {
            triggeredBy: chatClient.user?.id,
            members,
          },
          settings_override: {
            video: {
              enabled: true,
              camera_default_on: video === 'true',
              target_resolution: {
                width: 1280,
                height: 720,
              },
            },
          },
        };

        await _call.getOrCreate({
          ring: true,
          data: {
            members,
            ...callConfig,
          },
        });
        await _call.update(callConfig);

        if (!isDMChannel) {
          await _call.join({ maxJoinRetries: 3 });
        }

        if (cancelled) return;
        setCall(_call);
      } catch (error) {
        console.error('Error starting call:', error);
        router.back();
      }
    };

    startCall();

    return () => {
      cancelled = true;
      if (
        callRef.current &&
        callRef.current.state.callingState !== CallingState.LEFT
      ) {
        callRef.current.leave().catch((err) => {
          console.warn('Error leaving call on unmount:', err);
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!call) {
    return <ScreenLoading />;
  }

  return (
    <StreamCall call={call}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </StreamCall>
  );
};

export default CallLayout;
