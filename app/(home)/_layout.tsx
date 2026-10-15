import { useUser } from '@clerk/clerk-expo';
import {
  StreamVideo,
  StreamVideoClient,
  useCalls,
} from '@stream-io/video-react-native-sdk';
import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { StreamChat } from 'stream-chat';
import {
  Chat,
  DeepPartial as ChatDeepPartial,
  Theme as ChatTheme,
  OverlayProvider,
} from 'stream-chat-expo';

import ScreenLoading from '@/components/ScreenLoading';

const getBaseUrl = () => {
  if (Platform.OS === 'web') return '';
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    return `http://${hostUri}`;
  }
  return 'http://localhost:8081';
};

const tokenProvider = async (userId: string) => {
  const baseUrl = getBaseUrl();
  const endpoint = `${baseUrl}/token`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });
    const data = await response.json();
    return data.token;
  } catch (error) {
    // When testing via USB debugging with adb reverse, try fallback to localhost
    if (Platform.OS !== 'web' && !endpoint.includes('localhost:8081')) {
      try {
        const fallbackRes = await fetch('http://localhost:8081/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        });
        const fallbackData = await fallbackRes.json();
        return fallbackData.token;
      } catch {
        // Ignore fallback failure, throw original
      }
    }
    console.error('Error fetching token from', endpoint, error);
    throw error;
  }
};

const chatTheme: ChatDeepPartial<ChatTheme> = {
  colors: {
    white_snow: 'white',
  },
  channelPreview: {
    container: {
      borderBottomWidth: 0,
      paddingLeft: 0,
    },
    title: {
      fontWeight: '500',
    },
    unreadContainer: {
      backgroundColor: '#2c6bed',
    },
  },
  messageList: {
    contentContainer: {
      justifyContent: 'flex-end',
      flexGrow: 1,
    },
  },
  inlineDateSeparator: {
    container: {
      backgroundColor: 'transparent',
    },
    text: {
      color: '#6B7280',
      fontSize: 12,
      fontWeight: '600',
    },
  },
  messageSimple: {
    content: {
      receiverMessageBackgroundColor: '#e9e9e9',
      textContainer: {
        paddingHorizontal: 10,
      },
    },
  },
  messageInput: {
    container: {
      borderTopWidth: 0,
    },
    inputBoxContainer: {
      backgroundColor: '#eeeeef',
      borderRadius: 20,
      paddingHorizontal: 0,
      paddingVertical: 6,
      borderColor: '#eeeeef',
    },
    audioRecordingButton: {
      micIcon: {
        fill: 'black',
        width: 24,
        height: 24,
        style: {
          marginHorizontal: 2,
        },
      },
    },
  },
};

const API_KEY = process.env.EXPO_PUBLIC_STREAM_API_KEY as string;

const IncomingCallHandler = () => {
  const router = useRouter();
  const calls = useCalls().filter((call) => call.ringing);

  const ringingCall = calls[0];
  const isCallCreatedByMe =
    ringingCall?.state?.custom.triggeredBy === ringingCall?.currentUserId;

  useEffect(() => {
    if (isCallCreatedByMe) return;
    if (ringingCall) {
      router.navigate({
        pathname: `/call/[id]`,
        params: {
          id: ringingCall.id,
        },
      });
    }
  }, [ringingCall, isCallCreatedByMe, router]);

  return null;
};

const HomeLayout = () => {
  const router = useRouter();
  const { user, isSignedIn } = useUser();
  const [loading, setLoading] = useState(true);
  const [chatClient, setChatClient] = useState<StreamChat>();
  const [videoClient, setVideoClient] = useState<StreamVideoClient>();

  useEffect(() => {
    if (!isSignedIn) {
      router.replace('/sign-in');
      return;
    }
    if (!user?.id) return;

    let cancelled = false;

    const customProvider = async () => {
      const token = await tokenProvider(user.id);
      return token;
    };

    const setUpStream = async () => {
      try {
        const nextChatClient = StreamChat.getInstance(API_KEY);
        const chatUser = {
          id: user.id,
          name: user.fullName!,
          image: user.hasImage ? user.imageUrl : undefined,
          username: user.username!,
        };

        if (!nextChatClient.user) {
          await nextChatClient.connectUser(chatUser, customProvider);
        }
        if (cancelled) return;

        setChatClient(nextChatClient);

        const nextVideoClient = StreamVideoClient.getOrCreateInstance({
          apiKey: API_KEY,
          user: chatUser,
          tokenProvider: customProvider,
        });
        if (cancelled) return;

        setVideoClient(nextVideoClient);
      } catch (error) {
        console.error('Error setting up Stream:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setUpStream();

    return () => {
      cancelled = true;
    };
  }, [
    user?.id,
    user?.fullName,
    user?.hasImage,
    user?.imageUrl,
    user?.username,
    isSignedIn,
    router,
  ]);

  useEffect(() => {
    if (isSignedIn) return;
    chatClient?.disconnectUser();
    videoClient?.disconnectUser();
  }, [isSignedIn, chatClient, videoClient]);

  if (loading) return <ScreenLoading />;

  return (
    <OverlayProvider>
      <Chat client={chatClient!} style={chatTheme}>
        <StreamVideo client={videoClient!}>
          <IncomingCallHandler />
          <Stack>
            <Stack.Screen
              name="(modal)"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="(tabs)"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="chat/[id]"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="call/[id]"
              options={{
                headerShown: false,
                animation: 'none',
              }}
            />
          </Stack>
        </StreamVideo>
      </Chat>
    </OverlayProvider>
  );
};

export default HomeLayout;
