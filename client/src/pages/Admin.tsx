import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { User } from '../types';
import * as api from '../services/api';
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
}

export default function Admin() {
  const { user } = useAuth();
  const { socket, onlineUsers: socketOnlineUsers } = useSocket();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [modalPhotoIndex, setModalPhotoIndex] = useState(0);

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

  const modalPhotos = selectedUser?.photos && selectedUser.photos.length > 0
    ? selectedUser.photos.map(p => getHighResPhoto(p))
    : selectedUser?.profilePhoto
      ? [getHighResPhoto(selectedUser.profilePhoto)]
      : [];

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div className="admin-badge-exclusive">🔒 Acesso Exclusivo Admin</div>
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
        </div>

        <div className="admin-search-wrapper">
          <input
            type="text"
            className="admin-search-input"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="admin-refresh-btn" onClick={fetchStats} title="Atualizar lista">
            🔄 Atualizar
          </button>
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="admin-empty">
          <p>Nenhuma pessoa encontrada neste filtro.</p>
        </div>
      ) : (
        <div className="admin-users-grid">
          {filteredUsers.map(u => {
            const photoUrl = getHighResPhoto(u.profilePhoto);
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
                  <p className="admin-user-email">{u.email}</p>
                  {u.bio && <p className="admin-user-bio">{u.bio}</p>}
                  <div className="admin-user-meta">
                    {u.gender && <span>Gênero: {u.gender}</span>}
                    {u.createdAt && (
                      <span>
                        Cadastro: {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
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
    </div>
  );
}
