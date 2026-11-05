import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Match } from '../types';
import * as api from '../services/api';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';
import '../styles/matches.css';
import '../styles/skeleton.css';

export default function Matches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmUnmatch, setConfirmUnmatch] = useState<Match | null>(null);
  const [unmatching, setUnmatching] = useState(false);
  const navigate = useNavigate();
  const { onlineUsers, socket } = useSocket();

  useEffect(() => {
    loadMatches();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleReload = () => loadMatches();
    const handleMatchRemoved = ({ matchId }: { matchId: number }) => {
      setMatches(prev => prev.filter(m => m.matchId !== matchId));
    };

    socket.on('match_notification', handleReload);
    socket.on('message_notification', handleReload);
    socket.on('match_removed', handleMatchRemoved);
    return () => {
      socket.off('match_notification', handleReload);
      socket.off('message_notification', handleReload);
      socket.off('match_removed', handleMatchRemoved);
    };
  }, [socket]);

  const loadMatches = async () => {
    try {
      const data = await api.getMatches();
      setMatches(data);
    } catch (err) {
      console.error('Error loading matches:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmUnmatch = async () => {
    if (!confirmUnmatch || unmatching) return;
    setUnmatching(true);
    try {
      const res = await api.unmatchUser(confirmUnmatch.matchId);
      setMatches(prev => prev.filter(m => m.matchId !== confirmUnmatch.matchId));
      if (socket) {
        socket.emit('unmatch_user', {
          matchId: confirmUnmatch.matchId,
          otherUserId: res.otherUserId
        });
      }
      toast.success(`Match com ${confirmUnmatch.name} desfeito`, { icon: '💔' });
      setConfirmUnmatch(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao desfazer match');
    } finally {
      setUnmatching(false);
    }
  };

  const getProfileImage = (photo: string) => {
    if (!photo) return '';
    return photo.replace(/=s\d+(-c)?$/, '=s800-c');
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'Z');
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}min`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="matches-page">
        <div className="matches-header">
          <h1>Conversas & Matches</h1>
        </div>
        <div className="matches-list">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton-match-item">
              <div className="skeleton-box skeleton-avatar" />
              <div className="skeleton-match-info">
                <div className="skeleton-box skeleton-match-name" />
                <div className="skeleton-box skeleton-match-msg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="matches-page">
      <div className="matches-header">
        <div>
          <h1>Conversas & Matches</h1>
          <p className="matches-count">
            {matches.length} {matches.length === 1 ? 'conexão ativa' : 'conexões ativas'}
          </p>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="no-matches">
          <div className="no-matches-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </div>
          <h2>Sem matches ainda</h2>
          <p>Continue dando likes na aba Descobrir para encontrar seus matches!</p>
          <button onClick={() => navigate('/')} className="go-swipe-btn">
            🔥 Ir para Descobrir
          </button>
        </div>
      ) : (
        <div className="matches-list">
          {matches.map(match => {
            const isOnline = onlineUsers.has(match.userId);
            return (
              <div
                key={match.matchId}
                className={`match-item ${match.isSuper ? 'super-vibe' : ''}`}
                onClick={() => navigate(`/chat/${match.matchId}`)}
              >
                <div className="match-avatar">
                  {getProfileImage(match.profilePhoto) ? (
                    <img
                      src={getProfileImage(match.profilePhoto)}
                      alt={match.name}
                      referrerPolicy="no-referrer"
                      onError={e => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="avatar-placeholder-sm">{match.name.charAt(0)}</span>
                  )}
                  {isOnline && <span className="online-dot" />}
                </div>
                <div className="match-info">
                  <div className="match-name-row">
                    <h3>
                      {match.name}{match.age ? `, ${match.age}` : ''}
                      {match.isSuper && (
                        <span className="super-star" title="Super Vibe!">⭐</span>
                      )}
                    </h3>
                    {(match.lastMessageAt || match.matchedAt) && (
                      <span className="match-time">
                        {formatTime(match.lastMessageAt || match.matchedAt)}
                      </span>
                    )}
                  </div>
                  <p className="match-preview">
                    {match.lastMessage || '✨ Novo match! Toque para conversar'}
                  </p>
                </div>

                <div className="match-item-actions" onClick={e => e.stopPropagation()}>
                  <button
                    className="unmatch-list-btn"
                    onClick={() => setConfirmUnmatch(match)}
                    title="Desfazer Match"
                  >
                    💔 Desfazer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmUnmatch && (
        <div className="unmatch-modal-overlay" onClick={() => setConfirmUnmatch(null)}>
          <div className="unmatch-modal" onClick={e => e.stopPropagation()}>
            <div className="unmatch-modal-icon">💔</div>
            <h3>Desfazer Match com {confirmUnmatch.name}?</h3>
            <p>
              Vocês deixarão de ter um match e o histórico de conversa será apagado para ambos.
            </p>
            <div className="unmatch-modal-actions">
              <button
                className="unmatch-cancel-btn"
                onClick={() => setConfirmUnmatch(null)}
                disabled={unmatching}
              >
                Cancelar
              </button>
              <button
                className="unmatch-confirm-btn"
                onClick={handleConfirmUnmatch}
                disabled={unmatching}
              >
                {unmatching ? 'Desfazendo...' : '💔 Sim, desfazer match'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
