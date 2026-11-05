import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import '../styles/profile.css';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [age, setAge] = useState(String(user?.age || ''));
  const [gender, setGender] = useState(user?.gender || '');
  const [maxDistance, setMaxDistance] = useState(user?.maxDistance || 50);
  const [minAge, setMinAge] = useState(user?.minAge || 18);
  const [maxAge, setMaxAge] = useState(user?.maxAge || 100);
  const [genderPreference, setGenderPreference] = useState(user?.genderPreference || 'Todos');
  const [relationshipIntent, setRelationshipIntent] = useState(user?.relationshipIntent || '');
  const [zodiacSign, setZodiacSign] = useState(user?.zodiacSign || '');
  const [height, setHeight] = useState(String(user?.height || ''));
  const [mbti, setMbti] = useState(user?.mbti || '');
  const [instagram, setInstagram] = useState(user?.instagram || '');
  const [spotify, setSpotify] = useState(user?.spotify || '');
  const [favoritePlace, setFavoritePlace] = useState(user?.favoritePlace || '');
  const [currentEvent, setCurrentEvent] = useState(user?.currentEvent || '');
  const [interests, setInterests] = useState<string[]>(user?.interests || []);
  const [newInterest, setNewInterest] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generatingBio, setGeneratingBio] = useState(false);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const updated = await api.updateProfile({
        name,
        bio,
        age: parseInt(age),
        gender,
        maxDistance,
        minAge,
        maxAge,
        genderPreference,
        relationshipIntent,
        zodiacSign,
        height: height ? parseInt(height) : undefined,
        mbti,
        instagram,
        spotify,
        favoritePlace,
        currentEvent,
        interests
      } as any);
      updateUser(updated);
      setMessage('Perfil atualizado com sucesso');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateBio = () => {
    setGeneratingBio(true);
    setTimeout(() => {
      const templates = [
        `Sou ${gender === 'F' ? 'a garota' : 'o cara'} que vai te provar que ${interests[0] || 'pizza'} e ${interests[1] || 'Netflix'} combinam. Arraste para a direita se tiver coragem! 🚀`,
        `Focado em ${relationshipIntent || 'viver a vida'} e dar boas risadas. Meu MBTI é ${mbti || 'desconhecido'}, mas prometo que minha vibe é boa. ✨`,
        `Apaixonado(a) por ${interests.join(', ') || 'boas conversas'}. Meu signo é ${zodiacSign || 'Misterioso'}. Vamos descobrir se damos match? 🔮`,
        `Se eu der match, você vai ter que aturar minhas playlists de ${spotify || 'música duvidosa'}. Preparado(a)? 🎧`
      ];
      const randomBio = templates[Math.floor(Math.random() * templates.length)];
      setBio(randomBio);
      setGeneratingBio(false);
    }, 1200);
  };

  const compressImageFile = (file: File, maxDimension: number): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(file);
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (!blob) return resolve(file);
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
            },
            'image/jpeg',
            0.92
          );
        };
        img.onerror = () => resolve(file);
        img.src = event.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (file: File, type: 'profile' | 'cover') => {
    try {
      const compressed = await compressImageFile(file, type === 'profile' ? 1440 : 1600);
      if (type === 'profile') {
        const { profilePhoto, photos } = await api.uploadProfilePhoto(compressed);
        updateUser({ ...user!, profilePhoto, ...(photos ? { photos } : {}) });
        setMessage('Foto de perfil atualizada');
      } else {
        const { coverPhoto } = await api.uploadCoverPhoto(compressed);
        updateUser({ ...user!, coverPhoto });
        setMessage('Foto de capa atualizada');
      }
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage('Erro ao enviar foto: ' + err.message);
    }
  };

  const addInterest = () => {
    const trimmed = newInterest.trim();
    if (trimmed && !interests.includes(trimmed) && interests.length < 8) {
      setInterests([...interests, trimmed]);
      setNewInterest('');
    }
  };

  const removeInterest = (interest: string) => {
    setInterests(interests.filter(i => i !== interest));
  };

  const handleInterestKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addInterest();
    }
  };

  const getProfileImage = () => {
    if (!user?.profilePhoto) return '';
    return user.profilePhoto.replace(/=s\d+(-c)?$/, '=s800-c');
  };

  const getCoverImage = () => {
    if (!user?.coverPhoto) return '';
    return user.coverPhoto.replace(/=s\d+(-c)?$/, '=s1200-c');
  };

  const getCompletionPercentage = () => {
    let score = 0;
    const total = 10;
    if (name) score++;
    if (bio && bio.length > 10) score++;
    if (age) score++;
    if (gender) score++;
    if (interests.length >= 2) score++;
    if (getProfileImage()) score++;
    if (getCoverImage()) score++;
    if (relationshipIntent) score++;
    if (zodiacSign || height || mbti) score++;
    if (instagram || spotify) score++;
    return Math.round((score / total) * 100);
  };
  const completion = getCompletionPercentage();

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div
          className="cover-photo"
          style={getCoverImage() ? { backgroundImage: `url("${getCoverImage()}")` } : {}}
          onClick={() => coverInputRef.current?.click()}
        >
          <div className="cover-overlay">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <span>Alterar capa</span>
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={e => {
              if (e.target.files?.[0]) handlePhotoUpload(e.target.files[0], 'cover');
            }}
          />
        </div>
        <div className="profile-avatar-wrapper">
          <div
            className="profile-avatar"
            onClick={() => profileInputRef.current?.click()}
          >
            {getProfileImage() ? (
              <img src={getProfileImage()} alt={user?.name} referrerPolicy="no-referrer" />
            ) : (
              <span className="avatar-placeholder">{user?.name?.charAt(0)}</span>
            )}
            <div className="avatar-edit-overlay">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
          </div>
          <input
            ref={profileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={e => {
              if (e.target.files?.[0]) handlePhotoUpload(e.target.files[0], 'profile');
            }}
          />
        </div>
        <div className="vibe-score-badge">
          🔥 Vibe Score: {user?.vibeScore || 0}
        </div>
      </div>

      <div className="profile-completion">
        <div className="completion-header">
          <span>Perfil completo</span>
          <span>{completion}%</span>
        </div>
        <div className="completion-bar">
          <div className="completion-fill" style={{ width: `${completion}%` }} />
        </div>
        <button className="preview-btn" onClick={() => setPreviewOpen(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          Como os outros me veem
        </button>
      </div>

      <div className="profile-form">
        <h2>Editar Perfil</h2>

        {message && (
          <div className={`profile-message ${message.includes('Erro') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        <span className="profile-section-title">Informacoes basicas</span>

        <div className="input-group">
          <label htmlFor="profile-name">Nome</label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Seu nome"
          />
        </div>

        <div className="input-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label htmlFor="profile-bio" style={{ marginBottom: 0 }}>Bio</label>
            <button 
              className="ai-bio-btn" 
              onClick={handleGenerateBio} 
              disabled={generatingBio}
              type="button"
            >
              {generatingBio ? '✨ Gerando...' : '✨ VibeMaker IA'}
            </button>
          </div>
          <textarea
            id="profile-bio"
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Conte algo sobre voce..."
            rows={3}
            maxLength={300}
          />
          <span className="char-count">{bio.length}/300</span>
        </div>

        <div className="input-row">
          <div className="input-group">
            <label htmlFor="profile-age">Idade</label>
            <input
              id="profile-age"
              type="number"
              value={age}
              onChange={e => setAge(e.target.value)}
              min={18}
              max={99}
            />
          </div>
          <div className="input-group">
            <label htmlFor="profile-gender">Genero</label>
            <select
              id="profile-gender"
              value={gender}
              onChange={e => setGender(e.target.value)}
            >
              <option value="">Selecione</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
              <option value="O">Outro</option>
            </select>
          </div>
        </div>

        <span className="profile-section-title">Sobre Mim</span>
        <div className="input-row">
          <div className="input-group">
            <label>Altura (cm)</label>
            <input type="number" placeholder="Ex: 175" value={height} onChange={e => setHeight(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Signo</label>
            <select value={zodiacSign} onChange={e => setZodiacSign(e.target.value)}>
              <option value="">Selecione</option>
              <option value="Áries">Áries</option><option value="Touro">Touro</option>
              <option value="Gêmeos">Gêmeos</option><option value="Câncer">Câncer</option>
              <option value="Leão">Leão</option><option value="Virgem">Virgem</option>
              <option value="Libra">Libra</option><option value="Escorpião">Escorpião</option>
              <option value="Sagitário">Sagitário</option><option value="Capricórnio">Capricórnio</option>
              <option value="Aquário">Aquário</option><option value="Peixes">Peixes</option>
            </select>
          </div>
        </div>

        <div className="input-row">
          <div className="input-group">
            <label>Personalidade (MBTI)</label>
            <input type="text" placeholder="Ex: ENFP" value={mbti} onChange={e => setMbti(e.target.value.toUpperCase())} maxLength={4} />
          </div>
          <div className="input-group">
            <label>O que eu busco</label>
            <select value={relationshipIntent} onChange={e => setRelationshipIntent(e.target.value)}>
              <option value="">Selecione</option>
              <option value="Relacionamento Sério">Relacionamento Sério</option>
              <option value="Algo Casual">Algo Casual</option>
              <option value="Amizades">Amizades</option>
              <option value="Ainda não sei">Ainda não sei</option>
            </select>
          </div>
        </div>

        <span className="profile-section-title">Vida Real (Eventos e Locais)</span>
        <div className="input-group">
          <label>Check-in de Evento/Festa de Hoje</label>
          <input type="text" placeholder="Ex: Calourada, Lollapalooza..." value={currentEvent} onChange={e => setCurrentEvent(e.target.value)} />
        </div>
        <div className="input-group">
          <label>Lugar Favorito da Cidade</label>
          <input type="text" placeholder="Ex: Starbucks da Paulista" value={favoritePlace} onChange={e => setFavoritePlace(e.target.value)} />
        </div>

        <span className="profile-section-title">Redes Sociais</span>
        <div className="input-group">
          <label>Instagram</label>
          <input type="text" placeholder="@seuuser" value={instagram} onChange={e => setInstagram(e.target.value)} />
        </div>
        <div className="input-group">
          <label>Spotify (Top Artista/Música)</label>
          <input type="text" placeholder="Ex: The Weeknd" value={spotify} onChange={e => setSpotify(e.target.value)} />
        </div>

        <span className="profile-section-title">Descoberta</span>
        <div className="input-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label htmlFor="profile-distance" style={{ marginBottom: 0 }}>Distância Máxima</label>
            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
              {maxDistance >= 500 ? '🌎 Global' : `${maxDistance} km`}
            </span>
          </div>
          <input
            id="profile-distance"
            type="range"
            min={1}
            max={500}
            step={1}
            value={maxDistance}
            onChange={e => setMaxDistance(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
          />
        </div>

        <div className="input-row">
          <div className="input-group">
            <label htmlFor="profile-min-age">Idade Mínima ({minAge})</label>
            <input
              id="profile-min-age"
              type="range"
              min={18}
              max={100}
              value={minAge}
              onChange={e => setMinAge(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </div>
          <div className="input-group">
            <label htmlFor="profile-max-age">Idade Máxima ({maxAge})</label>
            <input
              id="profile-max-age"
              type="range"
              min={18}
              max={100}
              value={maxAge}
              onChange={e => setMaxAge(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </div>
        </div>

        <div className="input-group">
          <label htmlFor="profile-gender-pref">Mostrar-me</label>
          <select
            id="profile-gender-pref"
            value={genderPreference}
            onChange={e => setGenderPreference(e.target.value)}
          >
            <option value="Todos">Todos</option>
            <option value="M">Homens</option>
            <option value="F">Mulheres</option>
            <option value="O">Outros</option>
          </select>
        </div>

        <span className="profile-section-title">Interesses</span>

        <div className="interests-container">
          {interests.map(interest => (
            <div key={interest} className="interest-chip">
              {interest}
              <button onClick={() => removeInterest(interest)} title="Remover">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>

        {interests.length < 8 && (
          <div className="add-interest-input">
            <input
              type="text"
              value={newInterest}
              onChange={e => setNewInterest(e.target.value)}
              onKeyDown={handleInterestKeyDown}
              placeholder="Adicionar interesse"
              maxLength={20}
            />
            <button className="add-interest-btn" onClick={addInterest}>
              Adicionar
            </button>
          </div>
        )}

        <button className="save-btn" onClick={handleSave} disabled={saving}>
          {saving ? <span className="btn-loader" /> : 'Salvar Alteracoes'}
        </button>
      </div>

      {/* Preview Modal */}
      {previewOpen && (
        <div className="preview-modal-overlay" onClick={() => setPreviewOpen(false)}>
          <div className="preview-modal-content" onClick={e => e.stopPropagation()}>
            <button className="preview-close" onClick={() => setPreviewOpen(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <div className="match-card preview-card">
              <div className="card-image-container">
                {getProfileImage() ? (
                  <img src={getProfileImage()} alt={name} className="card-image" />
                ) : (
                  <div className="card-image-placeholder">{name.charAt(0)}</div>
                )}
                <div className="card-info-overlay">
                  <h2>{name}, {age} {user?.verified && <span className="verified-badge">✓</span>}</h2>
                  {relationshipIntent && <div className="card-intent">🎯 {relationshipIntent}</div>}
                </div>
              </div>
              <div className="card-details">
                {bio && <p className="card-bio">{bio}</p>}
                
                <div className="card-badges">
                  {height && <span className="info-badge">📏 {height} cm</span>}
                  {zodiacSign && <span className="info-badge">✨ {zodiacSign}</span>}
                  {mbti && <span className="info-badge">🧠 {mbti}</span>}
                </div>

                {interests.length > 0 && (
                  <div className="card-interests">
                    {interests.map(i => <span key={i} className="interest-tag">{i}</span>)}
                  </div>
                )}

                {(instagram || spotify) && (
                  <div className="card-socials">
                    {instagram && <div className="social-row">📸 {instagram}</div>}
                    {spotify && <div className="social-row">🎵 {spotify}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
