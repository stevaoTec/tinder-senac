import React, { useState, useEffect, useCallback } from 'react';
import { User, SwipeResult } from '../types';
import * as api from '../services/api';
import { useSocket } from '../context/SocketContext';
import SwipeCard from '../components/SwipeCard/SwipeCard';
import MatchModal from '../components/MatchModal/MatchModal';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import '../styles/home.css';
import '../styles/skeleton.css';

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchUser, setMatchUser] = useState<User | null>(null);
  const [showMatch, setShowMatch] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [hasSwiped, setHasSwiped] = useState(false);
  const [showPremiumAlert, setShowPremiumAlert] = useState(false);
  const [showBlindDate, setShowBlindDate] = useState(false);
  const { socket } = useSocket();

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.discoverUsers();
      setUsers(data);
      setCurrentIndex(0);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Try to get user location for accurate distances
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            // Update user location in backend
            await api.updateProfile({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            } as any);
            // After updating location, load users so distances are accurate
            loadUsers();
          } catch (err) {
            console.error('Error updating location:', err);
            loadUsers(); // Load anyway
          }
        },
        (error) => {
          console.warn('Geolocation error:', error);
          setLocationError('Ative a localizacao para encontrar pessoas mais proximas.');
          loadUsers(); // Load anyway
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
      );
    } else {
      loadUsers();
    }
  }, [loadUsers]);

  useEffect(() => {
    if (!socket) return;

    const handleUserOnline = () => {
      // Only reload if the user currently has no cards on screen
      setUsers(prev => {
        if (prev.length === 0 || currentIndex >= prev.length) {
          loadUsers();
        }
        return prev;
      });
    };

    socket.on('user_online', handleUserOnline);
    socket.on('match_notification', (match: any) => {
      setMatchUser(match.user);
      setShowMatch(true);
      
      // Haptic and Confetti!
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#10b981', '#ec4899', '#f59e0b']
      });

      toast.success(`Voce deu Match com ${match.user.name}!`, {
        duration: 5000,
      });
    });
    return () => {
      socket.off('user_online', handleUserOnline);
      socket.off('match_notification');
    };
  }, [socket, loadUsers, currentIndex]);

  const handleSwipe = async (direction: 'like' | 'dislike' | 'superlike') => {
    if (currentIndex >= users.length) return;

    const targetUser = users[currentIndex];
    setCurrentIndex(prev => prev + 1);

    try {
      const result: SwipeResult = await api.swipeUser(targetUser.id, direction);
      setHasSwiped(true);

      if (result.match) {
        setMatchUser(result.match.user);
        setShowMatch(true);

        // Haptic and Confetti!
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#3b82f6', '#10b981', '#ec4899', '#f59e0b']
        });

        if (socket) {
          socket.emit('new_match', {
            targetUserId: targetUser.id,
            match: result.match
          });
        }
      } else if (direction === 'like' || direction === 'superlike') {
        if (socket) {
          socket.emit('send_like', { targetUserId: targetUser.id });
        }
      }
    } catch (err) {
      console.error('Error swiping:', err);
    }
  };

  const handleRewind = async () => {
    try {
      const response = await api.rewindSwipe();
      if (response.success && response.user) {
        setUsers(prev => {
          const newUsers = [...prev];
          newUsers.splice(currentIndex, 0, response.user);
          return newUsers;
        });
        setHasSwiped(false);
        toast('Swipe desfeito!', { icon: '⏪' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao desfazer');
    }
  };

  if (loading) {
    return (
      <div className="home-page">
        <div className="swipe-container">
          <div className="skeleton-card-wrapper skeleton-box">
            <div className="skeleton-card-img" />
            <div className="skeleton-card-info">
              <div className="skeleton-title" />
              <div className="skeleton-text" />
              <div className="skeleton-chips">
                <div className="skeleton-chip" />
                <div className="skeleton-chip" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentUser = users[currentIndex];
  const nextUser = users[currentIndex + 1];

  return (
    <div className="home-page">
      <div className="home-top-bar">
        <button className="top-bar-btn gold-btn" onClick={() => setShowPremiumAlert(true)}>
          <span className="btn-icon">✨</span> Quem me curtiu
        </button>
        <button className="top-bar-btn blind-date-btn" onClick={() => setShowBlindDate(true)}>
          <span className="btn-icon">🎭</span> Roleta Cega
        </button>
      </div>

      <div className="swipe-container">
        {locationError && (
          <div style={{ position: 'absolute', top: -30, width: '100%', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            {locationError}
          </div>
        )}
        
        {currentIndex >= users.length ? (
          <div className="no-users">
            <div className="no-users-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <h2>Sem novos perfis por enquanto</h2>
            <p>Quando novas pessoas se cadastrarem no site, elas aparecerão aqui!</p>
            <button onClick={loadUsers} className="reload-btn">
              Buscar novamente
            </button>
          </div>
        ) : (
          <div className="card-stack">
            {nextUser && (
              <div className="card-behind">
                <SwipeCard user={nextUser} isBehind />
              </div>
            )}
            <SwipeCard
              key={currentUser.id}
              user={currentUser}
              onSwipe={handleSwipe}
            />
          </div>
        )}
      </div>

      {currentIndex < users.length && (
        <div className="swipe-actions">
          <button
            className="action-btn rewind-btn"
            onClick={handleRewind}
            title="Voltar Atras"
            disabled={!hasSwiped}
            style={{ opacity: hasSwiped ? 1 : 0.5 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l5-5m-5 5l5 5m-5-5h12a5 5 0 015 5v3" />
            </svg>
          </button>
          <button
            className="action-btn dislike-btn"
            onClick={() => handleSwipe('dislike')}
            title="Nao curtir"
            id="dislike-button"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <button
            className="action-btn superlike-btn"
            onClick={() => handleSwipe('superlike')}
            title="Super Vibe"
            id="superlike-button"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </button>
          <button
            className="action-btn like-btn"
            onClick={() => handleSwipe('like')}
            title="Curtir"
            id="like-button"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </button>
        </div>
      )}

      {showMatch && matchUser && (
        <MatchModal
          user={matchUser}
          onClose={() => setShowMatch(false)}
        />
      )}

      {showPremiumAlert && (
        <div className="premium-modal-overlay">
          <div className="premium-modal">
            <h2>✨ Descubra Quem te Curtiu</h2>
            <p>Para ver a lista completa de pessoas que curtiram você, assista a um anúncio ou convide um amigo!</p>
            <div className="premium-buttons">
              <button className="invite-btn" onClick={() => {
                toast.success('Link de convite copiado!');
                setShowPremiumAlert(false);
              }}>Copiar Link de Convite</button>
              <button className="close-btn" onClick={() => setShowPremiumAlert(false)}>Agora não</button>
            </div>
          </div>
        </div>
      )}

      {showBlindDate && (
        <div className="premium-modal-overlay">
          <div className="premium-modal blind-date-modal">
            <h2>🎭 Roleta Cega</h2>
            <p>Conecte-se com alguém apenas pela personalidade! Sem fotos, apenas chat por 3 minutos. Se rolar química, as fotos são reveladas.</p>
            <div className="premium-buttons">
              <button className="invite-btn" onClick={() => {
                toast('Procurando um par perfeito...', { icon: '🔍' });
                setTimeout(() => {
                  toast.error('Nenhum usuário online para a Roleta Cega no momento.');
                  setShowBlindDate(false);
                }, 3000);
              }}>Encontrar Par</button>
              <button className="close-btn" onClick={() => setShowBlindDate(false)}>Voltar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
