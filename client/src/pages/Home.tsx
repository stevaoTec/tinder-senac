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
  const [dislikedUsers, setDislikedUsers] = useState<User[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rewinding, setRewinding] = useState(false);
  const [matchUser, setMatchUser] = useState<User | null>(null);
  const [showMatch, setShowMatch] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [hasSwiped, setHasSwiped] = useState(false);
  const [showDislikedModal, setShowDislikedModal] = useState(false);
  const [showPremiumAlert, setShowPremiumAlert] = useState(false);
  const [showBlindDate, setShowBlindDate] = useState(false);
  const { socket } = useSocket();

  const refreshDisliked = useCallback(async () => {
    try {
      const list = await api.getDislikedUsers();
      setDislikedUsers(list);
      if (list.length > 0) setHasSwiped(true);
    } catch (err) {
      console.error('Erro ao buscar perfis recusados:', err);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const [data, disliked] = await Promise.all([
        api.discoverUsers(),
        api.getDislikedUsers().catch(() => [])
      ]);
      setUsers(data);
      setDislikedUsers(disliked);
      if (disliked.length > 0) setHasSwiped(true);
      setCurrentIndex(0);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await api.updateProfile({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            } as any);
            loadUsers();
          } catch (err) {
            console.error('Error updating location:', err);
            loadUsers();
          }
        },
        (error) => {
          console.warn('Geolocation error:', error);
          setLocationError('Ative a localizacao para encontrar pessoas mais proximas.');
          loadUsers();
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

  const triggerMatchCelebration = (targetUser: User, match: any) => {
    setMatchUser(match.user);
    setShowMatch(true);

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
        match
      });
    }
  };

  const handleSwipe = async (direction: 'like' | 'dislike' | 'superlike') => {
    if (currentIndex >= users.length) return;

    const targetUser = users[currentIndex];
    setCurrentIndex(prev => prev + 1);
    setHasSwiped(true);

    if (direction === 'dislike') {
      setDislikedUsers(prev => [targetUser, ...prev.filter(u => u.id !== targetUser.id)]);
    }

    try {
      const result: SwipeResult = await api.swipeUser(targetUser.id, direction);

      if (result.match) {
        triggerMatchCelebration(targetUser, result.match);
      } else if (direction === 'like' || direction === 'superlike') {
        if (socket) {
          socket.emit('send_like', { targetUserId: targetUser.id });
        }
      }
    } catch (err) {
      console.error('Error swiping:', err);
    }
  };

  const placeUserAtCurrentCard = (restoredUser: User) => {
    setUsers(prev => {
      const remaining = prev.slice(currentIndex).filter(u => u.id !== restoredUser.id);
      return [restoredUser, ...remaining];
    });
    setCurrentIndex(0);
    setDislikedUsers(prev => prev.filter(u => u.id !== restoredUser.id));
  };

  const handleRewind = async () => {
    if (rewinding) return;
    setRewinding(true);
    try {
      const response = await api.rewindSwipe();
      if (response.success && response.user) {
        placeUserAtCurrentCard(response.user);
        toast.success(`Voltou para ${response.user.name}! Agora voce pode curtir 💖`, {
          icon: '⏪',
          duration: 3500
        });
        refreshDisliked();
      }
    } catch (err: any) {
      toast.error(err.message || 'Nenhum perfil anterior para voltar');
    } finally {
      setRewinding(false);
    }
  };

  const handleRestoreSpecificUser = async (target: User) => {
    try {
      const res = await api.restoreDislikedUser(target.id);
      const restored = res.user || target;
      placeUserAtCurrentCard(restored);
      setShowDislikedModal(false);
      toast.success(`${restored.name} voltou para a sua tela!`, { icon: '⏪' });
    } catch (err: any) {
      toast.error('Erro ao voltar perfil');
    }
  };

  const handleLikeDirectlyFromDisliked = async (target: User) => {
    try {
      const result = await api.swipeUser(target.id, 'like');
      setDislikedUsers(prev => prev.filter(u => u.id !== target.id));
      setShowDislikedModal(false);

      if (result.match) {
        triggerMatchCelebration(target, result.match);
      } else {
        if (socket) {
          socket.emit('send_like', { targetUserId: target.id });
        }
        toast.success(`Voce curtiu ${target.name}! 💖`);
      }
    } catch (err: any) {
      toast.error('Erro ao curtir perfil');
    }
  };

  const handleRestoreAllDisliked = async () => {
    try {
      await api.restoreDislikedUser('all');
      setShowDislikedModal(false);
      await loadUsers();
      toast.success('Todos os perfis que voce passou voltaram para a fila!', { icon: '🔄' });
    } catch (err) {
      toast.error('Erro ao restaurar perfis');
    }
  };

  const getHighResImage = (photo?: string) => {
    if (!photo) return '';
    return photo.replace(/=s\d+(-c)?$/, '=s800-c');
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
  const canRewind = dislikedUsers.length > 0 || hasSwiped;

  return (
    <div className="home-page">
      <div className="home-top-bar">
        <button
          className="top-bar-btn rewind-top-btn"
          onClick={() => setShowDislikedModal(true)}
        >
          <span className="btn-icon">⏪</span>
          Quem não curti {dislikedUsers.length > 0 ? `(${dislikedUsers.length})` : ''}
        </button>
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
            <p>
              {dislikedUsers.length > 0
                ? `Você passou por ${dislikedUsers.length} ${dislikedUsers.length === 1 ? 'pessoa que não curtiu' : 'pessoas que não curtiu'}. Quer voltar e curtir?`
                : 'Quando novas pessoas se cadastrarem no site, elas aparecerão aqui!'}
            </p>
            <div className="no-users-actions">
              {canRewind && (
                <button onClick={handleRewind} className="rewind-empty-btn" disabled={rewinding}>
                  ⏪ Voltar {dislikedUsers[0]?.name ? `para ${dislikedUsers[0].name.split(' ')[0]}` : 'último perfil'}
                </button>
              )}
              {dislikedUsers.length > 0 && (
                <button onClick={() => setShowDislikedModal(true)} className="review-disliked-btn">
                  👀 Ver todos que não curti ({dislikedUsers.length})
                </button>
              )}
              <button onClick={loadUsers} className="reload-btn">
                🔄 Buscar novamente
              </button>
            </div>
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
            className={`action-btn rewind-btn ${canRewind ? 'can-rewind' : ''}`}
            onClick={handleRewind}
            title={
              dislikedUsers[0]
                ? `Voltar para ${dislikedUsers[0].name}`
                : 'Voltar para a pessoa anterior'
            }
            disabled={!canRewind || rewinding}
            id="rewind-button"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l5-5m-5 5l5 5m-5-5h12a5 5 0 015 5v3" />
            </svg>
            {dislikedUsers.length > 0 && (
              <span className="rewind-count-badge">{dislikedUsers.length}</span>
            )}
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

      {/* Modal: Pessoas que você não curtiu mas quer voltar / curtir */}
      {showDislikedModal && (
        <div className="premium-modal-overlay" onClick={() => setShowDislikedModal(false)}>
          <div className="disliked-modal" onClick={e => e.stopPropagation()}>
            <div className="disliked-modal-header">
              <div>
                <h2>⏪ Quem você não curtiu</h2>
                <p>Volte atrás se passou alguém sem querer!</p>
              </div>
              <button className="disliked-close-btn" onClick={() => setShowDislikedModal(false)}>
                ✕
              </button>
            </div>

            {dislikedUsers.length === 0 ? (
              <div className="disliked-empty">
                <span>✨</span>
                <p>Você ainda não recusou ninguém ou já voltou todos os perfis!</p>
              </div>
            ) : (
              <>
                <div className="disliked-list">
                  {dislikedUsers.map(u => {
                    const photo = getHighResImage(u.profilePhoto);
                    return (
                      <div key={u.id} className="disliked-item">
                        <div className="disliked-avatar">
                          {photo ? (
                            <img src={photo} alt={u.name} referrerPolicy="no-referrer" />
                          ) : (
                            <span>{u.name.charAt(0)}</span>
                          )}
                        </div>
                        <div className="disliked-info">
                          <h4>{u.name}{u.age ? `, ${u.age}` : ''}</h4>
                          {u.bio && <p>{u.bio}</p>}
                        </div>
                        <div className="disliked-item-actions">
                          <button
                            className="disliked-restore-btn"
                            onClick={() => handleRestoreSpecificUser(u)}
                            title="Colocar de volta na tela principal"
                          >
                            ⏪ Voltar
                          </button>
                          <button
                            className="disliked-like-btn"
                            onClick={() => handleLikeDirectlyFromDisliked(u)}
                            title="Curtir agora mesmo"
                          >
                            💖 Curtir
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {dislikedUsers.length > 1 && (
                  <button className="restore-all-btn" onClick={handleRestoreAllDisliked}>
                    🔄 Voltar todos os {dislikedUsers.length} perfis para a fila
                  </button>
                )}
              </>
            )}
          </div>
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
