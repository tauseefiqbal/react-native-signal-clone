import type { Channel } from 'stream-chat';

type ClerkFormError = {
  code?: string;
  longMessage?: string;
  long_message?: string;
  meta?: { paramName?: string; param_name?: string };
};

const clerkParamUnknownHint = (paramName?: string) => {
  if (paramName === 'username') {
    return (
      'Username is not enabled on your Clerk app. In the Clerk Dashboard go to ' +
      'User & authentication → Email, Phone, Username, turn Username on, and ' +
      'allow it for sign-up. Then try again.'
    );
  }
  if (paramName === 'first_name' || paramName === 'last_name') {
    return (
      'First/last name is not enabled on your Clerk app. In the Clerk Dashboard ' +
      'go to User & authentication → User model and allow users to set their name.'
    );
  }
  return null;
};

export const getError = (err: any) => {
  const errors = (err.errors ?? []) as ClerkFormError[];
  const errorMessage = errors
    .map((error, index) => {
      const paramName = error.meta?.paramName ?? error.meta?.param_name;
      const hint =
        error.code === 'form_param_unknown'
          ? clerkParamUnknownHint(paramName)
          : null;
      const longMessage = error.longMessage ?? error.long_message ?? '';
      return `${index + 1}. ${hint ?? longMessage}`;
    })
    .join('\n');
  alert(errorMessage || err.message || 'Something went wrong');
};

export const checkIfDMChannel = (channel: Channel) => {
  return !!channel?.id?.startsWith('!members');
};
