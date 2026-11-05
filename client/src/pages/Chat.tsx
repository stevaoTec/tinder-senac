import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Message, Match, User } from '../types';
import * as api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import '../styles/chat.css';
import '../styles/skeleton.css';

export default function Chat() {
  const { matchId } = useParams<{ matchId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [matchInfo, setMatchInfo] = useState<Match | null>(null);
  const [matchedUserProfile, setMatchedUserProfile] = useState<User | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [modalPhotoIndex, setModalPhotoIndex] = useState(0);
  const [avatarError, setAvatarError] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const navigate = useNavigate();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  // Load initial data
  useEffect(() => {
    if (!matchId) return;

    const loadData = async () => {
      try {
        const [msgs, matches] = await Promise.all([
          api.getMessages(parseInt(matchId)),
          api.getMatches()
        ]);
        setMessages(msgs);
        const currentMatch = matches.find(m => m.matchId === parseInt(matchId));
        setMatchInfo(currentMatch || null);
        setAvatarError(false);

        if (currentMatch) {
          try {
            const fullProfile = await api.getUserById(currentMatch.userId);
            setMatchedUserProfile(fullProfile);
          } catch (e) {
            console.error('Erro ao carregar perfil do match:', e);
          }
        }
      } catch (err) {
        console.error('Error loading chat:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [matchId]);

  // Mark read when entering chat
  useEffect(() => {
    if (socket && matchInfo && matchId) {
      socket.emit('mark_read', { 
        matchId: parseInt(matchId), 
        otherUserId: matchInfo.userId 
      });
    }
  }, [matchInfo, socket, matchId]);

  // Scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Socket listeners
  useEffect(() => {
    if (!socket || !matchId) return;

    const numericMatchId = parseInt(matchId);
    socket.emit('join_match', numericMatchId);

    const handleNewMessage = (message: Message) => {
      setMessages(prev => [...prev, message]);
      setIsTyping(false);
      
      // If we received a message while in chat, mark it as read immediately
      if (message.senderId !== user?.id && matchInfo) {
        socket.emit('mark_read', { 
          matchId: numericMatchId, 
          otherUserId: message.senderId 
        });
      }
    };

    const handleTyping = () => setIsTyping(true);
    const handleStopTyping = () => setIsTyping(false);
    
    const handleMessagesRead = () => {
      setMessages(prev => prev.map(m => m.senderId === user?.id ? { ...m, read: 1 } : m));
    };

    socket.on('new_message', handleNewMessage);
    socket.on('user_typing', handleTyping);
    socket.on('user_stop_typing', handleStopTyping);
    socket.on('messages_read', handleMessagesRead);

    return () => {
      socket.emit('leave_match', numericMatchId);
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleTyping);
      socket.off('user_stop_typing', handleStopTyping);
      socket.off('messages_read', handleMessagesRead);
    };
  }, [socket, matchId, matchInfo, user?.id]);

  // Focus input on load
  useEffect(() => {
    if (!loading) {
      inputRef.current?.focus();
    }
  }, [loading]);

  const handleSend = async () => {
    if (!newMessage.trim() || !matchId) return;

    const content = newMessage.trim();
    setNewMessage('');

    try {
      const { message, otherUserId } = await api.sendMessage(parseInt(matchId), content);
      setMessages(prev => [...prev, message]);

      if (socket) {
        socket.emit('send_message', {
          matchId: parseInt(matchId),
          message,
          otherUserId
        });
        socket.emit('stop_typing', { matchId: parseInt(matchId) });
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setNewMessage(content); // Restore message on error
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTyping = () => {
    if (socket && matchId) {
      socket.emit('typing', { matchId: parseInt(matchId) });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop_typing', { matchId: parseInt(matchId) });
      }, 2000);
    }
  };

  const getProfileImage = (photo?: string) => {
    if (!photo) return '';
    return photo.replace(/=s\d+(-c)?$/, '=s800-c');
  };

  const handleOpenProfile = async () => {
    if (!matchInfo) return;
    setModalPhotoIndex(0);
    setShowProfileModal(true);
    try {
      const freshProfile = await api.getUserById(matchInfo.userId);
      setMatchedUserProfile(freshProfile);
    } catch (err) {
      console.error('Erro ao buscar perfil completo:', err);
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr + 'Z').toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateSeparator = (dateStr: string) => {
    const date = new Date(dateStr + 'Z');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hoje';
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  // Group messages by date
  const getDateForMessage = (msg: Message) => {
    return new Date(msg.createdAt + 'Z').toDateString();
  };

  if (loading) {
    return (
      <div className="chat-page">
        <div className="chat-header">
          <button className="back-btn" onClick={() => navigate('/matches')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div className="chat-user-info">
            <div className="skeleton-box skeleton-avatar" style={{width: 40, height: 40}} />
            <div className="skeleton-box skeleton-match-name" style={{width: 100, marginLeft: 12}} />
          </div>
        </div>
        <div className="chat-messages">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`skeleton-message ${i % 2 === 0 ? 'received' : 'sent'}`}>
              <div className="skeleton-box skeleton-bubble" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const headerPhoto = getProfileImage(matchedUserProfile?.profilePhoto || matchInfo?.profilePhoto);
  const modalPhotos = matchedUserProfile?.photos && matchedUserProfile.photos.length > 0
    ? matchedUserProfile.photos.map(p => getProfileImage(p))
    : headerPhoto ? [headerPhoto] : [];

  return (
    <div className="chat-page">
      <div className="chat-header">
        <button className="back-btn" onClick={() => navigate('/matches')} aria-label="Voltar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        {matchInfo && (
          <div
            className="chat-user-info clickable-user-card"
            onClick={handleOpenProfile}
            title="Clique para ver o perfil completo"
          >
            <div className="chat-avatar">
              {headerPhoto && !avatarError ? (
                <img
                  src={headerPhoto}
                  alt={matchInfo.name}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <span>{matchInfo.name.charAt(0)}</span>
              )}
              {onlineUsers.has(matchInfo.userId) && <span className="online-dot" />}
            </div>
            <div className="chat-user-details">
              <h3>{matchInfo.name}{matchedUserProfile?.age ? `, ${matchedUserProfile.age}` : ''}</h3>
              <span className="chat-status">
                {isTyping
                  ? 'Digitando...'
                  : `${onlineUsers.has(matchInfo.userId) ? 'Online' : 'Offline'} • Toque para ver perfil`}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="wingman-badge">🤖 VibeMaker Wingman</div>
            <h3>Quebre o gelo com {matchInfo?.name}!</h3>
            <p>Escolha uma sugestão inteligente:</p>
            
            <div className="icebreakers-list">
              {[
                `Oi ${matchInfo?.name.split(' ')[0]}! Vi seu perfil e achei sua vibe muito massa. Qual seu lugar favorito por aqui?`,
                `Parece que temos coisas em comum! O que você mais gosta de fazer num fim de semana perfeito?`,
                `Pergunta polêmica: se você tivesse que ouvir só uma música pelo resto do ano, qual seria? 🎵`
              ].map((msg, i) => (
                <button 
                  key={i} 
                  className="icebreaker-btn"
                  onClick={() => setNewMessage(msg)}
                >
                  {msg}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, index) => {
          const showDate = index === 0 ||
            getDateForMessage(msg) !== getDateForMessage(messages[index - 1]);
          const isSent = msg.senderId === user?.id;
          const msgAvatar = getProfileImage(msg.senderPhoto || headerPhoto);

          return (
            <React.Fragment key={msg.id}>
              {showDate && (
                <div className="date-separator">
                  <span>{formatDateSeparator(msg.createdAt)}</span>
                </div>
              )}
              <div className={`message-row ${isSent ? 'sent' : 'received'}`}>
                {!isSent && (
                  <div className="message-avatar" onClick={handleOpenProfile} title="Ver perfil">
                    {msgAvatar && !avatarError ? (
                      <img
                        src={msgAvatar}
                        alt={msg.senderName || matchInfo?.name}
                        referrerPolicy="no-referrer"
                        onError={e => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span>{(msg.senderName || matchInfo?.name || '?').charAt(0)}</span>
                    )}
                  </div>
                )}
                <div className={`message ${isSent ? 'sent' : 'received'}`}>
                  <div className="message-bubble">
                    <p>{msg.content}</p>
                    <span className="message-time">
                      {formatTime(msg.createdAt)}
                      {isSent && (
                        <span className="message-read-indicator">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {msg.read ? (
                              <>
                                <polyline points="18 7 11 14 6 9" opacity="0.5"/>
                                <polyline points="20 7 13 14 8 9"/>
                              </>
                            ) : (
                              <polyline points="20 6 9 17 4 12"/>
                            )}
                          </svg>
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {isTyping && (
          <div className="message-row received">
            <div className="message received">
              <div className="message-bubble typing-bubble">
                <div className="typing-indicator">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <input
          ref={inputRef}
          type="text"
          placeholder="Digite sua mensagem..."
          value={newMessage}
          onChange={e => {
            setNewMessage(e.target.value);
            handleTyping();
          }}
          onKeyDown={handleKeyPress}
          id="chat-input"
        />
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!newMessage.trim()}
          id="send-button"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>

      {/* Matched User Profile Modal (Only accessible from Chat after Match) */}
      {showProfileModal && (
        <div className="chat-profile-modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="chat-profile-modal" onClick={e => e.stopPropagation()}>
            <button className="chat-profile-close" onClick={() => setShowProfileModal(false)} aria-label="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>

            <div className="chat-profile-hero">
              {modalPhotos.length > 0 ? (
                <img
                  src={modalPhotos[modalPhotoIndex] || headerPhoto}
                  alt={matchedUserProfile?.name || matchInfo?.name}
                  className="chat-profile-main-photo"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="chat-profile-photo-placeholder">
                  {(matchedUserProfile?.name || matchInfo?.name || '?').charAt(0)}
                </div>
              )}

              {modalPhotos.length > 1 && (
                <>
                  <div className="chat-profile-indicators">
                    {modalPhotos.map((_, idx) => (
                      <span
                        key={idx}
                        className={`chat-profile-dot ${idx === modalPhotoIndex ? 'active' : ''}`}
                        onClick={() => setModalPhotoIndex(idx)}
                      />
                    ))}
                  </div>
                  {modalPhotoIndex > 0 && (
                    <button
                      className="chat-photo-nav prev"
                      onClick={() => setModalPhotoIndex(i => i - 1)}
                    >
                      ‹
                    </button>
                  )}
                  {modalPhotoIndex < modalPhotos.length - 1 && (
                    <button
                      className="chat-photo-nav next"
                      onClick={() => setModalPhotoIndex(i => i + 1)}
                    >
                      ›
                    </button>
                  )}
                </>
              )}

              <div className="chat-profile-hero-overlay">
                <h2>
                  {matchedUserProfile?.name || matchInfo?.name}
                  {(matchedUserProfile?.age || matchInfo?.age) ? `, ${matchedUserProfile?.age || matchInfo?.age}` : ''}
                  {matchedUserProfile?.verified && <span className="chat-verified-badge" title="Verificado">✓</span>}
                </h2>
                <div className="chat-profile-status-pill">
                  <span className={`status-dot ${matchInfo && onlineUsers.has(matchInfo.userId) ? 'online' : 'offline'}`} />
                  {matchInfo && onlineUsers.has(matchInfo.userId) ? 'Online agora' : 'Offline'}
                  {matchedUserProfile?.vibeScore !== undefined && ` • 🔥 Vibe ${matchedUserProfile.vibeScore}`}
                </div>
              </div>
            </div>

            <div className="chat-profile-body">
              {(matchedUserProfile?.bio || matchInfo?.bio) && (
                <div className="chat-profile-section">
                  <h4>Sobre</h4>
                  <p>{matchedUserProfile?.bio || matchInfo?.bio}</p>
                </div>
              )}

              {(matchedUserProfile?.relationshipIntent ||
                matchedUserProfile?.height ||
                matchedUserProfile?.zodiacSign ||
                matchedUserProfile?.mbti ||
                matchedUserProfile?.currentEvent ||
                matchedUserProfile?.favoritePlace) && (
                <div className="chat-profile-section">
                  <h4>Detalhes</h4>
                  <div className="chat-profile-badges">
                    {matchedUserProfile?.relationshipIntent && (
                      <span className="chat-info-badge">🎯 {matchedUserProfile.relationshipIntent}</span>
                    )}
                    {matchedUserProfile?.height && (
                      <span className="chat-info-badge">📏 {matchedUserProfile.height} cm</span>
                    )}
                    {matchedUserProfile?.zodiacSign && (
                      <span className="chat-info-badge">✨ {matchedUserProfile.zodiacSign}</span>
                    )}
                    {matchedUserProfile?.mbti && (
                      <span className="chat-info-badge">🧠 {matchedUserProfile.mbti}</span>
                    )}
                    {matchedUserProfile?.currentEvent && (
                      <span className="chat-info-badge">📍 {matchedUserProfile.currentEvent}</span>
                    )}
                    {matchedUserProfile?.favoritePlace && (
                      <span className="chat-info-badge">🏙️ {matchedUserProfile.favoritePlace}</span>
                    )}
                  </div>
                </div>
              )}

              {matchedUserProfile?.interests && matchedUserProfile.interests.length > 0 && (
                <div className="chat-profile-section">
                  <h4>Interesses</h4>
                  <div className="chat-profile-badges">
                    {matchedUserProfile.interests.map(interest => (
                      <span key={interest} className="chat-interest-tag">{interest}</span>
                    ))}
                  </div>
                </div>
              )}

              {(matchedUserProfile?.instagram || matchedUserProfile?.spotify) && (
                <div className="chat-profile-section">
                  <h4>Redes & Música</h4>
                  <div className="chat-profile-badges">
                    {matchedUserProfile?.instagram && (
                      <span className="chat-info-badge">📸 @{matchedUserProfile.instagram.replace('@', '')}</span>
                    )}
                    {matchedUserProfile?.spotify && (
                      <span className="chat-info-badge">🎵 {matchedUserProfile.spotify}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
