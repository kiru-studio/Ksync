import React from 'react';

function UserProfile({ user, onLogout }) {
  if (!user) return null;
  const displayName = user.display_name || user.id || 'User';
  const avatarUrl = user.images?.[0]?.url;

  return (
    <div className="user-profile">
      {avatarUrl && (
        <img src={avatarUrl} alt="" className="user-avatar" />
      )}
      <span className="user-name">{displayName}</span>
      <button type="button" className="user-logout" onClick={onLogout} aria-label="Log out">
        Log out
      </button>
    </div>
  );
}

export default UserProfile;
