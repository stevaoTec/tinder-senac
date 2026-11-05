import React, { useState } from 'react';
import { User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { motion, useMotionValue, useTransform, useAnimation, PanInfo } from 'framer-motion';
import './SwipeCard.css';

interface SwipeCardProps {
  user: User;
  onSwipe?: (direction: 'like' | 'dislike' | 'superlike') => void;
  isBehind?: boolean;
}

export default function SwipeCard({ user, onSwipe, isBehind }: SwipeCardProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const { user: currentUser } = useAuth();
  const { onlineUsers } = useSocket();
  const controls = useAnimation();
  const isOnline = onlineUsers.has(user.id) || (user as any).isOnline;

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Transform values for rotation and opacity based on x position
  const rotate = useTransform(x, [-200, 200], [-30, 30]);
  const likeOpacity = useTransform(x, [20, 100], [0, 1]);
  const dislikeOpacity = useTransform(x, [-20, -100], [0, 1]);

  const currentUserInterests = currentUser?.interests || [];
  const sharedInterests = user.interests?.filter(i => currentUserInterests.includes(i)) || [];
  const photos = user.photos && user.photos.length > 0 ? user.photos : [user.profilePhoto || ''];
  const currentPhoto = photos[currentPhotoIndex] || '';

  const getProfileImage = () => {
    if (!currentPhoto) return '';
    return currentPhoto.replace(/=s\d+(-c)?$/, '=s800-c');
  };

  const handleDragEnd = async (event: any, info: PanInfo) => {
    if (isBehind) return;

    const threshold = 100;
    const velocityThreshold = 500;
    
    // Superlike (swipe up)
    if (info.offset.y < -150 && Math.abs(info.offset.x) < 100) {
      await controls.start({ y: -1000, opacity: 0, transition: { duration: 0.3 } });
      onSwipe?.('superlike');
    } 
    // Like (swipe right)
    else if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
      await controls.start({ x: 1000, opacity: 0, rotate: 30, transition: { duration: 0.3 } });
      onSwipe?.('like');
    } 
    // Dislike (swipe left)
    else if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
      await controls.start({ x: -1000, opacity: 0, rotate: -30, transition: { duration: 0.3 } });
      onSwipe?.('dislike');
    } 
    // Snap back
    else {
      controls.start({ x: 0, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
    }
  };

  const nextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentPhotoIndex < photos.length - 1) setCurrentPhotoIndex(prev => prev + 1);
  };

  const prevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentPhotoIndex > 0) setCurrentPhotoIndex(prev => prev - 1);
  };

  return (
    <motion.div
      className={`swipe-card ${isBehind ? 'behind' : ''}`}
      style={{
        x,
        y: isBehind ? 14 : y,
        rotate,
        scale: isBehind ? 0.93 : 1,
        pointerEvents: isBehind ? 'none' : 'auto',
      }}
      drag={!isBehind}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={1}
      onDragEnd={handleDragEnd}
      animate={controls}
      whileTap={!isBehind ? { cursor: 'grabbing' } : undefined}
    >
      {/* Like/Dislike Stamp Overlays */}
      {!isBehind && (
        <>
          <motion.div className="swipe-stamp like-stamp" style={{ opacity: likeOpacity }}>
            LIKE
          </motion.div>
          <motion.div className="swipe-stamp dislike-stamp" style={{ opacity: dislikeOpacity }}>
            NOPE
          </motion.div>
        </>
      )}

      {/* Shared Interests Badge */}
      {!isBehind && sharedInterests.length > 0 && (
        <div className="shared-badge">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
          {sharedInterests.length} {sharedInterests.length === 1 ? 'hobby' : 'hobbies'} em comum
        </div>
      )}

      {/* Card Image */}
      <div
        className="card-image"
        style={{
          backgroundImage: getProfileImage() ? `url("${getProfileImage()}")` : undefined
        }}
      >
        {!getProfileImage() && (
          <div className="card-image-placeholder">
            <span>{user.name.charAt(0)}</span>
          </div>
        )}

        {/* Photo Navigation */}
        {photos.length > 1 && (
          <>
            <div className="card-indicators">
              {photos.map((_, i) => (
                <div key={i} className={`indicator ${i === currentPhotoIndex ? 'active' : ''}`} />
              ))}
            </div>
            <div className="card-nav-area card-nav-left" onClick={prevPhoto} onMouseDown={e => e.stopPropagation()} />
            <div className="card-nav-area card-nav-right" onClick={nextPhoto} onMouseDown={e => e.stopPropagation()} />
          </>
        )}

        <div className="card-gradient-overlay" />
      </div>

      {/* Card Info */}
      <div className="card-info">
        <div className="card-name-row">
          <h2>{user.name}</h2>
          <span className="card-age">{user.age}</span>
          {user.verified && (
            <span className="verified-badge" title="Verificado">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </span>
          )}
          {isOnline && (
            <span className="card-online-pill">
              <span className="card-online-dot" /> Online
            </span>
          )}
        </div>
        
        {user.distance && (
          <div className="card-distance">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            A {user.distance} km de voce
          </div>
        )}

        {(user.currentEvent || user.favoritePlace) && (
          <div className="card-event-badge">
            <span className="event-icon">📍</span>
            {user.currentEvent || user.favoritePlace}
          </div>
        )}
        
        {user.vibeScore !== undefined && (
          <div className="card-vibe-score">
            🔥 Vibe Score: {user.vibeScore}
          </div>
        )}

        {user.bio && <p className="card-bio">{user.bio}</p>}

        <div className="card-traits">
          {user.height && <span className="trait-badge">📏 {user.height} cm</span>}
          {user.zodiacSign && <span className="trait-badge">♈ {user.zodiacSign}</span>}
          {user.mbti && <span className="trait-badge">🧠 {user.mbti}</span>}
          {user.relationshipIntent && <span className="trait-badge">💘 {user.relationshipIntent}</span>}
          {user.instagram && <span className="trait-badge">📸 @{user.instagram.replace('@', '')}</span>}
          {user.spotify && <span className="trait-badge">🎧 Spotify</span>}
        </div>
        
        {user.interests && user.interests.length > 0 && (
          <div className="card-interests">
            {user.interests.map(interest => {
              const isShared = sharedInterests.includes(interest);
              return (
                <span key={interest} className={`interest-tag ${isShared ? 'shared' : ''}`}>
                  {isShared && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12, marginRight: 4 }}>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                  {interest}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
