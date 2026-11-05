import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Message, User } from '../types';
import * as api from '../services/api';
import { AdminMatchSummary } from '../services/api';
import toast from 'react-hot-toast';
import './Admin.css';

type AdminUser = User & {
  email?: string;
  isOnline?: boolean;
  createdAt?: string;
};

interface AdminStats {
  totalUsers: number;
  onlineUsers: number;
  users: AdminUser[];
  matches?: AdminMatchSummary[];
}

export default function Admin() {
  const { user } = useAuth();
  const { socket, onlineUsers: socketOnlineUsers } = useSocket();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'online' | 'offline' | 'chats'>('all');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [modalPhotoIndex, setModalPhotoIndex] = useState(0);
  const [startingChatId, setStartingChatId] = useState<number | null>(null);

  // State for inspecting chats between any two users
  const [inspectedMatch, setInspectedMatch] = useState<AdminMatchSummary | null>(null);
  const [inspectedMessages, setInspectedMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.getAdminStats();
      setStats(res);
      setError('');
    } catch (err: any) {
      setError('Acesso restrito ao administrador.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.email?.toLowerCase() !== 'steven35silva@gmail.com') {
      navigate('/');
      return;
    }

    fetchStats();

    // Auto-refresh every 8 seconds
    const interval = setInterval(fetchStats, 8000);
    return () => clearInterval(interval);
  }, [user, navigate, fetchStats]);

  // Real-time update when someone comes online or goes offline
  useEffect(() => {
    if (!socket) return;
    const handleStatusChange = () => fetchStats();
    socket.on('user_online', handleStatusChange);
    socket.on('user_offline', handleStatusChange);
    return () => {
      socket.off('user_online', handleStatusChange);
      socket.off('user_offline', handleStatusChange);
    };
  }, [socket, fetchStats]);

  // Load and auto-refresh messages when inspecting a match conversation
  const loadInspectedMessages = useCallback(async (matchId: number, showSpinner = false) => {
    if (showSpinner) setLoadingMessages(true);
    try {
      const msgs = await api.getMessages(matchId);
      setInspectedMessages(msgs);
    } catch (err) {
      console.error('Erro ao carregar mensagens da conversa:', err);
    } finally {
      if (showSpinner) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!inspectedMatch) return;
    loadInspectedMessages(inspectedMatch.matchId, true);
    const interval = setInterval(() => {
      loadInspectedMessages(inspectedMatch.matchId, false);
    }, 4000);
    return () => clearInterval(interval);
  }, [inspectedMatch, loadInspectedMessages]);

  const handleStartTestChat = async (targetUser: { id: number; name: string }, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (targetUser.id === user?.id) {
      toast('Este é o seu próprio perfil de Admin!', { icon: '👑' });
      return;
    }
    setStartingChatId(targetUser.id);
    try {
      const { matchId } = await api.adminStartChat(targetUser.id);
      toast.success(`Abrindo chat de teste com ${targetUser.name}...`, { icon: '💬' });
      navigate(`/chat/${matchId}`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao abrir chat de teste');
    } finally {
      setStartingChatId(null);
    }
  };

  const getHighResPhoto = (photo?: string) => {
    if (!photo) return '';
    return photo.replace(/=s\d+(-c)?$/, '=s800-c');
  };

  if (loading) return <div className="admin-loading">Carregando painel exclusivo...</div>;
  if (error) return <div className="admin-error">{error}</div>;

  const allUsers = (stats?.users || []).map(u => ({
    ...u,
    isOnline: Boolean(u.isOnline || socketOnlineUsers.has(u.id))
  }));

  const allMatches = (stats?.matches || []).map(m => ({
    ...m,
    user1: { ...m.user1, isOnline: Boolean(m.user1.isOnline || socketOnlineUsers.has(m.user1.id)) },
    user2: { ...m.user2, isOnline: Boolean(m.user2.isOnline || socketOnlineUsers.has(m.user2.id)) }
  }));

  const onlineCount = allUsers.filter(u => u.isOnline).length;

  const filteredUsers = allUsers.filter(u => {
    if (filter === 'online' && !u.isOnline) return false;
    if (filter === 'offline' && u.isOnline) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.bio?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredMatches = allMatches.filter(m => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.user1.name?.toLowerCase().includes(q) ||
      m.user2.name?.toLowerCase().includes(q) ||
      m.lastMessage?.toLowerCase().includes(q)
    );
  });

  const modalPhotos = selectedUser?.photos && selectedUser.photos.length > 0
    ? selectedUser.photos.map(p => getHighResPhoto(p))
    : selectedUser?.profilePhoto
      ? [getHighResPhoto(selectedUser.profilePhoto)]
      : [];

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div className="admin-badges-row">
          <div className="admin-badge-exclusive">🔒 Acesso Exclusivo Admin</div>
          <div className="admin-badge-stealth">👻 Seu perfil está invisível para todos os usuários</div>
        </div>
        <h1>Painel do Dono 👑</h1>
        <p>Logado como <strong>{user?.email}</strong></p>
      </div>

      <div className="stats-grid">
        <div
          className={`stat-card ${filter === 'all' ? 'active-stat' : ''}`}
          onClick={() => setFilter('all')}
        >
          <div className="stat-icon users-icon">👥</div>
          <div className="stat-info">
            <h3>Pessoas Cadastradas</h3>
            <span className="stat-number">{allUsers.length}</span>
          </div>
        </div>

        <div
          className={`stat-card ${filter === 'online' ? 'active-stat online-focus' : ''}`}
          onClick={() => setFilter('online')}
        >
          <div className="stat-icon online-icon">🟢</div>
          <div className="stat-info">
            <h3>Pessoas Online Agora</h3>
            <span className="stat-number">{onlineCount}</span>
          </div>
        </div>

        <div
          className={`stat-card ${filter === 'chats' ? 'active-stat chats-focus' : ''}`}
          onClick={() => setFilter('chats')}
        >
          <div className="stat-icon chats-icon">💬</div>
          <div className="stat-info">
            <h3>Matches & Conversas</h3>
            <span className="stat-number">{allMatches.length}</span>
          </div>
        </div>
      </div>

      <div className="admin-controls">
        <div className="admin-tabs">
          <button
            className={`admin-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todos ({allUsers.length})
          </button>
          <button
            className={`admin-tab ${filter === 'online' ? 'active' : ''}`}
            onClick={() => setFilter('online')}
          >
            🟢 Online ({onlineCount})
          </button>
          <button
            className={`admin-tab ${filter === 'offline' ? 'active' : ''}`}
            onClick={() => setFilter('offline')}
          >
            ⚪ Offline ({allUsers.length - onlineCount})
          </button>
          <button
            className={`admin-tab ${filter === 'chats' ? 'active' : ''}`}
            onClick={() => setFilter('chats')}
          >
            💬 Ver Chats ({allMatches.length})
          </button>
        </div>

        <div className="admin-search-wrapper">
          <input
            type="text"
            className="admin-search-input"
            placeholder={filter === 'chats' ? 'Buscar conversa por nome ou mensagem...' : 'Buscar por nome ou email...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="admin-refresh-btn" onClick={fetchStats} title="Atualizar lista">
            🔄 Atualizar
          </button>
        </div>
      </div>

      {filter === 'chats' ? (
        filteredMatches.length === 0 ? (
          <div className="admin-empty">
            <p>Nenhuma conversa ou match registrado ainda. Você pode clicar em "💬 Testar Chat" em qualquer usuário na aba Todos!</p>
          </div>
        ) : (
          <div className="admin-matches-list">
            {filteredMatches.map(m => {
              const photo1 = getHighResPhoto(m.user1.profilePhoto);
              const photo2 = getHighResPhoto(m.user2.profilePhoto);
              return (
                <div key={m.matchId} className="admin-match-card">
                  <div className="admin-match-pair">
                    <div className="admin-match-person">
                      <div className="admin-user-avatar small">
                        {photo1 ? (
                          <img src={photo1} alt={m.user1.name} referrerPolicy="no-referrer" />
                        ) : (
                          <span>{m.user1.name?.charAt(0) || '?'}</span>
                        )}
                        <span className={`admin-status-dot ${m.user1.isOnline ? 'online' : 'offline'}`} />
                      </div>
                      <div className="admin-match-person-info">
                        <strong>{m.user1.name}</strong>
                        <span>{m.user1.isOnline ? '🟢 Online' : '⚪ Offline'}</span>
                      </div>
                    </div>

                    <div className="admin-match-heart-divider">
                      <span>{m.isSuper ? '⭐' : '❤️'}</span>
                      <small>{m.messageCount} msg{m.messageCount === 1 ? '' : 's'}</small>
                    </div>

                    <div className="admin-match-person">
                      <div className="admin-user-avatar small">
                        {photo2 ? (
                          <img src={photo2} alt={m.user2.name} referrerPolicy="no-referrer" />
                        ) : (
                          <span>{m.user2.name?.charAt(0) || '?'}</span>
                        )}
                        <span className={`admin-status-dot ${m.user2.isOnline ? 'online' : 'offline'}`} />
                      </div>
                      <div className="admin-match-person-info">
                        <strong>{m.user2.name}</strong>
                        <span>{m.user2.isOnline ? '🟢 Online' : '⚪ Offline'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="admin-match-preview">
                    {m.lastMessage ? (
                      <p className="admin-last-msg">💬 "{m.lastMessage}"</p>
                    ) : (
                      <p className="admin-last-msg empty">Nenhuma mensagem enviada ainda neste match</p>
                    )}
                  </div>

                  <div className="admin-match-actions">
                    <button
                      className="admin-inspect-chat-btn"
                      onClick={() => setInspectedMatch(m)}
                    >
                      👁️ Ver Conversa Completa ({m.messageCount})
                    </button>
                    {(m.user1.id === user?.id || m.user2.id === user?.id) && (
                      <button
                        className="admin-test-chat-btn"
                        onClick={() => navigate(`/chat/${m.matchId}`)}
                      >
                        💬 Entrar no Chat
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : filteredUsers.length === 0 ? (
        <div className="admin-empty">
          <p>Nenhuma pessoa encontrada neste filtro.</p>
        </div>
      ) : (
        <div className="admin-users-grid">
          {filteredUsers.map(u => {
            const photoUrl = getHighResPhoto(u.profilePhoto);
            const isSelfAdmin = u.email?.toLowerCase() === 'steven35silva@gmail.com';
            return (
              <div
                key={u.id}
                className={`admin-user-card ${u.isOnline ? 'is-online' : ''}`}
                onClick={() => {
                  setModalPhotoIndex(0);
                  setSelectedUser(u);
                }}
              >
                <div className="admin-user-avatar">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={u.name}
                      referrerPolicy="no-referrer"
                      onError={e => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span>{u.name?.charAt(0) || '?'}</span>
                  )}
                  <span className={`admin-status-dot ${u.isOnline ? 'online' : 'offline'}`} />
                </div>

                <div className="admin-user-info">
                  <div className="admin-user-top">
                    <h4>
                      {u.name}{u.age ? `, ${u.age}` : ''}
                      {u.verified && <span className="admin-verified" title="Verificado">✓</span>}
                    </h4>
                    <span className={`admin-status-badge ${u.isOnline ? 'online' : 'offline'}`}>
                      {u.isOnline ? '🟢 Online' : '⚪ Offline'}
                    </span>
                  </div>
                  <p className="admin-user-email">
                    {u.email}
                    {isSelfAdmin && <span className="admin-self-tag"> • 👻 Invisível</span>}
                  </p>
                  {u.bio && <p className="admin-user-bio">{u.bio}</p>}
                  <div className="admin-user-meta">
                    {u.gender && <span>Gênero: {u.gender}</span>}
                    {u.createdAt && (
                      <span>
                        Cadastro: {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>

                  {!isSelfAdmin && (
                    <div className="admin-card-actions">
                      <button
                        className="admin-test-chat-btn"
                        disabled={startingChatId === u.id}
                        onClick={e => handleStartTestChat(u, e)}
                      >
                        {startingChatId === u.id ? 'Abrindo...' : `💬 Testar Chat com ${u.name.split(' ')[0]}`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Profile Modal for Admin Inspection */}
      {selectedUser && (
        <div className="admin-modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="admin-profile-modal" onClick={e => e.stopPropagation()}>
            <button className="admin-modal-close" onClick={() => setSelectedUser(null)}>
              ✕
            </button>

            <div className="admin-modal-hero">
              {modalPhotos.length > 0 ? (
                <img
                  src={modalPhotos[modalPhotoIndex]}
                  alt={selectedUser.name}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="admin-modal-placeholder">{selectedUser.name?.charAt(0)}</div>
              )}

              {modalPhotos.length > 1 && (
                <div className="admin-modal-nav">
                  <button
                    disabled={modalPhotoIndex === 0}
                    onClick={() => setModalPhotoIndex(i => Math.max(0, i - 1))}
                  >
                    ‹
                  </button>
                  <span>{modalPhotoIndex + 1} / {modalPhotos.length}</span>
                  <button
                    disabled={modalPhotoIndex === modalPhotos.length - 1}
                    onClick={() => setModalPhotoIndex(i => Math.min(modalPhotos.length - 1, i + 1))}
                  >
                    ›
                  </button>
                </div>
              )}

              <div className="admin-modal-title">
                <h2>
                  {selectedUser.name}{selectedUser.age ? `, ${selectedUser.age}` : ''}
                </h2>
                <p>{selectedUser.email}</p>
                <span className={`admin-status-badge ${selectedUser.isOnline ? 'online' : 'offline'}`}>
                  {selectedUser.isOnline ? '🟢 Online agora' : '⚪ Offline'}
                </span>
              </div>
            </div>

            <div className="admin-modal-body">
              {selectedUser.email?.toLowerCase() !== 'steven35silva@gmail.com' && (
                <button
                  className="admin-test-chat-btn full-width"
                  disabled={startingChatId === selectedUser.id}
                  onClick={() => handleStartTestChat(selectedUser)}
                >
                  {startingChatId === selectedUser.id
                    ? 'Abrindo chat...'
                    : `💬 Iniciar / Testar Chat com ${selectedUser.name}`}
                </button>
              )}

              {selectedUser.bio && (
                <div className="admin-modal-section">
                  <h5>Bio</h5>
                  <p>{selectedUser.bio}</p>
                </div>
              )}

              <div className="admin-modal-section">
                <h5>Informações</h5>
                <div className="admin-modal-chips">
                  {selectedUser.gender && <span className="admin-chip">Gênero: {selectedUser.gender}</span>}
                  {selectedUser.relationshipIntent && <span className="admin-chip">🎯 {selectedUser.relationshipIntent}</span>}
                  {selectedUser.height && <span className="admin-chip">📏 {selectedUser.height} cm</span>}
                  {selectedUser.zodiacSign && <span className="admin-chip">✨ {selectedUser.zodiacSign}</span>}
                  {selectedUser.mbti && <span className="admin-chip">🧠 {selectedUser.mbti}</span>}
                  {selectedUser.instagram && <span className="admin-chip">📸 @{selectedUser.instagram.replace('@', '')}</span>}
                  {selectedUser.spotify && <span className="admin-chip">🎵 {selectedUser.spotify}</span>}
                  {selectedUser.currentEvent && <span className="admin-chip">📍 {selectedUser.currentEvent}</span>}
                  {selectedUser.favoritePlace && <span className="admin-chip">🏙️ {selectedUser.favoritePlace}</span>}
                </div>
              </div>

              {selectedUser.interests && selectedUser.interests.length > 0 && (
                <div className="admin-modal-section">
                  <h5>Interesses</h5>
                  <div className="admin-modal-chips">
                    {selectedUser.interests.map(i => (
                      <span key={i} className="admin-chip interest">{i}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin Live Chat Inspector Modal (View messages between any two users) */}
      {inspectedMatch && (
        <div className="admin-modal-overlay" onClick={() => setInspectedMatch(null)}>
          <div className="admin-chat-inspector-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-inspector-header">
              <div>
                <span className="admin-inspector-badge">👁️ Monitoramento de Chat em Tempo Real</span>
                <h3>
                  {inspectedMatch.user1.name} ❤️ {inspectedMatch.user2.name}
                </h3>
              </div>
              <button className="admin-inspector-close" onClick={() => setInspectedMatch(null)}>
                ✕
              </button>
            </div>

            <div className="admin-inspector-messages">
              {loadingMessages ? (
                <div className="admin-inspector-empty">Carregando mensagens...</div>
              ) : inspectedMessages.length === 0 ? (
                <div className="admin-inspector-empty">
                  Nenhuma mensagem foi enviada nesta conversa ainda.
                </div>
              ) : (
                inspectedMessages.map(msg => {
                  const isUser1 = msg.senderId === inspectedMatch.user1.id;
                  const avatar = getHighResPhoto(msg.senderPhoto);
                  return (
                    <div
                      key={msg.id}
                      className={`admin-inspector-msg-row ${isUser1 ? 'left' : 'right'}`}
                    >
                      <div className="admin-inspector-avatar">
                        {avatar ? (
                          <img src={avatar} alt={msg.senderName} referrerPolicy="no-referrer" />
                        ) : (
                          <span>{(msg.senderName || '?').charAt(0)}</span>
                        )}
                      </div>
                      <div className="admin-inspector-bubble">
                        <div className="admin-inspector-sender">
                          <strong>{msg.senderName}</strong>
                          <span>
                            {new Date(msg.createdAt + 'Z').toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p>{msg.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="admin-inspector-footer">
              {inspectedMatch.user1.id !== user?.id && (
                <button
                  className="admin-test-chat-btn"
                  onClick={() => handleStartTestChat(inspectedMatch.user1)}
                >
                  💬 Conversar com {inspectedMatch.user1.name.split(' ')[0]}
                </button>
              )}
              {inspectedMatch.user2.id !== user?.id && (
                <button
                  className="admin-test-chat-btn"
                  onClick={() => handleStartTestChat(inspectedMatch.user2)}
                >
                  💬 Conversar com {inspectedMatch.user2.name.split(' ')[0]}
                </button>
              )}
              <button
                className="admin-refresh-btn"
                onClick={() => loadInspectedMessages(inspectedMatch.matchId, true)}
              >
                🔄 Atualizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
