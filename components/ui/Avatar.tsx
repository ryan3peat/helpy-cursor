import React from 'react';

// Size mapping for consistent avatar sizes across the app
const SIZE_CLASSES = {
  xs: 'w-6 h-6',      // 24px - stacked avatars in Meals (inline)
  'xs+': 'w-7 h-7',   // 28px - meal card avatars
  sm: 'w-10 h-10',    // 40px - list items
  md: 'w-12 h-12',    // 48px - medium cards
  lg: 'w-16 h-16',    // 64px - profile carousel
  xl: 'w-20 h-20',    // 80px - main profile card
  '2xl': 'w-14 h-14', // 56px - dashboard header
} as const;

// Font size for Dicebear initials based on avatar size
const DICEBEAR_FONT_SIZE = {
  xs: 50,
  'xs+': 48,
  sm: 45,
  md: 42,
  lg: 40,
  xl: 38,
  '2xl': 42,
} as const;

export type AvatarSize = keyof typeof SIZE_CLASSES;

interface AvatarProps {
  user: {
    id?: string;
    name: string;
    avatar?: string;
    status?: string;
  };
  size: AvatarSize;
  isSelected?: boolean;
  isCurrentUser?: boolean;
  showSelectionBorder?: boolean;
  className?: string;
  onClick?: () => void;
}

/**
 * Get Dicebear fallback URL with initials
 * - Grey (#9CA3AF) for pending users
 * - Cyan (#3EAFD2) for active users
 */
const getDicebearUrl = (name: string, status?: string): string => {
  const seed = encodeURIComponent(name);
  const bgColor = status === 'pending' ? '9CA3AF' : '3EAFD2';
  return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=${bgColor}&fontSize=40`;
};

/**
 * Check if avatar URL is a Dicebear URL (no custom photo)
 */
const isDicebearAvatar = (avatar?: string): boolean => {
  return !!avatar?.includes('dicebear');
};

/**
 * Get the correct avatar URL, regenerating Dicebear URLs to ensure correct status color
 */
const getAvatarUrl = (user: AvatarProps['user']): string => {
  // If using dicebear avatar (no custom photo uploaded), regenerate with correct status color
  if (!user.avatar || isDicebearAvatar(user.avatar)) {
    return getDicebearUrl(user.name, user.status);
  }
  return user.avatar;
};

/**
 * Standardized Avatar component for consistent user avatar display
 * 
 * Features:
 * - Consistent sizing across the app
 * - Automatic Dicebear initials fallback
 * - Status-based colors (grey for pending, cyan for active)
 * - onError handling for failed image loads
 * - Optional selection border for interactive contexts
 */
const Avatar: React.FC<AvatarProps> = ({
  user,
  size,
  isSelected = false,
  isCurrentUser = false,
  showSelectionBorder = false,
  className = '',
  onClick,
}) => {
  const [imgError, setImgError] = React.useState(false);
  
  // Reset error state if user changes
  React.useEffect(() => {
    setImgError(false);
  }, [user.id, user.avatar]);

  const sizeClass = SIZE_CLASSES[size];
  const avatarUrl = imgError ? getDicebearUrl(user.name, user.status) : getAvatarUrl(user);

  // Build border classes for selection states
  let borderClasses = '';
  if (showSelectionBorder) {
    if (isSelected) {
      borderClasses = 'border-4 border-primary shadow-md';
    } else {
      borderClasses = 'border-4 border-transparent';
    }
  }

  // Current user indicator for inline contexts (like Meals)
  let currentUserClasses = '';
  if (isCurrentUser && !showSelectionBorder) {
    currentUserClasses = 'border-2 border-primary';
  } else if (!showSelectionBorder && size === 'xs') {
    // For stacked avatars, use border-card for non-current users
    currentUserClasses = 'border-2 border-card';
  }

  const handleError = () => {
    setImgError(true);
  };

  const combinedClasses = `
    ${sizeClass}
    rounded-full
    overflow-hidden
    object-cover
    bg-muted
    flex-shrink-0
    ${borderClasses}
    ${currentUserClasses}
    ${onClick ? 'cursor-pointer' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <img
      src={avatarUrl}
      alt={user.name}
      title={user.name}
      className={combinedClasses}
      onError={handleError}
      onClick={onClick}
    />
  );
};

export default Avatar;

