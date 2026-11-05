import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import './MatchModal.css';

interface MatchModalProps {
  user: User;
  onClose: () => void;
}

export default function MatchModal({ user, onClose }: MatchModalProps) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const getImage = (photo: string) => {
    if (!photo) return '';
    return photo.replace(/=s\d+(-c)?$/, '=s800-c');
  };

  return (
    <div className="match-overlay" onClick={onClose}>
      <div className="match-modal" onClick={e => e.stopPropagation()}>
        {/* SVG circle particles */}
        <div className="match-particles">
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="particle-heart"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 4}s`,
                fontSize: `${8 + Math.random() * 12}px`,
                color: ['#e8576d', '#f0806e', '#6366f1', '#818cf8', '#22c55e'][Math.floor(Math.random() * 5)]
              }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em">
                <circle cx="12" cy="12" r="10"/>
              </svg>
            </span>
          ))}
        </div>

        <motion.div 
          className="match-content"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 15, stiffness: 200 }}
        >
          <motion.h1 
            className="match-title"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <span className="match-title-glow">It's a Match!</span>
          </motion.h1>
          <motion.p 
            className="match-subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Voce e <strong>{user.name}</strong> se curtiram
          </motion.p>

          <div className="match-avatars">
            <motion.div 
              className="match-avatar-circle you"
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 16, opacity: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
            >
              {getImage(currentUser?.profilePhoto || '') ? (
                <img src={getImage(currentUser?.profilePhoto || '')} alt="Voce" referrerPolicy="no-referrer" />
              ) : (
                <span>{currentUser?.name?.charAt(0)}</span>
              )}
            </motion.div>
            <div className="match-heart-pulse">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </div>
            <motion.div 
              className="match-avatar-circle them"
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: -16, opacity: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
            >
              {getImage(user.profilePhoto || '') ? (
                <img src={getImage(user.profilePhoto || '')} alt={user.name} referrerPolicy="no-referrer" />
              ) : (
                <span>{user.name.charAt(0)}</span>
              )}
            </motion.div>
          </div>

          <motion.div 
            className="match-buttons"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <button
              className="match-btn primary"
              onClick={() => {
                onClose();
                navigate('/matches');
              }}
            >
              Enviar Mensagem
            </button>
            <button className="match-btn secondary" onClick={onClose}>
              Continuar Curtindo
            </button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
