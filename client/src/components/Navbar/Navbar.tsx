import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { usePWA } from '../../hooks/usePWA';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { unreadNotifications, clearNotifications } = useSocket();
  const { isInstallable, promptInstall } = usePWA();
  const navigate = useNavigate();

  const getProfileImage = () => {
    if (!user?.profilePhoto) return '';
    return user.profilePhoto.replace(/=s\d+(-c)?$/, '=s800-c');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Desktop Navbar */}
      <nav className="navbar desktop-nav">
        <div className="nav-brand" onClick={() => navigate('/')}>
          <span className="nav-logo-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </span>
          <span className="nav-logo-text">MatchVibe</span>
        </div>

        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/>
              </svg>
            </span>
            <span>Descobrir</span>
          </NavLink>
          <NavLink to="/matches" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </span>
            <span>Conversas</span>
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </span>
            <span>Perfil</span>
          </NavLink>
          {user?.email?.toLowerCase() === 'steven35silva@gmail.com' && (
            <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                </svg>
              </span>
              <span>Admin</span>
            </NavLink>
          )}
        </div>

        <div className="nav-profile">
          {isInstallable && (
            <button className="install-btn desktop-install" onClick={promptInstall}>
              Instalar App
            </button>
          )}
          <button 
            className="notification-btn" 
            onClick={() => {
              clearNotifications();
              navigate('/matches');
            }}
            title="Notificações"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 01-3.46 0"></path>
            </svg>
            {unreadNotifications > 0 && (
              <span className="notification-badge">{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>
            )}
          </button>
          <div className="nav-avatar" onClick={() => navigate('/profile')}>
            {getProfileImage() ? (
              <img src={getProfileImage()} alt={user?.name} referrerPolicy="no-referrer" />
            ) : (
              <span>{user?.name?.charAt(0)}</span>
            )}
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Sair" aria-label="Logout">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Top Header */}
      <header className="mobile-header">
        <div className="nav-brand" onClick={() => navigate('/')}>
          <span className="nav-logo-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </span>
          <span className="nav-logo-text">MatchVibe</span>
        </div>
        <div className="mobile-header-actions">
          {isInstallable && (
            <button className="install-btn mobile-install" onClick={promptInstall}>
              App
            </button>
          )}
          <button 
            className="notification-mobile-top-btn" 
            onClick={() => {
              clearNotifications();
              navigate('/matches');
            }}
          >
            <div className="notification-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 01-3.46 0"></path>
              </svg>
              {unreadNotifications > 0 && (
                <span className="notification-badge mobile">{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>
              )}
            </div>
          </button>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="navbar mobile-nav">
        <NavLink to="/" end className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
          <span className="mobile-nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/>
            </svg>
          </span>
          <span className="mobile-nav-label">Descobrir</span>
        </NavLink>
        <NavLink to="/matches" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
          <span className="mobile-nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </span>
          <span className="mobile-nav-label">Conversas</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
          <span className="mobile-nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </span>
          <span className="mobile-nav-label">Perfil</span>
        </NavLink>
        {user?.email?.toLowerCase() === 'steven35silva@gmail.com' && (
          <NavLink to="/admin" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
            <span className="mobile-nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
              </svg>
            </span>
            <span className="mobile-nav-label">Admin</span>
          </NavLink>
        )}
        <button 
          className="mobile-nav-item" 
          onClick={handleLogout}
        >
          <span className="mobile-nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </span>
          <span className="mobile-nav-label">Sair</span>
        </button>
      </nav>
    </>
  );
}
